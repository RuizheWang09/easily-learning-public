import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { updatePublicCatalog } from './public-catalog';
import { publishReadingAssets } from './publish';

const defaultOutput = fileURLToPath(new URL('../../../apps/web/src/reading/reading-catalog.json', import.meta.url));
const defaultCatalogV2 = fileURLToPath(new URL('../../../apps/web/public/reading/catalog-v2.json', import.meta.url));
const defaultBodies = fileURLToPath(new URL('../../../apps/web/public/reading/articles', import.meta.url));
const lexicon = fileURLToPath(new URL('../../../apps/web/public/lexicon/lexicon-core.db', import.meta.url));
const outFlag = process.argv.indexOf('--out');
const output = outFlag >= 0 && process.argv[outFlag + 1] ? resolve(process.argv[outFlag + 1]) : defaultOutput;

let running = false;
async function update(daily = false) {
  if (running) return;
  running = true;
  try {
    if (daily) {
      const previous = JSON.parse(await readFile(output, 'utf8').catch(() => '{}')) as { checkedAt?: string; warnings?: string[] };
      if (previous.checkedAt === new Date().toISOString().slice(0, 10) && !previous.warnings?.length) return;
    }
    const result = await updatePublicCatalog(output, lexicon);
    // 双版本发布：v1 完整目录保留给旧客户端，v2 纯元数据 + 不可变正文文件供新客户端按需读取（方案 §11）。
    const published = await publishReadingAssets(output, { catalogV2Path: defaultCatalogV2, bodiesDir: defaultBodies });
    process.stdout.write(`公开阅读：${result.count} 篇，合格 ${result.accepted}，跳过 ${result.skipped}，${result.changed ? '目录已更新' : '目录无变化'}；v2 元数据 ${published.articles} 篇、正文 ${published.bodies} 个\n`);
    for (const warning of result.warnings) process.stderr.write(`来源提示：${warning}\n`);
  } catch (error) {
    process.stderr.write(`公开阅读更新失败，保留原有目录：${(error as Error).message}\n`);
    if (!process.argv.includes('--watch')) process.exitCode = 1;
  } finally { running = false; }
}

await update(process.argv.includes('--watch'));
if (process.argv.includes('--watch')) {
  process.stdout.write('每日检索进程已启动：每小时检查 UTC 日期，失败下次重试；关闭进程后停止。\n');
  const timer = setInterval(() => { void update(true); }, 60 * 60 * 1000);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { clearInterval(timer); process.exit(); });
}
