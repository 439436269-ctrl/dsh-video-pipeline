# Changelog

## 0.1.0

首发。

- 新增 bundled skill provider（`lib/index.js` + `lib/provider.js`）：挂载即把包内 `skills/` 目录提供给 `ctx.skills`，以 rank 600 报告候选，因此安装者自己的项目/用户 skill 在同名时胜出。
- 内置 19 个 skill：1 个编排（`tangshi-pipeline`）+ 17 个原子 skill + 1 个本包自撰总入口（`video-pipeline`）。
- 无依赖实现：只用 Node 内建模块，`dependencies` 与 `peerDependencies` 均为空，避免 peer 范围解析失败。
- 无依赖的 frontmatter 解析（`lib/frontmatter.js`）：支持内联标量、`|` 与 `>` 块标量、嵌套 map，以及 `disable-model-invocation` / `user-invocable` 的严格布尔解析（非法值丢弃该 skill 并告警，不静默放行）。
- 占位符机制（`lib/placeholders.js`）：skill 正文里的 `{{TOKEN}}` 在加载时按「配置 → 环境变量 → 内置可读默认值」替换。
- 可复现导入器（`tools/import-skills.mjs`）与唯一规则来源（`tools/scrub-rules.mjs`）：`--audit` 只报告、`--write` 重建 `skills/`、`--verify` 过隐私与语法门。
- 发布前脱敏：剔除 170 个只属于原作者项目历史的文件（真实 API key、登录态缓存、字节码、播放数据快照、合集映射、逐集一次性脚本、操作截图），替换 37 个文件里的账号标识与本机路径；4 个被剔除但仍被脚本读取的输入以空模板随包。
- 第三方合规：`xiaohongshu-skills`（white0dew/XiaohongshuSkills, MIT）与 `douyin-publish`（L1angjy/douyin-publish-skill, MIT）随包保留许可与署名，见 `THIRD-PARTY-NOTICES.md`。
- 包内文本文件行尾统一为 LF：源 skill 在 Windows 上带 CRLF，不归一会让 tarball 随打包机器漂移，并让 npm 回读校验出现「本地 tgz 与 registry 不一致」的假差异。
- `tools/verify-artifact.mjs`：打包 → 解包 → 真实加载解出来的 `lib/index.js`，核对包内自洽、19 个 skill、占位符无残留、行尾统一，并断言开发目录没混进包。CI 里跑这条。
