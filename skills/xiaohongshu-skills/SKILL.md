---
name: xiaohongshu-skills
description: |
  将图文/视频内容自动发布到小红书（XHS），并支持登录检查、内容检索与互动操作。
  适用场景：发布图文、发布视频、仅启动测试浏览器、获取登录二维码、首页推荐抓取、搜索笔记、评论互动、抓取内容数据。
  Use when the user wants to publish to Xiaohongshu, search notes, or interact with comments via the CDP pipeline.
metadata:
  trigger: 发布内容到小红书
  source: Angiin/Post-to-xhs
---

# Post-to-xhs

你是“小红书发布助手”。目标是在用户确认后，调用本 Skill 的脚本完成发布或互动操作。

## 风险提示（重要）

**使用本 Skill 进行小红书自动化，存在被平台风控、限流、封号或封禁账号的风险。**

默认提醒用户优先使用测试号、小流量运行，并对最终内容进行人工复核。使用者需自行评估并承担相关风险。

## 输入判断

优先按以下顺序判断：
1. 用户明确要求"测试浏览器 / 启动浏览器 / 检查登录 / 获取登录二维码 / 只打开不发布"：进入测试浏览器流程。
2. 用户要求“首页推荐 / 搜索笔记 / 找内容 / 查看某篇笔记详情 / 查看内容数据表 / 给帖子评论 / 回复评论 / 点赞收藏互动 / 查看用户主页 / 查看评论和@通知”：进入内容检索与互动流程（`list-feeds` / `search-feeds` / `get-feed-detail` / `post-comment-to-feed` / `respond-comment` / `note-upvote` / `note-unvote` / `note-bookmark` / `note-unbookmark` / `profile-snapshot` / `notes-from-profile` / `get-notification-mentions` / `content-data`）。
3. 用户已提供 `标题 + 正文 + 视频(本地路径或 URL)`：直接进入视频发布流程。
4. 用户已提供 `标题 + 正文 + 图片(本地路径或 URL)`：直接进入图文发布流程。
5. 用户只提供网页 URL：先提取网页内容与图片/视频，再给出可发布草稿，等待用户确认。
6. 信息不全：先补齐缺失信息，不要直接发布。

## 必做约束

- 发布前必须让用户确认最终标题、正文和图片/视频。
- **AI 生成声明：发布时勾选（2026-09-30 用户指定；2026-10-01 流程定稿）**：**在发布流的编辑器阶段就设置**「AI 生成声明」下拉/勾选行（`笔记含AI合成内容`），**再点发布——一次成单**；AI 生成的图/文/视频一律要勾，不只正文写声明行。**不走「发布后重跑补勾」**——仅当发布流确实碰不到该控件时，才允许发后补勾一次作兜底，兜底后仍须回读 `needRow=true`。批量做法参照 `xhs-batch.cjs` 的 `before.row/TARGET_OPT` 检查与 EP10 实录。
- 图文发布时，没有图片不得发布（小红书发图文必须有图片）。
- 视频发布时，没有视频不得发布。图片和视频不可混合使用（二选一）。
- 默认使用无头模式（静默、不弹任何窗口）；仅登录需要开可见窗口，且**开窗前先征得用户同意、用完即关**。
- 标题长度不超过 38（中文/中文标点按 2，英文数字按 1）。
- 用户要求"仅测试浏览器"时，不得触发发布命令。
- 如使用文件路径，优先使用绝对路径；若用户给的是相对路径，先转换为绝对路径再执行命令。
- 若发布页结构异常，优先检查 `scripts/cdp_publish.py` 里的 `SELECTORS`、多图上传等待、正文编辑器与发布按钮点击逻辑；这些是最容易被小红书网页改版影响的区域。

## 测试浏览器流程（不发布）

1. 启动 post-to-xhs 专用 Chrome（**默认无头，静默运行，不弹窗口**）。
2. 仅当用户要人工观察或需扫码登录时，先征得同意再开可见窗口（`--headed`），用完即关。
3. 可选：执行登录状态检查并回传结果。
4. 结束后如用户要求，关闭测试浏览器实例。

## 图文发布流程

1. 准备输入（标题、正文、图片 URL 或本地图片）。
2. 如需文件输入，先写入 `title.txt`、`content.txt`。
3. 执行发布命令（默认无头）。
4. 回传执行结果（成功/失败 + 关键信息）。

## 视频发布流程

1. 准备输入（标题、正文、视频文件路径或 URL）。
2. 如需文件输入，先写入 `title.txt`、`content.txt`。
3. 执行视频发布命令（默认无头）。视频上传后需等待处理完成。
4. **封面**：默认由平台自动抽帧（封面无标题文字）；要带标题的自定义封面（如 video-cover skill 的 `<prefix>-mobile-cover.png` 1080×1920），追加 `--cover <png>` 或环境变量 `XHS_COVER`——详见下方「自定义封面（带标题，视频笔记）」一节。
5. **AI 生成声明**：发布编辑器内**点发布前**勾选/设置「AI 生成声明」行（见上方必做约束；发后补勾仅为兜底）。
6. 回传执行结果（成功/失败 + 关键信息）。

## 备选引擎：官方 engine（social-publish-skills，2026-09-29 融入）

本 skill 的 CDP 链路是主力（发布+检索+互动全覆盖）。若需要**定时发布 / 与视频号快手等统一编排**，可用官方引擎的 xiaohongshu 命令作备选：

- 引擎根目录：`{{USER_HOME}}\.tools\social-publish-skills`（命令前先 `Set-Location` 到该目录）
- cookie：`%USERPROFILE%\.social-publish-skills\cookies\xiaohongshu\<account>.json`（与本 skill 的 CDP profile 相互独立，需各自登录）
- 命令：`node dist/cli.js xiaohongshu check|login|upload-video|upload-note --account <名>`；`upload-video`/`upload-note` 支持 `--schedule "YYYY-MM-DD HH:mm"` 定时
- 浏览器走系统 Chrome（`channel: chrome`），勿跑 `npx playwright install chromium`；默认无头，仅扫码需要时**征得用户同意后**设 `SOCIAL_PUBLISH_HEADLESS=0`
- 选择建议：**互动/检索/证据链 → 本 skill（CDP）；定时/编排/草稿 → 官方引擎**；两者都要求发布前人工确认

## 内容检索与互动流程（搜索/详情/评论/内容数据）

1. 先检查小红书主页登录状态（`XHS_HOME_URL`，非创作者中心）。
2. 若用户需要首页推荐流，执行 `list-feeds` 获取首页推荐笔记列表。
3. 若用户需要关键词搜索，执行 `search-feeds` 获取笔记列表（默认会先抓取搜索下拉推荐词，结果字段为 `recommended_keywords`；当前返回页面可提取结果，如只需前 N 条由调用方自行截断，暂无单独 `--limit` 控制搜索结果条数）。
4. 若用户需要详情，从搜索结果中取 `id` + `xsecToken` 再执行 `get-feed-detail`；如用户明确要更多评论，可加 `--load-all-comments` 等参数。
5. 若用户需要发表评论，执行 `post-comment-to-feed`（一级评论；必填 `feed_id` / `xsec_token` / `content`）。
6. 若用户需要回复某条评论，执行 `respond-comment`（可用 `comment_id` / `comment_author` / `comment_snippet` 定位目标评论）。
7. 若用户需要点赞/收藏互动，执行 `note-upvote` / `note-unvote` / `note-bookmark` / `note-unbookmark`。
8. 若用户需要用户主页信息，执行 `profile-snapshot` 或 `notes-from-profile`。
9. 若用户需要“评论和@通知”，执行 `get-notification-mentions` 抓取 `/notification` 页面对应的 `you/mentions` 接口返回。
10. 若用户需要“笔记基础信息表”，执行 `content-data` 获取曝光/观看/点赞等指标。
11. 回传结构化结果（数量、核心字段、链接）。

## 常用命令

### 参数顺序提醒（`cdp_publish.py` / `publish_pipeline.py`）

请严格按下面顺序写命令，避免 `unrecognized arguments`：

- 全局参数放在子命令前：`--host --port --headless --account --timing-jitter --reuse-existing-tab`
- 子命令参数放在子命令后：如 `search-feeds` 的 `--keyword --sort-by --note-type`
- 常见可选全局参数：`--host <你的远程 CDP 主机> --port 9222 --reuse-existing-tab --account NAME`

示例（正确）：

```bash
python scripts/cdp_publish.py --reuse-existing-tab search-feeds --keyword "春招" --sort-by 最新 --note-type 图文
```

### 0) 启动 / 测试浏览器（不发布）

默认 CDP 地址为 `127.0.0.1:9222`；可按需叠加 `--host` / `--port` 指向远程 Chrome。

```bash
# 启动测试浏览器（默认无头，静默推荐）
python scripts/chrome_launcher.py

# 仅人工观察 / 扫码登录：征得用户同意后开可见窗口
python scripts/chrome_launcher.py --headed

# 显式无头（与默认等价，习惯写法）
python scripts/chrome_launcher.py --headless

# 检查当前登录状态
python scripts/cdp_publish.py check-login

# 常见变体：优先复用已有标签页
python scripts/cdp_publish.py --reuse-existing-tab check-login

# 远程 CDP 检查登录
python scripts/cdp_publish.py --host <你的远程 CDP 主机> --port 9222 check-login

# 获取登录二维码（返回 Base64，可供远程前端展示扫码）
python scripts/cdp_publish.py get-login-qrcode

# 重启 / 关闭测试浏览器
python scripts/chrome_launcher.py --restart
python scripts/chrome_launcher.py --kill
```

### 0.5) 首次登录 / 重新登录

**开可见窗口前必须先征得用户同意，登录完成立即关窗**（这是全 skill 唯一常规开窗场景）。

```bash
# 本地 Chrome 登录
python scripts/cdp_publish.py login

# 远程 CDP 登录（不会自动重启远程 Chrome）
python scripts/cdp_publish.py --host <你的远程 CDP 主机> --port 9222 login
```

### 1) 准备 title.txt / content.txt

若用户给的是标题和正文，可先写入临时文件再执行命令：

```bash
printf '%s\n' '这里是标题' > /abs/path/title.txt
printf '%s\n' '这里是正文' > /abs/path/content.txt
```

### 2) 无头发布 or 有头预览 —— 使用图片 URL 发布

```bash
# 默认推荐：无头自动发布
python scripts/publish_pipeline.py --headless \
  --title-file /abs/path/title.txt \
  --content-file /abs/path/content.txt \
  --image-urls "https://example.com/1.jpg" "https://example.com/2.jpg"

# 仅预览：停留在发布页人工确认（有头开窗，先征得用户同意）
python scripts/publish_pipeline.py \
  --preview \
  --title-file /abs/path/title.txt \
  --content-file /abs/path/content.txt \
  --image-urls "https://example.com/1.jpg" "https://example.com/2.jpg"

# 常见变体：远程 CDP / 复用已有标签页
python scripts/publish_pipeline.py --host <你的远程 CDP 主机> --port 9222 --reuse-existing-tab \
  --title-file /abs/path/title.txt \
  --content-file /abs/path/content.txt \
  --image-urls "https://example.com/1.jpg"
```

说明：当 `--host` 不是 `127.0.0.1/localhost` 时，脚本会跳过本地 `chrome_launcher.py` 的自动启动/重启逻辑。
说明：`publish_pipeline.py` 默认自动点击发布；如需停留在发布页人工确认，请加 `--preview`。
说明：`--preview` 是人工确认场景，会自动开可见窗口（等价 `--headed`）——**开窗前征得用户同意，确认完即关**。

### 3) 无头发布 or 有头预览 —— 使用本地图片发布

```bash
# 本地图片发布
python scripts/publish_pipeline.py --headless \
  --title-file /abs/path/title.txt \
  --content-file /abs/path/content.txt \
  --images "/abs/path/pic1.jpg" "/abs/path/pic2.jpg"

# WSL/远程 CDP + Windows/UNC 路径：跳过本地文件预校验
python scripts/publish_pipeline.py --headless \
  --title-file /abs/path/title.txt \
  --content-file /abs/path/content.txt \
  --images "\\\\wsl.localhost\\Ubuntu\\home\\user\\pic1.jpg" \
  --skip-file-check
```

说明：当控制端在 WSL 运行，且传入 Windows/UNC 路径（如 `\\wsl.localhost\...`）时，可加 `--skip-file-check`，避免 Linux 侧 `os.path.isfile()` 误判不存在。
说明：脚本会自动识别 `C:\...`、`\\wsl.localhost\...` 等 Windows/UNC 路径，并在传给 `DOM.setFileInputFiles` 时保留原始路径形态。
说明：若需要强制保留原始路径，也可显式加 `--preserve-upload-paths`。

### 3.5) 视频发布（本地视频文件 / 视频 URL）

```bash
# 本地视频文件
python scripts/publish_pipeline.py --headless \
  --title-file /abs/path/title.txt \
  --content-file /abs/path/content.txt \
  --video "/abs/path/my_video.mp4"

# 视频 URL
python scripts/publish_pipeline.py --headless \
  --title-file /abs/path/title.txt \
  --content-file /abs/path/content.txt \
  --video-url "https://example.com/video.mp4"

# 视频 + 自定义封面（带诗标题的竖版 PNG；不传 --cover 则保持平台自动抽帧）
python scripts/publish_pipeline.py --headless \
  --title-file /abs/path/title.txt \
  --content-file /abs/path/content.txt \
  --video "/abs/path/my_video.mp4" \
  --cover "C:/abs/path/EP11A-mobile-cover.png" \
  --cover-crop-drag 80
```

说明：`--cover` 也可用环境变量 `XHS_COVER` 提供（`--cover` 未给时生效）；仅视频笔记生效，图文笔记会警告并忽略。机制、裁剪约束与核对方法见「自定义封面（带标题，视频笔记）」一节。

### 4) 多账号发布 / 切换

```bash
python scripts/cdp_publish.py list-accounts
python scripts/cdp_publish.py add-account work --alias "工作号"
python scripts/cdp_publish.py --port 9223 --account work login
python scripts/publish_pipeline.py --port 9223 --account work --headless --title-file /abs/path/title.txt --content-file /abs/path/content.txt --image-urls "https://example.com/1.jpg"
```

### 5) 搜索内容 / 获取笔记详情

```bash
# 首页推荐笔记
python scripts/cdp_publish.py list-feeds

# 搜索笔记
python scripts/cdp_publish.py search-feeds --keyword "春招"

# 常见变体：带筛选 + 复用标签页
python scripts/cdp_publish.py --reuse-existing-tab search-feeds --keyword "春招" --sort-by 最新 --note-type 图文

# 获取笔记详情（feed_id 与 xsec_token 来自搜索结果）
python scripts/cdp_publish.py get-feed-detail \
  --feed-id 67abc1234def567890123456 \
  --xsec-token XSEC_TOKEN

# 可选：滚动加载更多一级评论，并尝试展开二级回复
python scripts/cdp_publish.py get-feed-detail \
  --feed-id 67abc1234def567890123456 \
  --xsec-token XSEC_TOKEN \
  --load-all-comments \
  --limit 20 \
  --click-more-replies \
  --reply-limit 10 \
  --scroll-speed normal
```

说明：`list-feeds` 返回首页推荐 feed 列表。
说明：`search-feeds` 输出中包含 `recommended_keywords_count` 与 `recommended_keywords`，表示回车前搜索框下拉推荐词。
说明：`search-feeds` 返回当前页面可提取到的结果，不提供单独的 `--limit` 条数控制；若只需前 N 条，请在调用方截断返回列表。
说明：`get-feed-detail --load-all-comments` 会先滚动评论区，并可选点击“更多回复”后再提取详情，同时额外返回 `comment_loading`。
说明：`check-login` 与主页登录检查默认启用本地缓存（12h，仅缓存“已登录”），到期后自动重新网页校验。

### 6) 给笔记发表评论（一级评论）

```bash
# 直接传评论文本
python scripts/cdp_publish.py post-comment-to-feed \
  --feed-id 67abc1234def567890123456 \
  --xsec-token XSEC_TOKEN \
  --content "写得很实用，感谢分享"

# 使用文件传评论（适合多行文本）
python scripts/cdp_publish.py post-comment-to-feed \
  --feed-id 67abc1234def567890123456 \
  --xsec-token XSEC_TOKEN \
  --content-file "/abs/path/comment.txt"
```

### 7) 获取内容数据表（content_data）

```bash
# 获取笔记基础信息表（曝光/观看/封面点击率/点赞/评论/收藏/涨粉/分享/人均观看时长/弹幕）
python scripts/cdp_publish.py content-data

# 下划线别名
python scripts/cdp_publish.py content_data

# 可选：导出 CSV
python scripts/cdp_publish.py --reuse-existing-tab content-data --csv-file "/abs/path/content_data.csv"
```

### 8) 获取评论和@通知（notification mentions）

```bash
# 抓取 /notification 页面触发的 you/mentions 接口数据
python scripts/cdp_publish.py get-notification-mentions

# 下划线别名
python scripts/cdp_publish.py get_notification_mentions
```

### 9) 评论回复 / 点赞收藏 / 用户主页信息

```bash
# 回复评论（支持按评论 ID / 作者 / 文本片段定位）
python scripts/cdp_publish.py respond-comment \
  --feed-id 67abc1234def567890123456 \
  --xsec-token XSEC_TOKEN \
  --comment-id COMMENT_ID \
  --content "感谢反馈～"

# 点赞 / 取消点赞
python scripts/cdp_publish.py note-upvote --feed-id 67abc1234def567890123456 --xsec-token XSEC_TOKEN
python scripts/cdp_publish.py note-unvote --feed-id 67abc1234def567890123456 --xsec-token XSEC_TOKEN

# 收藏 / 取消收藏
python scripts/cdp_publish.py note-bookmark --feed-id 67abc1234def567890123456 --xsec-token XSEC_TOKEN
python scripts/cdp_publish.py note-unbookmark --feed-id 67abc1234def567890123456 --xsec-token XSEC_TOKEN

# 用户主页快照 / 用户主页笔记
python scripts/cdp_publish.py profile-snapshot --user-id USER_ID
python scripts/cdp_publish.py notes-from-profile --user-id USER_ID --limit 20 --max-scrolls 3
```

补充：上游项目的完整背景与安装说明见 https://github.com/white0dew/XiaohongshuSkills（本包未随附其 README，因其含上游赞助位与作者联系方式）。本文件中的命令样例是 agent 执行基线。

## 自定义封面（带标题，视频笔记）

> **2026-09-30 EP11A 实测通过**：把 1080×1920 带诗标题封面真正设置到了已发布（审核中）的笔记
> `<你的小红书笔记 ID>`《一首诗一出戏11·早发白帝城》上——编辑该笔记 → 改封面 → 提交
> 「更新成功」→ 重新打开编辑器回读平台封面 URL → Pillow 像素比对一致（详见下文「实测状态」）。

视频笔记默认由平台**自动抽帧**当封面（没有标题文字）。要使用 `video-cover` skill 生成的
`<prefix>-mobile-cover.png`（1080×1920 竖版，系列角标 + 标题 + 诗文面板），给发布链路传可选封面参数；
**缺省不传 = 保持自动抽帧，完全向后兼容**。

### 参数

| 入口 | 参数 | 说明 |
|---|---|---|
| `publish_pipeline.py` | `--cover <png>` | 视频笔记自定义封面（顶层参数） |
| `publish_pipeline.py` | `--cover-crop-drag <px>` | 上传后把裁剪窗口内的图**向上拖** N 屏幕像素（0=默认居中） |
| `cdp_publish.py fill\|publish` | `--cover <png>` / `--cover-crop-drag <px>` | 放在**子命令后**（fill/publish 自己的参数） |
| 两者 | env `XHS_COVER` | `--cover` 未给时生效 |
| `publish-xhs.js`（本机模板） | env `XHS_COVER`、`XHS_COVER_DRAG`，或 `XHS_CFG` JSON 的 `cover` / `cover_drag` | 见文末「与 publish-xhs.js 的差异」 |

- 仅**视频笔记**生效；图文笔记的第一张图就是封面，传了会打印警告并忽略。
- 封面文件不存在 → 启动即报错退出（`--skip-file-check` 可跳过，同媒体文件逻辑）。

```bash
# 带封面发布（示例）
python scripts/publish_pipeline.py --headless \
  --title-file /abs/path/title.txt \
  --content-file /abs/path/content.txt \
  --video "/abs/path/ep11a.mp4" \
  --cover "C:/abs/path/EP11A-mobile-cover.png" \
  --cover-crop-drag 80

# 等价的环境变量写法
XHS_COVER="C:/abs/path/EP11A-mobile-cover.png" python scripts/publish_pipeline.py ... --video ep11a.mp4
```

### 实现机制与选择器（2026-09-30 实测）

实现：`cdp_publish.py` 的 `_set_video_cover()`（`publish_video()` 在 `--cover` 给出时于填完标题/正文后调用）。
与 `publish-xhs.js` 的 `applyCover()` 使用同一套选择器。流程：

1. **hover 封面缩略图** `.default--ai-cover-layout`（兜底 `.cover-plugin-preview .default`）——必须真实鼠标事件（CDP `Input.dispatchMouseEvent`），JS `el.click()` 无效。
2. 悬浮入口 **`.cover-edit-entry-text`**（文本「编辑封面」，**仅 hover 时出现**）→ 真实鼠标点击。
3. 打开弹窗 **`.main-cover-editor-modal`**（标题「设置封面」；左侧 AI修改/裁剪/模版/贴纸/文字/滤镜）。
4. 找 **`input[type="file"][accept*="image"]`**（`aria-label="上传封面图片"`，弹窗打开即在 DOM 中）→ `DOM.setFileInputFiles` 注入 PNG → 等 ~6s（会出现 `ros-upload.xiaohongshu.com/spectrum/...` 上传请求）。不用点弹窗里的「+上传」按钮。
5. 可选：在 `.canvas-stage`（兜底 `.canvas-gl`）中心把图**向上拖** `--cover-crop-drag` px（`_drag_mouse()`）。
6. 点弹窗内**「完成」**（弹窗里最后一个 innerText=`完成` 的元素）→ 等弹窗关闭 → 主表单缩略图 `.default--ai-cover-layout` 的 `background-image` 变为新的 `spectrum` URL = **表单级封面已生效**。
7. **保存**（本任务实测的是编辑既有笔记）：底部按钮是 web component **`xhs-publish-btn`**（shadow DOM，`innerText` 搜不到、`.publish-page-publish-btn` 已不存在）→ 按元素 rect 中心真实点击 → 成功页 `/publish/editSuccess`「更新成功」→ 自动回笔记管理。`_get_publish_button_rect` / `_is_publish_button_ready` 已补认 `xhs-publish-btn`。

### 裁剪约束（重要，决定封面构图）

- 封面编辑器**只有 3:4 / 4:3 / 1:1 三档**（「裁剪」tab），「图片大小」滑杆最小 100%（只能放大不能缩小）——**9:16 源图必被裁成 3:4，整图保留做不到**。
- 1080×1920 默认取**居中 3:4 窗口**（源图 y240..1680）。EP11A 实测：系列角标（源图 y55..145）**必被裁掉**；诗文面板文字（y1380..1679）刚好压在窗口底边（零留边）。
- `--cover-crop-drag 80`（屏幕 px，1408×804 视口、弹窗默认布局下 ≈ 源图窗口下移到 **y464..1904**）：**诗文面板完整 + 底部 ~220px 留边**；角标仍无法保住（角标+全诗需 1630px > 1440px，3:4 物理装不下）。
- 该像素值随视口/布局变化；**校准方法**：完成后拉平台封面与源图逐窗口做 Pillow diff，取 diff 最小的 `top`（本次 best=464，diff≈2.5；JPEG 噪声底≈1.8）。

### 发布后在哪里核对封面

1. 笔记管理 → 目标笔记 → 「编辑」：卡片 `.note-card__actions` 里 tooltip 第4个 `.note-card__action-btn` 是编辑（**第5个 `--del` 是删除，勿点**），打开 `/publish/update?id=<noteId>&noteType=video`。
2. 读 `.default--ai-cover-layout` 的 `style.backgroundImage` → 下载该 URL → **用 Pillow 与源图逐窗口比对**（字节/像素）。**Read 工具会错图（实测返回空白/错图），核对一律不要用 Read 直接看图下结论。**
3. 平台侧最终封面即 `https://sns-na-i*.xhscdn.com/spectrum/...`（视频笔记存的是 **1080×1440 = 3:4** JPG）。
4. 也可在发布前看编辑器右侧「封面预览」，或发布后在笔记管理卡片缩略图肉眼确认（肉眼仅作辅助）。

### 实测状态（2026-09-30）

- ✅ **EP11A 真机实测通过**：审核中的笔记可直接编辑改封面；`xhs-publish-btn` 提交 →「更新成功」；平台封面 1080×1440 / 121073 bytes，与源图 y464..1904 窗口 diff=2.53（噪声底≈1.8，中心窗 diff=46.9 排除）→ 诗文面板完整。改封面后笔记**重新进入「审核中」**（平台预期行为）。笔记标题/正文未动。
- ✅ skill 方法 `_set_video_cover()` 在真机表单上 E2E 跑通（9.7s：hover→弹窗→注入→拖拽→完成，`Cover set on form` 日志正常）。
- ⚠️ **仅结构验证、未实测**：**全新视频发布**链路里 `--cover` 的端到端（视频上传→表单出现→封面→真发布）。本任务禁止上传视频/发新笔记，未跑真实新发布；封面步骤复用编辑页同一套组件，风险低，首次真实使用时留意日志。
- ⚠️ 已知坑：headless + WebGL 编辑器的 `Page.captureScreenshot` 会错乱（整屏变封面图/空白），**截图不可作为封面核对依据**；表单长时间操作后渲染进程可能卡死（CDP 全部超时、`/json/list` 正常），重启 Edge（同 `.xhs-profile`）即可恢复，未保存的表单改动会丢弃、不影响已保存状态。
- 🛟 手动兜底（选择器失效/风控无口时）：编辑页 hover 封面缩略图 → 点「编辑封面」→ 弹窗里注入/点「上传」选 PNG → 拖到想要的裁剪位置 →「完成」→ 底部 `xhs-publish-btn`（发布/更新）→ 用上面第2步核对。不要硬编坐标。

### 与 publish-xhs.js（本机 sample-diary-map 模板）的差异

- **skill 脚本（`cdp_publish.py` / `publish_pipeline.py`）为实现主力**：完整参数、校验、日志、失败即抛错。
- `{{WORKSPACE}}\sample-diary-map\publish-xhs.js`：`applyCover()` 精简版（同一套选择器），在 `go` / `publishnow` 两阶段填完标题正文后调用；输出状态行 **`COVER_STATUS: OK|FAILED|SKIPPED`**，**失败不阻断发布**（保旧流程可用），靠状态行+截图人工复核。其保存仍沿用坐标点击（暂存 `(612,855)` / 发布 `(750,855)`，1440×900 视口），与 skill 的 `xhs-publish-btn` 元素点击不同。
- 定时/编排走官方 engine（social-publish-skills `upload-video`）时**没有**本封面参数；要自定义封面就走本 skill 链路或 publish-xhs.js。

## 失败处理

- 登录失败：提示用户重新扫码登录并重试；若用户需要远程展示二维码，可改用 `get-login-qrcode`。
- 图片/视频下载失败：提示更换 URL 或改用本地文件。
- 本地路径不可用：优先改用绝对路径；若为 WSL/远程 CDP 的 Windows/UNC 路径，可先尝试 `--skip-file-check`，必要时再加 `--preserve-upload-paths`。
- 自定义封面失败（入口不出现/弹窗不开/注入后无 `spectrum` URL）：先检查 `scripts/cdp_publish.py` 的 `SELECTORS["cover_*"]` 是否被改版影响；仍不行按「自定义封面」一节的手动兜底路径处理，`publish-xhs.js` 看 `COVER_STATUS` 行。
- 评论/回复目标未定位成功：提示补充 `comment_id`，或改用 `comment_author` / `comment_snippet` 再试。
- 页面选择器失效：提示检查 `scripts/cdp_publish.py` 中选择器并更新。

## 合集管理（2026-09-30 实测：网页端 API 全流程跑通，两合集各 10 条 EP01→EP10）

> **结论升级**：原以为「合集只能 App 手动建」，实测 **creator 网页端可直接调 edith API 完成列合集/加笔记/排序**（前提是笔记合集已存在——创建也可用 `/create`，本次合集由用户在 App 建好）。App 建合集与网页 API 操作同一套数据。

### 接口与签名（核心机密）

- **域**：`https://edith.xiaohongshu.com`（不是 creator 本身；creator 前端里 `pG()` 返回值就是它）。在 `creator.xiaohongshu.com` 页面上下文内跨域调用即可（带 credentials）。
- **签名**：页面全局函数 `window._webmsxyw(path, data)` → `{X-s, X-t}`：
  - **GET**：`_webmsxyw(pathname + search, null)`（带 query 整串 + null，错一个姿势就 406）
  - **POST**：`_webmsxyw(pathname, body对象)`
- **传输必须用 XMLHttpRequest，禁用 fetch**：页面 fetch 被安全 SDK 劫持，间歇抛 `TypeError: Failed to fetch`（6 连败都可能）；XHR 稳定。
- **参数全 snake_case**：`collection_id` / `note_ids`；camelCase 会被 param check 400。

### 接口清单（前缀 `/api/sns/v1/note/collection/pc`）

| 操作 | 方法 | 入参 | 说明 |
|---|---|---|---|
| 合集列表 | GET `/list` | `?page=1&pageSize=50` | 首项是伪元素 `id=create_collection`，过滤掉；含用户所有合集（App 建的也在） |
| 合集详情 | GET `/info` | `?collection_id=` | **`data.note_num` 是唯一权威计数**；`/list` 里的 note_num 不可信（加完仍显示 0） |
| 候选笔记 | GET `/candidate_notes` | `?page=&pageSize=` | **不含已在任何合集里的笔记**（EP01 已入集就查不到，别当丢失） |
| 合集内笔记 | GET `/list_note_v2` | `?collection_id=&page=&pageSize=` | `data.items[]` 带 `index`（1-based 即展示顺序）+ `title` + `id` |
| **加笔记** | POST `/add_note` | `{collection_id, note_ids:"id1,id2,…"}` | **`note_ids` 必须是逗号分隔字符串；传数组会返回 success:true 但根本不落库（假成功，实测大坑）**；支持一次多条，按传入顺序追加 |
| 排序 | POST `/sorting_note` | `{collection_id, note_ids:"…"}` | 全序字符串（本次顺序天然正确未触发，参数形状同 add） |
| 其余 | create / update / remove_note / delete / bgcolor | — | 常量在前端 bundle 里，同族 snake 参数 |

### 实操流程（脚本模式）

1. 在 `creator.xiaohongshu.com` 页面上下文里用 XHR + 上述签名封装一个 `call(method, path, body)`（带 6 次重试、5s 退避——edith 偶发网络层失败）。
2. `/list` 找目标合集 id → `/info` 记当前 note_num → `/list_note_v2` 取已有 id 集合。
3. 目标顺序按 EP 编号拼 id 串，过滤已存在的，一次 `add_note`（逗号串）。
4. 回读 `/list_note_v2`，核对 `items[].title` 顺序 == EP01→EPN；不符再 `/sorting_note`。

### 实测成果（2026-09-30）

- `一首诗一出戏 · 读诗版`（id `<你的小红书合集 ID>`）10 条 EP01→EP10 ✅
- `一首诗一出戏 · 故事版`（id `<你的小红书合集 ID>`）10 条 EP01→EP10 ✅
- 交付脚本：会话目录 `xhs_final.mjs`（XHR+重试+补缺+验证一体机）、`xhs_api.mjs`、`xhs_fill2.mjs`

### 排错速查

| 症状 | 原因 |
|---|---|
| 406 `{code:-1}` | 签名姿势错（GET 必须 full path+search、第二参 null） |
| 404 `Not Found` | 域前缀错（必须 edith.xiaohongshu.com） |
| 400 `required param check: collection_id` | 参数用了 camelCase |
| success:true 但 note_num 不动 | **note_ids 传了数组** → 改逗号字符串 |
| `TypeError: Failed to fetch`（间歇） | fetch 被安全 SDK 劫持 → 改 XHR |
| 候选里找不到已入集的笔记 | candidate_notes 天然排除已入集笔记，用 `/list_note_v2` 兜底 |

### 旧结论（已被推翻，留作背景）

- 网页创作中心**界面**上确无「合集」入口（note-manager/首页/发布页 DOM 扫描 0 命中）——但**接口存在**，界面无入口 ≠ 能力不可用。
- App 三条建合集入口仍然有效：主页「笔记」→合集 / 创作中心→更多服务→创建合集 / 笔记编辑页→添加到合集；规则（≥3 篇自己公开笔记、可排序、删笔记自动移出）仍适用。
