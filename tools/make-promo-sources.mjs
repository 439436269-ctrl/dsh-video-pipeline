#!/usr/bin/env node
/**
 * 由 `docs/promo/` 的两份推文草稿生成「可直接发布」的单源文件。
 *
 *   node tools/make-promo-sources.mjs
 *
 * 按 skill `zhihu-wechatmp-promo` 的约定：文案单源，先改文件再发布，禁止口头文案直接发。
 * 草稿（`*-article.md`）是给人读的，保留表格与代码块；发布源是喂给发布引擎的，
 * 而引擎的 Markdown 转换器**只认** h1-h3 / `- ` 列表 / `>` 引用 / `---` / 加粗 / 链接 / 图片
 * （2026-10-12 实读 `zhihu-article-upload/scripts/paste-content.cjs` 的 `md2html`），
 * 表格与 ``` 围栏会原样变成字面文本——线上表现就是「表格散成一行行竖线、代码块露出 ```」。
 *
 * 所以这里把草稿机械地转成引擎认的等价形式：
 *   | a | b | 表格   →  - **a**：b        （首列加粗，已含强调时不重复加）
 *   ``` 围栏代码块      →  > 逐行引用
 *   1. 有序列表         →  - 无序列表
 *   `行内代码`          →  **加粗**（转换器不认反引号，会露出反引号）
 *
 * 文案有改动 → 改草稿 → 重跑本脚本 → 再走对应平台的发布。
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'promo');

/** 行内代码转加粗（转换器不认反引号）。 */
function inlineCodeToBold(line) {
  return line.replace(/`([^`]+)`/g, (match, inner) => (inner.includes('**') ? inner : `**${inner}**`));
}

/**
 * 表格块转列表。输入是连续的 `|` 行（含表头与分隔行）。
 * @param {string[]} block - 表格块的行。
 * @returns {string[]} 列表行。
 */
function tableToLines(block) {
  const cells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
  const rows = block.filter((line) => !/^\|[\s:|-]+\|$/.test(line)).map(cells);
  if (!rows.length) return [];
  const [header, ...body] = rows;
  const out = [];
  for (const row of body) {
    const label = row[0] ?? '';
    const bolded = /\*\*/.test(label) ? label : `**${label}**`;
    const rest = row.slice(1).filter((c) => c.length).join('；');
    out.push(rest ? `- ${bolded}：${rest}` : `- ${bolded}`);
  }
  if (!body.length) out.push(`- ${header.join('；')}`);
  return out;
}

/**
 * 把草稿转成发布安全文本。
 * @param {string} text - 草稿全文。
 * @returns {string} 发布源全文。
 */
function toPublishSource(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  let inFence = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // 平台说明行：发到平台上就是噪音
    if (/^>\s*(知乎版|公众号版)/.test(line)) continue;

    // 代码围栏 → 逐行引用
    if (/^```/.test(line)) {
      if (inFence) { out.push(''); } else { /* 开栏不产出空行 */ }
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push(line.trim() ? `> ${inlineCodeToBold(line)}` : '>');
      continue;
    }

    // 表格块 → 列表
    if (/^\|/.test(line)) {
      const block = [];
      while (i < lines.length && /^\|/.test(lines[i])) { block.push(lines[i]); i += 1; }
      i -= 1;
      out.push(...tableToLines(block).map(inlineCodeToBold));
      continue;
    }

    // 有序列表 → 无序列表（转换器不认 ol）
    if (/^\d+\.\s/.test(line)) {
      out.push(inlineCodeToBold(line.replace(/^\d+\.\s/, '- ')));
      continue;
    }

    out.push(inlineCodeToBold(line));
  }

  let text2 = out.join('\n');
  // 删掉「## 目录」整节：Markdown 锚点在知乎/公众号编辑器里全是死链
  text2 = text2.replace(/##\s*目录[\s\S]*?(?=\n##\s)/, '');
  text2 = text2.replace(/\n{3,}/g, '\n\n').trimStart();
  return text2.endsWith('\n') ? text2 : `${text2}\n`;
}

/** 发布源里不该再出现的东西。 */
const FORBIDDEN = [
  [/^\|/m, '仍残留表格行（引擎不认表格）'],
  [/^```/m, '仍残留代码围栏（引擎不认 ```）'],
  [/^\d+\.\s/m, '仍残留有序列表（引擎不认 ol）'],
  [/`[^`]+`/, '仍残留行内反引号（引擎会露出反引号）'],
  [/##\s*目录/, '仍残留目录节（锚点是死链）'],
];

const JOBS = [
  { from: 'zhihu-article.md', to: '知乎-短视频流水线.md', limit: 64 },
  { from: 'wechat-article.md', to: '公众号-短视频流水线.md', limit: 64 },
];

let problems = 0;
for (const job of JOBS) {
  const cleaned = toPublishSource(readFileSync(join(DIR, job.from), 'utf8'));
  writeFileSync(join(DIR, job.to), cleaned, 'utf8');
  const title = /^#\s+(.+)$/m.exec(cleaned)?.[1] ?? '';
  console.log(`\n${job.to}  ${cleaned.length} 字符  标题 ${title.length} 字${title.length > job.limit ? ` ❌ 超过 ${job.limit} 字上限` : ' ✅'}`);
  if (title.length > job.limit) problems += 1;
  const hits = FORBIDDEN.filter(([re]) => re.test(cleaned));
  if (hits.length) {
    for (const [, why] of hits) { console.error(`  ❌ ${why}`); problems += 1; }
  } else {
    console.log('  ✅ 无表格 / 无代码围栏 / 无有序列表 / 无反引号 / 无目录节');
  }
}

process.exit(problems ? 1 : 0);
