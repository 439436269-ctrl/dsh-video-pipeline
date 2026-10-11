// 只读采集：抖音 content/manage work_list（含 statistics）→ dy-stats.json
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const PW = '{{USER_HOME}}/AppData/Local/npm-cache/_npx/a5b920f00216d246/node_modules/playwright';
const { chromium } = require(PW);

const profile = process.argv[2] || '{{WORKSPACE}}/sample-diary-map/.dy-profile';
// 填入要统计的作品 aweme_id（本包已剥离作者的真实清单）
const TARGET = new Set([
  // '7xxxxxxxxxxxxxxxxxx',
]);

const browser = await chromium.launchPersistentContext(profile, {
  channel: 'chrome',
  headless: true,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  locale: 'zh-CN',
});
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(60000);
  await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  const all = await page.evaluate(async () => {
    const out = [];
    let cursor = 0, hasMore = true, pages = 0;
    while (hasMore && pages < 80) {
      pages++;
      const u = `/janus/douyin/creator/pc/work_list?status=0&count=50&max_cursor=${cursor}&scene=star_atlas&device_platform=android&aid=1128`;
      const r = await fetch(u, { credentials: 'include' });
      const j = await r.json();
      const list = j.aweme_list || [];
      for (const a of list) {
        out.push({
          aweme_id: a.aweme_id || a.object_id,
          desc: (a.desc || '').slice(0, 200),
          create_time: a.create_time,
          duration: a.duration,
          status: a.status,
          statistics: a.statistics || null,
          mix_name: (a.mix_info && (a.mix_info.name || a.mix_info.mix_name)) || null,
        });
      }
      hasMore = !!(j.has_more || j.hasMore);
      cursor = j.max_cursor ?? j.cursor ?? j.next_cursor ?? 0;
      if (!list.length) break;
      await new Promise((res) => setTimeout(res, 300));
    }
    return { pages, total: out.length, items: out };
  });
  const tang = all.items.filter((x) => (x.desc || '').includes('一首诗一出戏'));
  fs.writeFileSync('dy_works_all.json', JSON.stringify(all, null, 2), 'utf8');
  console.log(`pages=${all.pages} total=${all.total} tang=${tang.length}`);
  for (const t of tang) {
    const s = t.statistics || {};
    const d = t.create_time ? new Date(t.create_time * 1000).toISOString().slice(0, 16).replace('T', ' ') : '?';
    const mark = TARGET.has(t.aweme_id) ? '★' : ' ';
    console.log(`${mark}${t.aweme_id} [${d}] dur=${t.duration} play=${s.play_count} digg=${s.digg_count} cm=${s.comment_count} share=${s.share_count} coll=${s.collect_count} | ${(t.desc || '').slice(0, 44)}`);
  }
  const payload = { collectedAt: new Date().toISOString(), profile, items: tang };
  fs.writeFileSync('dy-stats.json', JSON.stringify(payload, null, 2), 'utf8');
  const missing = [...TARGET].filter((id) => !tang.some((t) => t.aweme_id === id));
  console.log('MISSING_TARGETS=' + JSON.stringify(missing));
  console.log('WROTE dy-stats.json');
} finally {
  await browser.close();
}
