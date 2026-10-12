#!/usr/bin/env node
/**
 * Generate the skill relationship diagram for the README.
 *
 *   node tools/make-flow-diagram.mjs            # 生成 docs/skill-flow.svg + docs/skill-flow.png
 *   node tools/make-flow-diagram.mjs --svg-only # 只出 SVG（不调浏览器）
 *
 * Why a generator instead of a hand-drawn file: the diagram's whole job is to
 * state which skill hands what to which other skill, so it has to change when
 * the bundled set changes. Node and edge lists keep that edit honest, and
 * re-running is one command.
 *
 * The PNG matters: npm renders the tarball's README but not SVG or Mermaid, so
 * the README references a raster image. Rasterising uses the locally installed
 * Chrome in headless mode, which is also how the existing orchestration-flow
 * diagram was produced.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = join(ROOT, 'docs');
const SVG_ONLY = process.argv.includes('--svg-only');
const SCALE = 2;

const CHROME_CANDIDATES = [
  join(process.env.ProgramFiles ?? 'C:\\Program Files', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
  join(process.env.LOCALAPPDATA ?? '', 'Google/Chrome/Application/chrome.exe'),
  join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
];

// ── 内容：阶段（列）与节点 ────────────────────────────────────────────────
// kind 决定配色：entry 入口 / orchestrate 编排 / produce 原子·生产 /
// compose 原子·合成 / verify 原子·核验 / publish 交付 / thirdparty 第三方 / loop 回写复盘
const COLUMNS = [
  {
    stage: '入口',
    nodes: [{ id: 'video-pipeline', name: 'video-pipeline', note: '总入口：选环节、讲占位符', kind: 'entry' }],
  },
  {
    stage: '编排（调度 + 确认门）',
    nodes: [{ id: 'tangshi-pipeline', name: 'tangshi-pipeline', note: '门①报价 → 调度 → 门②发布确认', kind: 'orchestrate' }],
  },
  {
    stage: '配音',
    nodes: [{ id: 'chinese-tts', name: 'chinese-tts', note: '多音字校正 → 出 wav', kind: 'produce' }],
  },
  {
    stage: '画面（关键帧 / 镜头）',
    nodes: [
      { id: 'ark-agent-plan-image', name: 'ark-agent-plan-image', note: '关键帧 · Plan 配额', kind: 'produce' },
      { id: 'ark-seedream-image', name: 'ark-seedream-image', note: '关键帧 · 按量通道', kind: 'produce' },
      { id: 'dreamina-canvas-cli', name: 'dreamina-canvas-cli', note: '关键帧 · 备用线', kind: 'produce' },
      { id: 'image-to-video', name: 'image-to-video', note: '关键帧 → 运镜镜头', kind: 'produce' },
      { id: 'ark-seedance-video', name: 'ark-seedance-video', note: 't2v / i2v 直出镜头', kind: 'produce' },
    ],
  },
  {
    stage: '合成',
    nodes: [{ id: 'video-compose', name: 'video-compose', note: '镜头 + wav + SRT → 成片', kind: 'compose' }],
  },
  {
    stage: '核验',
    nodes: [
      { id: 'media-verify', name: 'media-verify', note: '音频对位 / 版本比对 / 白屏', kind: 'verify' },
      { id: 'video-cover', name: 'video-cover', note: '关键帧 → 双平台封面', kind: 'verify' },
    ],
  },
  {
    stage: '交付（四平台）',
    nodes: [
      { id: 'quad-platform-publish', name: 'quad-platform-publish', note: '四平台并行 + 风控速查', kind: 'publish' },
      { id: 'multi-platform-publish-orchestrator', name: 'multi-platform-publish-orchestrator', note: '按 JSON 顺序批量发', kind: 'publish' },
      { id: 'bilibili-upload', name: 'bilibili-upload', note: 'biliup 投稿 / 合集', kind: 'publish' },
      { id: 'tencent-upload', name: 'tencent-upload', note: '视频号 / 合集', kind: 'publish' },
      { id: 'douyin-publish', name: 'douyin-publish', note: '抖音 / 合集', kind: 'publish' },
      { id: 'xiaohongshu-skills', name: 'xiaohongshu-skills', note: '小红书（第三方 MIT）', kind: 'thirdparty' },
    ],
  },
];

// 底部一条：回写与复盘（不属于发布列的时序，单独成带）。
// col 指定它落在哪一列下方 —— 回写跟着交付列、复盘跟着核验列，这样连线短且不跨图。
const LOOP_BAND = {
  stage: '回写与复盘（闭环）',
  nodes: [
    { id: 'tangshi-data-review', col: 5, name: 'tangshi-data-review', note: '回收三平台数据 → 复盘', kind: 'loop' },
    { id: 'feishu-bitable', col: 6, name: 'feishu-bitable', note: '进度 / 逐集实录回写', kind: 'loop' },
  ],
};

// 边：kind = data（产物数据流）/ call（调度、调用）/ gate（质量门）/ feedback（闭环）
const EDGES = [
  { from: 'video-pipeline', to: 'tangshi-pipeline', kind: 'call' },
  { from: 'tangshi-pipeline', to: 'chinese-tts', kind: 'call' },
  { from: 'tangshi-pipeline', to: 'ark-agent-plan-image', kind: 'call' },
  { from: 'chinese-tts', to: 'video-compose', kind: 'data' },
  { from: 'ark-agent-plan-image', to: 'image-to-video', kind: 'data' },
  { from: 'ark-seedream-image', to: 'image-to-video', kind: 'data' },
  { from: 'dreamina-canvas-cli', to: 'image-to-video', kind: 'data' },
  { from: 'ark-agent-plan-image', to: 'ark-seedance-video', kind: 'call' },
  { from: 'image-to-video', to: 'video-compose', kind: 'data' },
  { from: 'ark-seedance-video', to: 'video-compose', kind: 'data' },
  { from: 'video-compose', to: 'media-verify', kind: 'data' },
  { from: 'media-verify', to: 'quad-platform-publish', kind: 'gate' },
  { from: 'quad-platform-publish', to: 'bilibili-upload', kind: 'call' },
  { from: 'quad-platform-publish', to: 'tencent-upload', kind: 'call' },
  { from: 'quad-platform-publish', to: 'douyin-publish', kind: 'call' },
  { from: 'quad-platform-publish', to: 'xiaohongshu-skills', kind: 'call' },
  { from: 'tencent-upload', to: 'feishu-bitable', kind: 'data' },
  { from: 'tangshi-data-review', to: 'tangshi-pipeline', kind: 'feedback', label: '数据复盘修正选片权重与发布节奏' },
];

const STYLE = {
  entry: { fill: '#e8f0fe', stroke: '#2563eb', text: '#1d4ed8' },
  orchestrate: { fill: '#f3e8ff', stroke: '#7c3aed', text: '#5b21b6' },
  produce: { fill: '#e6f4ea', stroke: '#1a7f37', text: '#14532d' },
  compose: { fill: '#e6f4ea', stroke: '#1a7f37', text: '#14532d' },
  verify: { fill: '#fff4ce', stroke: '#d97706', text: '#92400e' },
  publish: { fill: '#e8f0fe', stroke: '#2563eb', text: '#1d4ed8' },
  thirdparty: { fill: '#f6f8fa', stroke: '#8b949e', text: '#57606a' },
  loop: { fill: '#fde8e8', stroke: '#b91c1c', text: '#7f1d1d' },
};
const EDGE_STYLE = {
  data: { stroke: '#1a7f37', dash: '', width: 1.6, marker: 'arrowData' },
  call: { stroke: '#8b949e', dash: '4 3', width: 1.3, marker: 'arrowCall' },
  gate: { stroke: '#d97706', dash: '', width: 1.8, marker: 'arrowGate' },
  feedback: { stroke: '#b91c1c', dash: '6 4', width: 1.6, marker: 'arrowLoop' },
};

// ── 布局 ────────────────────────────────────────────────────────────────
const M = 36;              // 外边距
const COL_W = 168;
const GAP = 18;
const HEAD_Y = 108;        // 阶段标题带
const HEAD_H = 24;
const CARD_Y = 146;
const CARD_H = 54;         // 留出两行名字的高度
const CARD_GAP = 10;
const MAX_CARDS = 6;
const LOOP_Y = CARD_Y + MAX_CARDS * (CARD_H + CARD_GAP) + 30;
const LOOP_H = 72;
const FOOT = 24;

const colX = (i) => M + i * (COL_W + GAP);
const WIDTH = M * 2 + COLUMNS.length * COL_W + (COLUMNS.length - 1) * GAP;
const HEIGHT = LOOP_Y + LOOP_H + FOOT;

const ESC = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 等宽字体的近似字宽比（用于把名字塞进卡片）。 */
const MONO_RATIO = 0.68;

/**
 * 让名字适配卡片宽度：先缩字号，缩到下限还放不下就按连字符折两行。
 * 之前固定 11px + 固定阈值折行，导致 `ark-agent-plan-image` 折成
 * `ark-plan` / `agent-image` 并溢出卡片、压住连线标签。
 * @param {string} name - skill 名。
 * @param {number} maxWidth - 可用宽度。
 * @returns {{ lines: string[], size: number }} 行与字号。
 */
function fitName(name, maxWidth) {
  const single = Math.min(11.5, maxWidth / (MONO_RATIO * name.length));
  if (single >= 8.6) return { lines: [name], size: Number(single.toFixed(1)) };

  // 折两行：在连字符处切，取左右长度最接近的切点
  const parts = name.split('-');
  let best = null;
  for (let i = 1; i < parts.length; i += 1) {
    const left = parts.slice(0, i).join('-');
    const right = parts.slice(i).join('-');
    const score = Math.abs(left.length - right.length);
    if (!best || score < best.score) best = { left, right, score };
  }
  if (!best) return { lines: [name], size: 8.5 };
  const longest = Math.max(best.left.length, best.right.length);
  const size = Math.max(7.4, Math.min(10.5, maxWidth / (MONO_RATIO * longest)));
  return { lines: [best.left, best.right], size: Number(size.toFixed(1)) };
}

/**
 * 截断过长的说明文字，按中英文不同字宽估算。
 * @param {string} text - 说明。
 * @param {number} maxWidth - 可用宽度。
 * @param {number} size - 字号。
 * @returns {string} 可能带省略号的文字。
 */
function fitText(text, maxWidth, size) {
  const width = (value) => [...value].reduce((sum, ch) => sum + (ch.codePointAt(0) > 0x2e80 ? size : size * 0.56), 0);
  if (width(text) <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && width(`${cut}…`) > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

// ── 生成 SVG ────────────────────────────────────────────────────────────
const cards = new Map();   // id → {x, y, w, h}
const out = [];

out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" font-family="'Microsoft YaHei','PingFang SC',-apple-system,sans-serif">`);
out.push('  <defs>');
for (const [name, color] of [['arrowData', '#1a7f37'], ['arrowCall', '#8b949e'], ['arrowGate', '#d97706'], ['arrowLoop', '#b91c1c']]) {
  out.push(`    <marker id="${name}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10" fill="none" stroke="${color}" stroke-width="1.6"/></marker>`);
}
out.push('  </defs>');
out.push(`  <rect width="${WIDTH}" height="${HEIGHT}" fill="#fafbfc"/>`);

out.push(`  <text x="${WIDTH / 2}" y="34" text-anchor="middle" font-size="17" font-weight="600" fill="#1a1a1a">dsh-video-pipeline · 19 个 skill 的关系与数据流</text>`);
out.push(`  <text x="${WIDTH / 2}" y="56" text-anchor="middle" font-size="11.5" fill="#57606a">按流水线阶段排列；实线＝产物数据流，虚线＝调度/调用，橙色＝质量门，红色虚线＝数据复盘闭环</text>`);

// 图例
const legend = [
  ['entry', '入口（本包自撰）'],
  ['orchestrate', '编排'],
  ['produce', '原子能力'],
  ['verify', '核验 / 门'],
  ['publish', '交付'],
  ['loop', '回写与复盘'],
];
let lx = M;
for (const [kind, label] of legend) {
  const s = STYLE[kind];
  out.push(`  <rect x="${lx}" y="72" width="13" height="13" rx="3" fill="${s.fill}" stroke="${s.stroke}"/>`);
  out.push(`  <text x="${lx + 18}" y="83" font-size="11" fill="#57606a">${ESC(label)}</text>`);
  lx += 26 + label.length * 11.5;
}

// 右上角徽标：这套 skill 装在哪里。
// 放在图例同一行、右对齐，因此不需要改动下方任何坐标（改布局最容易碰坏已有卡片排布）。
// 文案与公众号封面同源，图自身就能说清「是什么 + 装在哪」。
const installNote = '同一套 skill：DSH 插件 · Claude Code · Codex';
const noteW = installNote.length * 8.2 + 20;
const noteX = WIDTH - M - noteW;
out.push(`  <rect x="${noteX}" y="69" width="${noteW}" height="19" rx="9.5" fill="#eef6ff" stroke="#b6d7ff"/>`);
out.push(`  <text x="${noteX + noteW / 2}" y="82.5" text-anchor="middle" font-size="11" fill="#0b4a8f">${ESC(installNote)}</text>`);

// 阶段标题 + 卡片
COLUMNS.forEach((column, i) => {
  const x = colX(i);
  out.push(`  <rect x="${x}" y="${HEAD_Y}" width="${COL_W}" height="${HEAD_H}" rx="5" fill="#eef1f4" stroke="#d0d7de"/>`);
  out.push(`  <text x="${x + COL_W / 2}" y="${HEAD_Y + 16}" text-anchor="middle" font-size="11" font-weight="600" fill="#424a53">${ESC(column.stage)}</text>`);
  column.nodes.forEach((node, j) => {
    const y = CARD_Y + j * (CARD_H + CARD_GAP);
    cards.set(node.id, { x, y, w: COL_W, h: CARD_H });
    const s = STYLE[node.kind];
    out.push(`  <rect x="${x}" y="${y}" width="${COL_W}" height="${CARD_H}" rx="6" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.2"/>`);
    const { lines, size } = fitName(node.name, COL_W - 20);
    const nameTop = lines.length > 1 ? y + 21 : y + 25;
    lines.forEach((line, k) => {
      out.push(`  <text x="${x + 10}" y="${(nameTop + k * (size + 2.5)).toFixed(1)}" font-size="${size}" font-weight="600" fill="${s.text}" font-family="ui-monospace,Consolas,monospace">${ESC(line)}</text>`);
    });
    out.push(`  <text x="${x + 10}" y="${y + CARD_H - 9}" font-size="9.5" fill="#57606a">${ESC(fitText(node.note, COL_W - 18, 9.5))}</text>`);
  });
});

// 底部带：回写与复盘（各落在指定列下方，连线短且不跨图）
out.push(`  <rect x="${M}" y="${LOOP_Y}" width="${WIDTH - M * 2}" height="${LOOP_H}" rx="8" fill="#fff7f7" stroke="#f0c4c4" stroke-dasharray="5 4"/>`);
out.push(`  <text x="${M + 12}" y="${LOOP_Y + 18}" font-size="11" font-weight="600" fill="#7f1d1d">${ESC(LOOP_BAND.stage)}</text>`);
for (const node of LOOP_BAND.nodes) {
  const x = colX(node.col);
  const y = LOOP_Y + 26;
  const h = 40;
  cards.set(node.id, { x, y, w: COL_W, h });
  const s = STYLE[node.kind];
  out.push(`  <rect x="${x}" y="${y}" width="${COL_W}" height="${h}" rx="6" fill="${s.fill}" stroke="${s.stroke}" stroke-width="1.2"/>`);
  out.push(`  <text x="${x + 10}" y="${y + 17}" font-size="${fitName(node.name, COL_W - 20).size}" font-weight="600" fill="${s.text}" font-family="ui-monospace,Consolas,monospace">${ESC(node.name)}</text>`);
  out.push(`  <text x="${x + 10}" y="${y + 33}" font-size="9.5" fill="#57606a">${ESC(fitText(node.note, COL_W - 18, 9.5))}</text>`);
}

/**
 * 直角走线。
 * 目标在右侧 → 水平折线（竖直段落在列间空白，天然不压卡片）。
 * 同列且相邻 → 直连竖线；同列但跨过中间卡片 → 走**同侧旁路**，
 *   否则连线会从中间卡片身上穿过去（`ark-agent-plan-image → ark-seedance-video`
 *   与 `tencent-upload → feishu-bitable` 就是这种情况）。
 * @returns {string} path 的 d。
 */
function routeFor(from, to, offsetIndex = 0) {
  const cx = from.x + from.w / 2;
  const cy = from.y + from.h / 2;
  const cx2 = to.x + to.w / 2;
  const cy2 = to.y + to.h / 2;

  if (to.x >= from.x + from.w) {
    const x1 = from.x + from.w;
    const mid = x1 + (to.x - x1) / 2 + offsetIndex * 8;
    return `M${x1},${cy} H${mid} V${cy2} H${to.x}`;
  }

  if (Math.abs(cx - cx2) < 6) {
    const gap = to.y - (from.y + from.h);
    if (gap <= CARD_H + 2) return `M${cx},${from.y + from.h} V${to.y}`;
    const right = cx > WIDTH / 2;
    const rail = right ? from.x + from.w + 7 + offsetIndex * 6 : from.x - 7 - offsetIndex * 4;
    const sx = right ? from.x + from.w : from.x;
    const tx = right ? to.x + to.w : to.x;
    return `M${sx},${cy} H${rail} V${cy2} H${tx}`;
  }

  const rail = Math.min(from.x, to.x) - 16 - offsetIndex * 12;
  return `M${from.x},${cy} H${rail} V${cy2} H${to.x}`;
}

/** 标签加浅色描边当光晕，避免压在连线或卡片上读不出来。 */
function label(text, x, y, fill, anchor = 'start') {
  if (!text) return;
  out.push(`  <text x="${x}" y="${y}" text-anchor="${anchor}" font-size="9.5" fill="${fill}" font-weight="600" paint-order="stroke" stroke="#fafbfc" stroke-width="3.5" stroke-linejoin="round">${ESC(text)}</text>`);
}

// 边
const outIndex = new Map();
for (const edge of EDGES) {
  const from = cards.get(edge.from);
  const to = cards.get(edge.to);
  if (!from || !to) continue;

  if (edge.kind === 'feedback') {
    // 闭环：从复盘卡片底部下到轨道，横走到编排卡片下方，再上去
    const x1 = from.x + from.w / 2;
    const y1 = from.y + from.h;
    const x2 = to.x + to.w / 2;
    const y2 = to.y + to.h;
    const rail = LOOP_Y + LOOP_H + 11;
    out.push(`  <path d="M${x1},${y1} V${rail} H${x2} V${y2}" fill="none" stroke="${EDGE_STYLE.feedback.stroke}" stroke-width="${EDGE_STYLE.feedback.width}" stroke-dasharray="${EDGE_STYLE.feedback.dash}" marker-end="url(#${EDGE_STYLE.feedback.marker})"/>`);
    // 标签放在轨道左段的空白处（那一带没有卡片）
    label(edge.label, (M + 12 + x2) / 2 + 90, rail - 5, EDGE_STYLE.feedback.stroke, 'middle');
    continue;
  }

  const index = outIndex.get(edge.from) ?? 0;
  outIndex.set(edge.from, index + 1);
  const style = EDGE_STYLE[edge.kind];
  // 列间只有 18px，任何文字标签都会压到相邻卡片，所以标签只留给底部有整条空轨的闭环边；
  // 其余交接关系由卡片自带的「输入 → 输出」注释承载。
  out.push(`  <path d="${routeFor(from, to, index)}" fill="none" stroke="${style.stroke}" stroke-width="${style.width}"${style.dash ? ` stroke-dasharray="${style.dash}"` : ''} marker-end="url(#${style.marker})"/>`);
}

out.push('</svg>');
const svg = `${out.join('\n')}\n`;

mkdirSync(OUT_DIR, { recursive: true });
const svgPath = join(OUT_DIR, 'skill-flow.svg');
const pngPath = join(OUT_DIR, 'skill-flow.png');
writeFileSync(svgPath, svg);
console.log(`SVG: ${svgPath}  (${WIDTH}×${HEIGHT}, ${(svg.length / 1024).toFixed(1)} KB)`);

if (SVG_ONLY) process.exit(0);

const chrome = CHROME_CANDIDATES.find((p) => p && existsSync(p));
if (!chrome) {
  console.error('找不到 Chrome/Edge，无法渲染 PNG。装一个浏览器或手动渲染 docs/skill-flow.svg。');
  process.exit(1);
}

// 用一张最小 HTML 包住 SVG，避免浏览器默认边距，并保证按精确尺寸截图。
const stage = mkdtempSync(join(tmpdir(), 'dsh-flow-'));
try {
  const htmlPath = join(stage, 'stage.html');
  writeFileSync(htmlPath, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fafbfc}svg{display:block}</style>${svg}`);
  execFileSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=' + SCALE,
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${pngPath}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`,
  ], { stdio: ['ignore', 'ignore', 'pipe'], timeout: 120000 });
  if (!existsSync(pngPath)) {
    console.error('截图未生成');
    process.exit(1);
  }
  console.log(`PNG: ${pngPath}  (${(statSync(pngPath).size / 1024).toFixed(0)} KB, ${SCALE}x)`);
} finally {
  rmSync(stage, { recursive: true, force: true });
}
