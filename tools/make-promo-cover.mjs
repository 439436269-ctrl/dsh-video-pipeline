#!/usr/bin/env node
/**
 * 生成公众号推文封面（900×383，2.35:1）。
 *
 *   node tools/make-promo-cover.mjs
 *
 * 为什么单独做：公众号草稿的完整性包含封面，而封面用编排图会全是看不清的小字。
 * 做法与编排图一致——写一张最小 HTML，用本机 Chrome 无头截图，保证可重复生成。
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'docs', 'promo', 'cover-wechat.png');
const W = 900;
const H = 383;
const SCALE = 2;

const CHROME = [
  join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('找不到 Chrome/Edge');
  process.exit(1);
}

const html = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden;
    font-family:'Microsoft YaHei','PingFang SC',-apple-system,sans-serif;}
  .card{width:${W}px;height:${H}px;box-sizing:border-box;padding:44px 52px;
    background:linear-gradient(135deg,#0f172a 0%,#1b2a4a 55%,#243b63 100%);color:#fff;
    display:flex;flex-direction:column;justify-content:space-between;}
  .kicker{font-size:17px;letter-spacing:3px;color:#7dd3fc;font-weight:600}
  h1{margin:14px 0 0;font-size:44px;line-height:1.24;font-weight:700}
  h1 em{font-style:normal;color:#fbbf24}
  .bottom{display:flex;align-items:flex-end;justify-content:space-between}
  .sub{font-size:19px;color:#cbd5e1;line-height:1.5}
  .repo{font-size:15px;color:#94a3b8;font-family:ui-monospace,Consolas,monospace}
  .bar{width:96px;height:5px;background:#fbbf24;border-radius:3px;margin-top:18px}
</style>
<div class="card">
  <div>
    <div class="kicker">DSH 插件 · CLAUDE CODE / CODEX SKILLS</div>
    <h1>把一条短视频流水线<br>拆成 <em>19 个 skill</em></h1>
    <div class="bar"></div>
  </div>
  <div class="bottom">
    <div class="sub">编排 + 原子能力 · 零运行时依赖<br>发布前我扫出了自己的一个真 API key</div>
    <div class="repo">github.com/439436269-ctrl</div>
  </div>
</div>`;

const stage = mkdtempSync(join(tmpdir(), 'promo-cover-'));
try {
  const htmlPath = join(stage, 'cover.html');
  writeFileSync(htmlPath, html, 'utf8');
  mkdirSync(dirname(OUT), { recursive: true });
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars',
    `--force-device-scale-factor=${SCALE}`,
    `--window-size=${W},${H}`,
    `--screenshot=${OUT}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`,
  ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000 });
  console.log(`封面：${OUT}  (${W}×${H}，${SCALE}x，${Math.round(statSync(OUT).size / 1024)} KB)`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
