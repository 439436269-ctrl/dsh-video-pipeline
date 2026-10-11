// 视频号合集：进编辑页抓结构+接口（只读，不提交）
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const PW = '{{USER_HOME}}/AppData/Local/npm-cache/_npx/a5b920f00216d246/node_modules/playwright';
const { chromium } = require(PW);

const COOKIES = '{{USER_HOME}}/.social-publish-skills/cookies/tencent/default.json';
const PROFILE = path.join(os.homedir(), '.tencent-heji-profile');
const KEY = process.argv[2] || '读诗版';

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: 'chrome', headless: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    locale: 'zh-CN', viewport: { width: 1440, height: 900 },
  });
  const st = JSON.parse(fs.readFileSync(COOKIES, 'utf8'));
  if (st.cookies?.length) await ctx.addCookies(st.cookies);
  if (st.origins?.length) {
    await ctx.addInitScript((origins) => {
      for (const o of origins) {
        if (!location.origin || !o.origin || location.origin !== o.origin.replace(/\/$/, '')) continue;
        for (const [k, v] of Object.entries(o.localStorage || {})) { try { localStorage.setItem(k, v); } catch (e) {} }
      }
    }, st.origins);
  }
  const page = await ctx.newPage();
  page.setDefaultTimeout(25000);
  const net = [];
  page.on('request', (r) => {
    const u = r.url();
    if (!/cgi-bin|collection|feed|post/.test(u)) return;
    if (/\.(js|css|png|jpg|gif|svg|woff)/.test(u)) return;
    net.push({ m: r.method(), u: u.split('?')[0], q: u.split('?')[1] || '', body: (r.postData() || '').slice(0, 3000) });
  });

  await page.goto('https://channels.weixin.qq.com/platform/post/list?tab=collection', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);

  // 在各 frame 里点目标合集的「编辑」
  for (const f of page.frames()) {
    await f.evaluate((KEY) => {
      let nameEl = null;
      for (const el of document.querySelectorAll('*')) {
        if ((el.textContent || '').trim() === `一首诗一出戏 · ${KEY}` && el.children.length === 0) { nameEl = el; break; }
      }
      if (!nameEl) return;
      let row = nameEl;
      for (let i = 0; i < 8 && row.parentElement; i++) {
        row = row.parentElement;
        const txt = row.textContent || '';
        if (txt.includes('编辑') && txt.includes('删除')) break;
      }
      const leaves = [];
      for (const el of row.querySelectorAll('*')) {
        if ((el.textContent || '').trim() === '编辑') leaves.push(el);
      }
      if (leaves.length) leaves[leaves.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }, KEY).catch(() => {});
  }
  await page.waitForTimeout(6000);
  console.log('URL_AFTER_EDIT: ' + page.url());

  // dump 所有 frame 文本
  for (const f of page.frames()) {
    const t = await f.evaluate(() => document.body?.innerText || '').catch(() => '');
    if (t && /合集|视频|添加/.test(t)) {
      console.log('=== FRAME ' + f.url().slice(0, 100) + ' ===');
      console.log(t.slice(0, 4000));
    }
  }
  fs.writeFileSync('wx_edit_net.json', JSON.stringify(net, null, 1), 'utf8');
  console.log('NET(' + net.length + '):');
  for (const n of net) console.log(` ${n.m} ${n.u}`);
  await ctx.close();
}
main().catch((e) => { console.error('ERROR: ' + (e?.stack || e)); process.exit(1); });
