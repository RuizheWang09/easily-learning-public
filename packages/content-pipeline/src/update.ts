import { randomUUID } from 'node:crypto';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { parseArticle, parseFeed, normalizeArticleUrl, VOA_FEEDS, type ImportedArticle } from './voa';
import { NASA_FEED } from './nasa';
import { NOVEL_ROOT } from './novels';

export interface ArticleCatalog {
  generatedAt: string;
  sources: string[];
  articles: ImportedArticle[];
  checkedAt?: string;
  warnings?: string[];
}

export type TextFetcher = (url: string) => Promise<string>;

export async function fetchText(url: string): Promise<string> {
  const requested = new URL(url);
  const voa = requested.hostname === 'learningenglish.voanews.com' && (requested.pathname.startsWith('/api/') || normalizeArticleUrl(url));
  const novel = url === `${NOVEL_ROOT}LICENSE.md` || (url.startsWith(`${NOVEL_ROOT}src/epub/text/`) && /\/chapter-(?:[1-9]|1[0-2])\.xhtml$/.test(url));
  if (requested.protocol !== 'https:' || requested.username || requested.password || requested.port || !(voa || novel || url === NASA_FEED)) {
    throw new Error(`不允许的内容地址: ${url}`);
  }
  const response = await fetch(url, {
    headers: { 'User-Agent': 'EasilyLearningContentBuilder/1.0 (educational text import)' },
    signal: AbortSignal.timeout(20_000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error(`获取失败 ${response.status}: ${url}`);
  const redirected = new URL(response.url);
  if (redirected.protocol !== 'https:' || redirected.hostname !== requested.hostname) {
    throw new Error(`内容域名不匹配: ${response.url}`);
  }
  const expectedArticle = normalizeArticleUrl(url);
  if (expectedArticle && normalizeArticleUrl(response.url)?.id !== expectedArticle.id) {
    throw new Error(`文章重定向目标不匹配: ${response.url}`);
  }
  if (voa && !expectedArticle && !redirected.pathname.startsWith('/api/')) {
    throw new Error(`RSS 重定向目标不匹配: ${response.url}`);
  }
  const body = await response.text();
  if (body.length > 12_000_000) throw new Error('内容超过大小限制');
  return body;
}

async function readCatalog(path: string): Promise<ArticleCatalog | null> {
  try {
    const catalog = JSON.parse(await readFile(path, 'utf8')) as ArticleCatalog;
    if (!Array.isArray(catalog.articles) || !Array.isArray(catalog.sources)) throw new Error('文章快照格式无效');
    return catalog;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function updateCatalog(
  outputPath: string,
  fetcher: TextFetcher = fetchText,
  feeds: readonly string[] = VOA_FEEDS,
  options: { extraArticles?: ImportedArticle[]; extraSources?: string[]; warnings?: string[]; enrich?: (article: ImportedArticle) => ImportedArticle } = {},
): Promise<{ changed: boolean; count: number; accepted: number; skipped: number; warnings: string[] }> {
  const feedSources = [...new Set(feeds)];
  const sources = [...new Set([...feedSources, ...options.extraSources ?? []])];
  const warnings = [...options.warnings ?? []];
  const results = await Promise.allSettled(feedSources.map((source) => fetcher(source)));
  const feedXml: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') feedXml.push(result.value);
    else warnings.push(`${feedSources[index]}: ${String(result.reason instanceof Error ? result.reason.message : result.reason)}`);
  });
  if (!feedXml.length && !options.extraArticles?.length) throw new Error(`没有合格文章，原有快照已保留: ${warnings.join('; ')}`);
  const candidates = [...new Map(feedXml.flatMap(parseFeed).map((item) => [item.url, item])).values()]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const accepted: ImportedArticle[] = [];
  let skipped = 0;
  for (const item of candidates.slice(0, 48)) {
    if (accepted.length >= 12) break;
    try {
      const article = parseArticle(await fetcher(item.url), item);
      if (article) accepted.push(article);
      else skipped++;
    } catch {
      skipped++;
    }
  }
  accepted.push(...options.extraArticles ?? []);
  if (accepted.length === 0) throw new Error('没有合格文章，原有快照已保留');

  const previous = await readCatalog(outputPath);
  const byId = new Map(previous?.articles.map((article) => [article.id, article]) ?? []);
  for (const article of accepted) {
    const previousArticle = byId.get(article.id);
    byId.set(article.id, { ...article, paragraphs: previousArticle?.paragraphs ?? article.paragraphs });
  }
  const merged = [...byId.values()].map((article) => options.enrich?.(article) ?? article);
  const newest = (a: ImportedArticle, b: ImportedArticle) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id);
  // 来源有独立配额，经典小说保留章节顺序，不被新新闻挤掉。
  const articles = [
    ...merged.filter((a) => a.id.startsWith('voa-')).sort(newest).slice(0, 60),
    ...merged.filter((a) => a.id.startsWith('nasa-')).sort(newest).slice(0, 60),
    ...merged.filter((a) => a.genre === 'fiction').sort((a, b) => (a.bookTitle ?? '').localeCompare(b.bookTitle ?? '') || (a.chapter ?? 0) - (b.chapter ?? 0)).slice(0, 120),
  ];
  const checkedAt = new Date().toISOString().slice(0, 10);
  const changed = JSON.stringify(articles) !== JSON.stringify(previous?.articles)
    || JSON.stringify(sources) !== JSON.stringify(previous?.sources)
    || checkedAt !== previous?.checkedAt || JSON.stringify(warnings) !== JSON.stringify(previous?.warnings);
  if (!changed) return { changed: false, count: articles.length, accepted: accepted.length, skipped, warnings };

  const catalog: ArticleCatalog = { generatedAt: new Date().toISOString(), checkedAt, sources, articles, warnings };
  const tempPath = `${outputPath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(tempPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
    await rename(tempPath, outputPath);
  } catch (error) {
    await unlink(tempPath).catch(() => {});
    throw error;
  }
  return { changed: true, count: articles.length, accepted: accepted.length, skipped, warnings };
}
