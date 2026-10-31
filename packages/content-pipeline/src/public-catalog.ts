import { readFile } from 'node:fs/promises';
import initSqlJs from 'sql.js';
import { updateCatalog, fetchText, type TextFetcher } from './update';
import { NASA_FEED, parseNasaFeed } from './nasa';
import { fetchNovel, NOVEL_LICENSE } from './novels';
import { classifyArticle } from './classify';
import type { ImportedArticle } from './voa';

export async function updatePublicCatalog(output: string, lexiconPath: string, fetcher: TextFetcher = fetchText) {
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(await readFile(lexiconPath)));
  let words: Map<string, string[]>;
  let forms: Map<string, string>;
  try {
    words = new Map(db.exec('SELECT headword, level FROM entries')[0].values.map((row) =>
      [String(row[0]), String(row[1] ?? '').split(/\s+/)]));
    forms = new Map(db.exec('SELECT form, headword FROM word_forms')[0].values.map((row) => [String(row[0]), String(row[1])]));
  } finally { db.close(); }
  const results = await Promise.allSettled([
    fetcher(NASA_FEED).then((xml) => { const articles = parseNasaFeed(xml); if (!articles.length) throw new Error('NASA 没有合格英文正文'); return articles; }),
    fetchNovel(fetcher),
  ]);
  const extraArticles: ImportedArticle[] = [];
  const warnings: string[] = [];
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') extraArticles.push(...result.value);
    else warnings.push(`${index === 0 ? 'NASA' : 'Standard Ebooks'}: ${String(result.reason)}`);
  });
  return updateCatalog(output, fetcher, undefined, {
    extraArticles, extraSources: [NASA_FEED, NOVEL_LICENSE], warnings,
    enrich: (article) => ({ ...article, ...classifyArticle({ ...article, genre: article.genre ?? (/grammar|words?|pronoun|verb|adjective|jeopardy/i.test(article.title) ? 'language' : 'news') }, words, forms) }),
  });
}
