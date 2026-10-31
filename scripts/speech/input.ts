import { articles } from '../../apps/web/src/reading/articles';
import { writeFile, mkdir }  from 'node:fs/promises';
import { articleContentVersion, normalizeParagraph, buildPublishedArtifacts } from '../reading-artifacts.mjs';
const ordered = [...articles.slice(0, 3), ...articles.slice(3).sort((a, b) => Number(/(?:chapter|ch)[-_]?0?1(?:$|[-_])/.test(b.id)) - Number(/(?:chapter|ch)[-_]?0?1(?:$|[-_])/.test(a.id)) || String((b as any).publishedAt ?? '').localeCompare(String((a as any).publishedAt ?? '')))];
const bodies = ordered.filter(a => a.paragraphs?.length).map(a => ({articleId:a.id, contentVersion:articleContentVersion(a.id,a.paragraphs!), paragraphs:a.paragraphs!.map(normalizeParagraph)}));
await writeFile(process.argv[2] ?? 'artifacts/speech-input.json', JSON.stringify(bodies));

// Publish the three built-in authoritative bodies so audio validation has the same version/count source.
for (const body of buildPublishedArtifacts({ articles: articles.slice(0,3) }).bodies) {
 const path = `apps/web/public/reading/${body.path}`;
 await mkdir(path.slice(0,path.lastIndexOf('/')), {recursive:true});
 try { await writeFile(path, body.content, {flag:'wx'}); } catch(e) { if ((e as any).code !== 'EEXIST') throw e; }
}
