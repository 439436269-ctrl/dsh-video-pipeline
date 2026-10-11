// 只读采集：B站 seasons_archives_list（BV 清单）+ x/web-interface/view（完整 stat）
// node bili_stats.mjs  → bili-stats.json
import fs from 'node:fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const MID = '<你的 B 站 UID>';
const SEASONS = { dushi: '<你的 B 站合集 seasonId>', gushi: '<你的 B 站合集 seasonId>' };
const ck = JSON.parse(fs.readFileSync('{{USER_HOME}}/.bilibili/cookies.json', 'utf8'));
const COOKIES = (ck.cookie_info?.cookies || []).map((c) => `${c.name}=${c.value}`).join('; ');

async function get(url) {
  const r = await fetch(url, {
    headers: {
      'user-agent': UA,
      cookie: COOKIES,
      referer: 'https://www.bilibili.com/',
      origin: 'https://www.bilibili.com',
    },
    redirect: 'follow',
  });
  const t = await r.text();
  if (!t.trim().startsWith('{')) return { code: -999, message: 'NON_JSON ' + t.slice(0, 120) };
  return JSON.parse(t);
}

async function archivesOf(seasonId) {
  const out = [];
  let pn = 1;
  while (pn <= 5) {
    const u = `https://api.bilibili.com/x/polymer/web-space/seasons_archives_list?mid=${MID}&season_id=${seasonId}&page_num=${pn}&page_size=30&sort_reverse=false`;
    const j = await get(u);
    if (j.code !== 0) { console.log(`season ${seasonId} p${pn} ERR ${JSON.stringify(j).slice(0, 200)}`); break; }
    const d = j.data || {};
    const list = d.archives || [];
    out.push(...list);
    if (!d.page || out.length >= d.page.total || list.length === 0) break;
    pn++;
    await new Promise((r) => setTimeout(r, 400));
  }
  return out;
}

const result = { collectedAt: new Date().toISOString(), source: 'seasons_archives_list + x/web-interface/view', seasons: {} };

for (const [ver, sid] of Object.entries(SEASONS)) {
  const list = await archivesOf(sid);
  console.log(`--- ${ver} season=${sid} n=${list.length} ---`);
  result.seasons[ver] = [];
  for (const a of list) {
    const j = await get(`https://api.bilibili.com/x/web-interface/view?bvid=${a.bvid}`);
    const st = j.code === 0 ? j.data.stat : (a.stat || {});
    const meta = {
      season: ver, seasonId: sid, bvid: a.bvid, aid: a.aid, title: a.title,
      duration: j.code === 0 ? j.data.duration : a.duration,
      pubdate: j.code === 0 ? j.data.pubdate : a.pubdate,
      view: st.view ?? null, danmaku: st.danmaku ?? null, reply: st.reply ?? null,
      favorite: st.favorite ?? null, coin: st.coin ?? null, share: st.share ?? null, like: st.like ?? null,
      err: j.code === 0 ? null : String(j.message || j.code),
    };
    result.seasons[ver].push(meta);
    console.log(`${a.bvid} v=${meta.view} like=${meta.like} fav=${meta.favorite} coin=${meta.coin} reply=${meta.reply} dm=${meta.danmaku} share=${meta.share} dur=${meta.duration} pub=${new Date(meta.pubdate * 1000).toISOString().slice(5, 16).replace('T', ' ')} ${meta.err || ''} | ${a.title.slice(0, 42)}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

fs.writeFileSync('bili-stats.json', JSON.stringify(result, null, 2), 'utf8');
console.log('WROTE bili-stats.json');
