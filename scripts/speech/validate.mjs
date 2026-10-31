import assert from 'node:assert/strict';
import { readFile, readdir, lstat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
export async function validateSpeechDirectory(directory, expected) {
 const m=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
 assert(m.schemaVer===1 && m.engine==='kokoro-onnx');
 assert(/^[\w-]+$/.test(m.articleId) && /^[a-f0-9]{64}$/.test(m.contentVersion));
 if(expected) assert(m.articleId===expected.articleId && m.contentVersion===expected.contentVersion);
 assert(m.voices?.length===2);
 assert(m.voices[0].segments.length===m.voices[1].segments.length);
 for(const [id,accent] of [['af_heart','us'],['bf_emma','uk']]) {
  const v=m.voices.find(v=>v.id===id); assert(v?.accent===accent && typeof v.label==='string');
  assert(v.segments.length>0 && (!expected || v.segments.length===expected.paragraphs.length));
  for(const [i,s] of v.segments.entries()) {
   assert(s.index===i && s.path===`${id}/${String(i).padStart(4,'0')}.mp3`);
   const file=join(directory,s.path); assert(!(await lstat(file)).isSymbolicLink());
   const data=await readFile(file); assert(data.length>0 && data.length===s.bytes);
   assert(createHash('sha256').update(data).digest('hex')===s.sha256);
  }
 }
 return m;
}
export async function speechManifests(root) {
 try { return (await readdir(root,{recursive:true})).filter(p=>p.replaceAll('\\','/').endsWith('/manifest.json')).map(p=>join(root,p)); }
 catch(e) {if(e.code==='ENOENT') return [];throw e;}
}
