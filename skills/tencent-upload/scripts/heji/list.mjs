// 视频号合集：API 直调（在 /platform 页面上下文里 fetch）
// 用法: node api.mjs <posts|collections>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const PW = '{{USER_HOME}}/AppData/Local/npm-cache/_npx/a5b920f00216d246/node_modules/playwright';
const { chromium } = require(PW);

const COOKIES = '{{USER_HOME}}/.social-publish-skills/cookies/tencent/default.json';
const PROFILE = path.join(os.homedir(), '.tencent-heji-profile');
const cmd = process.argv[2];

async function launch() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome',
    headless: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });
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
  return ctx;
}

const POST_BODY = (pageNo, pageSize) => ({
  pageSize, currentPage: pageNo, userpageType: 11, stickyOrder: false,
  timestamp: String(Date.now()), _log_finder_uin: null,
  _log_finder_id: '<你的视频号 FINDER_ID>',
  rawKeyBuff: '', pluginSessionId: null, scene: 7, reqScene: 7,
});

const COL_BODY = () => ({
  pageNum: 1, pageSize: 50, collectionScene: 0, collectionBusinessType: 0,
  timestamp: String(Date.now()), _log_finder_uin: null,
  _log_finder_id: '<你的视频号 FINDER_ID>',
  rawKeyBuff: '', pluginSessionId: null, scene: 7, reqScene: 7,
});

async function main() {
  const ctx = await launch();
  try {
    const page = await ctx.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });
    await page.goto('https://channels.weixin.qq.com/platform', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    if (cmd === 'posts') {
      const out = [];
      for (let p = 1; p <= 5; p++) {
        const body = POST_BODY(p, 50);
        const r = await page.evaluate(async (b) => {
          const res = await fetch(
            '/micro/content/cgi-bin/mmfinderassistant-bin/post/post_list?_aid=3bfb7216-b2df-4e26-aeee-481e7cad250d&_rid=' +
            Math.random().toString(36).slice(2) + '&_pageUrl=' + encodeURIComponent('https://channels.weixin.qq.com/platform'),
            { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }
          );
          const text = await res.text().catch(() => '');
          let json = null; try { json = JSON.parse(text); } catch (e) { /* ignore */ }
          return { status: res.status, json, text: text.slice(0, 300) };
        }, body);
        const list = r.json?.data?.list || [];
        console.error(`page ${p}: status=${r.status} err=${r.json?.errCode} n=${list.length} total=${r.json?.data?.postListCount ?? r.json?.data?.totalCount ?? '?'}`);
        for (const it of list) {
          const lines = (it.desc?.description || '').split('\n');
          out.push({
            objectId: it.objectId,
            title: (it.desc?.shortTitle?.[0]?.shortTitle || lines[0] || ''),
            // EP21 起描述首行是名句，系列标题在后续行 → desc 取含系列名的行，供 do.mjs pickIds 匹配
            // EP41/47 系列标题是短版前缀「一出戏4x·…」→ 用「出戏」匹配两种前缀
            desc: (lines.find((l) => l.includes('出戏')) || lines[0] || ''),
            line1: lines[0] || '',
            createTime: it.createTime,
            date: new Date(it.createTime * 1000).toISOString(),
            status: it.status,
            visibleType: it.visibleType,
          });
        }
        if (list.length < 50) break;
      }
      fs.writeFileSync('posts.json', JSON.stringify(out, null, 2));
      console.log(JSON.stringify(out, null, 2));
    } else if (cmd === 'collections') {
      const body = COL_BODY();
      const r = await page.evaluate(async (b) => {
        const res = await fetch(
          '/micro/content/cgi-bin/mmfinderassistant-bin/collection/get_collection_list?_aid=3bfb7216-b2df-4e26-aeee-481e7cad250d&_rid=' +
          Math.random().toString(36).slice(2) + '&_pageUrl=' + encodeURIComponent('https://channels.weixin.qq.com/platform'),
          { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }
        );
        return await res.json().catch(async () => ({ raw: await res.text() }));
      }, body);
      fs.writeFileSync('collections.json', JSON.stringify(r, null, 2));
      console.log(JSON.stringify(r, null, 2));
    } else {
      console.error('usage: posts | collections');
      process.exit(2);
    }
  } finally {
    await ctx.close();
  }
}
main().catch((e) => { console.error('ERROR: ' + (e?.stack || e)); process.exit(1); });
