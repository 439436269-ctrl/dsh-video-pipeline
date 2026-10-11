# 发布清单（本仓库专用坐标与命令）

> 原子的操作细节在 skill `dsh-plugin-publish-repo`、`dsh-plugin-publish-npm` 里；本文件只记录**这个仓库自己的**取值，避免每次都去回溯。

## 坐标

| 项 | 值 |
|---|---|
| npm 包名 | `dsh-video-pipeline`（已查重：registry 404，可用） |
| 版本 | `0.1.0` |
| GitHub 仓库 | `439436269-ctrl/dsh-video-pipeline`（目标，尚未创建） |
| 市场条目文件 | `data/plugins/439436269-ctrl__dsh-video-pipeline.yml`（内容见 `publish/market-entry.yml`） |
| 市场分类 | `skill` |
| 署名 | `vfvrpq` / <https://github.com/439436269-ctrl> |

## 当前前置条件（2026-10-11 实测）

| 需要 | 状态 |
|---|---|
| GitHub 凭据 | ❌ `credential.helper=manager` 已配置，但**未存** github.com 凭据；非交互探测报 `Cannot prompt because user interactivity has been disabled`。首次 `git push` 会弹凭据管理器窗口，或先提供 token。 |
| npm Automation token | ❌ `~/.secrets/keys.env` 不存在，`NPM_AUTOMATION_TOKEN` 环境变量未设置。按 `dsh-plugin-publish-npm` 的约定，token 的唯一真源是 `~/.secrets/keys.env`。 |
| 仓库年龄 | 建仓后需满 **1 天**才能提市场 PR（仓库年龄门槛由 CI 自动检查） |

密钥请**不要**贴进对话或写进仓库；放 `~/.secrets/keys.env` 一行一个即可，我会写临时 npmrc、用完即删。

## 三条发布渠道与命令

### 1. GitHub 建仓 + 推送

```sh
# 建仓（API，topic 只能小写 ASCII，dsh-plugin 必带）
#   POST https://api.github.com/user/repos
#   {"name":"dsh-video-pipeline","private":false,"has_issues":true,"has_wiki":false,"auto_init":false,
#    "description":"DSH 插件：把一条短视频生产流水线（19 个 skill）内置进 agent 技能目录",
#    "homepage":"https://www.npmjs.com/package/dsh-video-pipeline"}
#   PUT /repos/439436269-ctrl/dsh-video-pipeline/topics
#   {"names":["dsh","dsh-plugin","deepseek-harness","cordis","skill","video","ffmpeg"]}
cd <repo>
git remote add origin https://github.com/439436269-ctrl/dsh-video-pipeline.git
git push -u origin main
git ls-remote origin refs/heads/main     # 用远端 SHA 核对，不要只看命令没报错
```

### 2. npm 发布

```sh
. $HOME\.secrets\load.ps1                                   # 载入 NPM_AUTOMATION_TOKEN
$rc = Join-Path $env:TEMP "npmrc-video-pipeline"
"//registry.npmjs.org/:_authToken=$env:NPM_AUTOMATION_TOKEN" | Set-Content $rc -Encoding ascii
$env:NPM_CONFIG_USERCONFIG = $rc
npm run check; npm test; npm run privacy-gate; npm run verify:artifact
npm publish --no-git-checks
Remove-Item $rc                                             # 立刻删
```

⚠️ **staged publishing**：`npm publish` 打印成功只代表进了暂存区，registry 自动 promote 需 6～12 分钟。窗口期内 `dist-tags.latest` 还是旧值、`GET /<name>/<version>` 404、同版本重发报 `409 Cannot publish over previously staged version` —— **都不是失败**，等 10～15 分钟再用两个端点确认。npm 包不可撤回。

### 3. 市场 PR

```sh
# 仓库创建满 1 天后，把 publish/market-entry.yml 的内容写到
#   data/plugins/439436269-ctrl__dsh-video-pipeline.yml
# 再给 awesome-dsh-plugin/awesome-dsh-plugin 提 PR（一个 PR 最多 3 条）。
```
