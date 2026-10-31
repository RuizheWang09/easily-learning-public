import { copyFile } from 'node:fs/promises';
await copyFile('apps/web/src/reading/reading-catalog.json', 'apps/web/public/reading/catalog.json');
