# 入坑指南 — douyin-publish 测试记录（2026-09-28）

来源：会话 `test-skills/` 目录的 GitHub 实测（目录可删，本文件是权威记录）。

## 一、源仓库评估

| 仓库（GitHub） | 结论 |
|---|---|
| `L1angjy/douyin-publish-skill`（OpenClaw 原版） | ❌ 不可直接用：通篇 `browser(target="host")` 调 OpenClaw Gateway，上传路径写死 `/tmp/openclaw/uploads`。**本 skill 即其 MiMo 改写版** |
| `huangji6693-max/social-media-publish-skill`（sau 全平台引擎） | ✅ 实测可用（`sau douyin {login,check,upload-video,upload-note}` 跑通），是抖音发布的备选引擎。重装法：git 直连 github 常败 → `api.github.com/repos/<owner>/<repo>/zipball` 下载 → 引擎内 `conf.example.py` 复制为 `conf.py` |
| `yzfly/douyin-mcp-server`（douyin-video skill） | ⚠️ 是"下载/提文案"不是发布；`--help` 通过，`extract` 需硅基流动 API_KEY，合并需 ffmpeg（本机没装） |
| `WeiZhuochun/douyin-live-recorder` | ❌ 全套 `.sh` + ffmpeg + 网盘 + 账号配置，链路太重，本机缺 ffmpeg |
| `Rimagination/dy-note`（抖音学习笔记） | ❌ 强依赖作者另一 skill `web-access` 和 Qwen3-ASR 环境，本机缺失 |

## 二、端到端实测记录（本 skill）

1. **未登录检测**：headless `open` 上传页 → `snapshot` 元素树完整，页面停在「扫码登录」（二维码/验证码/手机号登录俱在）→ 符合预期
2. **扫码登录**：征得用户同意后 `--headed --persistent --profile` 开窗 → 用户扫码 → 快照确认登录面板消失
3. **登录态持久化验证**：中间因工具报错会话被杀、重开时**漏带 profile 参数**，登录面板又出现（误判为"登录失效"）→ 带回 `--persistent --profile` 后登录态完好
4. **发布入口就位**：回上传页快照 = 已登录创作者中心侧边栏（作品发布/内容管理/数据中心），`上传视频` 按钮 ref=e144 → **验证到此为止，未真实发布**
5. **收尾**：`close` 正常；登录态留在 profile，复验无需再扫

## 三、坑清单（现象 → 根因 → 对策）

1. **`Browser is already in use for <profile>` / 打开即报错**
   前次异常退出的僵尸 Chrome 占着 profile 锁。按命令行匹配 profile 路径杀 `chrome.exe`/`node.exe`，**必须排除当前 shell 的 PID**——本 shell 命令行里同样含该路径，不排除会把整个工具调用杀掉（本会话真踩过：命令输出戛然而止）
2. **工具层报 `ChildProcess.kill`**
   多为收尾杀进程的噪音，命令实际已成功（日志文件都写出来了）。对策：`Start-Process npx.cmd -ArgumentList ... -WindowStyle Hidden -RedirectStandardOutput <log> -Wait` 后读日志，别盲目重跑（`-WindowStyle Hidden` 必带，否则弹可见控制台）
3. **重开窗口"被登出"**
   会话被杀后重新 `open` 漏带 `--persistent --profile`，新窗口是无登录态临时 profile。**每个 open 都带齐参数**
4. **会话中途死掉、ref 全失效**
   `--idle-timeout` 设短了（曾设 60s）。默认 headless 闲置 1 小时，别动它
5. **PowerShell 输出中文乱码**
   控制台按 GBK 解 UTF-8 的显示问题，不代表数据错；脚本侧设 `PYTHONUTF8=1`

## 四、备忘

- playwright-cli 会话名固定 `douyin-publish`；profile 目录见 SKILL.md「登录态位置」
- 原 OpenClaw 版与本版步骤一一对应，排查时可对照其 `SKILL.md`（当时克隆于 `test-skills/douyin-publish-skill`）
