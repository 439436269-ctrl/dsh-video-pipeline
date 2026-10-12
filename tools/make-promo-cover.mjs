#!/usr/bin/env node
/**
 * 生成推文封面：标题 + 简化编排流程条。
 *
 *   node tools/make-promo-cover.mjs
 *
 * 两个平台各要一种比例，同一套设计按高度等比缩放（k = h / 383）：
 *   - 公众号  cover-wechat-v2.png   900×383（2.35:1）
 *   - 知乎    cover-zhihu.png      1280×720（16:9）
 * 传错比例会被平台裁掉关键内容，所以各出一版。
 *
 * 设计取舍：整张 `docs/skill-flow.png` 缩到封面尺寸会全是看不清的小字，所以封面不复用那张图，
 * 而是画一条**简化流程条**（选题 → 编排 → 配音 → 画面 → 合成 → 核验 → 发布），
 * 把「这是条什么流水线」一眼交代掉；完整关系图仍放正文。
 *
 * 公众号那份用 -v2 文件名：素材库按**文件名**命中同名图会直接秒选旧图
 * （skill 记载的「同名匹配导致误用旧图」事故），换名才能确保用上新封面。
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = join(ROOT, 'docs', 'promo');

/**
 * 两个平台各要一种比例：
 * - 公众号：2.35:1（900×383），传 16:9 会被裁
 * - 知乎文章封面：16:9（1280×720），传 2.35:1 会被裁
 * 同一套设计按高度等比缩放，避免两版视觉不一致。
 */
const VARIANTS = [
  { file: 'cover-wechat-v2.png', w: 900, h: 383 },
  { file: 'cover-zhihu.png', w: 1280, h: 720 },
];
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

const TONES = {
  plain: 'border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.07);color:#e2e8f0',
  accent: 'border:1px solid rgba(251,191,36,.75);background:rgba(251,191,36,.14);color:#fbbf24;font-weight:700',
  gate: 'border:1px solid rgba(251,146,60,.75);background:rgba(251,146,60,.14);color:#fdba74;font-weight:700',
  cyan: 'border:1px solid rgba(125,211,252,.7);background:rgba(125,211,252,.13);color:#7dd3fc;font-weight:700',
};

const CHROME = [
  join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
].find((p) => existsSync(p));
if (!CHROME) {
  console.error('找不到 Chrome/Edge');
  process.exit(1);
}

/**
 * 渲染一个尺寸的封面。
 * @param {{file:string,w:number,h:number}} variant - 目标尺寸。
 * @returns {string} 输出路径。
 */
function render(variant) {
  const { file, w: W, h: H } = variant;
  const k = H / 383; // 以公众号那版为基准等比缩放

  const pills = FLOW.map((node, index) => {
    const arrow = index < FLOW.length - 1 ? '<div class="arrow">▶</div>' : '';
    return `<div class="pill" style="${TONES[node.tone]}">${node.label}</div>${arrow}`;
  }).join('');

  const html = `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:${W}px;height:${H}px;overflow:hidden;
    font-family:'Microsoft YaHei','PingFang SC',-apple-system,sans-serif;}
  .card{width:${W}px;height:${H}px;box-sizing:border-box;padding:${30 * k}px ${34 * k}px ${24 * k}px;
    background:linear-gradient(135deg,#0f172a 0%,#1b2a4a 55%,#243b63 100%);color:#fff;
    display:flex;flex-direction:column;justify-content:space-between;}
  .kicker{font-size:${(15 * k).toFixed(1)}px;letter-spacing:${(2.6 * k).toFixed(1)}px;color:#7dd3fc;font-weight:600}
  h1{margin:${(11 * k).toFixed(1)}px 0 0;font-size:${(36 * k).toFixed(1)}px;line-height:1.22;font-weight:700}
  h1 em{font-style:normal;color:#fbbf24}
  .bar{width:${84 * k}px;height:${Math.max(3, 4 * k).toFixed(1)}px;background:#fbbf24;border-radius:2px;margin-top:${(13 * k).toFixed(1)}px}
  .flowLabel{font-size:${(13 * k).toFixed(1)}px;letter-spacing:${(1.6 * k).toFixed(1)}px;color:#94a3b8;margin-bottom:${(11 * k).toFixed(1)}px}
  /* 用 flex:1 等分容器宽度：手算总宽极易溢出（曾经把最后一个胶囊切掉），等分则由容器决定，不可能溢出 */
  .flow{display:flex;align-items:center;width:100%}
  .pill{flex:1 1 0;min-width:0;height:${(47 * k).toFixed(1)}px;border-radius:${(10 * k).toFixed(1)}px;display:flex;align-items:center;
    justify-content:center;font-size:${(17 * k).toFixed(1)}px;letter-spacing:.5px;white-space:nowrap}
  .arrow{flex:0 0 auto;color:#475569;font-size:${(12 * k).toFixed(1)}px;padding:0 ${(7 * k).toFixed(1)}px}
  .bottom{display:flex;align-items:flex-end;justify-content:space-between;margin-top:${(16 * k).toFixed(1)}px}
  .sub{font-size:${(16 * k).toFixed(1)}px;color:#cbd5e1;line-height:1.45}
  .repo{font-size:${(14 * k).toFixed(1)}px;color:#94a3b8}
  .loop{font-size:${(13.5 * k).toFixed(1)}px;color:#fdba74;margin-top:${(8 * k).toFixed(1)}px}
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

  const out = join(OUT_DIR, file);
  const stage = mkdtempSync(join(tmpdir(), 'promo-cover-'));
  try {
    const htmlPath = join(stage, 'cover.html');
    writeFileSync(htmlPath, html, 'utf8');
    mkdirSync(OUT_DIR, { recursive: true });
    execFileSync(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars',
      `--force-device-scale-factor=${SCALE}`,
      `--window-size=${W},${H}`,
      `--screenshot=${out}`,
      `file:///${htmlPath.replace(/\\/g, '/')}`,
    ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000 });
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
  return out;
}

for (const variant of VARIANTS) {
  const out = render(variant);
  console.log(`${variant.file}  ${variant.w}×${variant.h}（${SCALE}x，${Math.round(statSync(out).size / 1024)} KB）`);
}
console.log(`流程条：${FLOW.map((n) => n.label).join(' → ')}`);
