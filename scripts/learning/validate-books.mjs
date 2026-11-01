import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
// directory is the site public root containing learning/manifest.json.
export async function validateLearningDirectory(directory) {
    const root = resolve(directory);
    const manifest = JSON.parse(await readFile(join(root, 'learning/manifest.json'), 'utf8'));
    assert.equal(manifest.schemaVer, 1);
    assert.equal(manifest.books.length, 3);
    const bookIds = new Set();
    let totalWords = 0, totalBytes = 0;
    for (const descriptor of manifest.books) {
        const { id, title, version, url, count, bytes, sha256, source, license } = descriptor;
        assert(['cet4', 'cet6', 'ielts'].includes(id) && !bookIds.has(id), 'Invalid book ID');
        bookIds.add(id);
        assert(/^[a-f0-9]{16}$/.test(version));
        assert.equal(url, `learning/books/${id}-${version}.json`);
        assert(Number.isInteger(count) && count > 3000 && count < 50000);
        assert(bytes > 0 && bytes < 20 * 1024 * 1024);
        assert(source === 'https://github.com/skywind3000/ECDICT' && license.includes('MIT'));
        const data = await readFile(join(root, url));
        assert.equal(data.length, bytes);
        assert.equal(createHash('sha256').update(data).digest('hex'), sha256);
        const book = JSON.parse(data);
        assert.equal(book.id, id);
        assert.equal(book.version, version);
        assert.equal(book.title, title);
        assert.equal(book.words.length, count);
        const seen = new Set();
        for (const word of book.words) {
            assert(typeof word.headword === 'string' && word.headword === word.headword.normalize('NFC').trim().toLowerCase() && !seen.has(word.headword));
            seen.add(word.headword);
            assert(Array.isArray(word.translations_zh) && word.translations_zh.length > 0 && word.translations_zh.every(s => typeof s === 'string' && s.trim() && !s.includes('\\n')));
            assert(Array.isArray(word.pos) && Array.isArray(word.definitions_en));
            if (word.examples !== undefined) assert(Array.isArray(word.examples) && word.examples.length <= 2 && word.examples.every(e=>typeof e.en==='string' && e.en.trim() && (e.zh===undefined || typeof e.zh==='string') && (e.sourceId===undefined || typeof e.sourceId==='string')));
        }
        totalWords += count;
        totalBytes += bytes;
    }
    return { books: bookIds.size, totalWords, totalBytes };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
    console.log(JSON.stringify(await validateLearningDirectory(process.argv[2] ?? 'apps/web/public')));
