// B站合集 UI 探路：打开合集管理 → 点「添加合集」→ 抓弹窗与网络 → 不提交
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const PW = '{{USER_HOME}}/AppData/Local/npm-cache/_npx/a5b920f00216d246/node_modules/playwright';
const { chromium } = require(PW);

const biliupCk = JSON.parse(fs.readFileSync('{{USER_HOME}}/.bilibili/cookies.json', 'utf8'));
const cookies = (biliupCk.cookie_info?.cookies || []).map((c) => ({
  name: c.name, value: c.value, domain: '.bilibili.com', path: '/',
  httpOnly: !!c.http_only, secure: true,
  expires: c.expires && c.expires > 0 ? c.expires : undefined,
}));

const profile = path.join(os.homedir(), '.bili-heji-profile');
const step = process.argv[2] || 'dialog';

async function main() {
  const ctx = await chromium.launchPersistentContext(profile, {
    channel: 'chrome', headless: true,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    locale: 'zh-CN', viewport: { width: 1440, height: 900 },
  });
  await ctx.addCookies(cookies);
  const page = await ctx.newPage();
  const net = [];
  page.on('request', (r) => {
    if (!/member\.bilibili\.com|x\d*\/creative/.test(r.url())) return;
    if (/data\.bilibili\.com|static|\.js|\.css|\.png|\.svg/.test(r.url())) return;
    net.push({ m: r.method(), u: r.url(), body: r.postData() });
  });
  await page.goto('https://member.bilibili.com/platform/upload-manager/ep', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  if (step === 'dialog') {
    const btn = page.locator('text=添加合集').first();
    await btn.click();
    await page.waitForTimeout(1500);
    console.log('URL_AFTER_CLICK: ' + page.url());
    const bodyTxt = await page.evaluate(() => document.body.innerText.slice(0, 2500));
    console.log('BODY:\n' + bodyTxt);
    const controls = await page.evaluate(() =>
      [...document.querySelectorAll('input, textarea, button, [class*="upload"]')].map((e) => ({
        tag: e.tagName, type: e.type || '', cls: (e.className || '').toString().slice(0, 80),
        placeholder: e.placeholder || '', maxlength: e.maxlength || '', text: (e.innerText || '').slice(0, 30),
      }))
    );
    console.log('CONTROLS:\n' + JSON.stringify(controls, null, 1));
    const dump = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.modal, .dialog, [class*="modal"], [class*="dialog"], [class*="Modal"]')];
      return els.map((e) => ({ cls: e.className, txt: (e.innerText || '').slice(0, 800), html: e.outerHTML.slice(0, 3000) }));
    });
    fs.writeFileSync('bili-dialog.json', JSON.stringify({ dump, net }, null, 2), 'utf8');
    console.log(JSON.stringify(dump, null, 2).slice(0, 5000));
    console.log('NET:', JSON.stringify(net.filter((n) => n.m === 'POST'), null, 2).slice(0, 3000));
  } else if (step === 'create') {
    const which = process.argv[3] || 'dushi';
    const meta = {
      dushi: { title: '一首诗一出戏 · 读诗版', desc: '25秒跟读整首唐诗：题卡→四句连读→全诗字卡。按 EP 编号顺序排列，EP01 起持续更新。', cover: process.env.TEMP + '/heji-covers/cover-dushi.jpg' },
      gushi: { title: '一首诗一出戏 · 故事版', desc: '60-90秒把一首唐诗拍成微型剧情：钩子→三幕→点诗→下集预告。按 EP 编号顺序排列，EP01 起持续更新。', cover: process.env.TEMP + '/heji-covers/cover-gushi.jpg' },
    }[which];
    const btn = page.locator('text=添加合集').first();
    await btn.click();
    await page.waitForTimeout(1200);
    await page.setInputFiles('input[type=file]', meta.cover);
    await page.waitForTimeout(2500);
    let t = await page.evaluate(() => document.body.innerText.slice(0, 1200));
    console.log('AFTER_COVER:\n' + t);
    // 若出现裁剪/确认弹窗，只点 button 元素里文案精确等于 确定/保存/完成 的那个
    const clicked = await page.evaluate(() => {
      const want = ['确认', '确定', '保存', '完成'];
      const all = [...document.querySelectorAll('button, .btn, span, div, a')];
      const els = all.filter((e) => want.includes((e.innerText || '').trim()) && e.offsetParent !== null);
      if (els.length) {
        const target = els[els.length - 1];
        target.click();
        return { text: target.innerText.trim(), tag: target.tagName, cls: (target.className || '').toString() };
      }
      return null;
    });
    if (clicked) { console.log('MODAL_BTN: ' + JSON.stringify(clicked)); await page.waitForTimeout(1000); }
    else {
      const html = await page.evaluate(() => {
        const el = [...document.querySelectorAll('*')].find((e) => (e.innerText || '').includes('封面最终展示效果'));
        return el ? el.outerHTML.slice(0, 2500) : 'NOT_FOUND';
      });
      console.log('OVERLAY_HTML: ' + html);
    }
    await page.fill('input[placeholder="请输入合集标题"]', meta.title);
    await page.fill('textarea.ep-text-area-length', meta.desc);
    await page.waitForTimeout(300);
    const submitted = await page.evaluate(() => {
      const els = [...document.querySelectorAll('button, .btn, span, div')].filter((e) => (e.innerText || '').trim() === '立即提交' && e.offsetParent !== null);
      if (els.length) { els[els.length - 1].click(); return true; }
      return false;
    });
    console.log('SUBMITTED: ' + submitted);
    await page.waitForTimeout(3500);
    const posts = net.filter((n) => n.m === 'POST' && !/data\.bilibili\.com|gaia|material\/up\/check/.test(n.u));
    console.log('POSTS:\n' + JSON.stringify(posts, null, 2));
    t = await page.evaluate(() => document.body.innerText.slice(0, 1500));
    console.log('AFTER_SUBMIT:\n' + t);
    fs.writeFileSync(`bili-create-${which}.json`, JSON.stringify({ posts, after: t }, null, 2), 'utf8');
  }
  await ctx.close();
}
main().catch((e) => { console.error('ERROR: ' + e.message); process.exit(1); });
