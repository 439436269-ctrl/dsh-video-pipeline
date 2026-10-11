---
name: douyin-publish
description: 用 playwright-cli 驱动抖音创作者中心上传并发布视频，以及合集管理（创建合集/添加作品/排序/验证，含 creator API 与 UI 双路径）。当用户要求"上传视频到抖音"、"发布抖音视频"、"自动上传视频到抖音创作者平台"、"创建/管理抖音合集"、"把作品加进合集排序"时触发。含首次扫码登录（持久化 profile）、关闭弹窗、上传视频、填写标题、设置可见性、发布的完整流程，以及登录态（cookie）位置说明。由 OpenClaw 版 douyin-publish-skill 改写适配 MiMo Desktop。Use when the user wants to upload or publish a video to Douyin creator platform.
---

# 抖音视频上传发布（MiMo 版）

> ✅ 状态：本机实测通过（2026-09-28，全流程实录见文末：有头发布+注入校验+flag 确认）

用 playwright-cli（真实 Chromium）操作抖音创作者中心完成视频发布。
原 skill 依赖 OpenClaw 的 `browser()` 工具；本版改为 playwright-cli 等价命令，流程语义不变。
**入坑指南**（test-skills 实测记录、源仓库评估、坑清单）：`references/pitfalls.md`

## 前置要求

- playwright 技能可用（`npx --yes --package @playwright/cli playwright-cli`，下文简称 `$cli`）
- PowerShell 里先设别名避免重复输入：
  ```powershell
  $cli = "npx --yes --package @playwright/cli playwright-cli"
  ```
- 固定会话名 `douyin-publish`，所有命令带 `$env:PLAYWRIGHT_CLI_SESSION = "douyin-publish"`
- 专用持久化 profile（登录态保存在这里，跨会话复用）：
  `%USERPROFILE%\.cache\mimo-skills\douyin-publish\chrome-profile`
- 视频文件路径：用**绝对路径**，直接喂给 `upload`，无需复制到任何临时目录

## 登录态（Cookie）位置

抖音没有独立 cookie 文件——**登录态全部存在 Chrome profile 目录里**（等价于 Cookie 库）：

- **位置**：`%USERPROFILE%\.cache\mimo-skills\douyin-publish\chrome-profile\`
  （即 `{{USER_HOME}}\.cache\mimo-skills\douyin-publish\chrome-profile\`）
- **内容**：Cookies、localStorage、登录会话；扫码一次后跨会话长期有效
- **状态**：已于 2026-09-28 扫码登录并实测（创作者中心可进、「上传视频」入口在）
- **检查方法**：headless `open` 上传页后 `snapshot`——出现「扫码登录」字样=未登录，否则已登录
- **迁移/备份**：整个 profile 目录可拷走复用；**不要**单独复制其中 cookie 文件
- ⚠ 该 profile 同一时间只能被一个浏览器实例使用，见下方排障第 1 条

## 硬规则

1. **默认 headless**。只有首次扫码登录需要开可见窗口，且必须先征得用户同意，用完即关
2. 每次操作前先 `snapshot`——ref 是动态的，**禁止硬编码 ref**，一律从最新 snapshot 按文字匹配
3. 页面跳转/弹窗后必须重新 snapshot，旧 ref 立即失效
4. 发布前必须让用户确认标题与可见性设置
5. 失败时先重试 snapshot 再定位问题；Element not found 十有八九是页面已跳转

## 首次使用：扫码登录（仅此一步需要可见窗口）

先征求用户同意，然后：

```powershell
$env:PLAYWRIGHT_CLI_SESSION = "douyin-publish"
& $cli open "https://creator.douyin.com/creator-micro/content/upload" `
  --headed --persistent --profile "$env:USERPROFILE\.cache\mimo-skills\douyin-publish\chrome-profile"
& $cli snapshot
```

- snapshot 中出现 `扫码登录` → 把窗口展示给用户扫码；用户扫完后 `snapshot` 确认已进入创作者中心
- 已登录（页面是上传页/作品管理）→ 直接进入发布流程，不需要 headed
- 登录态保存在 profile 里，以后全部 headless 运行：

```powershell
& $cli open "https://creator.douyin.com/creator-micro/content/upload" `
  --persistent --profile "$env:USERPROFILE\.cache\mimo-skills\douyin-publish\chrome-profile"
```

**登录态检查**：`open` 后 `snapshot`，若仍出现"扫码登录"字样 → 未登录，回到上面的 headed 流程。

## 发布流程（全部 headless）

### 1. 打开上传页

```powershell
& $cli open "https://creator.douyin.com/creator-micro/content/upload" --persistent --profile "<同上>"
```

### 2. 关闭弹窗

```powershell
& $cli snapshot
```
在结果里找 `我知道了` / `关闭` 类按钮的 ref（如 `e123`）：

```powershell
& $cli click e123
& $cli snapshot   # 关完再快照一次
```

### 3. 点击"上传视频"

从最新 snapshot 找到含 `上传视频` 文字的按钮 ref → `& $cli click <ref>`。

### 4. 上传视频文件

```powershell
& $cli upload "D:\absolute\path\to\video.mp4"
```

- `upload` 只接受绝对路径，可一次传多个文件
- 若点击上传按钮后弹出的是原生文件框导致流程卡住：改为先 snapshot 找到隐藏的 `<input type=file>` 或"上传视频"区域的 ref，对其执行 `& $cli click <ref>` 再立即 `upload`（Playwright 会接管文件选择）
- 上传成功标志：页面出现进度条（"文件解析中"）

### 5. 等待视频解析

页面显示 `0% 文件解析中...` 直到解析完成。轮询等待（不要盲等）：

```powershell
Start-Sleep -Seconds 10
& $cli snapshot   # 检查是否已出现标题输入框
```

大视频可多轮等待，每轮 10–15 秒 + snapshot 确认。

### 6. 填写标题

从 snapshot 找标题输入框（placeholder 含 `标题`/`输入标题`）：

```powershell
& $cli fill <ref> "我的视频标题"
```

### 7. 设置可见性

从 snapshot 找 `公开` / `好友可见` / `仅自己可见` 选项的 ref → `& $cli click <ref>`。
默认选 `公开`；用户明确要求时才改。**这一步前向用户复述最终标题和可见性，等确认。**

### 8. 发布

```powershell
& $cli snapshot   # 找"发布"按钮 ref
& $cli click <ref>
```

**成功标志**：页面出现「共 X 个作品」「已发布」或跳转到作品管理页。
发布后 `snapshot` 复核一次，把结果回传给用户。

### 9. 收尾

```powershell
& $cli close
```

## 完整命令序列模板

```powershell
$env:PLAYWRIGHT_CLI_SESSION = "douyin-publish"
$cli = "npx --yes --package @playwright/cli playwright-cli"
$profile = "$env:USERPROFILE\.cache\mimo-skills\douyin-publish\chrome-profile"

& $cli open "https://creator.douyin.com/creator-micro/content/upload" --persistent --profile $profile
& $cli snapshot                      # 1) 检查登录 2) 找弹窗/按钮 ref
# → 有弹窗先 click 关闭，重新 snapshot
# → click "上传视频" ref
& $cli upload "D:\abs\path\video.mp4"
Start-Sleep -Seconds 10; & $cli snapshot    # 等解析，确认标题框出现
& $cli fill <标题ref> "标题文本"
& $cli click <可见性ref>                      # 默认公开
# ⚠ 此处等用户确认标题+可见性
& $cli click <发布ref>
& $cli snapshot                        # 验证"已发布"
& $cli close
```

## 常见问题

**Q: 提示需要登录？**
A: profile 里没有登录态。按「首次使用」流程 headed 扫码一次即可，之后长期有效。

**Q: Element not found？**
A: 页面已跳转或 ref 过期，重新 `snapshot` 再按文字找 ref。

**Q: `upload` 没反应？**
A: 确认路径是绝对路径且文件存在；确认当前页面已出现文件输入元素（先 click 上传区域再 upload）。

**Q: 会话找不到（browser not open）？**
A: 闲置超时已关闭会话（默认 headless 闲置 1 小时）。重新 `open` 即可，登录态在 profile 里不会丢。

**Q: 为什么和原版命令不一样？**
A: 原版 `douyin-publish-skill` 是 OpenClaw 专用（`browser()` 工具 + `/tmp/openclaw/uploads`），本版逐步骤映射到 playwright-cli，行为一致、平台无关。

## 实战排障（2026-09-28 实测教训）

1. **报 `Browser is already in use for <profile>` / 僵尸 Chrome**：上次异常退出留下的进程占着 profile 锁。按命令行匹配 profile 路径清掉 `chrome.exe` 和 `node.exe`，**必须排除自己的 PID**（当前 shell 命令行里也含该路径，不排除会自杀）：
   ```powershell
   $me = $PID
   Get-CimInstance Win32_Process | Where-Object {
     $_.Name -in @("chrome.exe","node.exe") -and
     $_.CommandLine -like "*douyin-publish*" -and $_.ProcessId -ne $me
   } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
   ```
2. **工具层报 `ChildProcess.kill`**：多为收尾杀进程的噪音，命令可能已成功——去日志/目标文件确认，别盲目重跑。稳妥做法是 `Start-Process npx.cmd -ArgumentList ... -WindowStyle Hidden -RedirectStandardOutput <log> -Wait` 后读日志（**`-WindowStyle Hidden` 必带**，否则起一个可见控制台黑窗）
3. **每个 `open` 都必须带 `--persistent --profile <同上>`**：工具报错后会话被杀，若重开时漏掉该参数，新窗口是无登录态的临时 profile，登录面板会重新出现（看起来像"登录失效"，实际是没加载 profile）
4. **`--idle-timeout` 别设短**：默认 headless 闲置 1 小时；设太短会话中途死掉，ref 全失效

## 全流程实录（2026-09-28 样片日记发布，端到端验证）

以下为 playwright-core 路线（模板 `{{WORKSPACE}}\sample-diary-map\dy-publish.js`，stage: `check | login | flow` + `safeClose`）：

1. **300012 风控铁律**：无头**上传动作必被拦**（「安全限制 IP存在风险」）；登录扫码、读页面可过。→ 上传+发布必须有头（`DY_HEADED=1`），停在待确认时窗口保持打开，失败也 `safeClose` 不关窗，留给用户手动兜底
2. **MiMo 自带 node 不能脱离引擎跑**（报 `MIMO_ELECTRON_NODE_HOST is not set`）→ 后台/独立进程一律用系统 node `D:\Program Files\nodejs\node.exe`
3. **旧 chrome-profile 与 Edge 不兼容**（exitCode 21 + crashpad「Settings version is not 7」）→ 换新 Edge profile（如项目内 `.dy-profile`，env `DY_PROFILE`），首登扫码一次
4. **表单真实结构（DOM dump 实测）**：标题 = `INPUT placeholder="填写作品标题，为作品获得更多流量"`（30 字）；简介 = `DIV[data-placeholder="添加作品简介"]` contenteditable（1000 字）。注意 body.innerText **不含 placeholder**，识别表单用「作品描述」文本，别用「标题」二字猜
5. **注入三要点**：草稿回流会清掉注入值 → 表单就绪后**先等 10s 稳定**；INPUT 用原生 value setter + 派发 input/change；DIV 用 `document.execCommand('insertText')`；注入后**校验计数器**（N/30、N/1000），不对重试 3 次，仍失败保窗退出
6. **跨回合确认模式**：填完写 `WAITING_USER_CONFIRM` 到日志 → 截图给用户确认标题+可见性 → 用户点头后落 `dy-confirm.txt` → 脚本轮询该文件（≤15 分钟）再点发布。**不要用 fill() 后不做计数器校验**（React 受控组件会假成功）
7. **发布按钮**：`button:text-is("发布")` 精确匹配（防误点「发布视频」tab）；点发布后若弹 AI 内容声明，勾「含 AI 生成」再确认（TTS 配音视频几乎必现）
8. **后台驱动**：WMI `Win32_Process.Create` + .cmd（env 写 cmd 里）+ 轮询日志，注意 cmd 内要 `set DY_PROFILE=`（env 不随 WMI 继承）。**静默铁律**：WMI 新建进程在 Session 1，不加 `ShowWindow=0` 会闪 cmd 黑窗——用 `Invoke-WmiMethod -ArgumentList @(命令, $null, $si)`（`$si.ShowWindow=0`，三参，细节见 feishu-bitable skill 同款坑），浏览器窗口本身因 `DY_HEADED=1` 仍可见（风控必需，开窗前告知用户）

## 备选引擎：官方 engine（social-publish-skills，2026-09-29 融入）

本 skill 的 playwright-cli 有头链路是主力（已实测：300012 风控下无头必拦、有头可发）。若需要**统一 cookie 管理、定时发布（`--schedule`）或与视频号快手等编排**，可用官方引擎的 douyin 命令作备选：

- 引擎根目录：`{{USER_HOME}}\.tools\social-publish-skills`（命令前先 `Set-Location` 到该目录）
- cookie：`%USERPROFILE%\.social-publish-skills\cookies\douyin\<account>.json`（与本 skill 的 playwright profile 相互独立，需各自登录）
- 命令：`node dist/cli.js douyin check|login|upload --account <名> --file <绝对路径> --title ... --desc ... --tags a,b [--schedule "YYYY-MM-DD HH:mm"]`；login 扫码默认轮询
- 标题 ≤30 字；浏览器走系统 Chrome（`channel: chrome`），勿跑 `npx playwright install chromium`；异常时 `SOCIAL_PUBLISH_HEADLESS=0` 有头重试（**会弹可见窗口：仅作最后手段，且先征得用户同意，用完即关**）
- 选择建议：**已验证的发布流程/风控实录 → 本 skill；定时/编排 → 官方引擎**；两条路都必须发布前人工确认

## 合集管理（创建/添加作品/排序/验证）

> ✅ 状态：本机实测通过（2026-09-30，headless 全程跑通，两个合集各 7 条 EP01→EP07 验证无误）
> 本次用的登录态 profile：`{{WORKSPACE}}\sample-diary-map\.dy-profile`（Playwright persistent context，`channel:'chrome'` + 指定 UA/`zh-CN`）。任何已扫码的 persistent profile 都通用；profile 被锁（browser already in use）说明有残留进程——**按当时任务指示不要杀进程，报告即可**。
> 实测结论：**creator.douyin.com 的读接口和写接口（mix/create、mix/item/editlist）headless 均未触发 300012**，与上传/发布不同——合集操作不需要有头。

### 入口路径（页面 URL，全部实测）

| 用途 | URL |
|---|---|
| 内容管理（作品列表） | `https://creator.douyin.com/creator-micro/content/manage` |
| 合集管理 tab | `…/content/manage?tab=collections`（SPA 路由，URL query 变化**不是**新页面；左侧「作品合集 (N)」是 span 不是 `<a>`，无 href） |
| 创建合集页 | `https://creator.douyin.com/creator-micro/content/collection/create` |
| 合集编辑/详情页 | `https://creator.douyin.com/creator-micro/content/collection/detail/<mix_id>` |

### 关键 API（page.evaluate 里带 `credentials:'include'` 直接 fetch 即可，无需签名参数）

1. **列作品（分页）**：`GET /janus/douyin/creator/pc/work_list?status=0&count=50&max_cursor=<cursor>&scene=star_atlas&device_platform=android&aid=1128`
   → `aweme_list[]`（`aweme_id`/`desc`/`create_time`）、`has_more`、`max_cursor`。账号作品多时要翻页（701 个作品 ≈ 18 页 count=50）；按标题筛目标视频，**别按发布时间排序**（发布顺序是乱的）。
2. **列合集**：`GET /web/api/mix/list/?status=0,1,2,3,6&count=20&cursor=0`（status 这串值=全部状态）→ `mix_list[]`（`mix_id`/`mix_name`/`status.status`：0=待发布、2=已发布）。**动手前先盘点已有合集**，防重复建/误删历史合集。
3. **创建合集**：`POST /web/api/mix/create/`（**form-encoded**）：`mix_id=&mix_name=<≤20字>&mix_desc=&mix_cover=<tos uri>&item_ids=` → `{mix_id, status_code:0}`。标题上限页面计数器 0/20（空格和 `·` 都算字数）。
4. **封面上传**：创建页 `input[type=file]` setInputFiles → 走 `media/upload/auth/v5` 拿 tos uri → 表单里的 `mix_cover` 填该 uri。**封面必填**：≤5MB、1080×1080 正方形；没有现成图就用 Pillow 生成（`C:\Windows\Fonts\msyh.ttc`，深色底+金字+副题，实测 ~78KB 一次过）。
5. **提交作品清单/顺序**：`POST /web/api/mix/item/editlist/`（form-encoded）：`mix_id=<id>&item_ids=<id1,id2,…全序逗号分隔>&add_item_ids=<同 item_ids>&del_item_ids=` → `{status_code:0}`。**item_ids 的顺序就是合集内最终顺序**（本次两合集均按 EP01→EP07 拼串一次提交，回读完全一致），不需要拖拽。
6. **回读验证**：`GET /web/api/mix/item/list/?mix_id=<id>&count=50&cursor=0` → `aweme_list[]` 即合集内顺序；`GET /aweme/v1/mix/detail/?mix_id=<id>&req_from=pc&version_code=28.0.0` → `mix_info.status.status`（2=已发布）、`statis.updated_to_episode`（应=作品数）、`share_info.share_url`（对外分享链接：`https://www.iesdouyin.com/share/mix/detail/<mix_id>/`）。

### UI 操作流程（逐步）

1. **盘点**：打开 `?tab=collections`，`page.on('response')` 抓 xhr；先跑上面 API 1/2 存 JSON，确认目标视频清单与已有合集。
2. **创建**（每个合集一遍，或改脚本参数复用）：
   - 打开 create 页 → `fill` 标题输入框（placeholder `请输入合集的标题`）→ `input[type=file]` 传封面；
   - **等约 6s 出现封面裁剪弹窗（按钮：重新上传/取消/保存）→ 先点「保存」**，弹窗关掉后封面字段才就绪；
   - 点按钮文本精确等于 `创建` 的按钮（先读 `disabled` 确认为 false）→ 成功则跳回 `manage?tab=collections`，列表出现新合集。
3. **添加作品**：打开 `detail/<mix_id>` → 点文本 `点击添加作品` → 右侧抽屉（`.semi-sidesheet`，内部有搜索框「请输入作品描述查找作品」）→ 列表行为 `[class*=drawer-item-]`，**每行末尾是 `plus-area` 的 + 号 SVG，点它=选中**（点行其他区域无效）→ 按目标顺序（EP01→EP07）逐个点 +；
   - 抽屉列表是**虚拟滚动**：目标行不在 DOM 时滚动 `[class*=main-]` 容器（scrollTop+600）再找，循环重试；
   - + 只是本地选中，**不发任何请求**；点抽屉头部 ×（`icon-fZcWbp`）关闭，再点编辑页的 `保存` 按钮 → 此时才 POST `mix/item/editlist` 并跳回合集列表。
4. **等待审核**：新合集/修改后状态会变成「审核中」，过一会儿回读变「已发布」（本次几分钟内自动过审）。
5. **验证**：跑上面 API 6，逐条打印 `idx + aweme_id + 标题`，与目标 EP 清单比对；同时核对列表页「N个作品」与 `updated_to_episode`。

### 踩过的坑

1. **封面裁剪弹窗会挡住「创建」**：上传后不点弹窗里的「保存」直接点「创建」→ 点击无效果、无请求、URL 不变，看起来像“创建失败”，实际是被遮罩拦了。先保存封面再创建。
2. **侧栏点击别用 `el.click()`**：用 DOM API 点左侧「作品合集」span 无效（URL 纹丝不动）；换 Playwright `getByText().click()`（真实指针事件）才触发 SPA 路由 → `?tab=collections`。
3. **作品选择没有 checkbox**：抽屉行外观看不出可点，选择控件是行尾的 + SVG（`plus-area`）；点行正文无效。顶部「只看可添加的作品」是过滤开关，不是行选择。
4. **`+`≠已提交**：点 + 全程零网络请求，必须回编辑页点「保存」才发 `editlist`；中途关抽屉不点保存 = 白点。
5. **顺序不靠拖拽**：editlist 的 `item_ids` 全序直接生效，按目标顺序点 + / 按目标顺序拼 id 串即可；回读 `mix/item/list` 确认。
6. **字数与命名**：合集标题 ≤20 字（含空格·），`一首诗一出戏 · 读诗版`=12 字；如被拒可退化为无空格的 `一首诗一出戏·读诗版`。
7. **状态值**：`status.status` 0=待发布、2=已发布；`mix/list` 不带 status 过滤可能漏掉待发布合集，用 `status=0,1,2,3,6` 拉全。
8. **既有合集别动**：账号里可能有历史实验/平台自动合集（本次 6 个：锦安的日常/全景日常/3D打印/吃吃吃/拉布布/第一次），只读盘点，绝不删改。
9. **EP01 视频发布最早、藏在列表深处**：按发布日期倒序加载时要滚动/翻页才见；务必用 work_list 分页拿到全部目标 aweme_id，别只看第一页。

10. **详情页按钮文案会变**：加作品入口曾是「点击添加作品」，2026-09-30 实测已变为「**添加作品**」——脚本匹配要两者都兼容（`t === '添加作品' || t === '点击添加作品'`），只认旧文案会静默失败、抽屉不开。抽屉行 class 哈希（`drawer-item-mTdppj`）会随发版变，选择器用前缀泛化 `[class*=drawer-item-]`。
11. **追加实测（2026-09-30，EP08-10）**：两合集从 7 条补到 **10 条、EP01→EP10**，`mix/item/list` 逐条回读通过（`updated_to_episode:10`）。只勾选缺的 3 条、别碰已在合集里的（重复点 + 可能反选）。本 skill `scripts/heji/` 留档：`dy_add.mjs`（UI 加作品）、`dy_verify.mjs`（回读顺序）、`dy_api.mjs`（作品/合集盘点）、`dy_t_*810.json`（目标清单样例）。

## 自定义封面（可选 DY_COVER；已发布作品换封面）

> ✅ 状态：本机实测通过（2026-09-30，headless 全程）：已发布作品 aweme `<你的抖音作品 ID>`（EP11A《早发白帝城》）
> 竖版封面换为 1080×1920 源图；平台回读 540×721，Pillow 中心窗 **mad=2.834 → MATCH**，重启回读同 uri 稳定。
> 视频默认封面是平台自动选帧，**自定义封面必须显式传参**（不传 = 旧行为，自动帧）。

### 参数

| 用法 | 说明 |
|---|---|
| `DY_COVER=<png>`（env，`{{WORKSPACE}}\sample-diary-map\dy-publish.js`） | 发布流可选封面；**不设时行为与旧版完全一致**（applyCover 不被调用）。`DY_CFG` JSON 的 `cover` 字段亦可，`DY_COVER` 优先 |
| `node dy-cover-set.js apply\|read\|verify\|probe\|diag` | 独立改封面脚本（已发布作品）。env：`DY_MID`（默认 <你的抖音作品 ID>）、`DY_COVER`、`DY_PROFILE`（默认项目内 `.dy-profile`）、`DY_LOG`；默认 headless，`DY_HEADED=1` 才开有头（用完即关） |

发布流日志状态行 `COVER_STATUS: OK | FAILED … | SKIPPED`（失败不阻断发布）。
独立脚本 stdout 独立、追加 `dy-cover-set.log`；启动前按命令行匹配 `.dy-profile` 清残留 chrome 并**排除自身 PID**。

### 已发布作品改封面（入口步骤，全部 headless 实测）

1. 编辑页直链：`https://creator.douyin.com/creator-micro/content/post/video?mid=<aweme_id>&enter_from=edit_item`
   （或内容管理 → 作品行「编辑作品」菜单 → 编辑作品）。
2. **真实鼠标点「竖封面3:4」槽位**（矩形高>50 的那个）。⚠ 点封面区**中心**打开的是**横封面**编辑器（标题「设置横封面」），必须以编辑器标题 `设置竖封面` 校验。
3. 编辑器内有 4 个 `input[type=file]`：#0/#1 属「智能参考」AI 参考图上传，#2/#3 才是封面上传区（add / replace）。**别注入错 input**。
4. **先真实点一下上传区**（「点击上传文件或拖拽文件到这里」容器中心；原生文件框由 Playwright 自动关），再 `setInputFiles` **#2（add input）**。
5. 等 `imagex.bytedanceapi.com Action=CommitImageUpload` POST **200**（30s 超时=失败），再点编辑器「完成」。
6. 表单底「**提交修改**」→ 成功回跳内容管理页；回读 `work_list` 确认 `Cover.uri` 已变。
7. 收尾：脚本 headless 自动关上下文；若开过有头，用完即关。

### 验证方法（不看图，字节+像素）

`node dy-cover-set.js verify`：回读封面 → 下载 `.jpeg` 变体到 `tasks/T67.2/platform-cover.jpg` →
`compare_cover.py` 用 Pillow 把 9:16 源图按 3:4 中心窗滑动扫描 + 中心窗比对（mad < 12 判 MATCH）。
本次：平台 540×721 / 39411B vs 源 1080×1920 / 1274423B，中心窗 top=239 **mad=2.834 MATCH**。

### 坑

1. **每作品最多修改 5 次**（编辑页文案「超过次数后不可继续修改」），每次成功「提交修改」计 1 次；本实测已耗 2 次（第 1 次上传未生效白耗 1 次）。动手前先看页面提示的已用次数。
2. **直接 setInputFiles 到 replace input（#3）不触发上传**（0 网络请求）——必须先点上传区激活组件，再注入 add input（#2）。
3. **「完成」「提交修改」用 locator.click 会超时**（编辑器遮罩 / SPA），取按钮 bbox 后 `page.mouse.click` 真实指针才稳；合成 `el.click()` 对 SPA 同样无效（与合集菜单同教训）。
4. 封面字段是 `work_list` 的 **`hit.Cover`（大写 C）**，`hit.cover` 不存在；`video.cover`/`video_cover` 是首帧 origin_cover，改自定义封面后**不变**，别拿它当验证目标。
5. 平台把 9:16 源图**中心裁成 3:4** 再压到 540 宽（高度 721）；比对必须先按中心窗裁剪再缩放，直接整图缩放会 MISMATCH（mad≈27 的假阴性）。
6. **封面 uri 变了 ≠ 你的图上传成功**：编辑器「完成→提交」会提交某种再编码态并产生新 uri（本次第 1 次即如此）。必须看到 `CommitImageUpload 200`，最终以 Pillow 比对为准。
7. headless 下编辑页封面上传/提交**未触发 300012**（与合集写接口同结论），无需有头；若被风控拦截再 `DY_HEADED=1` 重试（先征得用户同意，用完即关）。
8. 发布流里的 applyCover 是同一套选择器的结构复用，**未端到端实测**（本次任务禁新发布）；首次真实发布带 `DY_COVER` 时看 `COVER_STATUS` 行并按上文方法核对。