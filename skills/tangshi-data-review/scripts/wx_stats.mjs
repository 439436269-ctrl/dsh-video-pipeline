// 只读采集：视频号 post/get_post_info → wx-stats.json
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const PW = '{{USER_HOME}}/AppData/Local/npm-cache/_npx/a5b920f00216d246/node_modules/playwright';
const { chromium } = require(PW);

const COOKIES = '{{USER_HOME}}/.social-publish-skills/cookies/tencent/default.json';
const PROFILE = path.join(os.homedir(), '.tencent-heji-profile');
const POSTS = path.join(process.env.HOME || os.homedir(), '.agents/skills/tencent-upload/scripts/heji/posts.json');

const raw = fs.readFileSync(POSTS, 'utf8').replace(/^﻿/, '');
const posts = JSON.parse(raw);

// 同 EP 内按 createTime 升序：先发 = A 读诗版，后发 = B 故事版
const byEp = new Map();
for (const p of posts) {
  // EP21+ 平台标题改用诗题（2026-10-01），EP 标识在 desc；EP1-20 老标题兜底；
  // EP41/47 desc 历史缺字（"一出戏41·"），用宽松 /一出戏(\d{2,3})/ 统一覆盖
  const m = /一出戏(\d{2,3})/.exec(p.desc || '') || /^(?:#.*#)?\s*一首诗一出戏(\d{2})/.exec(p.title || '');
  if (!m) continue;
  const ep = parseInt(m[1], 10);
  if (!byEp.has(ep)) byEp.set(ep, []);
  byEp.get(ep).push(p);
}
const picked = [];
for (const [ep, list] of [...byEp].sort((a, b) => a[0] - b[0])) {
  list.sort((a, b) => a.createTime - b.createTime);
  list.forEach((p, i) => picked.push({ ep, ver: i === 0 ? 'dushi' : 'gushi', ...p }));
}
console.log('picked=' + picked.length + ' eps=' + [...byEp.keys()].sort((a, b) => a - b).join(','));

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
        for (const [k, v] of Object.entries(o.localStorage || {})) {
          try { localStorage.setItem(k, v); } catch (e) { /* ignore */ }
        }
      }
    }, st.origins);
  }
  const page = await ctx.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });
  await page.goto('https://channels.weixin.qq.com/platform', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const out = [];
  for (const p of picked) {
    const r = await page.evaluate(async (objectId) => {
      const base = '/micro/content/cgi-bin/mmfinderassistant-bin';
      const qs = '?_aid=3bfb7216-b2df-4e26-aeee-481e7cad250d&_rid=' + Math.random().toString(36).slice(2) + '&_pageUrl=' + encodeURIComponent(location.href);
      const body = {
        objectId, timestamp: String(Date.now()), _log_finder_uin: null,
        _log_finder_id: '<你的视频号 FINDER_ID>',
        rawKeyBuff: '', pluginSessionId: null, scene: 7, reqScene: 7,
      };
      const res = await fetch(`${base}/post/get_post_info${qs}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      });
      const text = await res.text();
      try { return { status: res.status, json: JSON.parse(text) }; } catch (e) { return { status: res.status, err: String(e), head: text.slice(0, 200) }; }
    }, p.objectId);

    const o = r.json?.data?.object || {};
    const row = {
      ep: p.ep, ver: p.ver, objectId: p.objectId, title: p.title, createTime: p.createTime,
      date: p.date, status: o.status ?? p.status,
      read: o.readCount ?? null, like: o.likeCount ?? null, comment: o.commentCount ?? null,
      forward: o.forwardCount ?? null, fav: o.favCount ?? null,
      err: r.json?.errCode !== undefined ? (r.json.errCode === 0 ? null : `${r.json.errCode}:${r.json.errMsg}`) : String(r.err || ''),
    };
    out.push(row);
    console.log(`EP${String(p.ep).padStart(2, '0')} ${p.ver} read=${row.read} like=${row.like} cm=${row.comment} fwd=${row.forward} fav=${row.fav} ${row.err || ''}`);
    await new Promise((x) => setTimeout(x, 400));
  }

  fs.writeFileSync('wx-stats.json', JSON.stringify({ collectedAt: new Date().toISOString(), items: out }, null, 2), 'utf8');
  console.log('WROTE wx-stats.json');
} finally {
  await ctx.close();
}
