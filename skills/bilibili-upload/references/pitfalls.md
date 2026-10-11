# 入坑指南 — bilibili-upload 测试记录（2026-09-28）

来源：会话 `test-skills/` 目录的 GitHub 实测（目录可删，本文件是权威记录）。
凭据位置与重登步骤见 `login.md`；本文件是"为什么会长成那样"的来龙去脉。

## 一、源仓库评估

| 仓库（GitHub） | 结论 |
|---|---|
| `yhbcode000/paper-share-skills` 的 `paper-bilibili-uploader` | ✅ **选用**，CLI/dry-run/diagnose 全部实测通过（已装到同级目录） |
| `programmerloverun/bilibili-to-doc` | ✅ 可用但属"读取向"（B站字幕→文档），与投稿互补，已另装 |
| `JimmyLv/bibigpt-skill`（bibi 摘要） | ⚠️ 需装 bibi 桌面客户端或 `BIBI_API_TOKEN`，无账号跑不起来 |
| `kaiger666888/bilibili-upload`、`RickyCui010/bilibili-api-skill` | 未深入（星少，已有更成熟的 paper-share-skills 覆盖） |
| `joeseesun/qiaomu-opencli-skills`、`nashsu/autocli-skill` | 通用抓取向，非投稿，未装 |

## 二、paper-bilibili-uploader 实测记录

1. **缺文件 fail-closed**：空目录 dry-run → 明确报 `No video_meta.json ... Run paper-slides-to-video first`，exit=1 ✓
2. **完整样例 dry-run**：构造 横屏 `*_narrated.mp4` + 竖屏 `*_portrait_narrated.mp4` + `cover.png` + `video_meta.json` →
   正确解析标题/标签/tid=231/简介，分 P 顺序横屏在前，生成完整 `biliup upload` 命令（cookie 指向 `~/.bilibili/cookies.json`、web 提交、cnbd 线路），末尾 `DRY RUN: metadata and command validated; biliup was not invoked.` ✓
3. **`--diagnose`**：锁文件/进程检查正常输出 ✓

## 三、biliup 凭据战役（本 skill `login.md` 的由来）

按时间线，每一步都是被报错逼出来的：

1. **手拼 cookie 四种格式全败**（flat dict / 键值对数组 / 字符串 / 完整 cookie jar）→ 报错各不相同
2. **serde 报错逐字段反推格式**（比读二进制猜快得多）：
   `missing field cookie_info` → `missing field sso`（类型=序列）→ `missing field token_info` → `missing field access_token`
   ⇒ 原生格式 = **TV 登录 poll 返回的整个 data**：`{cookie_info:{cookies:[{name,value,http_only,expires}]}, sso:[], token_info:{...}}`
3. **结构过了仍报** `credential validation failed with Bilibili code -400`
   ⇒ 所有子命令（`list`/`show`/`comments`/**`upload`**）启动都先跑 `oauth2/info`，**必须真 access_token**；纯 cookie 文件必死（用假 mp4 实测 upload 也在同一行 `uploader.rs:344` 被拦——顺带证明了不会误发布）
4. **旁路验证**：官方 `nav` 接口用我们抓的 cookie 返回 `isLogin=true`（账号正常）→ cookie 没问题，缺的只是 access_token；网页扫码拿到的 `crossDomain` cookie 同样缺 token，**喂不进 biliup**
5. **TV 登录接口猜参数失败**：`qrcode/auth_code` 用已知 appkey 签名 / JSON / GET 全部 -400（二进制里根本没有 `subject_id` 字面量，方向错误）
6. **转机：pywinpty 伪终端跑 `biliup login`**——登录不是直接出码，而是**菜单**：
   `账号密码 / 短信登录 / 扫码登录 / 浏览器登录 / 网页Cookie登录1 / 网页Cookie登录2`
   ⇒ 选「网页Cookie登录1」→ 按提示逐项喂 `SESSDATA`、`bili_jct` → 内部"获取二维码→**自动确认二维码**"（bili_jct 当 csrf 自确认，**无需手机再扫**）
7. **`os error 3 路径找不到`**：缺 cwd 下 `qrcode.png` 与 `.biliup/`（二进制里还有 `.biliup-write/-delete/-restore` 原子写痕迹）→ 预建后成功：
   `登录成功，凭据已保存到 {{USER_HOME}}\.bilibili\cookies.json`（1358 字节）
8. **终验**：`biliup list` exit=0 拉回账号真实稿件；paper skill dry-run 复验照常通过

## 四、坑清单（现象 → 根因 → 对策）

1. **拼好的 cookie 喂 biliup 报 -400** → 缺 access_token，格式再对也没用 → 必须走 `login.md` 流程让 biliup 自己生成
2. **`os error 3`** → 缺 `~/.biliup/`、cwd `.biliup/`、`qrcode.png` → 预建（`login.md` 第 1 步）
3. **`PtyProcess.spawn` FileNotFound** → 参数带了引号 → 不加引号（venv 路径无空格）
4. **PTY 脚本卡死** → `p.read()` 阻塞主线程 → 读取放 daemon 线程
5. **正则报 unbalanced parenthesis** → PS 5.1 `Get-Content` 按 ANSI 读无 BOM UTF-8 毁了中文 → 脚本用 here-string 一次写入，别回读
6. **子进程输出乱码/解码崩** → GBK 控制台读 UTF-8 → 一律 `PYTHONUTF8=1`
7. **网页扫码码有效期** ≈ 135~180 秒，过期报 86038 → 重新生成；86101=未扫，86090=已扫待确认

## 五、备忘

- 当时还装了共享 venv `~/.config/mimocode/skills/.venvs/publish`（biliup/psutil/requests/pywinpty/playwright），克隆仓库与试测样例都在 `test-skills/`，可整体删除
- 网页二维码 API（`generate`/`poll`）的完整可用脚本在 `login.md` 第 0 步方式 B，产物只够网页接口用，别直接当 biliup 凭据
