// 视频号「发布后修改封面」——EP11A 真机实测通过（2026-09-30）
// 流程：post/list 点卡片「修改描述和封面」图标 → coverEdit 页 → 编辑封面弹窗 → 上传封面 tab
//       → 注入 PNG → 弹窗确认（DFS 上传）→ 完成 → 确认修改（finderModFeed modFlag=仅封面位）
//       → 轮询 post_list 直到 coverUrl 变化（服务端处理约 30-90s）
// 用法: node set_cover.mjs <标题子串|export/objectId> <封面png绝对路径>
// 只改封面：不编辑描述/短标题（modFlag 不含描述位 → 不消耗「描述仅可改一次」配额）
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const PW = '{{USER_HOME}}/AppData/Local/npm-cache/_npx/a5b920f00216d246/node_modules/playwright';
const { chromium } = require(PW);

const COOKIES = path.join(process.env.USERPROFILE || os.homedir(), '.social-publish-skills/cookies/tencent/default.json');
const PROFILE = path.join(os.homedir(), '.tencent-heji-profile');
const FINDER_ID = '<你的视频号 FINDER_ID>';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const target = process.argv[2];
const coverPath = process.argv[3];
if (!target || !coverPath) {
  console.error('用法: node set_cover.mjs <标题子串|export/objectId> <封面png绝对路径>');
  process.exit(2);
}
if (!fs.existsSync(coverPath)) { console.error('封面不存在: ' + coverPath); process.exit(2); }
const isObjectId = target.startsWith('export/');

async function launch() {
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
  return ctx;
}

async function postList(page, pageSize = 12) {
  return page.evaluate(async ({ fid, pageSize }) => {
    const body = {
      pageSize, currentPage: 1, userpageType: 11, stickyOrder: false,
      timestamp: String(Date.now()), _log_finder_uin: null, _log_finder_id: fid,
      rawKeyBuff: '', pluginSessionId: null, scene: 7, reqScene: 7,
    };
    const res = await fetch(
      '/micro/content/cgi-bin/mmfinderassistant-bin/post/post_list?_aid=3bfb7216-b2df-4e26-aeee-481e7cad250d&_rid=' +
      Math.random().toString(36).slice(2) + '&_pageUrl=' + encodeURIComponent(location.href),
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    );
    const j = await res.json();
    return j?.data?.list || [];
  }, { fid: FINDER_ID, pageSize });
}

function coverUrlOf(listItem) {
  if (!listItem) return '';
  const s = JSON.stringify(listItem);
  const m = s.match(/"fullCoverUrl":"([^"]*)"/) || s.match(/"coverUrl":"([^"]*)"/);
  return m ? m[1] : '';
}
function encKey(url) {
  const m = (url || '').match(/encfilekey=([^&]*)/);
  return m ? m[1] : url;
}
function descOf(item) {
  return item?.desc?.description || item?.desc?.shortTitle?.[0]?.shortTitle || '';
}

async function main() {
  const ctx = await launch();
  try {
    const page = await ctx.newPage();
    await page.goto('https://channels.weixin.qq.com/platform', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(6000);

    // 1) 定位目标 + 记录修改前封面
    let list = await postList(page);
    let hit = isObjectId ? list.find((x) => JSON.stringify(x).includes(target.slice(7))) : null;
    if (!hit && !isObjectId) hit = list.find((x) => descOf(x).includes(target));
    if (!hit && !isObjectId) {
      list = await postList(page, 30);
      hit = list.find((x) => descOf(x).includes(target));
    }
    if (!hit) { console.error('未在 post_list 找到目标: ' + target); process.exit(1); }
    // 平台铁律：每条视频「描述+封面」整条编辑仅一次；status=1 已用掉（入口 disabled，点了也不会跳转）
    const mfi = hit?.desc?.modFeedInfo || {};
    if (mfi.modifyButtonStatus !== 2) {
      console.error(`目标不可修改: modifyButtonStatus=${mfi.modifyButtonStatus} (${mfi.buttonTipsWording || '无提示'})。该视频的修改配额已使用。`);
      process.exit(1);
    }
    const objectId = (JSON.stringify(hit).match(/"(export\/[^"]+)"/) || [])[1];
    const title = descOf(hit).split('\n')[0];
    const beforeCover = coverUrlOf(hit);
    console.log('TARGET:', JSON.stringify({ objectId, title, beforeEnc: encKey(beforeCover).slice(0, 50) }));
    if (!objectId) { console.error('objectId 解析失败'); process.exit(1); }

    // 2) 进列表页，点卡片「修改描述和封面」**图标**（注意：点文字 .edit-cover-text 无效）
    await page.goto('https://channels.weixin.qq.com/platform/post/list', { waitUntil: 'domcontentloaded' });
    const card = page.locator('.post-feed-item').filter({ hasText: title.slice(0, 20) }).first();
    await card.waitFor({ timeout: 25000 });
    await card.locator('.edit-cover-item .opr-item').first().click({ timeout: 10000 });
    await page.waitForURL('**/post/coverEdit**', { timeout: 25000 });
    await page.waitForTimeout(5000);
    if (!page.url().includes(encodeURIComponent(objectId).replace(/'/g, "%27")) && !page.url().includes(objectId)) {
      console.log('WARN: coverEdit URL 与目标 objectId 不完全一致:', page.url());
    }
    console.log('ON_COVEREDIT');

    // 3) 打开「编辑封面」弹窗（.edit-btn 是 pointer-events:none，必须 force click；重试直到打开）
    let opened = false;
    for (let i = 0; i < 6 && !opened; i++) {
      await page.locator('.vertical-img-wrap').first().hover({ timeout: 4000 }).catch(() => {});
      await sleep(700);
      await page.locator('.edit-btn').first().click({ timeout: 4000, force: true }).catch(() => {});
      await sleep(1500);
      const disp = await page.locator('.edit-cover-dialog .weui-desktop-dialog__wrp').first()
        .evaluate((el) => el.style.display).catch(() => 'na');
      if (disp !== 'none' && disp !== 'na') opened = true;
    }
    if (!opened) { console.error('编辑封面弹窗打开失败'); process.exit(1); }
    console.log('DIALOG_OPENED');

    // 4) 切「上传封面」tab → 注入 → 等本地预览（data: base64）
    const tab = page.locator('.edit-cover-dialog').getByText('上传封面', { exact: true }).first();
    if (await tab.count()) await tab.click({ timeout: 6000, force: true }).catch(() => {});
    await sleep(1000);
    await page.locator('.single-cover-uploader-wrap input[type=file]').first().setInputFiles(coverPath, { timeout: 30000 });
    let ready = false;
    for (let i = 0; i < 20 && !ready; i++) {
      await sleep(1500);
      ready = await page.locator('.edit-cover-dialog img.img-wrap').first()
        .evaluate((im) => im.naturalWidth > 0 && (im.src || '').startsWith('data:')).catch(() => false);
    }
    if (!ready) { console.error('封面本地预览未生成（检查图片格式/大小）'); process.exit(1); }
    console.log('PREVIEW_READY');
    await sleep(3000); // 等图片读取/组件状态收尾

    // 5) 弹窗「确认」（DFS 上传，toast「封面已更新」）
    await page.locator('.edit-cover-dialog button', { hasText: /^确认$/ }).locator('visible=true').first()
      .click({ timeout: 8000, force: true });
    let closed = false;
    for (let i = 0; i < 15 && !closed; i++) {
      await sleep(1500);
      const disp = await page.locator('.edit-cover-dialog .weui-desktop-dialog__wrp').first()
        .evaluate((el) => el.style.display).catch(() => 'na');
      if (disp === 'none') closed = true;
    }
    if (!closed) { console.error('弹窗确认后未关闭'); process.exit(1); }
    console.log('DIALOG_CONFIRMED');

    // 6) 主页面「完成」→ 二次确认「确认修改」（modFlag=2 仅封面位，描述不置位）
    const done = page.locator('button:has-text("完成")').first();
    await done.waitFor({ timeout: 10000 });
    for (let i = 0; i < 8 && !(await done.isEnabled().catch(() => false)); i++) await sleep(1000);
    await done.click({ timeout: 10000 });
    const fin = page.locator('button:has-text("确认修改")').first();
    let finOk = false;
    for (let i = 0; i < 10; i++) {
      await sleep(1200);
      if (await fin.isVisible().catch(() => false)) { finOk = true; break; }
    }
    if (!finOk) { console.error('「确认修改」二次确认层未出现'); process.exit(1); }
    await fin.click({ timeout: 10000 });
    let redirected = false;
    for (let i = 0; i < 25; i++) {
      await sleep(1500);
      if (page.url().includes('post/list')) { redirected = true; break; }
    }
    console.log('SAVED:', redirected ? 'redirected_to_list' : 'no_redirect(check_verify)');
    if (!redirected) {
      const t = await page.evaluate(() => document.body.innerText).catch(() => '');
      console.log('PAGE_TEXT:', JSON.stringify(t.replace(/\n+/g, ' | ').slice(0, 300)));
    }

    // 7) 轮询 post_list 直到 coverUrl 变化（服务端处理 30-90s）
    const beforeEnc = encKey(beforeCover);
    let after = beforeCover;
    for (let i = 0; i < 30; i++) {
      await sleep(6000);
      const l = await postList(page);
      const it = l.find((x) => JSON.stringify(x).includes(objectId.slice(7))) || l.find((x) => descOf(x).includes(title.slice(0, 12)));
      after = coverUrlOf(it);
      if (after && encKey(after) !== beforeEnc) break;
    }
    const ok = after && encKey(after) !== beforeEnc;
    console.log(ok ? 'VERIFY: coverUrl 已变化（服务端生效）' : 'VERIFY: 超时未见 coverUrl 变化（可能仍在处理，稍后人工核对）');
    console.log('RESULT_JSON:', JSON.stringify({ ok, objectId, title, beforeEnc: beforeEnc.slice(0, 40), afterEnc: encKey(after).slice(0, 40) }));
    process.exit(ok ? 0 : 1);
  } finally {
    await ctx.close().catch(() => {});
  }
}
main().catch((e) => { console.error('ERROR:', e?.stack || e); process.exit(1); });
