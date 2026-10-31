import { createHash } from 'node:crypto';

export function normalizeParagraph(paragraph) {
  return paragraph.replace(/\s+/g, ' ').trim().normalize('NFC');
}

export function articleContentVersion(articleId, paragraphs) {
  return createHash('sha256').update(JSON.stringify({ schemaVer: 2, articleId, paragraphs: paragraphs.map(normalizeParagraph) }), 'utf8').digest('hex');
}

export function compatibleReadingBody(expected, existing) {
  try {
    const a = JSON.parse(expected), b = JSON.parse(existing);
    return a.articleId === b.articleId && a.contentVersion === b.contentVersion &&
      a.license === b.license && a.credit === b.credit && Array.isArray(b.paragraphs) &&
      articleContentVersion(a.articleId, a.paragraphs) === a.contentVersion &&
      articleContentVersion(b.articleId, b.paragraphs) === a.contentVersion;
  } catch { return false; }
}

export function reconcileBodyMetadata(catalogV2, content) {
  const body = JSON.parse(content), catalog = JSON.parse(catalogV2);
  const article = catalog.articles.find((item) => item.id === body.articleId && item.latestContentVersion === body.contentVersion);
  if (!article) throw new Error('Reading metadata does not reference the body');
  article.bytes = Buffer.byteLength(content, 'utf8');
  article.sha256 = createHash('sha256').update(content).digest('hex');
  return `${JSON.stringify(catalog, null, 2)}\n`;
}

// This Node-only generator is shared by the pipeline, Vite and resource server.
export function buildPublishedArtifacts(catalog) {
  const metadata = [], bodies = [];
  for (const article of catalog.articles ?? []) {
    if (!/^[\w.-]+$/.test(article.id)) throw new Error('Invalid reading article id');
    const { paragraphs, ...rest } = article;
    const meta = { ...rest };
    if (paragraphs?.length) {
      // Normalization is also used in the version hash: equivalent content must
      // produce exactly the same immutable file, regardless of publication time.
      const normalized = paragraphs.map(normalizeParagraph);
      const contentVersion = articleContentVersion(article.id, normalized);
      const body = { schemaVer: 2, articleId: article.id, contentVersion, paragraphs: normalized,
        license: article.license, credit: article.credit,
        bytes: normalized.reduce((sum, paragraph) => sum + Buffer.byteLength(paragraph, 'utf8'), 0) };
      const content = `${JSON.stringify(body)}\n`;
      Object.assign(meta, { paragraphCount: normalized.length, latestContentVersion: contentVersion,
        bytes: Buffer.byteLength(content, 'utf8'), sha256: createHash('sha256').update(content).digest('hex') });
      bodies.push({ path: `articles/${article.id}/${contentVersion}.json`, content });
    }
    metadata.push(meta);
  }
  return { catalogV2: `${JSON.stringify({ schemaVer: 2, generatedAt: catalog.generatedAt,
    checkedAt: catalog.checkedAt, warnings: catalog.warnings ?? [], articles: metadata }, null, 2)}\n`, bodies };
}
