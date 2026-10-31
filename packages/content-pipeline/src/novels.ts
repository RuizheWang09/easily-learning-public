import { load } from 'cheerio';
import type { ImportedArticle } from './voa';
import type { TextFetcher } from './update';

// Lewis Carroll (1832–1898)，1865 年英文原作。只导入文本，不导入插画。
export const NOVEL_ROOT = 'https://raw.githubusercontent.com/standardebooks/lewis-carroll_alices-adventures-in-wonderland_john-tenniel/master/';
export const NOVEL_LICENSE = `${NOVEL_ROOT}LICENSE.md`;
export function parseNovelChapter(xhtml: string, chapter: number): ImportedArticle | null {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 12) return null;
  const $ = load(xhtml);
  const paragraphs = $(`#chapter-${chapter} > p`).toArray()
    .map((p) => $(p).text().replace(/[\u2060\u00ad]/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (paragraphs.length < 3 || (paragraphs.join(' ').match(/[A-Za-z]+/g)?.length ?? 0) < 120) return null;
  return {
    id: `alice-chapter-${chapter}`, title: `Alice’s Adventures in Wonderland · ${$('title').text().trim()}`,
    description: `Lewis Carroll · 第 ${chapter} 章 · 1865 年英文原作`, bookTitle: 'Alice’s Adventures in Wonderland', chapter,
    source: 'Standard Ebooks', sourceUrl: `${NOVEL_ROOT}src/epub/text/chapter-${chapter}.xhtml`,
    license: '经典公版原作；Standard Ebooks 编辑贡献 CC0', credit: 'Lewis Carroll (1832–1898). Standard Ebooks edition, text only.',
    level: 'B2', genre: 'fiction', publishedAt: '1865', paragraphs,
  };
}

export async function fetchNovel(fetcher: TextFetcher): Promise<ImportedArticle[]> {
  const license = await fetcher(NOVEL_LICENSE);
  if (!license.includes('CC0 1.0') || !license.includes('public domain')) throw new Error('小说来源许可校验失败');
  const articles: ImportedArticle[] = [];
  for (let chapter = 1; chapter <= 12; chapter++) {
    const article = parseNovelChapter(await fetcher(`${NOVEL_ROOT}src/epub/text/chapter-${chapter}.xhtml`), chapter);
    if (!article) throw new Error(`小说第 ${chapter} 章正文校验失败`);
    articles.push(article);
  }
  return articles;
}
