# 发布清单（本仓库专用坐标与命令）

> **当前进度（2026-10-16）**
>
> | 步骤 | 状态 |
> |---|---|
> | ① GitHub 建仓 + 推送 | ✅ **已完成** —— `439436269-ctrl/dsh-video-pipeline`，CI 绿；另建宿主中立仓 `video-pipeline-skills`（Claude Code / Codex）。 |
> | ② npm 发布 0.1.0 | ✅ **已完成** —— shasum `7c40c1647b549b737c65497bb6b51c94d85ee1ff`（与本地打包逐字节一致）。详见 `VERIFY.md` 第 8 节。 |
> | ②b npm 发布 0.1.1（仅文档） | ✅ **已发布** —— 目的是让 npm 页面显示含 skill 关系图的新 README；`latest=0.1.1`，逐字节回读一致（sha1 `4281b430…`）。 |
> | ③ 市场 PR（本项目） | ✅ **已提 PR [#7501](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/7501)** —— 只加一个条目文件；`dsh.bundle` / 满 1 天 / topic `dsh-plugin` / `category: skill` 四项要求均满足。 |
> | ③b 市场 PR（dsh-zspace） | ✅ **已提 PR [#7502](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/7502)** —— 同一作者的另一个插件，按上游「一 PR 一条目」的主流形态单独开，未合并在同一 PR 里。 |
>
> 🔑 npm token 已存入 `~/.secrets/keys.env`（唯一真源，权限已收敛到仅本人、去继承），配套 `load.ps1` / `load.sh` 读取脚本已就位，用 `. $HOME\.secrets\load.ps1` 载入。**注意**：这一枚 token 已出现在对话记录里，建议尽快到 npm 设置 revoke，再新建一枚替换 `keys.env` 里的值。

> 原子的操作细节在 skill `dsh-plugin-publish-repo`、`dsh-plugin-publish-npm` 里；本文件只记录**这个仓库自己的**取值，避免每次都去回溯。

## 坐标

| 项 | 值 |
|---|---|
| npm 包名 | `dsh-video-pipeline`（已发布；`latest=0.1.1`） |
| 版本 | `0.1.1`（已发布） |
| GitHub 仓库 | [`439436269-ctrl/dsh-video-pipeline`](https://github.com/439436269-ctrl/dsh-video-pipeline)（已建，CI 绿） |
| 市场条目文件 | `data/plugins/439436269-ctrl__dsh-video-pipeline.yml`（内容见 `publish/market-entry.yml`，PR [#7501](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/7501)） |
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

> **先跑一次自检**：`node tools/preflight.mjs` —— 只读、不推送、不发布。它会核对包清单（`dsh.bundle`、署名、`repository`、`files` 白名单）、远端名字占用、git 状态、三道本地门与凭据，并给出「本地是否已可发 + 还差哪些外部条件」的明确判决。本地问题会让它非零退出，缺凭据只单独列出（那是外部条件，不是包的缺陷）。

> **顺序说明**：原计划「先建仓推送，再发 npm」——因为 npm 页面渲染的 README 顶部那张编排图用的是
> `https://raw.githubusercontent.com/439436269-ctrl/dsh-video-pipeline/main/...` 绝对地址
> （相对路径在 npm 页面上拿不到），仓库没公开时图是坏的。实际执行时 **npm 先发了**（作者只给了 npm token）。
> 这不是不可逆的：图片是渲染时按 URL 取的，仓库建好后该图会自己恢复显示，**不需要为了图片重发版本**。
> `screenshots.json` 同理。

### 1. GitHub 建仓 + 推送

推荐用脚本（幂等、输出里不会出现 token、推送后核对远端 SHA）：

```sh
node tools/setup-repo.mjs --check     # 只自检：git 状态、凭据、仓库与 topics 规则
node tools/setup-repo.mjs             # 建仓（已存在则跳过）+ 设 topics + push + 核对远端 SHA
node tools/setup-repo.mjs --no-push   # 只建仓与设 topics
```

token 来源：`GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_PAT` 环境变量，或 `~/.secrets/keys.env` 里的同名键。脚本用带 token 的 URL 推一次，**随后立刻把 remote 换回干净地址**（不把 token 留在 `.git/config`），并把捕获到的输出里出现的 token 替换成 `<token>` 再打印（git 会回显 URL）。

等价的纯手工命令（脚本不能跑时用）：

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

**加速点**：账号 `439436269-ctrl` 下**已经有 `awesome-dsh-plugin` 的 fork**（2026-10-11 实测），所以第 3 步可以跳过 fork，直接在已有 fork 上开分支写文件、再开 PR。作者另有 5 个已发布的 DSH 插件（`dsh-zspace` / `dsh-piano` / `dsh-scroll-piano` / `dsh-session-path` / `dsh-pinned-sessions`），发布流程已跑通过。

## 市场 PR 实战要点（2026-10-16 实测，awesome-dsh-plugin）

- **提交物只有一个文件**：`data/plugins/<owner>__<repo>.yml`；README 由脚本生成，**不许手改**。
- 条目字段：`url`（必须与仓库完全一致）/ `name`（`owner/repo`）/ `category` / `description.en`（**唯一必填**，`zh` 可选）。
  **含「冒号+空格」的值必须加引号**，否则 YAML 当成嵌套键；单引号内的单引号写成两个。
- 四项硬门槛（`scripts/check-submission.mjs`）：仓库声明 `dsh.bundle`（**只有 `dsh.client` 会被拒**）、仓库满 1 天、仓库未归档、不是 DSH 自身或一方包的翻版；**无提交数门槛**。
- 单 PR 最多 3 个条目；合并样本里 92% 是单条目 → 同一作者的多个插件**各开一个 PR** 更稳。
- **先同步 fork 再开 PR**：`POST /repos/<fork>/merge-upstream`。fork 落后会触发 `pr-check` 的 stale-fork 守卫（PR 若删掉 >2 个既有条目即失败）。
- 目录列举会被 GitHub API **截断在 1000 条**（市场条目远多于此）→ 判断「是否已收录」要按**精确路径**取文件，不能靠列目录。
- CI 通过只是前置条件，维护者会真读仓库核对描述（含描述里的数字与 API 名）→ **描述只写能核实的**。
