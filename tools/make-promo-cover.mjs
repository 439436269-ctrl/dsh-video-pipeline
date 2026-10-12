#!/usr/bin/env node
/**
 * 生成公众号推文封面（900×383，2.35:1）：标题 + 简化编排流程条。
 *
 *   node tools/make-promo-cover.mjs
 *
 * 设计取舍：整张 `docs/skill-flow.png` 缩到封面尺寸会全是看不清的小字，所以封面不复用那张图，
 * 而是画一条**简化流程条**（选题 → 编排 → 配音 → 画面 → 合成 → 核验 → 发布），
 * 把「这是条什么流水线」一眼交代掉；完整关系图仍放正文。
 *
 * 输出用 -v2 文件名：公众号素材库按**文件名**命中同名图会直接秒选旧图
 * （skill 记载的「同名匹配导致误用旧图」事故），换名才能确保用上新封面。
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'docs', 'promo', 'cover-wechat-v2.png');
const W = 900;
const H = 383;
const SCALE = 2;

/** 简化流程条：label 为显示文本，tone 决定配色。 */
const FLOW = [
  { label: '选题', tone: 'plain' },
  { label: '编排', tone: 'accent' },
  { label: '配音', tone: 'plain' },
  { label: '画面', tone: 'plain' },
  { label: '合成', tone: 'plain' },
  { label: '核验', tone: 'gate' },
  { label: '发布', tone: 'cyan' },
];

const CHROME = [
  join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('找不到 Chrome/Edge');
  process.exit(1);
}

const pills = FLOW.map((node, index) => {
  const tone = {
    plain: 'border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);color:#e2e8f0',
    accent: 'border:1px solid rgba(251,191,36,.75);background:rgba(251,191,36,.14);color:#fbbf24;font-weight:700',
    gate: 'border:1px solid rgba(251,146,60,.75);background:rgba(251,146,60,.14);color:#fdba74;font-weight:700',
    cyan: 'border:1px solid rgba(125,211,252,.7);background:rgba(125,211,252,.13);color:#7dd3fc;font-weight:700',
  }[node.tone];
  const arrow = index < FLOW.length - 1 ? '<div class="arrow">▶</div>' : '';
  return `<div class="pill" style="${tone}">${node.label}</div>${arrow}`;
}).join('');

const html = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden;
    font-family:'Microsoft YaHei','PingFang SC',-apple-system,sans-serif;}
  .card{width:${W}px;height:${H}px;box-sizing:border-box;padding:30px 34px 24px;
    background:linear-gradient(135deg,#0f172a 0%,#1b2a4a 55%,#243b63 100%);color:#fff;
    display:flex;flex-direction:column;justify-content:space-between;}
  .kicker{font-size:15px;letter-spacing:2.6px;color:#7dd3fc;font-weight:600}
  h1{margin:11px 0 0;font-size:36px;line-height:1.22;font-weight:700}
  h1 em{font-style:normal;color:#fbbf24}
  .bar{width:84px;height:4px;background:#fbbf24;border-radius:2px;margin-top:13px}
  .flowLabel{font-size:13px;letter-spacing:1.6px;color:#94a3b8;margin-bottom:11px}
  /* 用 flex:1 等分容器宽度：手算总宽极易溢出（上一版就把最后一个胶囊切掉了），等分则由容器决定，不可能溢出 */
  .flow{display:flex;align-items:center;width:100%}
  .pill{flex:1 1 0;min-width:0;height:47px;border-radius:10px;display:flex;align-items:center;
    justify-content:center;font-size:17px;letter-spacing:.5px;white-space:nowrap}
  .arrow{flex:0 0 auto;color:#475569;font-size:12px;padding:0 7px}
  .bottom{display:flex;align-items:flex-end;justify-content:space-between;margin-top:16px}
  .sub{font-size:16px;color:#cbd5e1;line-height:1.45}
  .repo{font-size:14px;color:#94a3b8}
  .loop{font-size:13.5px;color:#fdba74;margin-top:8px}
</style>
<div class="card">
  <div>
    <div class="kicker">DSH 插件 · CLAUDE CODE / CODEX SKILLS</div>
    <h1>把一条短视频流水线拆成 <em>19 个 skill</em></h1>
    <div class="bar"></div>
  </div>
  <div>
    <div class="flowLabel">编排流程</div>
    <div class="flow">${pills}</div>
    <div class="loop">↺ 数据复盘回写选片权重，闭环回到编排</div>
  </div>
  <div class="bottom">
    <div class="sub">编排 + 原子能力 · 零运行时依赖</div>
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
  console.log(`流程条：${FLOW.map((n) => n.label).join(' → ')}`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
