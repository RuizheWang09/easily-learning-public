import { load } from 'cheerio';

export const VOA_PERMISSION_URL = 'https://learningenglish.voanews.com/p/6861.html';
export const VOA_FEEDS = [
  'https://learningenglish.voanews.com/api/zmg_pl-vomx-tpeymtm', // Science & Technology
  'https://learningenglish.voanews.com/api/zbmroml-vomx-tpeqboo_', // All About America
  'https://learningenglish.voanews.com/api/zoroqql-vomx-tpeptpqq', // Everyday Grammar
] as const;

export interface FeedItem {
  title: string;
  description: string;
  url: string;
  publishedAt: string;
}

export interface ImportedArticle {
  id: string;
  title: string;
  description: string;
  source: string;
  license: string;
  level: string;
  paragraphs: string[];
  publishedAt: string;
  sourceUrl: string;
  credit: string;
  genre?: 'news' | 'science' | 'language' | 'life' | 'fiction';
  goals?: ('general' | 'ielts' | 'cet4' | 'cet6')[];
  wordCount?: number;
  examVocabulary?: Record<'ielts' | 'cet4' | 'cet6', number>;
  bookTitle?: string;
  chapter?: number;
}

export function normalizeArticleUrl(raw: string): { url: string; id: string } | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'learningenglish.voanews.com'
      || url.port || url.username || url.password) return null;
    const match = /^\/a\/(?:[^/]+\/)?(\d+)\.html$/.exec(url.pathname);
    if (!match) return null;
    url.search = '';
    url.hash = '';
    return { url: url.toString(), id: `voa-${match[1]}` };
  } catch {
    return null;
  }
}

export function parseFeed(xml: string): FeedItem[] {
  const $ = load(xml, { xmlMode: true });
  const seen = new Set<string>();
  const items: FeedItem[] = [];
  $('item').each((_index, element) => {
    const title = $(element).children('title').first().text().trim();
    const description = load($(element).children('description').first().text()).text().replace(/\s+/g, ' ').trim();
    const normalized = normalizeArticleUrl($(element).children('link').first().text());
    const date = new Date($(element).children('pubDate').first().text());
    if (!title || !normalized || Number.isNaN(date.getTime()) || seen.has(normalized.id)) return;
    seen.add(normalized.id);
    items.push({ title, description, url: normalized.url, publishedAt: date.toISOString().slice(0, 10) });
  });
  return items;
}

const thirdPartyCredit = /\bAssociated Press\b|\bReuters\b|\bAFP\b|\bAgence France-Presse\b|\bAP News\b/i;
const voaCredit = /\b(?:wrote|written|prepared|adapted)\b.{0,160}\bfor (?:VOA )?Learning English\b/i;

export function parseArticle(html: string, item: FeedItem): ImportedArticle | null {
  const normalized = normalizeArticleUrl(item.url);
  if (!normalized) return null;
  const $ = load(html);
  const rawParagraphs = $('.wsw').first().children('p').toArray()
    .map((node) => $(node).text().replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (rawParagraphs.some((paragraph) => thirdPartyCredit.test(paragraph))) return null;
  const creditIndex = rawParagraphs.findIndex((paragraph) => voaCredit.test(paragraph));
  if (creditIndex < 0) return null;
  const credit = rawParagraphs[creditIndex];
  if (!/[.!?]$/.test(credit)) return null;
  const paragraphs = rawParagraphs.slice(0, creditIndex)
    .filter((paragraph) => !/^(?:I['’]m|And I['’]m|This is)\s+[\p{L} .-]+\.?$/u.test(paragraph));
  const wordCount = paragraphs.join(' ').match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)?.length ?? 0;
  if (paragraphs.length < 3 || wordCount < 120) return null;
  const firstSentence = paragraphs[0].match(/^.+?[.!?](?:\s|$)/)?.[0]?.trim() ?? paragraphs[0];
  return {
    id: normalized.id,
    title: item.title,
    description: item.description || firstSentence.slice(0, 180),
    source: 'VOA Learning English',
    license: 'VOA Learning English 公有领域文本',
    level: 'B1',
    paragraphs,
    publishedAt: item.publishedAt,
    sourceUrl: normalized.url,
    credit,
    genre: /grammar|words?|pronoun|verb|adjective|jeopardy/i.test(item.title) ? 'language' : 'news',
  };
}
