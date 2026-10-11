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
const titles = process.argv.slice(2);
const ctx = await chromium.launchPersistentContext(path.join(os.homedir(), '.bili-heji-profile'), {
  channel: 'chrome', headless: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  locale: 'zh-CN', viewport: { width: 1440, height: 900 },
});
await ctx.addCookies(cookies);
const page = await ctx.newPage();
await page.goto('https://member.bilibili.com/platform/upload-manager/ep', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
for (const t of titles) {
  await page.evaluate((tt) => {
    const cards = [...document.querySelectorAll('*')].filter((e) => (e.innerText || '').includes(tt) && (e.innerText || '').includes('编辑'));
    const root = cards.sort((a, b) => a.innerText.length - b.innerText.length)[0];
    const edit = [...root.querySelectorAll('*')].filter((e) => (e.innerText || '').trim() === '编辑').pop();
    edit && edit.click();
  }, t);
  await page.waitForTimeout(2500);
  const txt = await page.evaluate(() => {
    const body = document.body.innerText;
    const i = body.indexOf('视频（');
    return i >= 0 ? body.slice(i, i + 1600) : 'NOT_FOUND';
  });
  console.log('=== ' + t + ' ===');
  console.log(txt);
  await page.evaluate(() => window.history.back());
  await page.waitForTimeout(2500);
}
await ctx.close();
