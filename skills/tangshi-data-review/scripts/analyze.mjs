// 汇总三平台数据 → tables.json + 控制台摘要
import fs from 'node:fs';

const NOW = new Date('2026-10-01T11:10:12Z');
const read = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));

const bili = read('./bili-stats.json');
const dy = read('./dy-stats.json');
const wx = read('./wx-stats.json');

const rows = {}; // key `${ep}|${ver}` -> {ep,ver,bili:{},dy:{},wx:{}}
const R = (ep, ver) => {
  const k = `${ep}|${ver}`;
  if (!rows[k]) rows[k] = { ep, ver, bili: null, dy: null, wx: null };
  return rows[k];
};

// --- B站 ---
for (const ver of ['dushi', 'gushi']) {
  (bili.seasons[ver] || []).forEach((it, i) => {
    const ep = i + 1;
    R(ep, ver).bili = {
      bvid: it.bvid, title: it.title, dur: it.duration, pub: it.pubdate,
      play: it.view, like: it.like, comment: it.reply, share: it.share,
      favorite: it.favorite, coin: it.coin, danmaku: it.danmaku,
    };
  });
}

// --- 抖音 ---
for (const it of dy.items) {
  const m = /一首诗一出戏(\d{2})/.exec(it.desc || '');
  if (!m) continue;
  const ep = parseInt(m[1], 10);
  // 故事版紧跟集号（「一首诗一出戏01故事版」）；正文里提到「故事版」不算
  const ver = /^一首诗一出戏\d{2}故事版/.test(it.desc || '') ? 'gushi' : 'dushi';
  const s = it.statistics || {};
  R(ep, ver).dy = {
    aweme_id: it.aweme_id, dur_ms: it.duration, pub: it.create_time,
    play: s.play_count, like: s.digg_count, comment: s.comment_count,
    share: s.share_count, collect: s.collect_count, title: it.desc.slice(0, 40),
  };
}

// --- 视频号 ---
for (const it of wx.items) {
  R(it.ep, it.ver).wx = {
    objectId: it.objectId, pub: it.createTime, title: it.title,
    play: it.read, like: it.like, comment: it.comment, share: it.forward, fav: it.fav,
  };
}

const hoursSince = (sec) => (NOW.getTime() / 1000 - sec) / 3600;
const P = (e) => (e.play !== undefined && e.play !== null ? e.play : e.view);
const fmt = (n) => (n === null || n === undefined ? 'N/A' : n);

// 主表
const all = Object.values(rows).sort((a, b) => a.ep - b.ep || a.ver.localeCompare(b.ver));
const md = [];
md.push('| EP | 版本 | 平台 | 播放 | 赞 | 评 | 转 | 发布至今(h) | 播放/日 |');
md.push('|---|---|---|---|---|---|---|---|---|');
for (const r of all) {
  const ver = r.ver === 'dushi' ? 'A读诗' : 'B故事';
  const entries = [
    ['B站', r.bili && { play: r.bili.play, like: r.bili.like, comment: r.bili.comment, share: r.bili.share, pub: r.bili.pub, dur: r.bili.dur }],
    ['抖音', r.dy && { play: r.dy.play, like: r.dy.like, comment: r.dy.comment, share: r.dy.share, pub: r.dy.pub, dur: Math.round(r.dy.dur_ms / 1000) }],
    ['视频号', r.wx && { play: r.wx.play, like: r.wx.like, comment: r.wx.comment, share: r.wx.share, pub: r.wx.pub, dur: null }],
  ];
  for (const [name, e] of entries) {
    if (!e) { md.push(`| EP${String(r.ep).padStart(2, '0')} | ${ver} | ${name} | N/A | N/A | N/A | N/A | N/A | N/A |`); continue; }
    const h = hoursSince(e.pub);
    const perDay = P(e) !== null && P(e) !== undefined ? (P(e) / h * 24) : null;
    md.push(`| EP${String(r.ep).padStart(2, '0')} | ${ver} | ${name} | ${fmt(P(e))} | ${fmt(e.like)} | ${fmt(e.comment)} | ${fmt(e.share)} | ${h.toFixed(1)} | ${perDay === null ? 'N/A' : perDay.toFixed(1)} |`);
  }
}

// 分组汇总
function agg(filterEp, platform) {
  let play = 0, like = 0, comment = 0, share = 0, n = 0, hours = 0, durs = [];
  for (const r of all) {
    if (!filterEp(r.ep)) continue;
    const e = r[platform];
    if (!e) continue;
    n++;
    play += P(e) || 0; like += e.like || 0; comment += e.comment || 0; share += e.share || 0;
    hours += hoursSince(e.pub);
    if (platform === 'bili' && e.dur) durs.push(e.dur);
    if (platform === 'dy') durs.push(Math.round(e.dur_ms / 1000));
  }
  return { n, play, like, comment, share, avgPlay: n ? play / n : 0, avgHours: n ? hours / n : 0, durs };
}

const groups = {
  '第二批 EP15-20': (e) => e >= 15 && e <= 20,
  'EP11-14': (e) => e >= 11 && e <= 14,
  '第一批 EP01-10': (e) => e <= 10,
  'EP05-10 基线': (e) => e >= 5 && e <= 10,
};

const summary = {};
for (const [gname, f] of Object.entries(groups)) {
  summary[gname] = {};
  for (const p of ['bili', 'dy', 'wx']) summary[gname][p] = agg(f, p);
}

// A vs B
function verAgg(filterEp, ver, platform) {
  let play = 0, n = 0, hours = 0;
  for (const r of all) {
    if (r.ver !== ver || !filterEp(r.ep)) continue;
    const e = r[platform]; if (!e) continue;
    n++; play += P(e) || 0; hours += hoursSince(e.pub);
  }
  return { n, play, avgPlay: n ? play / n : 0, avgHours: n ? hours / n : 0, perDayAvg: n ? (play / hours * 24) : 0 };
}

const avb = {};
for (const [gname, f] of Object.entries(groups)) {
  avb[gname] = {};
  for (const p of ['bili', 'dy', 'wx']) {
    avb[gname][p] = { A: verAgg(f, 'dushi', p), B: verAgg(f, 'gushi', p) };
  }
}

// 长短分组（按抖音时长）：短 <40s，长 >=40s
function durAgg(filterEp, platform, short) {
  let play = 0, n = 0, hours = 0;
  for (const r of all) {
    if (!filterEp(r.ep)) continue;
    const e = r[platform]; if (!e) continue;
    const d = platform === 'bili' ? e.dur : Math.round(e.dur_ms / 1000);
    if (d == null) continue;
    const isShort = d < 40;
    if (isShort !== short) continue;
    n++; play += P(e) || 0; hours += hoursSince(e.pub);
  }
  return { n, play, avgPlay: n ? play / n : 0, perDayAvg: n ? (play / hours * 24) : 0 };
}

const durSplit = {};
for (const [gname, f] of Object.entries(groups)) {
  durSplit[gname] = {};
  for (const p of ['bili', 'dy']) durSplit[gname][p] = { short: durAgg(f, p, true), long: durAgg(f, p, false) };
}

fs.writeFileSync(new URL('./tables.json', import.meta.url), JSON.stringify({ NOW: NOW.toISOString(), rows, summary, avb, durSplit }, null, 2), 'utf8');
console.log(md.join('\n'));
console.log('\n=== 分组汇总 ===');
console.log(JSON.stringify(summary, null, 2));
console.log('\n=== A vs B ===');
console.log(JSON.stringify(avb, null, 2));
console.log('\n=== 长短（<40s vs >=40s）===');
console.log(JSON.stringify(durSplit, null, 2));
