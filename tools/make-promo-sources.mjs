#!/usr/bin/env node
/**
 * 由 `docs/promo/` 的两份推文草稿生成「可直接发布」的单源文件。
 *
 *   node tools/make-promo-sources.mjs
 *
 * 按 skill `zhihu-wechatmp-promo` 的约定：文案单源，先改文件再发布，禁止口头文案直接发。
 * 草稿（`*-article.md`）是给人读的；发布源（`知乎-*.md` / `公众号-*.md`）是喂给发布引擎的，
 * 差别只有两处——引擎不需要的东西得去掉：
 *
 *   1. 「> 知乎版 / > 公众号版」这类平台说明，发到平台上就是噪音
 *   2. 「## 目录」整节：Markdown 锚点链接在知乎/公众号编辑器里全是死链
 *
 * 文案有改动 → 改草稿 → 重跑本脚本 → 再走对应平台的发布。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'promo');

/**
 * 去掉平台说明行与目录节。
 * @param {string} text - 草稿全文。
 * @returns {string} 发布源全文。
 */
function clean(text) {
  const withoutNote = text
    .split(/\r?\n/)
    .filter((line) => !/^>\s*(知乎版|公众号版)/.test(line))
    .join('\n');
  // 删掉从「## 目录」到下一个同级标题之间的内容
  const withoutToc = withoutNote.replace(/##\s*目录[\s\S]*?(?=\n##\s)/, '');
  const collapsed = withoutToc.replace(/\n{3,}/g, '\n\n').trimStart();
  return collapsed.endsWith('\n') ? collapsed : `${collapsed}\n`;
}

const JOBS = [
  { from: 'zhihu-article.md', to: '知乎-短视频流水线.md', limit: 64 },
  { from: 'wechat-article.md', to: '公众号-短视频流水线.md', limit: 64 },
];

let problems = 0;
for (const job of JOBS) {
  const cleaned = clean(readFileSync(join(DIR, job.from), 'utf8'));
  writeFileSync(join(DIR, job.to), cleaned, 'utf8');
  const title = /^#\s+(.+)$/m.exec(cleaned)?.[1] ?? '';
  const tooLong = title.length > job.limit;
  console.log(`${job.to}  ${cleaned.length} 字符  标题 ${title.length} 字${tooLong ? ` ❌ 超过 ${job.limit} 字上限` : ' ✅'}`);
  if (tooLong) problems += 1;
  if (/##\s*目录/.test(cleaned)) { console.error(`  ❌ ${job.to} 仍残留目录节`); problems += 1; }
  if (/知乎版|公众号版/.test(cleaned)) { console.error(`  ❌ ${job.to} 仍残留平台说明`); problems += 1; }
}

process.exit(problems ? 1 : 0);
