// 视频号合集操作：create / add / order / verify / all
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const require = createRequire(import.meta.url);
const PW = '{{USER_HOME}}/AppData/Local/npm-cache/_npx/a5b920f00216d246/node_modules/playwright';
const { chromium } = require(PW);

const COOKIES = '{{USER_HOME}}/.social-publish-skills/cookies/tencent/default.json';
const PROFILE = path.join(os.homedir(), '.tencent-heji-profile');
const BASE = '/micro/content/cgi-bin/mmfinderassistant-bin';
const STATE = 'heji-state.json'; // {read:{id,name},story:{id,name}}

const cmd = process.argv[2];
const TITLE_READ = process.argv[3] || '一首诗一出戏 · 读诗版';
const TITLE_STORY = process.argv[4] || '一首诗一出戏 · 故事版';

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

function mkApi(page) {
  return async function api(p, body) {
    const r = await page.evaluate(
      async ({ p, body }) => {
        const url = p + '?_aid=3bfb7216-b2df-4e26-aeee-481e7cad250d&_rid=' + Math.random().toString(36).slice(2) +
          '&_pageUrl=' + encodeURIComponent('https://channels.weixin.qq.com/platform');
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
        const text = await res.text().catch(() => '');
        let json = null; try { json = JSON.parse(text); } catch (e) { /* ignore */ }
        return { status: res.status, json, text: text.slice(0, 500) };
      },
      { p, body }
    );
    return r;
  };
}

const readOrder = [
  '一首诗一出戏01·题都城南庄', '一首诗一出戏02·过华清宫', '一首诗一出戏03·卖炭翁',
  '一首诗一出戏04·凉州词', '一首诗一出戏05·黄鹤楼送广陵', '一首诗一出戏06·宫词', '一首诗一出戏07·枫桥夜泊',
  '一首诗一出戏08·金缕衣', '一首诗一出戏09·游子吟', '一首诗一出戏10·闺怨', '一首诗一出戏11·早发白帝城',
  '一首诗一出戏12·石壕吏', '一首诗一出戏13·黄鹤楼', '一首诗一出戏14·行路难',
  '一首诗一出戏15·白雪歌（读诗版）',
  '一首诗一出戏16·泊秦淮（读诗版）',
  '一首诗一出戏17·出塞（读诗版）',
  '一首诗一出戏18·茅屋（读诗版）',
  '一首诗一出戏19·将进酒（读诗版）',
  '一首诗一出戏20·别董大（读诗版）',
  '一首诗一出戏21·登鹳雀楼（读诗版）',
];
const storyOrder = [
  '一首诗一出戏01·门上那行字', '一首诗一出戏02·一骑红尘', '一首诗一出戏03·一车炭',
  '一首诗一出戏04·醉卧沙场', '一首诗一出戏05·孤帆', '一首诗一出戏06·深宫二十年', '一首诗一出戏07·夜半钟声',
  '一首诗一出戏08·空折枝', '一首诗一出戏09·密密缝', '一首诗一出戏10·悔教夫婿', '一首诗一出戏11·轻舟',
  '一首诗一出戏12·夜久语声绝', '一首诗一出戏13·搁笔', '一首诗一出戏14·云帆',
  '一首诗一出戏15·白雪歌（故事版）',
  '一首诗一出戏16·泊秦淮（故事版）',
  '一首诗一出戏17·出塞（故事版）',
  '一首诗一出戏18·茅屋（故事版）',
  '一首诗一出戏19·将进酒（故事版）',
  '一首诗一出戏20·别董大（故事版）',
];

function loadState() { try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch (e) { return {}; } }
function saveState(s) { fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); }

function pickIds(posts, orderTitles) {
  return orderTitles.map((t) => {
    const hit = posts.find((x) => x.desc === t) || posts.find((x) => (x.desc || '').includes(t));
    if (!hit) throw new Error('post not found: ' + t);
    return hit;
  });
}

async function main() {
  const posts = JSON.parse(fs.readFileSync('posts.json', 'utf8'));
  const ctx = await launch();
  try {
    const page = await ctx.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'zh-CN,zh;q=0.9' });
    await page.goto('https://channels.weixin.qq.com/platform', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const api = mkApi(page);
    const state = loadState();

    if (cmd === 'create') {
      for (const [key, title] of [['read', TITLE_READ], ['story', TITLE_STORY]]) {
        const r = await api(BASE + '/collection/create_collection', { name: title, collectionBusinessType: 0 });
        console.log(key, title, JSON.stringify(r).slice(0, 600));
        const cid = r.json?.data?.collectionId;
        if (cid) { state[key] = { id: cid, name: title }; saveState(state); }
      }
    } else if (cmd === 'list') {
      const r = await api(BASE + '/collection/get_collection_list', { pageNum: 1, pageSize: 50, collectionScene: 0, collectionBusinessType: 0 });
      console.log(JSON.stringify(r.json, null, 2).slice(0, 4000));
    } else if (cmd === 'add') {
      for (const [key, order] of [['read', readOrder], ['story', storyOrder]]) {
        const cid = state[key]?.id;
        if (!cid) throw new Error('no collection id for ' + key + '; run create first');
        const cur = await api(BASE + '/collection/get_collection_feed_list', { collectionId: cid, pageNum: 1, pageSize: 50 });
        const exist = new Set((cur.json?.data?.objectInfo || []).map((it) => it.feed?.objectId));
        const feeds = pickIds(posts, order).filter((f) => !exist.has(f.objectId));
        if (!feeds.length) { console.log('add', key, 'SKIP(已全量)'); continue; }
        const r = await api(BASE + '/collection/mod_collection_feed', {
          collectionId: cid, collectionScene: 0, opType: 1,
          objectInfo: feeds.map((f) => ({ objectId: f.objectId })),
        });
        console.log('add', key, `(+${feeds.length})`, JSON.stringify(r).slice(0, 600));
        await page.waitForTimeout(1500);
      }
    } else if (cmd === 'verify') {
      for (const key of ['read', 'story']) {
        const cid = state[key]?.id;
        if (!cid) { console.log(key, 'no id'); continue; }
        const r = await api(BASE + '/collection/get_collection_feed_list', { collectionId: cid, pageNum: 1, pageSize: 50 });
        const list = r.json?.data?.objectInfo || [];
        console.log(`--- ${key} (${state[key].name}) count=${r.json?.data?.collectionFeedCount} ---`);
        list.forEach((it, i) => console.log(i + 1, it.sortId, it.feed?.desc?.description?.split('\n')[0] || it.feed?.desc?.shortTitle?.[0]?.shortTitle || it.feed?.objectId));
        fs.writeFileSync(`heji-feeds-${key}.json`, JSON.stringify(r.json, null, 2));
      }
    } else if (cmd === 'reorder') {
      for (const [key, order] of [['read', readOrder], ['story', storyOrder]]) {
        const cid = state[key]?.id;
        const r0 = await api(BASE + '/collection/get_collection_feed_list', { collectionId: cid, pageNum: 1, pageSize: 50 });
        const items = r0.json?.data?.objectInfo || [];
        const feeds = pickIds(posts, order);
        const ordered = feeds.map((f) => {
          const hit = items.find((it) => it.feed?.objectId === f.objectId);
          if (!hit) throw new Error('feed not in collection: ' + f.desc);
          return { sortId: hit.sortId, objectId: f.objectId };
        });
        const r = await api(BASE + '/collection/mod_collection_feed', {
          collectionId: cid, collectionScene: 0, opType: 2, objectInfo: ordered,
        });
        console.log('reorder', key, JSON.stringify(r).slice(0, 600));
      }
    } else if (cmd === 'info') {
      for (const key of ['read', 'story']) {
        const cid = state[key]?.id;
        if (!cid) continue;
        const r = await api(BASE + '/collection/get_collection_info', { collectionId: cid, collectionBusinessType: 0 });
        console.log(key, JSON.stringify(r.json, null, 2).slice(0, 2500));
      }
    } else {
      console.error('usage: create|list|add|verify|reorder|info');
      process.exit(2);
    }
  } finally {
    await ctx.close();
  }
}
main().catch((e) => { console.error('ERROR: ' + (e?.stack || e)); process.exit(1); });
