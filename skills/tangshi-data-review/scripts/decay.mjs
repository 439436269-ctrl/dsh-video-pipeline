// 1) 视频号合集 totalReadCount 交叉校验；2) 按发布时长分档的衰减分析
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const PW = '{{USER_HOME}}/AppData/Local/npm-cache/_npx/a5b920f00216d246/node_modules/playwright';
const { chromium } = require(PW);
const HERE = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

const COOKIES = '{{USER_HOME}}/.social-publish-skills/cookies/tencent/default.json';
const PROFILE = path.join(os.homedir(), '.tencent-heji-profile');

const ctx = await chromium.launchPersistentContext(PROFILE, {
  channel: 'chrome', headless: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  locale: 'zh-CN',
});
try {
  const st = JSON.parse(fs.readFileSync(COOKIES, 'utf8'));
  if (st.cookies?.length) await ctx.addCookies(st.cookies);
  if (st.origins?.length) {
    await ctx.addInitScript((origins) => {
      for (const o of origins) {
        if (!location.origin || !o.origin || location.origin !== o.origin.replace(/\/$/, '')) continue;
        for (const [k, v] of Object.entries(o.localStorage || {})) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
      }
    }, st.origins);
  }
  const page = await ctx.newPage();
  await page.goto('https://channels.weixin.qq.com/platform', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const cols = await page.evaluate(async () => {
    const base = '/micro/content/cgi-bin/mmfinderassistant-bin';
    const qs = '?_aid=3bfb7216-b2df-4e26-aeee-481e7cad250d&_rid=' + Math.random().toString(36).slice(2) + '&_pageUrl=' + encodeURIComponent(location.href);
    const body = { pageNum: 1, pageSize: 50, collectionScene: 0, collectionBusinessType: 0, timestamp: String(Date.now()), _log_finder_uin: null, _log_finder_id: '<你的视频号 FINDER_ID>', rawKeyBuff: '', pluginSessionId: null, scene: 7, reqScene: 7 };
    const r = await fetch(`${base}/collection/get_collection_list${qs}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    return (j.data?.collectionList || []).map((c) => ({ name: c.name, totalReadCount: c.totalReadCount, feedCount: c.feedCount, createTime: c.createTime }));
  });
  fs.writeFileSync(path.join(HERE, 'wx-collections.json'), JSON.stringify({ at: new Date().toISOString(), cols }, null, 2), 'utf8');
  console.log('COLLECTIONS:', JSON.stringify(cols, null, 2));
} finally {
  await ctx.close();
}

// --- 衰减分档 ---
const NOW = new Date('2026-10-01T11:10:12Z').getTime() / 1000;
const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
const bili = read('./bili-stats.json'), dy = read('./dy-stats.json'), wx = read('./wx-stats.json');

const items = [];
for (const ver of ['dushi', 'gushi']) (bili.seasons[ver] || []).forEach((it, i) => items.push({ plat: 'B站', ep: i + 1, ver, pub: it.pubdate, play: it.view }));
for (const it of dy.items) {
  const m = /一首诗一出戏(\d{2})/.exec(it.desc || ''); if (!m) continue;
  items.push({ plat: '抖音', ep: +m[1], ver: /^一首诗一出戏\d{2}故事版/.test(it.desc) ? 'gushi' : 'dushi', pub: it.create_time, play: (it.statistics || {}).play_count ?? 0 });
}
for (const it of wx.items) items.push({ plat: '视频号', ep: it.ep, ver: it.ver, pub: it.createTime, play: it.read ?? 0 });

const bands = [
  { name: '0-6h', lo: 0, hi: 6 },
  { name: '6-12h', lo: 6, hi: 12 },
  { name: '12-24h', lo: 12, hi: 24 },
  { name: '24-48h', lo: 24, hi: 48 },
  { name: '48h+', lo: 48, hi: 1e9 },
];
console.log('\n## 按发布至今时长分档（播放/日 = play / h * 24）');
const out = {};
for (const plat of ['抖音', '视频号', 'B站']) {
  out[plat] = {};
  for (const b of bands) {
    const sel = items.filter((x) => x.plat === plat && x.pub && (NOW - x.pub) / 3600 >= b.lo && (NOW - x.pub) / 3600 < b.hi);
    if (!sel.length) { out[plat][b.name] = null; continue; }
    const totPlay = sel.reduce((s, x) => s + (x.play || 0), 0);
    const totHours = sel.reduce((s, x) => s + (NOW - x.pub) / 3600, 0);
    out[plat][b.name] = {
      n: sel.length, play: totPlay,
      avgPlay: +(totPlay / sel.length).toFixed(1),
      perDayPerItem: +((totPlay / sel.length) / (totHours / sel.length) * 24).toFixed(1),
      eps: sel.map((x) => `EP${String(x.ep).padStart(2, '0')}${x.ver === 'dushi' ? 'A' : 'B'}`).join(','),
    };
    console.log(`${plat} ${b.name}: n=${sel.length} play=${totPlay} avgPlay=${out[plat][b.name].avgPlay} perDay/item=${out[plat][b.name].perDayPerItem} | ${out[plat][b.name].eps}`);
  }
}

// 分批内 A/B + 题材（只对第二批）
console.log('\n## 第二批 EP15-20 逐条（播放 / 发布小时 / 播放/日）');
for (const x of items.filter((x) => x.ep >= 15).sort((a, b) => a.ep - b.ep || a.plat.localeCompare(b.plat))) {
  const h = (NOW - x.pub) / 3600;
  console.log(`EP${String(x.ep).padStart(2, '0')} ${x.ver === 'dushi' ? 'A' : 'B'} ${x.plat}: play=${x.play} h=${h.toFixed(1)} perDay=${(x.play / h * 24).toFixed(1)}`);
}

fs.writeFileSync(new URL('./decay.json', import.meta.url), JSON.stringify({ out, items }, null, 2), 'utf8');
