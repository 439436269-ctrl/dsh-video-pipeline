// 抖音创作者中心只读 API 盘点：作品分页(筛唐诗) + 合集列表
// 用法：node dy_api.mjs [works|mix|all]
import { createRequire } from 'node:module';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const PW = '{{USER_HOME}}/AppData/Local/npm-cache/_npx/a5b920f00216d246/node_modules/playwright';
const { chromium } = require(PW);

const profile = '{{WORKSPACE}}/sample-diary-map/.dy-profile';
const cmd = process.argv[2] || 'all';

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
    page.setDefaultTimeout(60000);
    await page.goto('https://creator.douyin.com/creator-micro/content/manage', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);

    if (cmd === 'works' || cmd === 'all') {
      const works = await page.evaluate(async () => {
        const out = [];
        let cursor = 0;
        let hasMore = true;
        let pages = 0;
        while (hasMore && pages < 80) {
          pages++;
          const u = `/janus/douyin/creator/pc/work_list?status=0&count=50&max_cursor=${cursor}&scene=star_atlas&device_platform=android&aid=1128`;
          const r = await fetch(u, { credentials: 'include' });
          const j = await r.json();
          const list = j.aweme_list || [];
          for (const a of list) {
            out.push({
              aweme_id: a.aweme_id || a.object_id,
              title: (a.desc || a.title || '').slice(0, 120),
              create_time: a.create_time,
              status: a.status,
              mix_id: a.mix_id || (a.mix_info && (a.mix_info.mix_id || a.mix_info.id)) || null,
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
      fs.writeFileSync('dy_works_all.json', JSON.stringify(works, null, 2));
      const tang = works.items.filter((x) => x.title.includes('一首诗一出戏'));
      fs.writeFileSync('dy_works_tang.json', JSON.stringify(tang, null, 2));
      console.log('WORKS pages=' + works.pages + ' total=' + works.total + ' tang=' + tang.length);
      for (const t of tang) {
        const d = t.create_time ? new Date(t.create_time * 1000).toISOString().slice(0, 16) : '?';
        console.log(`${t.aweme_id} [${d}] mix=${t.mix_id || '-'} ${t.title}`);
      }
    }

    if (cmd === 'mix' || cmd === 'all') {
      const mixes = await page.evaluate(async () => {
        const out = [];
        let cursor = 0;
        let hasMore = true;
        let pages = 0;
        while (hasMore && pages < 10) {
          pages++;
          const u = `/web/api/mix/list/?status=0,1,2,3,6&count=20&cursor=${cursor}&cookie_enabled=true&screen_width=1280&screen_height=720&browser_language=zh-CN&browser_platform=Win32&browser_name=Mozilla&browser_version=5.0`;
          const r = await fetch(u, { credentials: 'include' });
          const j = await r.json();
          for (const m of j.mix_list || []) {
            out.push({
              mix_id: m.mix_id || m.id,
              name: m.name || m.mix_name,
              desc: (m.desc || '').slice(0, 100),
              aweme_count: m.aweme_count,
              status: m.status,
              create_time: m.create_time,
              cover: (m.cover_url && m.cover_url.uri) || '',
              raw_keys: Object.keys(m),
            });
          }
          hasMore = !!j.has_more;
          cursor = j.cursor ?? 0;
          if (!(j.mix_list || []).length) break;
          await new Promise((res) => setTimeout(res, 300));
        }
        return out;
      });
      fs.writeFileSync('dy_mix_list.json', JSON.stringify(mixes, null, 2));
      console.log('MIXES: ' + mixes.length);
      for (const m of mixes) console.log(`${m.mix_id} | ${m.name} | count=${m.aweme_count} | status=${m.status} | keys=${m.raw_keys.join(',')}`);
    }
  } finally {
    await browser.close();
  }
}
main().catch((e) => {
  console.error('ERROR: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
