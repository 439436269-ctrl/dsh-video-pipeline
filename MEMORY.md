# MEMORY

本仓（dsh-video-pipeline）的长期记忆：规则、架构定论、以及「未来不知道就会再踩」的坑。
条目式、只追加或就地更新。**不写任何明文凭据与账号标识**（本仓公开）。

## Rules

- **找 skill / 脚本 / 本机约定时，优先读 `~/.agents/`（复数）**（2026-10-12 作者指定）。
  本机权威 skills 根 = Windows `%USERPROFILE%\.agents\skills`（96 个）/ macOS `~/.agents/skills`；
  `~/.agent/`（**单数**）不存在，`~/.config/mimocode/skills` 是已废弃旧根（只剩一个 `agents.md`）。
  只有确认 `.agents/` 里没有，才去旧路径翻。详见下方「本机路径权威表」。
- **发布动作由作者点头后执行。** npm publish、平台「发表/更新」都不擅自点；公众号只做到草稿，
  由作者手动发表（2026-10-02 作者指定，优先级最高）。
- **唯一密码只存 `~/.secrets/keys.env`**（本机 ACL 已收敛、无继承），绝不写进记忆文件、skill、
  仓库或对话产物。提醒作者轮换曾出现在对话里的 token。
- **本仓公开**：任何记忆/文档都不得出现账号昵称、平台后台 ID、密钥、个人绝对路径（用 `%USERPROFILE%`）。
- **推文写法**：主体讲「编排流程 + 原子能力各自怎么做」，踩坑集中成一个章节，不占主要篇幅
  （2026-10-12 作者反馈）。
- **软件源里的图必须目视检查**：生成器产出的图每版都要读一遍，不能只看代码跑通（这轮因此修掉
  4 个真实缺陷：名字溢出、标签叠卡片、长边穿卡片、以及自己把长 skill 名缩写坏）。
- **平台文案分开维护**：知乎可点链接；公众号未认证账号正文不能带外链，必须写纯文本 URL。

## Architecture decisions

- **零运行时依赖**：`dependencies` 与 `peerDependencies` 全空，只 import Node 内建模块。
  理由：DSH 官方包的 peer 范围对**预发布版本**有反直觉的 semver 规则
  （`>=0.0.1-rc.1 <0.2.0` 匹配不到 `0.1.0-rc.6`），用户会撞上需要手改的 `ERESOLVE`。
  注册 provider 用的是普通对象 `{ name, list, get }`，不需要 import 任何官方包。
- **内置 skill 用最低优先级（rank 600）**：项目 100 / 用户 400-500 / 内置 600，数字小的赢 →
  使用者自己同名的 skill 胜出，不会被插件静默覆盖。
- **单一真源 + 下游生成**：`skills/` 由 `tools/import-skills.mjs` 从本机技能库生成（规则集中在
  `tools/scrub-rules.mjs`）；宿主中立仓 `video-pipeline-skills` 由 `tools/sync-skills.mjs`
  从本仓 `skills/` 单向导出，不做双份维护。
- **图一律用生成器**：`tools/make-flow-diagram.mjs`（关系图，声明式节点/边）与
  `tools/make-promo-cover.mjs`（推文封面，按平台比例缩放）。数据改了重跑，不手改图。
- **按平台比例出图**：关系图 1356×728（1.86:1）；公众号封面用两侧补白的 2.35:1 宽版
  （1711×728，避免默认居中裁剪切掉标题/页脚）；知乎封面另出 16:9。
- **图要按平台的「遮挡」留白**：知乎在图片右下角压水印，所以关系图底部留 96px 空白带。
- **调试产物不得入库**：发布脚本会把失败/成功截图写到封面同目录（含后台账号信息），
  `.gitignore` 已挡 `*-fail-*.png` / `inserted-final.png`，并由 `verify:metadata` 做门。

## Discovered durable knowledge

### 本机路径权威表（2026-10-12 实测，避免再猜）

| 用途 | 权威路径 | 实测状态 |
|---|---|---|
| skills 库（Agent 扫描、读写） | `%USERPROFILE%\.agents\skills` | ✅ **存在，复数**；本机 96 个 skill；`zspace-skills-sync` 的默认源就是它 |
| `%USERPROFILE%\.agent\`（**单数**） | — | ❌ **不存在**；任何文档写单数都是错的 |
| `%USERPROFILE%\.config\mimocode\skills\` | 旧 MiMo 根 | ⚠️ 只剩下一个 `agents.md`；**多个 skill 引用的 `.venvs/publish/Scripts/biliup.exe` 已不存在** |
| `%USERPROFILE%\.dsh\skills\` | — | ❌ 不存在（DSH 不从这里读 skill） |
| `C:\Users\86136\...`（曾出现在 5 个 skill 里） | 另一台机的用户名 | ✅ **已于 2026-10-12 清理**：12 处改为 `$env:USERPROFILE`（代码）/ `%USERPROFILE%`（散文），并把同时存在的废弃根 `.config\mimocode\skills` 一并修正为 `.agents\skills` |

结论：**读写 skill 只认 `%USERPROFILE%\.agents\skills`**（Windows）/ `~/.agents/skills`（macOS）；旧文档里的 `.config/mimocode/skills` 只在「历史沿革」意义上成立。

### 市场投稿（awesome-dsh-plugin，2026-10-16 实测）

- **投稿物只有一个文件**：`data/plugins/<owner>__<repo>.yml`；字段 `url` / `name` / `category` / `description.en`
  （**只有 en 必填**，缺 zh 由维护者补）；值含「冒号+空格」**必须加引号**；**README 由脚本生成，不许手改**。
- **四项硬门槛**（`scripts/check-submission.mjs`，由 `pr-gate.yml` 用带 token 的 API 实查）：声明 `dsh.bundle`
  （**只声明 `dsh.client` 会被拒**）、仓库满 1 天、未归档、不是 DSH 自身或一方包翻版；**已无提交数门槛**。
  CI 双绿（`check` + `Submission gate`）只是**前置条件**，仍要人工评审。
- **判断「是否已收录」必须按精确路径取文件**（`contents/data/plugins/<owner>__<repo>.yml`）。
  **目录列举会被 GitHub API 截断在 1000 条**，而市场条目远多于此 → 靠列目录得到的「没匹配到」是**假阴性**
  （曾据此误判 dsh-zspace 未收录/已收录各一次）。
- **开 PR 前先查重**：`GET /pulls?head=<owner>:<branch>`。同名分支已存在时，`PUT contents` 会**改写既有 PR 的内容**
  ——2026-10-16 实测：`dsh-session-path` 已有 #6997，重复投稿触发 422，且误在既有 PR 上多加了一次描述改写，
  最后还原原文。**不该给正在评审的 PR 塞无谓改动。**
- **先 `POST /repos/<fork>/merge-upstream` 再开 PR**：上游 `pr-check` 有 **stale-fork 守卫**（PR 若删掉超过
  2 个既有条目即失败），落后的 fork 会被误判成大删改。
- 单 PR 上限 3 个条目，但**合并样本 92% 是单条目** → 同一作者的多个插件**各开一个 PR** 更稳。
- 本次投稿的 PR 号与结果记在 `PUBLISH.md`；作者侧完整目录见其笔记 `~/Downloads/插件笔记.md`。

### 隐私与仓库

- **`git add -A` 前必须审查文件清单**（2026-10-12 事故）：发布脚本的调试截图落到 `docs/` 被带进
  公开仓，内容含后台账号信息，分布在 5 个提交里，最后靠 `git filter-branch --index-filter`
  改写全部历史 + `git push --force` 才清掉（`--force-with-lease` 当时报 stale info）。
  对策：入库前列 `git status --short` 逐条看；已加 `verify:metadata` 门 + `.gitignore`。
  注意 GitHub 可能在一段时间内仍能按 SHA 访问不可达 blob，彻底清除需联系 GitHub Support。
- **PowerShell 5.1 不能用来改 UTF-8 文本**（2026-10-12 又踩一次）：`Get-Content -Raw` 按 ANSI 读、
  `Set-Content -Encoding UTF8` 加 BOM → 脚本报 `SyntaxError` 且中文变乱码。改文件用编辑工具，
  改 JSON/脚本后跑一次 `node --check`。
- **PowerShell `Invoke-RestMethod` 发 JSON 会把中文写成 `?`**：GitHub 仓库简介因此变成
  `?????19???skill`。对策：用 Node `fetch` + `Buffer.from(JSON.stringify(body),'utf8')`。

### 断言与门

- **一条通过的断言不代表它会咬人**（2026-10-12）：新加的「包内文档与最后一次提交一致」最初写成
  与**工作区**比 —— 而打包本身就取自工作区，断言在数学上不可能失败。改成与 `git HEAD` 比才会咬人。
  现在每加一条检查都先做反向测试。
- **`if (!bad.length)` 判的是函数参数个数**（恒为 1）→ 那行确认永远不打印，等于静默跳过检查。
- **`claude plugin validate` 在仓根只严格校验 marketplace 清单**：故意把 `plugin.json` 写成缺
  `name` 的坏 JSON，它只给 warning 且 **exit 0**。对策：自己严格解析两个清单，并把 warning 当失败。
- **npm 渲染的是该版本 tarball 里的 README** → 只改文档也要发版；想验证「npm 页面会显示什么」，
  就查包内那份文件，别查工作区。

### 发布链路

- **npm staged publishing**：`publish` 打印成功只代表进暂存区。窗口期内 `dist-tags.latest` 仍旧值、
  新版本 404、同版本重发报 `409` —— **都不是失败**（实测 promote 约 1.5–2.5 分钟）；改版本号重发
  才是真的麻烦。
- **回读校验要四重**：`dist.shasum` == 本地 tgz 的 sha1、integrity 校验、本地 tgz 与 registry
  产物逐字节一致、逐文件比对。本仓 `tools/verify-artifact.mjs` 会在解包后**真实 import** 入口。
- **README 的图要用 raw 绝对地址**（npm 不渲染相对路径/SVG/Mermaid）；`docs/` 不必进 `files`
  白名单（图是渲染时按 URL 取的）。本机实测 `raw.githubusercontent.com` 直连超时，属网络问题。
- **Windows 上 Node 20+ 不能直接 spawn `.cmd`**（CVE-2024-27980 加固）→ 经 shell 调用并给路径加引号。

### 知乎 / 公众号（发布编排）

- **知乎的注入器只认一套有限语法**（h1-h3 / `- ` 列表 / `>` 引用 / `---` / 加粗 / 链接 / 图片）：
  表格、``` 围栏、有序列表、行内反引号都会变字面文本。对策：文案单源 + 生成器做发布安全转换，
  并断言「无表格行/无围栏/无有序列表/无反引号/无目录节/无 autolink」。
- **清空编辑器必须断言**：`Ctrl+A → Delete` 不校验时，选区一旦不在编辑器里，随后的 paste 就变成
  **追加**（实测 8 节粘成 16 节），而成功判据 `h2 ≥ 1 && > 300 字` 在追加时同样成立 → 它照样报 FIXED。
  对策：删完量字数，非 0 重试，仍失败即中止；成功判据改成 h2 数与源文件一致。
- **正文里有图时要点「有文字的块」再全选**：点编辑器容器可能落在图片上，`Ctrl+A` 选不到文本。
- **`insert-images.cjs` 的 `dir` 是滚动方向**：靠顶部的锚点用 `-1`、靠底部的用 `1`；用错一律报
  `anchor not found`，容易误导去查锚点字符串。
- **知乎引擎只在首次创建草稿时设标题**，后续重注入只替换正文、不动标题字段 → 已发布文章会出现
  「标题旧、正文新」。对策：重注入后单独核对标题字段。
- **已发布文章的编辑要点「更新」才上线**（编辑器按钮此时显示「更新」而非「发布」）；
  `created` 与 `updated` 相同即表明发布后未再更新过。
- **知乎公开页对自动化返回 403**（带不带 cookie 都一样）→ 读线上标题/封面要用
  `https://zhuanlan.zhihu.com/api/articles/<id>`（返回 200，含 `title` / `image_url` / `updated`）。
- **知乎话题限 3 个**，且话题库里同名「书籍」话题很多（搜 `Claude Code` 首条是《…橙皮书（书籍）》）→
  选话题要排除 `书籍/橙皮书`；删除 chip 的控件是 chip 内部的 `button` 里的 `svg.ZDI--CircleClose24`，
  不要点页面上第一个 close（会误删别的话题）。
- **公众号未认证账号正文不能带外链**：Markdown 链接会被剥掉 href，**URL 一并消失**、只剩链接文字
  （实测正文里 `bilibili`/`github`/`npmjs` 关键词全为 false）。对策：正文写**纯文本 URL**；
  要让某个链接可点，只能用编辑器的「阅读原文」。
- **公众号封面不能信引擎自报**：裁剪页「确认」超时会导致封面其实没绑上，而引擎仍报 `coverOk: true`。
  权威判定是**重开草稿读回图床背景图**；`fix-cover.cjs` 可补绑（素材库已有该图时走这条路）。
- **素材库按文件名命中同名图会秒选旧图** → 换封面务必用新文件名（`-v2`、`-wide`）。
  素材库上传成功后缩略图转存需 15–45 秒；`direct-insert-cover.cjs` 在本机某些草稿上会因
  素材库面板根本没打开而报 `uploaded thumb not found`（面板 0 条目），此时改走「引擎发布带
  `--cover` → 再 `fix-cover` 补绑」这条已验证路径；代价是新建一篇草稿。
- **`fetch-article-url.cjs` 的标题选择器已失效**（报 `not found`），但发表记录页的内嵌 JSON 里有
  `content_url`（永久短链 `mp.weixin.qq.com/s/xxx`）与 `sent_status`（群发成功判定 1/1/0），从那里取。

### 编排层的时间账（内容侧结论，值得复用）

- 一集端到端 59 分钟里**只有约 7 分钟在生产**，88% 花在发布等待与主线程同步 `wait` 上。
  优化位不在生成，而在「不等最慢的 agent」、把延迟审计移出关键路径、不共用浏览器 profile。
