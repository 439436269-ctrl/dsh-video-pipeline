---
name: tencent-upload
description: 当 agent 需要完成微信视频号登录、cookie 校验、视频发布、进度可视化与合集管理（创建合集/加视频/排序/验证）时使用。使用本仓库 TypeScript 引擎与 Playwright；命令为 node dist/cli.js tencent check|login|upload（或 npm run dev --）；合集走 channels.weixin.qq.com 的 collection/* 接口（脚本在 scripts/heji/）。不依赖任何第三方上传仓库。 Use when the user wants to publish a video to WeChat Channels (shipinhao) or manage 视频号合集.
---
## 本机引擎位置

引擎已安装于 `{{USER_HOME}}\.tools\social-publish-skills`（引擎根目录）。
所有 `node dist/cli.js ...` 命令必须先 `Set-Location` 到该目录执行；依赖与 `dist/` 已就绪，缺文件时在引擎根目录 `npm run build`（Windows 构建坑已修）。
浏览器走系统 Chrome（`channel: chrome`），**不要**跑 `npx playwright install chromium`（下载源被墙）。
Cookie 目录：`%USERPROFILE%\.social-publish-skills\cookies\`。


# 视频号上传 Skill

## Agent 执行规则（重要）

- 默认由 Agent 在仓库根目录**直接执行命令**，不要让用户手动复制粘贴命令。
- 只有在必须人工完成的步骤（扫码、短信验证码、账号确认、终端按 Enter、Inspector Resume）才请求用户介入。
- 若缺少 `dist/cli.js` 或依赖未安装，Agent 先自动执行 `npm install`、`npx playwright install chromium`、`npm run build`，再继续业务命令。

## 标准执行模板（全自动优先）

1. 在仓库根目录检查 `dist/cli.js` 是否可用。
2. 若不可用，自动执行 `npm install`、`npx playwright install chromium`、`npm run build`。
3. 自动执行目标命令（`check` / `login` / `upload`）。
4. 仅在扫码、Inspector Resume 或显式人工确认时暂停并请求用户操作；完成后由 Agent 继续后续步骤。

## 执行入口（本仓库）

在 **social-publish-skills** 根目录：

```bash
npm install && npm run build
node dist/cli.js tencent check --account <name>
node dist/cli.js tencent login --account <name>
node dist/cli.js tencent upload --account <name> --file <video> --title "..." --tags "a,b"
# 可选：发布时设置自定义封面（1080×1920 竖版 PNG/JPG，不传则用平台自动帧）
node dist/cli.js tencent upload --account <name> --file <video> --title "..." --tags "a,b" --cover <png>
```

环境变量见仓库根 `README.md`（`SOCIAL_PUBLISH_DATA_DIR`、`SOCIAL_PUBLISH_HEADLESS`、`SOCIAL_PUBLISH_CHROME_PATH`）。

## 功能概览

| 功能 | CLI |
| ---
 | --- |
| cookie 校验 | `tencent check` |
| 登录 / 刷新 storageState | `tencent login`（headed + Playwright pause） |
| 发布视频 | `tencent upload` |
| 发布时设自定义封面 | `tencent upload --cover <png>`（见下「自定义封面」） |
| 发布后改封面 | `scripts/cover/set_cover.mjs`（见下「自定义封面」） |

## 默认工作流

1. `references/runtime-requirements.md`
2. `references/workflow-contract.md`
3. `scripts/examples/tencent_upload_example.sh` 或直连 `node dist/cli.js`
4. `references/troubleshooting.md`

## cookie 持久化

- 默认目录：`$SOCIAL_PUBLISH_DATA_DIR/cookies/tencent/<account>.json`
- 发布前后引擎会读写的 Playwright `storageState`

## 进度可视化

引擎在控制台输出 `⏳/✅/❌ [step/total] STAGE - message`；agent 应同步转述给用户。

## 参考文档

- `references/runtime-requirements.md`
- `references/workflow-contract.md`
- `references/troubleshooting.md`

## 本机实测记录（2026-09-29）

- **登录**：`tencent login` 有头扫码 + 自动轮询（勿设 `SOCIAL_PUBLISH_LOGIN_STDIN`，默认轮询即可），cookie 落 `%USERPROFILE%\.social-publish-skills\cookies\tencent\default.json`，check=valid
- **引擎已打两个本机补丁**（引擎根 `src/platforms/tencent.ts`，改完需 `npm run build`）：
  1. `ensureTencentPostCreatePage`：deep-link goto 发表页只停 ~2 秒就被 SPA 弹回首页 → 改为「先到 /platform 首页再点『发表视频』」
  2. `clickPublish`：原无限循环等跳转（现微信保存草稿不跳转）会永久卡死 → 限次 120 + 超时抛明确错误
- **上传/草稿卡点（账号侧）**：点保存草稿会真实发出 `POST .../post/post_draft`（HTTP 201），但页面持续提示**「暂时无法使用该功能」**——微信在业务层拒绝，属**账号功能限制**（非脚本/非 headless 指纹问题；无头模式下弹窗更频繁）
- **验证方法**：草稿是否真存看「草稿箱」入口（post/list 视频列表不显示草稿）
- **未解**：解除「暂时无法使用该功能」需在手机微信侧处理（视频号助手内查看限制原因/实名/申诉），解除后本 skill 链路即可跑通

## 合集管理（创建 / 加视频 / 排序 / 验证，2026-09-30 实测通过）

> 脚本：`scripts/heji/do.mjs`（create/add/reorder/verify/info 全功能）、`scripts/heji/list.mjs`（posts/collections 列表）、`scripts/heji/wx_edit.mjs`（进编辑页回读 UI）、`scripts/heji/heji-state.json`（已建合集的 id）。
> 实测成果：读诗版 / 故事版各 7 条、sortId 1→7、EP01→EP07 顺序，API + 页面双回读验证。

**登录态**：`%USERPROFILE%\.social-publish-skills\cookies\tencent\default.json`（storageState）。注入方式：`launchPersistentContext(~/.tencent-heji-profile, {channel:'chrome', headless:true})` + `addCookies(st.cookies)` + `addInitScript` 回放 `st.origins` 的 localStorage（token 在 localStorage，只注 cookie 会掉登录）。

**调用方式**：所有接口都在 `/platform` 页面上下文里 `fetch`（同源带登录态），POST + `content-type: application/json`，query 带 `_aid=3bfb7216-…&_rid=<random>&_pageUrl=<当前页>`；路径前缀 `/micro/content/cgi-bin/mmfinderassistant-bin`。**必须在页面加载后调用**（裸 Node fetch 不行）。

| 操作 | 接口 | body 关键字段 |
|---|---|---|
| 建合集 | `POST …/collection/create_collection` | `{name, collectionBusinessType:0}` → `data.collectionId`（`event/UzFf…` 长串） |
| 加视频 | `POST …/collection/mod_collection_feed` | `{collectionId, collectionScene:0, opType:1, objectInfo:[{objectId},…]}`——**数组顺序=合集顺序** |
| 重排序 | 同上 | `opType:2`，`objectInfo:[{sortId, objectId},…]`（sortId 从 feed list 取） |
| 移除 | 同上 | `opType:0`（未实测，按对称推断，用前先验证） |
| 列合集 | `POST …/collection/get_collection_list` | `{pageNum:1, pageSize:50, collectionScene:0, collectionBusinessType:0}` |
| 合集内视频 | `POST …/collection/get_collection_feed_list` | `{collectionId, pageNum:1, pageSize:50}` → `data.objectInfo[]`（`sortId` + `feed.desc.description`） |
| 合集信息 | `POST …/collection/get_collection_info` | `{collectionId, collectionScene:0, collectionBusinessType:0}` |
| 作品列表 | `POST …/post/post_list` | `{pageSize, currentPage, userpageType:11, …}` → 取 `objectId` |

**页面入口（人工核对用）**：`https://channels.weixin.qq.com/platform/post/list?tab=collection` → 每行「编辑」→ `/platform/collection/item?id=<collectionId>`；编辑页有 `全部视频(N)` / `更改排序` / `添加视频` / 每条「移除」。**注意所有内容在同域 iframe（`micro/content/…`）里**，`document.body.innerText` 读不到，要遍历 `page.frames()` 或 iframe 的 `contentDocument`。

**踩坑**：
1. `get_collection_list` 的 **`feedCount` 字段不准（加完视频仍显示 0）**，别用它判断成败——以 `get_collection_feed_list` 的 `collectionFeedCount` / 编辑页「全部视频(N)」为准。
2. 编辑页按钮用 `dispatchEvent(MouseEvent)` 点不动（Vue 监听在别层），页面文本里的「添加视频」用 `getByText` 也常超时——**加/排序视频优先走 `mod_collection_feed` API，别死磕 UI**。
3. 列表接口 `_log_finder_id` 固定值可复用（见 do.mjs）；`timestamp` 用 `Date.now()` 字符串。
4. 发布时的历史坑与合集无关但会同时看到：部分视频描述首行是 GBK 乱码（`#鍞愯瘲`），是早前 PS5.1 无 BOM 脚本所致，需在视频号助手手动改描述——合集列表里也会显示这行乱码。

**未来 EP08+ 追加流程**：`post_list` 拿新视频 objectId → `mod_collection_feed opType:1` 追加（顺序放在数组末尾）→ `get_collection_feed_list` 回读核对 sortId 连续。

**opType 枚举（2026-09-30 从前端 `404.b0af01fb.js` 实锤）**：`Add=1、REORDER=2、REMOVE=3`、REORDER_COURSE=4、REMOVE_COURSE=5、REORDER_DRAMA=6、REMOVE_DRAMA=7。官方调用形状：Add `{collectionId, objectInfo:[{objectId}], opType:1}`；REMOVE `{opType:3, collectionId, objectInfo:[{objectId}]}`——**REMOVE 一次只吃一条，多条数组只删第一条（实测）**，要删多条就循环单条调用；REORDER `{opType:2, objectInfo:[{sortId,objectId}…], collectionId}`。

**追加实测（2026-09-30，EP08-10）**：`do.mjs add` 已升级为「拉当前 feed list → 过滤已有 → 只补缺」，orders 已扩到 01-10；幂等可重复跑。**教训**：曾出现读诗版 3 条被误加进故事版合集（App 手动加时选串），用 opType:3 逐条移除修正——加完必须回读逐条核对标题，不能只看 count。

## 自定义封面（带标题，2026-09-30 实测）

**素材规范**：封面由 `video-cover` skill 生成，命名 `<prefix>-mobile-cover.png`，**1080×1920 竖版**（例：`…\13-EP11-早发白帝城\EP11A-mobile-cover.png`）。发布不再全靠平台自动帧（自动帧截出来的没有诗标题）。

### 路径 A：发布时设封面 —— 引擎 `--cover`（注入级实测通过，完整发布链未跑）

```bash
node dist/cli.js tencent upload --account default --file <video> --title "…" --tags "a,b" --cover <1080×1920.png>
```

- **引擎改动（2026-09-30，已 build）**：`src/platforms/tencent.ts` 新增 `TencentPublishOptions.coverFile` + `setTencentCover()`（插在 `detectUploadStatus` 转码完成之后、PUBLISHING 之前）；`src/cli.ts` 新增 `--cover <path>`。改完在引擎根 `npm run build`（tsc + 拷贝 stealth.min.js）。
- **进度条**：传 `--cover` 时为 `[x/9]`（新增 7/COVER_SET 步骤）；不传保持 `[x/8]` 不变。
- **实测状态**：**注入级实测通过**——有视频上传后的发表页上，force 点 `.edit-btn` 开「编辑封面」弹窗 → 切「上传封面」tab → 注入 PNG → data: 预览就绪 → 弹窗「确认」→ 封面预览更新 + toast「封面已更新」，随后**中止、未点发表**。**完整 `upload --cover` 发布链未实跑**（当次任务禁止发真实内容），首次真实使用建议 `SOCIAL_PUBLISH_HEADLESS=0` 有头复核一眼。
- 弹窗组件与路径 B 完全同源（`.edit-cover-dialog` / `single-cover-uploader-wrap`），坑位见下。

### 路径 B：发布后改封面 —— `scripts/cover/set_cover.mjs`（EP11A 真机端到端实测通过）

```bash
node scripts/cover/set_cover.mjs <标题子串|export/objectId> <封面png绝对路径>
# 例：node scripts/cover/set_cover.mjs "早发白帝城" "D:\…\13-EP11-早发白帝城\EP11A-mobile-cover.png"
```

- 依赖与 heji 脚本相同：npx playwright 缓存路径 + `~/.tencent-heji-profile` + `%USERPROFILE%\.social-publish-skills\cookies\tencent\default.json`（cookie 注入含 localStorage origins，token 在 localStorage 只注 cookie 会掉登录）。
- **EP11A 实测（2026-09-30）**：objectId `<你的视频号作品 objectId>`，《一首诗一出戏11·早发白帝城》，保存调用 `POST …/svrkit/MmFinderAssistantBroker/finderModFeed`（`modFlag:"2"` 仅封面位、description/shortTitle 原样回传）→ toast「修改成功」→ 自动跳回 post/list → **Pillow 比对平台回读封面 vs 源图：mean_abs_diff=2.6、直方图相关 0.89–0.93 → MATCH**。
- **服务端生效延迟**：保存成功后 **30–90 秒** post_list / get_post_info 才返回新 `coverUrl`（encfilekey 变化）；脚本内置轮询最长 180s。
- **复跑实测**：EP11A 再次执行被脚本前置校验快速拦截（exit 1，见铁律①）——属预期，不是 bug。

### 平台铁律（必读）

1. **每条视频「描述+封面」整条编辑只支持一次**。`post_list → desc.modFeedInfo.modifyButtonStatus`：`2`=可改、`1`=已用掉（列表入口变 `disabled`，点击不跳转，提示 `buttonTipsWording`「已修改过描述，当前仅支持修改一次」）。**EP11A 的修改配额已因本次实测消耗**。→ 封面要在发布后尽快设置；**若描述也要修（如 GBK 乱码 #鍞愯瘲），必须与封面在同一次编辑里完成**（set_cover.mjs 目前只带封面，扩展同时带 desc 未实现）。
2. 修改会留痕：作品列表出现「作者修改过视频信息」badge、coverEdit 右侧 history 记录（`history[0]` 存修改后的 desc+cover）。本次描述文本未变（diff 前后一致），仅封面图变化。
3. 描述文本不会被误提交：`handleConfirm` 只在 `editActions.length>0` 时才给 modFlag 置描述位（前端源码实锤），只改封面 → `modFlag=2`，描述原文回传、内容零变化。

### 关键坑位（历史「修改描述和封面 headless 点击无响应」的真相与解法）

1. 列表内容在 **wujie 微前端子文档**里（`page.locator` 可穿透，`frame.locator` 反而计 0；`page.evaluate` 遍历 iframe 找不到子文档）。要点卡片操作区的 **`.edit-cover-item .opr-item`（铅笔图标）**；点 `.edit-cover-text` 文字（含 dispatchEvent）无效——这就是当年「点击无响应」的根因。
2. coverEdit/发表页封面缩略图上的 `.edit-btn`（「编辑」浮层）**`pointer-events:none`** → 普通 click 超时，必须 `click({force:true})`；配 `hover(.vertical-img-wrap)` + 重试循环更稳。
3. 「编辑封面」弹窗默认停在**「从视频中选择封面」tab**：直接往 hidden file input 注入**不触发上传**（无网络请求、预览不变）——必须先点「**上传封面**」tab 再 `setInputFiles`。
4. 注入成功的标志：弹窗内出现 `data:image/png;base64,…` 的 `img.img-wrap` 预览（`naturalWidth=1080`）；此时点弹窗可见的「**确认**」才真正 DFS 上传（`completepartuploaddfs`），toast「**封面已更新**」。
5. 主页面「完成」（dirty 后变橙色可点）→ 弹二次确认层「**确认修改**」（标题「仅支持修改一次，修改后不可撤回，修改记录将会展示在视频上」）→ 才发 `finderModFeed` → toast「修改成功」→ 2s 后跳回 post/list。**只点「完成」不点「确认修改」= 没保存**（历史上只点完成时无任何请求）。
6. 验证闭环：post_list `coverUrl`/`fullCoverUrl` 的 `encfilekey` 变化 → 下载 → 与源图 Pillow 比对（resized 后 mean_abs_diff < 30 且直方图相关 > 0.85 判 MATCH）。

### 引擎本地补丁状态（勿覆盖）

引擎根 `src/platforms/tencent.ts`（2026-09-30 已随本次 `npm run build` 同步进 `dist/`，grep 复核 1+1 存在）：

1. `ensureTencentPostCreatePage`：deep-link goto 发表页只停 ~2 秒即被 SPA 弹回 → 改为「先到 /platform 首页再点『发表视频』」。
2. `clickPublish`：限次 120 + 超时抛明确错误（原无限循环会永久卡死）。

本次为**正式增量**（非补丁）：`setTencentCover()` + CLI `--cover`。验证：`npm run build` 成功、`node dist/cli.js tencent upload --help` 显示 `--cover`。
