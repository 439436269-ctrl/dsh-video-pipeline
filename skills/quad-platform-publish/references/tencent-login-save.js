const path = require("path");
const base = "{{USER_HOME}}/.tools/social-publish-skills";
const { chromium } = require(path.join(base, "node_modules", "playwright-core"));
const { execSync } = require("child_process");
const fs = require("fs");
const STATE = "{{USER_HOME}}/.social-publish-skills/cookies/tencent/default.json";
const LOG = "<本机会话产物路径>";
const say = (m) => { try { fs.appendFileSync(LOG, new Date().toISOString().slice(11,19) + " " + m + "\n"); } catch(e){} };
const engineCheck = () => {
  try {
    const out = execSync('node "' + path.join(base, "dist/cli.js") + '" tencent check --account default', { encoding: "utf8", timeout: 30000 });
    return /valid/.test(out);
  } catch(e) { return false; }
};
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: false });
  say("launched");
  const page = await browser.newPage();
  await page.goto("https://channels.weixin.qq.com/platform", { waitUntil: "domcontentloaded", timeout: 60000 });
  say("goto");
  let done = false;
  for (let i = 0; i < 48; i++) {   // 最多4分钟
    await page.waitForTimeout(5000);
    let t = "";
    try { t = await page.evaluate(() => document.body.innerText.slice(0, 2500)); } catch(e) { continue; }
    if (/视频ID|sphN/.test(t)) {
      const st = await page.context().storageState();
      if (st.cookies.length > 0) {
        fs.writeFileSync(STATE, JSON.stringify(st, null, 2));
        say("SAVED cookies=" + st.cookies.length + " @" + ((i+1)*5) + "s");
        if (engineCheck()) { say("ENGINE_VALID"); done = true; break; }
        say("saved but engine invalid, retry loop");
      }
    }
    if (i % 6 === 0) say("wait" + i);
  }
  if (!done) say("GIVE_UP");
  await browser.close();
  say("closed");
})().catch(e => say("ERR " + e.message));
