import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { articleContentVersion } from './reading-artifacts.mjs';

export async function validateGithubResources(siteDirectory) {
  const root = resolve(siteDirectory);
  const json = async (path) => JSON.parse((await readFile(join(root, path), 'utf8')).replace(/^\uFEFF/, ''));
  const verify = async (path, bytes, sha256) => {
    const body = await readFile(join(root, path));
    assert.equal(body.length, bytes, `Invalid bytes: ${path}`);
    assert.equal(createHash('sha256').update(body).digest('hex'), sha256, `Invalid sha256: ${path}`);
    return body;
  };
  const manifest = await json('lexicon/manifest.json');
  assert.equal(manifest.schemaVer, 1);
  assert(manifest.shards.some((shard) => shard.id === 'core'));
  for (const shard of manifest.shards) {
    assert(/^lexicon-[\w#.-]+\.db$/.test(shard.file) && !/e2e/i.test(shard.file), 'Unsafe lexicon file');
    await verify(`lexicon/${shard.file}`, shard.size, shard.sha256);
  }
  const version = await json('app/version.json');
  assert(/^https:\/\//.test(version.url), 'APK URL must be absolute HTTPS');
  await verify('download/easily-learning.apk', version.bytes, version.sha256);
  const catalog = await json('reading/catalog-v2.json');
  assert.equal(catalog.schemaVer, 2);
  for (const article of catalog.articles) {
    assert(!Object.hasOwn(article, 'paragraphs'), 'Metadata contains full paragraphs');
    if (!article.latestContentVersion) continue;
    assert(/^[\w.-]+$/.test(article.id) && /^[a-f0-9]{64}$/.test(article.latestContentVersion), 'Unsafe reading body path');
    const path = `reading/articles/${article.id}/${article.latestContentVersion}.json`;
    await verify(path, article.bytes, article.sha256);
  }
  let bodies = 0;
  for (const entry of await readdir(join(root, 'reading/articles'), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const body = JSON.parse(await readFile(join(entry.parentPath ?? entry.path, entry.name), 'utf8'));
    assert.equal(body.contentVersion, articleContentVersion(body.articleId, body.paragraphs), 'Historical body hash mismatch');
    assert.equal(entry.name, `${body.contentVersion}.json`, 'Historical body filename mismatch');
    bodies++;
  }
  return { shards: manifest.shards.length, articles: catalog.articles.length, bodies, apkBytes: version.bytes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await validateGithubResources(process.argv[2] ?? 'apps/web/public')));
}
