// 向指定合集按顺序添加作品：打开编辑页 → 抽屉滚动加载 → 逐条点 + → 关抽屉 → 保存
// 用法：node dy_add.mjs <mixId> <targetFile.json>
// targetFile: [{ep, prefix}]  prefix=标题前缀匹配（如 "一首诗一出戏01｜"）
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const PW = '{{USER_HOME}}/AppData/Local/npm-cache/_npx/a5b920f00216d246/node_modules/playwright';
const { chromium } = require(PW);

const profile = '{{WORKSPACE}}/sample-diary-map/.dy-profile';
const mixId = process.argv[2];
const targets = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));

const netlog = [];

async function main() {
  const browser = await chromium.launchPersistentContext(profile, {
    channel: 'chrome',
    headless: true,
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    locale: 'zh-CN',
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    page.on('response', async (res) => {
      try {
        const req = res.request();
        if (!res.url().includes('douyin')) return;
        if (!['xhr', 'fetch'].includes(req.resourceType())) return;
        const entry = { method: req.method(), url: res.url(), status: res.status(), post: req.postData() || null };
        try {
          if ((res.headers()['content-type'] || '').includes('json')) entry.body = (await res.text()).slice(0, 150000);
        } catch (e) { /* ignore */ }
        netlog.push(entry);
      } catch (e) { /* ignore */ }
    });
    await page.goto(`https://creator.douyin.com/creator-micro/content/collection/detail/${mixId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4500);
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('button,span,div,a')].find((e) => {
        const t = (e.innerText || '').trim();
        return t === '点击添加作品' || t === '添加作品';
      });
      if (el) el.click();
    });
    await page.waitForTimeout(5000);

    // 逐个目标：滚动查找 → 点 +
    for (const t of targets) {
      let done = false;
      for (let attempt = 0; attempt < 40 && !done; attempt++) {
        const res = await page.evaluate((prefix) => {
          let rows = [...document.querySelectorAll('[class*=drawer-item-]')];
          if (!rows.length) rows = [...document.querySelectorAll('.semi-sidesheet [class*=item]')];
          const row = rows.find((r) => {
            const title = r.querySelector('[class*=info-title]') || r.querySelector('[class*=title]');
            return title && title.innerText.trim().startsWith(prefix);
          });
          if (row) {
            const plus = row.querySelector('[class*=plus-area]');
            if (plus) { plus.click(); return 'CLICKED'; }
            return 'ROW_NO_PLUS';
          }
          // 滚动容器加载更多
          const main = document.querySelector('.semi-sidesheet [class*=main-]') || document.querySelector('[class*=main-H6Euej]');
          if (main) main.scrollTop = main.scrollTop + 600;
          else window.scrollBy(0, 600);
          return 'SCROLL';
        }, t.prefix);
        if (res === 'CLICKED') {
          done = true;
          console.log(`EP${t.ep}: CLICKED + for [${t.prefix}]`);
          await page.waitForTimeout(700);
        } else if (res === 'ROW_NO_PLUS') {
          console.log(`EP${t.ep}: ROW found but NO plus, retry`);
          await page.waitForTimeout(500);
        } else {
          await page.waitForTimeout(400);
        }
      }
      if (!done) console.log(`EP${t.ep}: FAILED to find/click [${t.prefix}]`);
    }
    await page.waitForTimeout(2000);
    // 关闭抽屉
    const closed = await page.evaluate(() => {
      const icon = document.querySelector('.semi-sidesheet [class*=icon-fZcWbp]');
      if (icon) { icon.click(); return 'CLOSED_ICON'; }
      return 'NO_CLOSE';
    });
    console.log('DRAWER: ' + closed);
    await page.waitForTimeout(2000);
    // 点「保存」（编辑页按钮）
    const saved = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].filter((b) => b.innerText.trim() === '保存');
      if (!btns.length) return 'NO_SAVE';
      btns[0].click();
      return 'SAVE_CLICKED';
    });
    console.log('SAVE: ' + saved);
    await page.waitForTimeout(8000);
    console.log('URL: ' + page.url());
    const body = await page.evaluate(() => document.body.innerText.slice(0, 1800));
    console.log('--- PAGE ---');
    console.log(body);
    fs.writeFileSync('dy_add_net.json', JSON.stringify(netlog, null, 2));
    console.log('--- NET ---');
    for (const e of netlog) {
      if (/monitor|zijieapi|passport|ttwid|\.js|\.css|charge|msg\/|im\/token|user\/info|anchor\/search|sts2|oversea|fans\/index|mcn\/|relation|ai_creation|unread|top\?|get_create_info|check\/user|prefetch|mono\/|goofy\/|playlet|paid\/agreement|mix\/rule|mix_permission|collection\/notice|get\/url|personal\/search|work_list|item\/mix\/mget/.test(e.url)) continue;
      console.log(`${e.method} ${e.status} ${e.url.slice(0, 220)}`);
      if (e.post) console.log('   POST: ' + e.post.slice(0, 600));
      if (e.body) console.log('   RESP: ' + e.body.slice(0, 900));
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error('ERROR: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
