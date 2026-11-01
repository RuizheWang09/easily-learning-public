import assert from 'node:assert/strict';
export const WORD_MODEL={schemaVer:1,id:'kokoro-v2',url:'https://github.com/RuizheWang09/easily-learning-public/releases/download/word-voice-v2/kokoro-v2.zip',bytes:140497447,sha256:'7aefba453808fd595b5c1b1f0acd73b3e09a4a9971ba5aa6d4e0e7195ac9a6d0',unpackedBytes:232925488};
export function validateWordModelManifest(value){for(const [key,expected] of Object.entries(WORD_MODEL))assert.equal(value?.[key],expected,`Unapproved word model ${key}`);return value;}
