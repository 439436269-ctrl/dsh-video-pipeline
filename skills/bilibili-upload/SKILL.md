---
name: bilibili-upload
description: B站视频投稿、biliup 凭据管理与合集（视频合集）管理。当用户要求"上传视频到B站"、"发布B站视频"、"投稿到bilibili"、"biliup 上传"、"创建/管理B站合集"、"把视频加进合集排序"，或询问"B站 cookie 在哪"、"B站凭据过期怎么重新登录"时使用。覆盖凭据（cookie）位置、常用命令、论文视频投稿与 dry-run 校验、凭据失效后的免手动扫码重登流程、合集创建/批量加单集/排序/验证的完整 API 与 UI 流程。Use when the user wants to upload videos to Bilibili or asks where biliup cookies live and how to renew them.
---

# B站视频投稿（bilibili-upload）

用 biliup 把视频投稿到 B站。本文件另含一条论文视频投稿路径，它依赖**本包未包含**的外部 skill `paper-bilibili-uploader`；biliup 投稿引擎本身已包含在本包内。
2026-09-28 全链路实测通过（凭据校验 + list 拉回真实稿件 + dry-run 通过）。
**入坑指南**（test-skills 实测记录、凭据格式反推过程、坑清单）：`references/pitfalls.md`；**重登流程**：`references/login.md`

## 凭据（Cookie）位置 —— 核心事实

| 凭据 | 位置 | 说明 |
|------|------|------|
| **biliup 主凭据** | `{{USER_HOME}}\.bilibili\cookies.json` | biliup 原生格式，含 cookie 集合 + 真 `access_token`（token_info）。**所有** biliup 子命令启动时都会跑 `oauth2/info` 校验，缺 access_token 必报 `credential validation failed with Bilibili code -400` |
| 网页 cookie（SESSDATA / bili_jct / DedeUserID 等） | 不单独落盘 | 是生成主凭据的原料；来源：浏览器 DevTools 手动复制，或扫码后从 crossDomain 链接提取（见 `references/login.md`） |

- 当前主凭据绑定账号「<你的 B 站昵称>」，2026-09-28 登录，实测 `biliup list` 正常
- 该文件**含登录态，禁止入库、禁止外传**；本 skill 只记位置不记内容
- 格式备忘（反推所得）：`{"cookie_info":{"cookies":[{name,value,http_only,expires}]},"sso":[],"token_info":{mid,expires_in,refresh_token,access_token}}`——手工拼纯 cookie 文件无效，必须走重登流程生成

## 运行环境

```powershell
$env:PYTHONUTF8 = "1"
$py = "{{USER_HOME}}\.config\mimocode\skills\.venvs\publish\Scripts\python.exe"
$ck = "{{USER_HOME}}\.bilibili\cookies.json"
```

- venv 位于 `~/.config/mimocode/skills/.venvs/publish/`（已装 biliup、psutil、requests、pywinpty、playwright）
- 每条命令都要 `PYTHONUTF8=1`（否则子进程输出按 GBK 解码崩溃）

## 常用命令

```powershell
# 凭据健康检查（成功列出稿件 = 有效；-400 = 凭据过期，走 references/login.md）
& $py -m biliup -u $ck list

# 稿件详情 / 评论
& $py -m biliup -u $ck show "BV1xxxx"
& $py -m biliup -u $ck comments "BV1xxxx"

# 单视频投稿（发布前必须把 title/tag/tid/封面给用户确认，禁止未确认就提交）
& $py -m biliup -u $ck upload "D:\abs\path\video.mp4" `
  --title "标题" --tid 231 --tag "标签1,标签2" --desc "简介" --copyright 1 --cover "D:\abs\cover.png"
```

## 论文视频投稿（依赖**本包未包含**的外部 skill `paper-bilibili-uploader`；需先自行安装，下文命令里的路径按它的实际安装位置调整）

目录约定（缺一 fail-closed）：

```text
<paper_dir>/video/
  *_narrated.mp4            # 横屏，必传
  *_portrait_narrated.mp4   # 竖屏，必传
  cover.png
  video_meta.json           # {title, tag:[], tid, copyright, desc, cover_path}
```

```powershell
# 第一步永远是 dry-run（只校验、生成 biliup 命令，不上传）
& $py "{{USER_HOME}}\.agents\skills\paper-bilibili-uploader\scripts\upload.py" "<paper_dir>" --dry-run
# 输出末尾应见：DRY RUN: metadata and command validated; biliup was not invoked.
# 确认无误后再去掉 --dry-run 真实投稿（同样需用户确认）
```

## 凭据失效的信号与处理

- **信号**：任何子命令报 `credential validation failed with Bilibili code -400`，或 list 里稿件突然拉不到
- **处理**：按 `references/login.md` 重登（约 1 分钟，pywinpty 驱动 biliup 菜单的「网页Cookie登录1」，自动确认二维码，**无需手动扫码**）
- 注意：cookie 过期 ≠ 网页不能用——网页接口只要 SESSDATA 有效即可；biliup 额外要 access_token，两者生命周期不同

## 合集管理（创建 / 加单集 / 排序，2026-09-30 唐诗合集实测通过）

> 脚本在 `scripts/heji/`：`bili_ui.mjs`（UI 建合集）、`bili_api.mjs`（API 加单集/查询）、`bili_check.mjs`（编辑页回读验证）。
> 实测成果：读诗版 `seasonId=<你的 B 站合集 seasonId>` / 故事版 `seasonId=<你的 B 站合集 seasonId>`，各 7 单集、EP01→EP07 顺序、全部正常显示。

**入口**：创作中心 → 内容管理 → 视频管理 → 合集管理（`https://member.bilibili.com/platform/upload-manager/ep`）。

**登录态**：biliup 的 `cookies.json` 不是 storageState，注入方法——读 `cookie_info.cookies`，映射为 playwright cookie（`domain:.bilibili.com`、`path:/`、`secure:true`、`httpOnly:c.http_only`、`expires:c.expires`），`launchPersistentContext` 后 `addCookies`。专用 profile：`~/.bili-heji-profile`。

**创建合集（UI，必须走 UI——封面要先传图）**
1. 点「添加合集」→ 表单在主内容区（不是弹窗）：`input[type=file]` 封面（必填，≥960×540）、`input[placeholder="请输入合集标题"]`（≤50 字）、`textarea.ep-text-area-length` 简介（≤500 字）→「立即提交」。
2. **封面传完会弹裁剪确认框，按钮文案是「确认」不是「确定」**（第一版脚本按「确定」找导致提交被挡，白跑三次）。
3. 提交后页面转为编辑态，显示 `合集ID：xxx` 和「正在审核」，审核通常几分钟内转「正常显示」。

**API 链（可复用，curl/脚本皆可，cookie 带 SESSDATA+bili_jct）**
- 传封面：`POST /x/vu/web/cover/up`，body `cover=data:image/jpeg;base64,<...>&csrf=<bili_jct>` → 返回 biliimg URL
- 标题过滤：`POST /x/vu/web/staff-title/filter`
- 建合集：`POST /x2/creative/web/season/add?csrf=<bili_jct>`，body `{cover,title,desc,season_price:0,captcha_token:""}`
- 查列表：`GET /x2/creative/web/seasons?pn=1&ps=30&order=&sort=&draft=1&source=0` → `seasons[].season.id` / `sections.sections[0].id`(=sectionId) / `season.ep_num`
- 加单集：`POST /x2/creative/web/season/section/episodes/add?csrf=<bili_jct>`，body `{sectionId, episodes:[{title,aid,cid,charging_pay:0,member_first:0,limited_free:false}]}`
- 删单集：`POST /x2/creative/web/season/section/episode/del`，form `id=<episodeId>&csrf=<bili_jct>`

**加单集：用 API，别用 UI 批量**
- UI 流程（编辑 → 添加视频 → 搜索框 `type + Enter` 才过滤 → 勾选 `.ep-select-box-item-all-checkbox i`（class 变 `icon-checkbox_selected`）→ 下一步 `.ep-button` → 改单集标题（`maxlength=80`）→ 完成）**每次重新搜索会重置已勾选状态**，跨标题多搜只会留下最后一条——实测只进 1 条。
- 搜索框 `page.fill` 不触发过滤，必须 `type + Enter`。
- **限频**：连续 add 撞 `code=20111「合集编辑过于频繁」`→ 单条间隔 ≥12s，撞限频退避 20/40/60s 重试。
- **顺序**：按目标顺序逐条 add，`order` 即添加顺序；要改顺序需删了重加（排序接口未挖）。
- **限制**：每个稿件只能加入一个合集；仅已过审单P稿件。

**aid/cid 来源**：`biliup show <bvid>` → JSON `archive.aid` + `videos[0].cid`。⚠️ `api.bilibili.com/x/web/view` 无论裸 fetch 还是浏览器内 fetch 都被 WAF 返 HTML（412 风控页），别走。

**验证的坑**：`x2/creative/web/seasons` 的 `part_episodes` **只回前 4 条（服务端截断）**，别当真相——以 `sections.sections[].epCount` + 编辑页渲染列表（`视频（N）` + 序号行）为准（`bili_check.mjs`）。

**追加实测（2026-09-30，EP08-10 追加到 10 条）**：
- `bili_api.mjs add` 幂等：截断列表导致漏判已存在时，服务端返回 `code=20080「当前稿件已存在在合集中」`，**无副作用**，继续跑即可；读文件已内置 BOM strip——**PS5.1 `Out-File -Encoding utf8` 写的 JSON 带 BOM，`JSON.parse` 直接炸**，用 Node 读 JSON 前先 `replace(/^\uFEFF/,'')`。
- 映射文件 `map-dushi.json` / `map-gushi.json`（现含 EP01-10 的 title/aid/cid/bvid）已随 `scripts/heji/` 留档，新 EP 追加只要 `biliup show` 取 aid/cid 追进数组再跑 add。

## 对照说明：social-publish-skills 的 bilibili（2026-09-29 结论）

上游 `multi-platform-publish-orchestrator` 覆盖 tencent/douyin/kuaishou/xiaohongshu/wechatmp/zhihu/baijiahao **七平台，不含 B 站**；其 `skills/bilibili-upload` 为**占位未实现**（仓库 AGENTS.md 明示勿声称支持）。
因此 B 站唯一可用路径 = 本 skill（biliup）+ `paper-bilibili-uploader`（论文投稿，**本包未含**）；多平台场景走 `quad-platform-publish`（四平台总控，B 站段走 biliup）。
