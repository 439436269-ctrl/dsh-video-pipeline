// 回读验证：拉取指定合集的 item/list（顺序即合集内顺序）+ 合集列表状态
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const PW = '{{USER_HOME}}/AppData/Local/npm-cache/_npx/a5b920f00216d246/node_modules/playwright';
const { chromium } = require(PW);

const profile = '{{WORKSPACE}}/sample-diary-map/.dy-profile';
const mixIds = process.argv.slice(2);

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
    await page.goto('https://creator.douyin.com/creator-micro/content/manage?tab=collections', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const out = await page.evaluate(async (ids) => {
      const result = { mixes: [], items: {} };
      // 合集列表
      let cursor = 0, hasMore = true, pages = 0;
      while (hasMore && pages < 5) {
        pages++;
        const r = await fetch(`/web/api/mix/list/?status=0,1,2,3,6&count=20&cursor=${cursor}&cookie_enabled=true`, { credentials: 'include' });
        const j = await r.json();
        for (const m of j.mix_list || []) {
          result.mixes.push({
            mix_id: m.mix_id, name: m.mix_name, status: m.status && m.status.status,
            total_episode: m.total_episode, create_time: m.create_time,
          });
        }
        hasMore = !!j.has_more; cursor = j.cursor || 0;
        if (!(j.mix_list || []).length) break;
      }
      // 每个合集的 item 顺序
      for (const id of ids) {
        const r = await fetch(`/web/api/mix/item/list/?mix_id=${id}&count=50&cursor=0&cookie_enabled=true`, { credentials: 'include' });
        const j = await r.json();
        result.items[id] = (j.aweme_list || []).map((a, i) => ({
          idx: i + 1,
          aweme_id: a.aweme_id,
          title: (a.desc || '').slice(0, 60),
          mix_item_id: a.mix_item_id || null,
        }));
      }
      // mix detail 状态
      result.details = {};
      for (const id of ids) {
        const r = await fetch(`/aweme/v1/mix/detail/?mix_id=${id}&req_from=pc&version_code=28.0.0`, { credentials: 'include' });
        const j = await r.json();
        const mi = j.mix_info || {};
        result.details[id] = { name: mi.mix_name, status: mi.status, statis: mi.statis };
      }
      return result;
    }, mixIds);
    fs.writeFileSync('dy_verify.json', JSON.stringify(out, null, 2));
    console.log('=== MIX LIST ===');
    for (const m of out.mixes) console.log(`${m.mix_id} | ${m.name} | status=${JSON.stringify(m.status)} | episodes=${m.total_episode}`);
    console.log('\n=== DETAILS ===');
    for (const [id, d] of Object.entries(out.details)) console.log(`${id} | ${d.name} | status=${JSON.stringify(d.status)} | statis=${JSON.stringify(d.statis)}`);
    console.log('\n=== ITEM ORDER ===');
    for (const [id, items] of Object.entries(out.items)) {
      console.log(`\nmix ${id} (${items.length} items):`);
      for (const it of items) console.log(`  ${it.idx}. ${it.aweme_id} ${it.title}`);
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error('ERROR: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
