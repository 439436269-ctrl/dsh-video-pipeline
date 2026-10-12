#!/usr/bin/env node
/**
 * Repo-metadata lint.
 *
 *   node tools/verify-repo-metadata.mjs
 *
 * The market entry (`publish/market-entry.yml`) and `screenshots.json` are read
 * by the awesome-dsh-plugin site, not by the plugin. A malformed entry is
 * bounced by their CI, and a wrong screenshot path shows up as a 404 on the
 * storefront — both are silent from inside this repo. This is the check that
 * makes them loud locally and in CI.
 *
 * It deliberately does not parse YAML: this package has no dependencies (that
 * is one of its selling points) and a YAML library would have to be added just
 * for CI. So it lints the structural rules that actually get submissions
 * rejected, and says so rather than pretending to be a parser.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const problems = [];
const ok = (m) => console.log(`  ✅ ${m}`);
const bad = (m) => { console.log(`  ❌ ${m}`); problems.push(m); };
const info = (m) => console.log(`  ·  ${m}`);

// 来自 awesome-dsh-plugin 的 contributing 指南
const CATEGORIES = new Set(['agi', 'ui', 'usage', 'theme', 'model', 'identity', 'session', 'memory', 'tools', 'wsl', 'browser', 'vision', 'voice', 'docs', 'skill', 'workflow', 'git', 'notify', 'dev', 'security', 'remote', 'market', 'fun']);

const ownerRepo = (pkg.repository?.url ?? '').match(/github\.com[/:]([^/]+)\/([^/.]+)/);
const [owner, repo] = ownerRepo ? [ownerRepo[1], ownerRepo[2]] : [undefined, undefined];

console.log('\n一、市场条目 publish/market-entry.yml');
const entryPath = join(ROOT, 'publish', 'market-entry.yml');
if (!existsSync(entryPath)) {
  bad('缺少 publish/market-entry.yml');
} else {
  const text = readFileSync(entryPath, 'utf8');
  const lines = text.split(/\r?\n/);
  const value = (key) => {
    const match = text.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : undefined;
  };

  const url = value('url');
  const name = value('name');
  const category = value('category');

  if (url === `https://github.com/${owner}/${repo}`) ok(`url 与 package.json 的仓库一致：${url}`);
  else bad(`url 必须是 https://github.com/${owner}/${repo}，实际是 ${url}`);
  if (/[\u4e00-\u9fff]/.test(url ?? '')) bad('url 含中文');
  if (name === `${owner}/${repo}`) ok(`name 为 owner/repo：${name}`);
  else bad(`name 应为 ${owner}/${repo}，实际是 ${name}`);
  if (name && /[\u4e00-\u9fff]/.test(name)) bad('name 含中文（topic/条目名只允许 ASCII）');
  if (CATEGORIES.has(category)) ok(`category 合法：${category}`);
  else bad(`category "${category}" 不在市场取值表内`);

  // 条目文件名必须与仓库对应，否则 CI 找不到
  const expectedFile = `${owner}__${repo}.yml`;
  info(`条目落点名应为 data/plugins/${expectedFile}（本文件是待提交的内容副本）`);

  if (/^\s*npm:/m.test(text)) bad('条目里不应出现 npm: 键（市场会拒绝手写映射）');

  const enMatch = text.match(/^\s{2}en:\s*(.*)$/m);
  const beforeDesc = problems.length;
  if (!enMatch) {
    bad('缺少 description.en（市场唯一必填描述）');
  } else {
    const raw = enMatch[1].trim();
    const quoted = /^(['"]).*\1$/.test(raw);
    const body = quoted ? raw.slice(1, -1) : raw;
    if (!body) bad('description.en 为空');
    if (!/\.$/.test(body.trim())) bad('description.en 未以句号结尾');
    if (/: /.test(body) && !quoted) bad('description.en 含「冒号+空格」却没加引号（YAML 会解析失败）');
    if (body.length > 400) info(`description.en 偏长（${body.length} 字符），市场只要求一行`);
    if (problems.length === beforeDesc) {
      ok(`description.en 结构合法（${body.length} 字符，引号=${quoted ? '有' : '无'}，以句号结尾）`);
    }
  }
  if (!/^\s{2}zh:/m.test(text)) info('没有 description.zh —— 可选，维护者会补');

  // 单引号包裹时，把 '' 还原后再数冒号，避免误报
  const enBody = enMatch ? enMatch[1].trim().replace(/^(['"])(.*)\1$/, '$2').replace(/''/g, "'") : '';
  for (const line of lines) {
    if (/^\s*(en|zh):\s+/.test(line) && /: /.test(line.replace(/^[^:]*:\s*/, '')) && !/^\s*(en|zh):\s*(['"])/.test(line)) {
      bad(`描述行含「冒号+空格」但未加引号：${line.trim().slice(0, 60)}`);
    }
  }
  if (enBody) ok('描述内容已按「冒号必须加引号」规则检查');
}

console.log('\n二、screenshots.json');
const shotsPath = join(ROOT, 'screenshots.json');
if (!existsSync(shotsPath)) {
  info('没有 screenshots.json —— 可选，市场会从 README 抽图');
} else {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(shotsPath, 'utf8'));
  } catch (error) {
    bad(`screenshots.json 不是合法 JSON：${error.message}`);
    parsed = undefined;
  }
  if (parsed) {
    const list = Array.isArray(parsed) ? parsed : parsed.screenshots;
    if (!Array.isArray(list)) bad('screenshots.json 里没有数组（或 {"screenshots": [...]}）');
    else {
      if (list.length < 1 || list.length > 8) bad(`条目数 ${list.length} 不在 1-8 之间`);
      else ok(`条目数 ${list.length}（市场要求 1-8）`);
      for (const entry of list) {
        if (typeof entry !== 'string') { bad(`条目不是字符串：${JSON.stringify(entry)}`); continue; }
        if (/^https?:/.test(entry)) {
          if (/^https:\/\/(raw\.githubusercontent\.com|github\.com|user-images\.githubusercontent\.com|camo\.githubusercontent\.com)\//.test(entry)) ok(`绝对地址来自 GitHub 托管：${entry}`);
          else bad(`绝对地址必须是 GitHub 托管的 https：${entry}`);
          continue;
        }
        if (entry.startsWith('/')) { bad(`相对路径不能以 / 开头：${entry}`); continue; }
        if (entry.split('/').includes('..')) { bad(`相对路径不能跳出插件目录：${entry}`); continue; }
        if (!existsSync(join(ROOT, entry))) { bad(`文件不存在：${entry}`); continue; }
        ok(`相对路径存在：${entry}`);
      }
    }
  }
}

console.log('\n三、README 里的图能不能取到');
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const urls = [...readme.matchAll(/!\[[^\]]*\]\((https:\/\/raw\.githubusercontent\.com\/[^)]+)\)/g)].map((m) => m[1]);
if (!urls.length) info('README 里没有 raw 绝对地址的图');
for (const url of urls) {
  const marker = `/${owner}/${repo}/`;
  if (!url.includes(marker)) { bad(`图地址不指向本仓库 ${marker}：${url}`); continue; }
  const rest = url.slice(url.indexOf(marker) + marker.length);
  const [branch, ...segments] = rest.split('/');
  if (branch !== 'main') info(`图地址钉在分支 ${branch}（默认分支若不是 ${branch} 会 404）`);
  const relative = segments.join('/');
  if (existsSync(join(ROOT, relative))) ok(`图文件在仓库里：${relative}`);
  else bad(`图地址指向 ${relative}，但仓库里没有这个文件（raw 链接会 404）`);
}

console.log(`\n${problems.length ? `仓库元数据检查未通过：${problems.length} 个问题` : '仓库元数据检查通过'}`);
process.exit(problems.length ? 1 : 0);
