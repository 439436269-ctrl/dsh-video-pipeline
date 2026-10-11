// B站合集 API 操作（在已登录浏览器上下文内 fetch）
// 用法:
//   node bili_api.mjs ids
//   node bili_api.mjs section <seasonId>
//   node bili_api.mjs add <seasonId> <mapping.json>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const PW = '{{USER_HOME}}/AppData/Local/npm-cache/_npx/a5b920f00216d246/node_modules/playwright';
const { chromium } = require(PW);
const ck = JSON.parse(fs.readFileSync('{{USER_HOME}}/.bilibili/cookies.json', 'utf8'));
const cookies = (ck.cookie_info?.cookies || []).map((c) => ({
  name: c.name, value: c.value, domain: '.bilibili.com', path: '/',
  httpOnly: !!c.http_only, secure: true,
  expires: c.expires && c.expires > 0 ? c.expires : undefined,
}));
const csrf = (ck.cookie_info?.cookies || []).find((c) => c.name === 'bili_jct')?.value;

const BV = {
  dushi: {
    EP01: 'BV0000000000', EP02: 'BV0000000000', EP03: 'BV0000000000',
    EP04: 'BV0000000000', EP05: 'BV0000000000', EP06: 'BV0000000000', EP07: 'BV0000000000',
  },
  gushi: {
    EP01: 'BV0000000000', EP02: 'BV0000000000', EP03: 'BV0000000000',
    EP04: 'BV0000000000', EP05: 'BV0000000000', EP06: 'BV0000000000', EP07: 'BV0000000000',
  },
};

const [,, cmd, a1, a2] = process.argv;

const ctx = await chromium.launchPersistentContext(path.join(os.homedir(), '.bili-heji-profile'), {
  channel: 'chrome', headless: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  locale: 'zh-CN', viewport: { width: 1440, height: 900 },
});
await ctx.addCookies(cookies);
const page = await ctx.newPage();
await page.goto('https://member.bilibili.com/platform/upload-manager/ep', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

async function api(url, body) {
  return page.evaluate(async ({ u, b, isPost }) => {
    const opts = { credentials: 'include', headers: { accept: 'application/json, text/plain, */*' } };
    if (isPost) {
      opts.method = 'POST';
      opts.headers['content-type'] = 'application/json';
      opts.body = JSON.stringify(b);
    }
    const r = await fetch(u, opts);
    const t = await r.text();
    try { return JSON.parse(t); } catch (e) { return { code: -1, message: 'NON_JSON ' + t.slice(0, 200) }; }
  }, { u: url, b: body || null, isPost: !!body });
}

if (cmd === 'ids') {
  const out = {};
  for (const [ver, map] of Object.entries(BV)) {
    out[ver] = {};
    for (const [ep, bv] of Object.entries(map)) {
      const j = await api(`https://api.bilibili.com/x/web/view?bvid=${bv}`);
      if (j.code !== 0) { console.log(`${ver} ${ep} ERROR ${JSON.stringify(j).slice(0, 150)}`); continue; }
      out[ver][ep] = { bvid: bv, aid: j.data.aid, cid: j.data.cid, title: j.data.title };
      console.log(`${ver} ${ep} aid=${j.data.aid} cid=${j.data.cid} ${j.data.title}`);
    }
  }
  fs.writeFileSync('bili-ids.json', JSON.stringify(out, null, 2), 'utf8');
} else if (cmd === 'section') {
  const j = await api('https://member.bilibili.com/x2/creative/web/seasons?pn=1&ps=30&order=&sort=&draft=1&source=0');
  const s = j.data.seasons.find((x) => String(x.season.id) === String(a1));
  if (!s) { console.log('SEASON_NOT_FOUND ' + JSON.stringify(j).slice(0, 200)); process.exit(1); }
  console.log(JSON.stringify({
    seasonId: s.season.id, title: s.season.title, state: s.season.state,
    sectionIds: s.sections.sections.map((x) => ({ id: x.id, title: x.title, epCount: x.epCount })),
    episodes: (s.part_episodes || []).sort((x, y) => x.order - y.order).map((e) => ({ order: e.order, id: e.id, title: e.title })),
  }, null, 2));
} else if (cmd === 'add') {
  const seasonId = a1;
  const mapping = JSON.parse(fs.readFileSync(a2, 'utf8').replace(/^﻿/, ''));
  const j = await api('https://member.bilibili.com/x2/creative/web/seasons?pn=1&ps=30&order=&sort=&draft=1&source=0');
  const s = j.data.seasons.find((x) => String(x.season.id) === String(seasonId));
  if (!s) { console.log('SEASON_NOT_FOUND'); process.exit(1); }
  const sectionId = s.sections.sections[0].id;
  const existing = new Set((s.part_episodes || []).map((e) => e.title));
  console.log('sectionId=' + sectionId + ' currentEps=' + existing.size);
  for (const m of mapping) {
    if (existing.has(m.title)) { console.log(`${m.title} -> SKIP(已在合集)`); continue; }
    let tries = 0;
    while (true) {
      const res = await api(
        `https://member.bilibili.com/x2/creative/web/season/section/episodes/add?csrf=${csrf}`,
        { sectionId, episodes: [{ title: m.title, aid: m.aid, cid: m.cid, charging_pay: 0, member_first: 0, limited_free: false }] }
      );
      console.log(`${m.title} -> code=${res.code} ${res.message || 'OK'}`);
      if (res.code === 0) break;
      if (res.code === 20111 && tries < 4) {
        tries++;
        console.log(`  rate-limited, wait ${20 * tries}s (try ${tries})`);
        await page.waitForTimeout(20000 * tries);
        continue;
      }
      console.log(JSON.stringify(res).slice(0, 400));
      break;
    }
    await page.waitForTimeout(12000);
  }
  const after = await api('https://member.bilibili.com/x2/creative/web/seasons?pn=1&ps=30&order=&sort=&draft=1&source=0');
  const s2 = after.data.seasons.find((x) => String(x.season.id) === String(seasonId));
  console.log('AFTER order:');
  for (const e of (s2.part_episodes || []).sort((x, y) => x.order - y.order)) console.log(`  ${e.order}. [${e.id}] ${e.title}`);
} else {
  console.log('usage: ids | section <seasonId> | add <seasonId> <mapping.json>');
  process.exit(2);
}
await ctx.close();
