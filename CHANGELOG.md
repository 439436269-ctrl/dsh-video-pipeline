# Changelog

## 0.1.1 — 仅文档与工具（待发布）

代码与 `0.1.0` 完全一致，`lib/` 无改动；本版只为让 npm 页面显示新的 README（npm 渲染的是**该版本 tarball 里的 README**，改了仓库不会回流）。

- README 增加「19 个 skill 的关系与数据流」编排图，并配一张逐条列出 skill 交接关系的表。
- 新增 `tools/make-flow-diagram.mjs`：声明式生成 `docs/skill-flow.svg` + 2x `docs/skill-flow.png`（用本机 Chrome 无头渲染）；skill 集合变化时改数据重跑即可。图片列为 `screenshots.json`，但**不进制品包**——README 用 raw 绝对地址取图，`files` 白名单无需包含 `docs/`。
- 新增 `tools/setup-repo.mjs`：建仓 + 设 topics + 推送 + 核对远端 SHA；幂等，token 只从环境变量或 `~/.secrets/keys.env` 读，输出里不含 token。
- `tools/preflight.mjs` 修正 npm 名字检查：区分「名字被第三方占用」与「本版本已发布」，并把 maintainers 纳入核对，不再在首发之后永远失败。
- `tools/import-skills.mjs` 可移植性修复：`.py` 检查器按 `PYTHON` → `python3` → `python` 探测，缺失时如实报「跳过」而非误报语法失败（CI runner 只有 `python3`）。
- 新增 `docs/`（图与源码）与 `.gitattributes`（行尾统一 LF）。

## 0.1.0

首发。

- 新增 bundled skill provider（`lib/index.js` + `lib/provider.js`）：挂载即把包内 `skills/` 目录提供给 `ctx.skills`，以 rank 600 报告候选，因此安装者自己的项目/用户 skill 在同名时胜出。
- 内置 19 个 skill：1 个编排（`tangshi-pipeline`）+ 17 个原子 skill + 1 个本包自撰总入口（`video-pipeline`）。
- 无依赖实现：只用 Node 内建模块，`dependencies` 与 `peerDependencies` 均为空，避免 peer 范围解析失败。
- 无依赖的 frontmatter 解析（`lib/frontmatter.js`）：支持内联标量、`|` 与 `>` 块标量、嵌套 map，以及 `disable-model-invocation` / `user-invocable` 的严格布尔解析（非法值丢弃该 skill 并告警，不静默放行）。
- 占位符机制（`lib/placeholders.js`）：skill 正文里的 `{{TOKEN}}` 在加载时按「配置 → 环境变量 → 内置可读默认值」替换。
- 可复现导入器（`tools/import-skills.mjs`）与唯一规则来源（`tools/scrub-rules.mjs`）：`--audit` 只报告、`--write` 重建 `skills/`、`--verify` 过隐私与语法门。
- 发布前脱敏：剔除 175 个只属于原作者项目历史的文件（真实 API key、登录态缓存、字节码、播放数据快照、合集映射、逐集一次性脚本、操作截图，以及作者明确要求不保留的五份数据复盘文档），替换 35 个文件里的账号标识与本机路径；另有 15 处「文档准确性改写」——把包外 skill 标为外部、把正文里对作者账号播放表现的绝对数字与实测倍率改写成定性规则。4 个被剔除但仍被脚本读取的输入以空模板随包。
- 第三方合规：`xiaohongshu-skills`（white0dew/XiaohongshuSkills, MIT）与 `douyin-publish`（L1angjy/douyin-publish-skill, MIT）随包保留许可与署名，见 `THIRD-PARTY-NOTICES.md`。
- 包内文本文件行尾统一为 LF：源 skill 在 Windows 上带 CRLF，不归一会让 tarball 随打包机器漂移，并让 npm 回读校验出现「本地 tgz 与 registry 不一致」的假差异。
- `tools/verify-artifact.mjs`：打包 → 解包 → 真实加载解出来的 `lib/index.js`，核对包内自洽、19 个 skill、占位符无残留、行尾统一，并断言开发目录没混进包。CI 里跑这条。
