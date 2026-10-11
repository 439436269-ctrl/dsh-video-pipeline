---
name: quad-platform-publish
description: 全机指定的统一发布入口 skill：同一个视频一键发布四个平台（小红书 / B 站 / 抖音 / 微信视频号）的统一流程与手册，**默认 4 个 agent 并行发布（每平台一个 general agent，主 agent 只做确认门+文案+飞书回写）**：资产与文案变体准备、各平台底层工具调用（biliup 换线路、XHS 视频笔记坐标发布、抖音有头注入+flag 确认、视频号官方引擎 tencent 命令）、发布前确认门、发布后验证取链接、300012 等风控速查。当用户要求「四平台发布」「一键多平台发布」「同时发小红书抖音B站视频号」「批量发布视频到多个平台」，或沿用旧说法「三平台发布」时使用。Use when the user wants one video published to Xiaohongshu, Bilibili, Douyin and WeChat Channels together.
---

# 视频四平台统一批发（小红书 / B 站 / 抖音 / 微信视频号）

> 🚪 **入口声明（2026-09-29 用户指定）**：本 skill 是本机**唯一的发布总入口**。凡「发布/上传/投稿到某平台」的请求，先经本手册走确认门与平台分发；各平台底层细节见对应 skill（bilibili-upload / douyin-publish / xiaohongshu-skills / tencent-upload 等），但入口永远是这里。

> ✅ 状态：三平台（小红书/B站/抖音）本机实测通过（2026-09-28，样片日记三平台实发；validate PASS 0 错 0 警）。
> 第 4 平台**视频号**已实测到微信侧限制层（2026-09-29 实测：登录走默认轮询即可、勿设 LOGIN_STDIN；登录/进页/上传链路全通，卡在账号「暂时无法使用该功能」，解除前无法出草稿）——细节见 tencent-upload §本机实测记录。

一个视频（以竖版配音成片为基准）分别适配四平台发布。**每个平台发布前都要把「标题+可见性」截图给用户确认，点头才点发布**。各平台的底层流程各自沉淀在既有 skill，本文是总控手册。

> 与 `multi-platform-publish-orchestrator` 的分工：那边是**引擎派 JSON 批量**（7 平台但**无 B 站**、无确认门）；本 skill 是**总控派**（有确认门/验证/风控/写回表格）。视频号底层用该引擎的 `tencent` 命令，其余三平台走本机已实测链路。

## ⚡ 并行发布编排（2026-09-30 用户指定：串行太慢，4 平台并行；2026-10-01 起 = 3 平台）

> 🚫 **小红书不再发布（2026-10-01 用户指定）**：EP14 遭账号/IP 级风控（`-9136 因违反社区规范禁止发笔记` + `300012 IP存在风险`，A/B 内容不同同错即证），用户决定**此后一律不发小红书**——四平台发布改为**三平台（B站 / 抖音 / 视频号）= 3 个 agent 并行**。EP14 的 A/B 草稿保留在小红书草稿箱（封面+AI声明齐备），XHS 合集停在 13/13。若未来用户明确说「恢复小红书」→ 先单发 EP14 草稿验证风控（真判据 = `POST edith…/web_api/sns/v2/note` 响应 `result=0`），成功再恢复；期间**禁止反复重试**（hammer 会升级风控）。

> **B 故事版平台标题用诗题（2026-10-01 用户指定）**：所有平台的 B 版标题一律写**原诗诗题**，不写剧名（例：EP14 → 标题用《行路难》故事版，而不是《云帆》；EP13 → 《黄鹤楼》故事版，不叫《搁笔》）。副题/简介里可以带剧名梗。本地文件名（`EPxx-<剧名>-样片视频.mp4`）不受影响；EP11–14 已发的不回改，**EP15 起生效**。

> 全流程编排图（本 skill 对应图中「确认门② 之后」的发布段）：见 skill `tangshi-pipeline` 内的 `orchestration-flow.svg`（同目录有浏览用 PNG）。

**默认模式：3 个 general agent 并行（B站/抖音/视频号）**，不再串行逐平台跑。分工：

- **主 agent（总控）**：
  1. 确认门：文案四变体给用户确认（一次确认覆盖四平台）
  2. 核对素材（成片/封面路径与大小）、**读音核查**（见下）后，按下方模板同时 spawn 4 个 general agent（每平台一个，task_id 绑各自子任务）
  3. 等 4 个 agent 全部回报 → 汇总矩阵 → **统一做一次飞书回写**（不要让子 agent 各自写表）
- **子 agent（每平台一个）**：审计该平台当前状态（是否已有旧版本/草稿）→ 补发或替换 → 合集归档（该平台自己的合集）→ 发布后验证 → 写 `tasks/<task_id>/progress.md` 回报
- **并行安全前提**（已实测可共存）：B站走 biliup/HTTP 无浏览器；小红书=CDP 9222 专用 profile；抖音=.dy-profile 专用 Edge；视频号=系统 Chrome social-publish；互不抢 profile。**禁止** 4 个 agent 共用 playwright-mcp（profile 常被占）。
- **素材一致性**：每个 agent 的 prompt 必须写明成片**绝对路径+字节数+生成时刻**；若成片在发布中途被重建过（如读音修复重合成），明确标注"旧上传副本作废"，各 agent 一律以 prompt 给的路径现拷现发。

### 发布前读音核查（2026-09-30 用户指定，诗歌/故事配音必做）

- **细则与工具一律走 skill `chinese-tts`**（多音字替换表、`pinyin_fix.py check/fix`、音色与 context 模板）
- 一句话规则：**朝=zhāo（朝辞白帝）、还=huán（一日还/还给了）、重=chóng（万重山）、骑=jì（一骑红尘）、教=jiào（悔教夫婿）** 等；TTS 输入用同音字替换，字幕保留原字
- 已发内容发现读音错 → 替换/删除重发（各平台：B站换视频文件可保 BV，小红书/抖音删旧重发）

## 资产与文案变体

- **视频**：`*.mp4`（竖版 1080×2340 最通用；竖版也能直接发 B 站）。发布前 ffprobe 校验时长，抽帧人审白屏/封面错位
- **封面（2026-09-30 起：四平台全部显式传封面，不再依赖自动抽帧）**：由 skill `video-cover` 一次出两张——
  - B 站 16:10 `<prefix>-bili-cover.png`（1146×717）→ `biliup --cover`
  - 小红书/抖音/视频号共用竖版 `<prefix>-mobile-cover.png`（1080×1920，带系列角标+标题+诗文面板）→ 三平台的上传接入见各自 skill §自定义封面；接入前的过渡：发布后在平台编辑器手动换封面
- **文案四变体**（内容一致，形式各异；**B 版标题一律用诗题，EP15 起生效**，见文首规则）：
  - 小红书：长文 + 🔸分点 + 结尾 emoji + `#话题`（≤1000 字）
  - B 站：title ≤80 字（可带｜副题）+ desc（链接可直接放）+ `--tag` 逗号分隔（≤6 个）
  - 抖音：title ≤30 字 + desc ≤1000（#话题写进正文），**无外链位**→ 引导「评论区见」
  - 视频号：`--title` + `--tags` 逗号分隔话题；**无 `--desc` 参数**（简介写进 title 或让引擎默认）；支持 `--schedule "YYYY-MM-DD HH:mm"` 定时、`--draft` 存草稿

## 平台手册

### 1. B 站（biliup，全链路最稳）
- 工具：`{{USER_HOME}}\.config\mimocode\skills\.venvs\publish\Scripts\biliup.exe`（biliup-cli 1.2.4）
- **必须 `Push-Location %USERPROFILE%\.bilibili` 后执行**（它按 CWD 找 `cookies.json`，cookie 文件就在那）
- **线路**：`--line bda2` 直接可用；默认 bldsa 会报 `invalid peer certificate: Expired`（边缘节点证书问题），失败按 bda2→tx→alia 轮询
- 参数：`upload <video> --title --desc --tag "a,b,c" --tid 171(科技) --copyright 1 --cover <png>`；11:00–22:00 直发
- 成功判定：输出含 `BV1xxxx` + 「投稿成功」；实录 `BV0000000000`

### 2. 小红书（视频笔记，指针 → bili-route-map §5）
- 流程：creator.xiaohongshu.com 上传视频（单文件 input）→ 表单 5s 就绪 → `fill()` 标题/正文 → Escape 关话题联想 → **坐标点击 (750,855)「发布」** → 去 `new/note-manager` 验证（别信页面文本，会跳回上传页）
- **AI 生成声明必勾（2026-09-30 用户强调）**：发布编辑器里必须设置「AI 生成声明」下拉/勾选行（不只正文声明行）；发布后回读编辑器确认 `needRow=true`。批量做法参照 xhs-batch.cjs / EP10 实录
- 草稿存**浏览器本地 profile**（换浏览器看不到）；已发布笔记不可改视频，重发需删旧
- www 域（explore/评论）对 headless 报 300012 → 评论让用户 App 手动发

### 3. 抖音（有头必开，指针 → douyin-publish §全流程实录）
- **无头上传必被 300012 拦** → `DY_HEADED=1` 有头跑 `dy-publish.js`（模板在 sample-diary-map）。浏览器窗口是抖音风控+人工点发布必需、**无法静默**——开跑前告知用户
- 注入后必须校验计数器（N/30、N/1000）；跨回合用 `dy-confirm.txt` flag 点发布
- AI 声明弹窗：勾「含 AI 生成」再确认（TTS 配音视频必现）
- 发布按钮 `button:text-is("发布")` 精确匹配

### 4. 微信视频号（官方引擎 tencent，2026-09-29 接入）
- 引擎根目录：`{{USER_HOME}}\.tools\social-publish-skills`（下称引擎根），**所有命令先 `Set-Location` 到引擎根**
- 登录态（cookie）：`%USERPROFILE%\.social-publish-skills\cookies\tencent\<account>.json`（Playwright storageState）
- **登录态获取定稿流程（五次试错终版，脚本见本 skill `references/tencent-login-save.js`）**：
  1. `chromium.launch({channel:'chrome', headless:false})` 开窗 → goto `channels.weixin.qq.com/platform`
  2. 轮询页面出现 **`视频ID|sphN`** ——唯一可信登录信号（「数据中心/内容管理」等导航词是预加载**假阳性**，会存出 cookies=0 空壳）
  3. 保存必须用 **`page.context().storageState()`**（`chromium.launch` 返回的是 **Browser**，它没有 storageState 方法）→ `fs.writeFileSync` 到上面的 cookie 路径，且确认 `cookies.length>0`
  4. **引擎自验**：保存后立即 `execSync(node dist/cli.js tencent check --account default)`，输出 `valid` 才算成功；invalid 则继续轮询，勿关窗
  5. 自验通过再关窗
  - 历史坑：①cmd stdout 重定向与 appendFileSync 写同一文件 → EBUSY 崩；②检测词写错导致超时不存；③Browser 当 Context 调 API 7 秒崩；④预加载假阳性存空壳。**日志与终版脚本模式照抄 references/tencent-login-save.js**
- 首次登录（有头扫码，**开可见窗口前征求用户同意**）：
  ```powershell
  Set-Location "{{USER_HOME}}\.tools\social-publish-skills"
  node dist/cli.js tencent login --account default   # 默认自动轮询扫码（5 分钟），勿设 LOGIN_STDIN
  ```
- cookie 校验：`node dist/cli.js tencent check --account default`（无 cookie 返回 `invalid`，exit 1）
- 发布（**首跑建议 `--draft` 存草稿**，人工在视频号助手复核后再手动发）：
  ```powershell
  node dist/cli.js tencent upload --account default --file "D:\abs\video.mp4" `
    --title "标题（≤20字内测过更稳）" --tags "话题1,话题2" --draft
  # 确认无误后去掉 --draft 正式发；可加 --schedule "YYYY-MM-DD HH:mm" 定时
  ```
- 浏览器走系统 Chrome（`channel: chrome`）；**不要** `npx playwright install chromium`（下载源被墙）
- 上传页：`channels.weixin.qq.com/platform/post/create`；引擎输出 `⏳/✅/❌ [step/total]` 进度，同步转述给用户

## 确认门与验证

1. 每平台发布前：**截图 + 复述标题/可见性** → 等用户明确「发布」
2. 发布后验证：B 站抓 BV（可拼 `https://www.bilibili.com/video/<BV>`）；小红书看 note-manager 新行（标题+时长+审核中）；抖音看内容管理列表；视频号去 channels.weixin.qq.com 平台列表核对标题（`--draft` 则看草稿箱）
3. 发布结果写回多维表格（skill `feishu-bitable`）：进度、备注里挂 BV / 笔记 / 链接 / 视频号状态

## 风控速查

| 码/现象 | 平台 | 解法 |
|---|---|---|
| 300012 安全限制 IP风险 | 抖音(上传) / 小红书(www) | 有头跑；评论/浏览类让用户 App 手动 |
| peer certificate Expired | B 站 bldsa 线路 | 换 `--line bda2` |
| 字段 counter 不涨 | 抖音 | 稳定 10s + 原生 setter/execCommand + 3 次重试 |
| 发布后页面无「成功」文案 | 小红书 | 以 note-manager 行数/标题为准 |
| check 返回 invalid | 视频号 | cookie 缺/过期 → 重新 `tencent login` 扫码 |

## 已验证实录（2026-09-28 样片日记 · 三平台）

- 小红书：视频笔记（配音竖版）发布成功 → note-manager 审核中；评论链接用户 App 手动补
- B 站：`BV0000000000`（bda2 线路，分区 171，自制）
- 抖音：自动化完成上传+填写（计数器 11/30、96/1000），用户在有头窗口手动点发布
- 视频号（第 4 平台）：链路与命令已就绪，**已实测至微信侧限制层**：post_draft 返回 201 但页面持续「暂时无法使用该功能」（账号限制），解除前出不了草稿——实录见 tencent-upload §本机实测记录

## 已验证实录（2026-09-29 唐诗短剧 EP01 · 双版本 × 三平台全量，子 agent autonomous 跑通）

- B 站：A=`BV0000000000`、B=`BV0000000000`，**诗词/人文内容用 tid=228（知识·人文历史）** 比 171 更贴切；16:10 封面 `ffmpeg crop=864:545:0:400,scale=1146:717` 过审；bda2 线路秒传
- 小红书：A/B 各一条（`publish-xhs.js` 改 TITLE/BODY/验证串 → `publishnow`），A 00:25、B 01:02 均审核中
- 抖音：A/B 均 `PUBLISH_SUCCESS` + headless content/manage 佐证；**文案预先经用户确认后，子 agent 可全流程 autonomous**（prompt 需带全下方踩坑）
- 三平台发布结果均已按 feishu-bitable 流程回写「开发项目」记录并读回验证

### 抖音自动化新坑（2026-09-29 agent 实测）

1. 既存 dy-publish node 占住 stdout 重定向 → 新 `cmd /c > log` **静默失败**（ReturnValue=0 但啥都没跑）：发布前清旧 node + `.dy-profile` Edge（排除自身 PID），每次用独立 stdout 文件名（如 `dy-stdout-b.log`）
2. 注入计数器判版本：title 可能两版相同（均 17 字），看 **desc 字数**（A 126 / B 90）
3. 修改已发布简介：`x/web-interface/archive/modify` 已 **404**（2026-09-29）、biliup 无 edit 命令 → 只能创作中心网页手改；**发布前把互链写进首版简介可免除此需求**

### 双版本互链的窗口期设计（本次教训）

- 抖音简介发布后不可改、小红书无外链位、B 站可改但接口失联 → **A/B 互链要在发布时就写进文案**：B 版简介直接带 A 版 BV 链接；XHS 无公开链接时用「见主页」文字指路；A 版简介留 B 版预告位（B 发出后回填）

### 视频号发布实录与核对路径（2026-09-29 首跑直发成功）

- `tencent check` = valid 后直发：`node dist/cli.js tencent upload --account default --file <mp4> --title <≤20字> --tags "话题1,话题2"`（**不带 --draft** 即正式发布），成功 = `✅ [8/8] DONE - 成功`
- **发布后核对**（post/list 直开会 302 回首页）：`launch({channel:'chrome'})` + `storageState=cookies\tencent\default.json` → 首页 `/platform` → 作品列表在 `micro/content/iframe/post-card.html` **iframe 内**，读 iframe 文档核对标题
- EP02 双版本四平台 8 条一次跑通：B站×2 / 小红书×2 / 抖音×2 / 视频号×2（2026-09-29）

### 调用 skill 的坑

- `tri-platform-publish` 已更名为 `quad-platform-publish`（注册名≠旧名时 skill 工具可能加载失败 → 直接 Read 磁盘 SKILL.md）
- PS here-string 必须以 `'@` 结尾（写成 `'` 会报「字符串缺少终止符」）

### B 站已发布稿件换封面（2026-09-29 实测，无需浏览器）

- 用全局 skill `paper-bilibili-uploader` 的 upload 脚本（`upload.py`，位于该 skill 目录内）加参数 `--edit --vid <BV> --cover <png>`：读 `~\.bilibili\cookies.json`，先 `POST member.bilibili.com/x/vu/web/cover/up` 传图，再 `POST x/vu/web/edit?csrf=` **仅改 cover**、其余元数据原样回填（标题/标签/简介不动）
- cover URL 必须**原样回传**（去掉 scheme 会被拒「封面必须由页面进行上传」）；脚本依赖 `pip install psutil`（requests/PIL 系统 python 自带）
- 验证：`view?bvid=` 取 `data.pic`，下载线上图与本地图**按 16:10 裁剪后逐像素比对**（B站会裁剪封面，直接比字节会误报）——4 条 meanDiff=0 实测通过
- 坑：playwright-mcp 常驻服务探针正常但报 `Session not found` 时，会话内无法自愈（MCP session id 缓存失效）→ 此类改稿操作优先走 API 路线