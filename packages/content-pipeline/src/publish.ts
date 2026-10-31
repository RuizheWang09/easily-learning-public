import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

import { articleContentVersion, normalizeParagraph, buildPublishedArtifacts as buildArtifacts, compatibleReadingBody, reconcileBodyMetadata } from '../../../scripts/reading-artifacts.mjs';
export { articleContentVersion, normalizeParagraph };

export interface SourceArticle {
  id: string;
  paragraphs?: string[];
  paragraphCount?: number;
  latestContentVersion?: string;
  license?: string;
  credit?: string;
  [key: string]: unknown;
}

export interface SourceCatalog {
  generatedAt: string;
  checkedAt?: string;
  warnings?: string[];
  articles?: SourceArticle[];
}

export interface PublishedArtifacts {
  // 纯元数据目录（schemaVer=2，禁止 paragraphs），供新客户端拉取。
  catalogV2: string;
  // 不可变正文文件，路径相对发布根：articles/{articleId}/{contentVersion}.json。
  bodies: { path: string; content: string }[];
}

export function buildPublishedArtifacts(catalog: SourceCatalog): PublishedArtifacts {
  return buildArtifacts(catalog);
}

async function writeAtomic(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temp, content, 'utf8');
    await rename(temp, path);
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
}

// 从完整目录写出 v2 目录与正文文件：原子写、版本路径不可变（方案 §11）。
export async function publishReadingAssets(
  catalogPath: string,
  options: { catalogV2Path: string; bodiesDir: string },
): Promise<{ articles: number; bodies: number }> {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8')) as SourceCatalog;
  const artifacts = buildPublishedArtifacts(catalog);
  for (const body of artifacts.bodies) {
    const path = resolve(options.bodiesDir, body.path.replace(/^articles\//, ''));
    await mkdir(dirname(path), { recursive: true });
    try { await writeFile(path, body.content, { encoding: 'utf8', flag: 'wx' }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const existing = await readFile(path, 'utf8');
      if (existing !== body.content) {
        if (!compatibleReadingBody(body.content, existing)) throw new Error(`Immutable reading body conflict: ${body.path}`);
        artifacts.catalogV2 = reconcileBodyMetadata(artifacts.catalogV2, existing);
      }
    }
  }
  await writeAtomic(options.catalogV2Path, artifacts.catalogV2);
  return { articles: catalog.articles?.length ?? 0, bodies: artifacts.bodies.length };
}
