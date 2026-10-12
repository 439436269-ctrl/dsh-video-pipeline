# 鍙戝竷娓呭崟锛堟湰浠撳簱涓撶敤鍧愭爣涓庡懡浠わ級

> **褰撳墠杩涘害锛?026-10-11锛?*
>
> | 姝ラ | 鐘舵€?|
> |---|---|
> | 鈶?GitHub 寤轰粨 + 鎺ㄩ€?| 鈴?**寰呭姙** 鈥斺€?缂?GitHub 鍑嵁锛坄credential.helper=manager` 宸查厤缃絾鏈瓨 github.com 鍑嵁锛涢潪浜や簰鎺㈡祴鎶?`Cannot prompt because user interactivity has been disabled`锛夈€傚缓浠?API 涔熼渶瑕?token锛屾垨鐢变綔鑰呭湪缃戦〉绔缓濂戒粨搴撳悗鎴戝彧鍋?push銆?|
> | 鈶?npm 鍙戝竷 | 鉁?**宸插畬鎴?* 鈥斺€?`dsh-video-pipeline@0.1.0`锛宻hasum `7c40c1647b549b737c65497bb6b51c94d85ee1ff`锛堜笌鏈湴鎵撳寘閫愬瓧鑺備竴鑷达級銆傝瑙?`VERIFY.md` 绗?8 鑺傘€?|
> | 鈶?甯傚満 PR | 鈴?寰呪憽涔嬪墠鍏堝缓浠擄紝涓斾粨搴撳垱寤烘弧 1 澶┿€傝处鍙蜂笅**宸叉湁 `awesome-dsh-plugin` 鐨?fork**锛屽彲璺宠繃 fork銆?|
>
> 鈿狅笍 鍙戝竷鎵€鐢?npm token 宸插嚭鐜板湪瀵硅瘽璁板綍閲岋紝纭鏃犺鍚庤鍒?npm 璁剧疆 **revoke**銆?
> 鍘熷瓙鐨勬搷浣滅粏鑺傚湪 skill `dsh-plugin-publish-repo`銆乣dsh-plugin-publish-npm` 閲岋紱鏈枃浠跺彧璁板綍**杩欎釜浠撳簱鑷繁鐨?*鍙栧€硷紝閬垮厤姣忔閮藉幓鍥炴函銆?
## 鍧愭爣

| 椤?| 鍊?|
|---|---|
| npm 鍖呭悕 | `dsh-video-pipeline`锛堝凡鏌ラ噸锛歳egistry 404锛屽彲鐢級 |
| 鐗堟湰 | `0.1.0` |
| GitHub 浠撳簱 | `439436269-ctrl/dsh-video-pipeline`锛堢洰鏍囷紝灏氭湭鍒涘缓锛?|
| 甯傚満鏉＄洰鏂囦欢 | `data/plugins/439436269-ctrl__dsh-video-pipeline.yml`锛堝唴瀹硅 `publish/market-entry.yml`锛?|
| 甯傚満鍒嗙被 | `skill` |
| 缃插悕 | `vfvrpq` / <https://github.com/439436269-ctrl> |

## 褰撳墠鍓嶇疆鏉′欢锛?026-10-11 瀹炴祴锛?
| 闇€瑕?| 鐘舵€?|
|---|---|
| GitHub 鍑嵁 | 鉂?`credential.helper=manager` 宸查厤缃紝浣?*鏈瓨** github.com 鍑嵁锛涢潪浜や簰鎺㈡祴鎶?`Cannot prompt because user interactivity has been disabled`銆傞娆?`git push` 浼氬脊鍑嵁绠＄悊鍣ㄧ獥鍙ｏ紝鎴栧厛鎻愪緵 token銆?|
| npm Automation token | 鉂?`~/.secrets/keys.env` 涓嶅瓨鍦紝`NPM_AUTOMATION_TOKEN` 鐜鍙橀噺鏈缃€傛寜 `dsh-plugin-publish-npm` 鐨勭害瀹氾紝token 鐨勫敮涓€鐪熸簮鏄?`~/.secrets/keys.env`銆?|
| 浠撳簱骞撮緞 | 寤轰粨鍚庨渶婊?**1 澶?*鎵嶈兘鎻愬競鍦?PR锛堜粨搴撳勾榫勯棬妲涚敱 CI 鑷姩妫€鏌ワ級 |

瀵嗛挜璇?*涓嶈**璐磋繘瀵硅瘽鎴栧啓杩涗粨搴擄紱鏀?`~/.secrets/keys.env` 涓€琛屼竴涓嵆鍙紝鎴戜細鍐欎复鏃?npmrc銆佺敤瀹屽嵆鍒犮€?
## 涓夋潯鍙戝竷娓犻亾涓庡懡浠?
> **鍏堣窇涓€娆¤嚜妫€**锛歚node tools/preflight.mjs` 鈥斺€?鍙銆佷笉鎺ㄩ€併€佷笉鍙戝竷銆傚畠浼氭牳瀵瑰寘娓呭崟锛坄dsh.bundle`銆佺讲鍚嶃€乣repository`銆乣files` 鐧藉悕鍗曪級銆佽繙绔悕瀛楀崰鐢ㄣ€乬it 鐘舵€併€佷笁閬撴湰鍦伴棬涓庡嚟鎹紝骞剁粰鍑恒€屾湰鍦版槸鍚﹀凡鍙彂 + 杩樺樊鍝簺澶栭儴鏉′欢銆嶇殑鏄庣‘鍒ゅ喅銆傛湰鍦伴棶棰樹細璁╁畠闈為浂閫€鍑猴紝缂哄嚟鎹彧鍗曠嫭鍒楀嚭锛堥偅鏄閮ㄦ潯浠讹紝涓嶆槸鍖呯殑缂洪櫡锛夈€?
> **椤哄簭鏈夌‖绾︽潫锛氬厛寤轰粨鎺ㄩ€侊紝鍐嶅彂 npm銆?* npm 椤甸潰娓叉煋鐨勬槸 tarball 閲岀殑 README锛岃€?README 椤堕儴閭ｅ紶缂栨帓鍥剧敤鐨勬槸
> `https://raw.githubusercontent.com/439436269-ctrl/dsh-video-pipeline/main/...` 缁濆鍦板潃
> 锛堢浉瀵硅矾寰勫湪 npm 椤甸潰涓婃嬁涓嶅埌锛夈€備粨搴撴病鍏堝叕寮€锛宯pm 椤甸潰鐨勫浘灏辨槸鍧忕殑銆?> `screenshots.json` 涔熸寚鍚戜粨搴撳唴鐨勫浘锛屽悓鐞嗐€?
### 1. GitHub 寤轰粨 + 鎺ㄩ€?
```sh
# 寤轰粨锛圓PI锛宼opic 鍙兘灏忓啓 ASCII锛宒sh-plugin 蹇呭甫锛?#   POST https://api.github.com/user/repos
#   {"name":"dsh-video-pipeline","private":false,"has_issues":true,"has_wiki":false,"auto_init":false,
#    "description":"DSH 鎻掍欢锛氭妸涓€鏉＄煭瑙嗛鐢熶骇娴佹按绾匡紙19 涓?skill锛夊唴缃繘 agent 鎶€鑳界洰褰?,
#    "homepage":"https://www.npmjs.com/package/dsh-video-pipeline"}
#   PUT /repos/439436269-ctrl/dsh-video-pipeline/topics
#   {"names":["dsh","dsh-plugin","deepseek-harness","cordis","skill","video","ffmpeg"]}
cd <repo>
git remote add origin https://github.com/439436269-ctrl/dsh-video-pipeline.git
git push -u origin main
git ls-remote origin refs/heads/main     # 鐢ㄨ繙绔?SHA 鏍稿锛屼笉瑕佸彧鐪嬪懡浠ゆ病鎶ラ敊
```

### 2. npm 鍙戝竷

```sh
. $HOME\.secrets\load.ps1                                   # 杞藉叆 NPM_AUTOMATION_TOKEN
$rc = Join-Path $env:TEMP "npmrc-video-pipeline"
"//registry.npmjs.org/:_authToken=$env:NPM_AUTOMATION_TOKEN" | Set-Content $rc -Encoding ascii
$env:NPM_CONFIG_USERCONFIG = $rc
npm run check; npm test; npm run privacy-gate; npm run verify:artifact
npm publish --no-git-checks
Remove-Item $rc                                             # 绔嬪埢鍒?```

鈿狅笍 **staged publishing**锛歚npm publish` 鎵撳嵃鎴愬姛鍙唬琛ㄨ繘浜嗘殏瀛樺尯锛宺egistry 鑷姩 promote 闇€ 6锝?2 鍒嗛挓銆傜獥鍙ｆ湡鍐?`dist-tags.latest` 杩樻槸鏃у€笺€乣GET /<name>/<version>` 404銆佸悓鐗堟湰閲嶅彂鎶?`409 Cannot publish over previously staged version` 鈥斺€?**閮戒笉鏄け璐?*锛岀瓑 10锝?5 鍒嗛挓鍐嶇敤涓や釜绔偣纭銆俷pm 鍖呬笉鍙挙鍥炪€?
### 3. 甯傚満 PR

```sh
# 浠撳簱鍒涘缓婊?1 澶╁悗锛屾妸 publish/market-entry.yml 鐨勫唴瀹瑰啓鍒?#   data/plugins/439436269-ctrl__dsh-video-pipeline.yml
# 鍐嶇粰 awesome-dsh-plugin/awesome-dsh-plugin 鎻?PR锛堜竴涓?PR 鏈€澶?3 鏉★級銆?```

**鍔犻€熺偣**锛氳处鍙?`439436269-ctrl` 涓?*宸茬粡鏈?`awesome-dsh-plugin` 鐨?fork**锛?026-10-11 瀹炴祴锛夛紝鎵€浠ョ 3 姝ュ彲浠ヨ烦杩?fork锛岀洿鎺ュ湪宸叉湁 fork 涓婂紑鍒嗘敮鍐欐枃浠躲€佸啀寮€ PR銆備綔鑰呭彟鏈?5 涓凡鍙戝竷鐨?DSH 鎻掍欢锛坄dsh-zspace` / `dsh-piano` / `dsh-scroll-piano` / `dsh-session-path` / `dsh-pinned-sessions`锛夛紝鍙戝竷娴佺▼宸茶窇閫氳繃銆?