import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import type { ImportedArticle } from './voa';

export const NASA_FEED = 'https://www.nasa.gov/news-release/feed/';
export const NASA_POLICY = 'https://www.nasa.gov/nasa-brand-center/images-and-media/';

export function parseNasaFeed(xml: string): ImportedArticle[] {
  const $ = load(xml, { xmlMode: true });
  const articles: ImportedArticle[] = [];
  $('item').each((_index, node) => {
    const item = $(node);
    const raw = item.children('link').text();
    let url: URL;
    try { url = new URL(raw); } catch { return; }
    // science.nasa.gov 的 RSS 正文含导航和不同许可的 APOD，暂不导入。
    if (url.protocol !== 'https:' || url.hostname !== 'www.nasa.gov' || url.username || url.password || url.port) return;
    if (!/^\/(news-release|missions|centers-and-facilities|technology|aeronautics)\//.test(url.pathname)) return;
    url.search = ''; url.hash = '';
    const title = item.children('title').text().trim();
    const date = new Date(item.children('pubDate').text());
    if (!title || Number.isNaN(date.getTime()) || /^(?:La NASA|El |La |Los |Las )/.test(title)) return;
    const html = load(item.children('content\\:encoded').text());
    const paragraphs = html('body > p').toArray().map((p) => html(p).text().replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 40 && !/^https?:|^For (?:more information|media)|^Media (?:contacts|inquiries)/i.test(p));
    if (paragraphs.some((p) => /\bcopyright\b|\bReuters\b|\bAssociated Press\b|\bused (?:with|by) permission\b/i.test(p))) return;
    const wordCount = paragraphs.join(' ').match(/[A-Za-z]+/g)?.length ?? 0;
    if (paragraphs.length < 3 || wordCount < 120) return;
    const englishWords = paragraphs.join(' ').match(/\b(?:the|and|of|to|is|are|was|were|with|will|from|has|have|for)\b/gi)?.length ?? 0;
    if (englishWords / wordCount < 0.08) return;
    const sourceUrl = url.toString();
    articles.push({
      id: `nasa-${createHash('sha256').update(sourceUrl).digest('hex').slice(0, 16)}`,
      title, description: paragraphs[0].slice(0, 180), paragraphs,
      source: 'NASA', sourceUrl, publishedAt: date.toISOString().slice(0, 10),
      license: 'NASA 教育与信息用途文本', credit: 'Source: NASA. Text only; no NASA endorsement implied.',
      level: 'B2', genre: 'science',
    });
  });
  return articles.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 12);
}
