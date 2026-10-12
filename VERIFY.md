# VERIFY.md — 验证记录

本文件记录 0.1.0 的验证过程与原始证据。按发布要求，路径已脱敏为 `%USERPROFILE%` / `<plugin dir>`。

环境：Windows，Node v22.16.0，pnpm 11.7.0，`dsh` CLI 0.1.5-rc.3。

## 1. 隐私门（P5）

```
$ node tools/import-skills.mjs --write
合计：保留 45，脱敏 35，准确性改写 15，剔除 175，自撰 1，模板 4
写入 85 个文件

$ node tools/import-skills.mjs --verify
校验 85 个文件（其中 33 个脚本做了语法解析）；残留 0 处
未发现密钥、账号标识、本机路径、内网地址残留，脚本语法可解析，全部通过。
exit 0
```

`--verify` 检查四类东西：密钥/账号标识/本机路径/内网地址残留、脚本语法可解析性、`SKILL.md` 可解析性、以及每个应存在的 skill 目录是否存在。

导入过程中门禁抓出并修掉了 5 个真实问题（说明这道门不是形式）：

| # | 问题 | 怎么发现的 | 处置 |
|---|---|---|---|
| 1 | `^map-.*\.json$` 这类锚定文件名的剔除规则对 `scripts/heji/map-*.json` 不生效，真实合集映射被当成保留文件 | `--audit` 报告里该文件出现在「改」而不是「删」 | 规则改为任意深度匹配 |
| 2 | `dropReason` 改为传 skill 前缀后，`^ARK_KEY\.txt$` 失效，**真实 API key 文件被复制进包** | `--verify` 残留扫描命中 `ARK API key` | 规则改为 `(^|\/)ARK_KEY\.txt$` |
| 3 | 脱敏把 `set_cover.mjs` 里的解析正则 `/encfilekey=([^&]*)/` 改成了 `/encfilekey=<签名>&]*)/` | 语法/残留扫描与逐行比对 | 删除该条过宽规则（真实签名值只存在于已剔除的数据文件里），残留判据改为匹配**签名的值**而不是参数名 |
| 4 | `bili_api.mjs` 内嵌整张 EP→BV 真实映射表（只替换了已知的一个 BV） | 独立宽形态扫描 `BV1[0-9A-Za-z]{9}` | 改为按形态替换全部稿件号 |
| 5 | `stage_writability_probe.py` 里飞书 table_id 被当作 **Python 变量名**，替换成 `{{TOKEN}}` 后语法错误 | `--verify` 的 Python 语法解析 | 增补「作标识符」形态规则，替换成合法标识符 |

另有一次自撰内容导致的失败：`video-pipeline/SKILL.md` 正文里写了字面的 `{{TOKEN}}`，被单测判为未知占位符 → 改写措辞。

还有一次是**门自身**的可移植性缺陷（加 CI 时暴露）：`.py` 的语法检查原本写死 `python`，在只有 `python3` 的机器（如 ubuntu CI runner）上会 `ENOENT`，被当成「语法失败」误报红灯。已改为先探测 `PYTHON` → `python3` → `python`，都不可用则如实报告「跳过」而不是失败。

另一个同类盲点：**无扩展名的文本文件**（`LICENSE`、`.gitkeep`）原本被判成二进制原样复制，于是既逃过残留扫描，也逃过行尾检查——「包内文本行尾统一为 LF」这句话当时并不成立（`skills/xiaohongshu-skills/LICENSE` 仍是 CRLF）。已补 `TEXT_FILENAMES` 与 `isTextPath()`，两处检查共用同一判据。

## 2. 单测（P3）

```
$ node --test test/provider.test.mjs
# tests 12   # pass 12   # fail 0
```

覆盖：frontmatter 三种形态（内联/块标量/嵌套 map）、非法 frontmatter 与非法布尔值必须被丢弃并告警、kebab-case 校验、占位符优先级与未知占位符保留、目录 bundle 与平铺文件发现、`enabledSkills` 过滤、不可读目录不抛异常、以及**对真实 `skills/` 目录的集成断言**（19 个 skill 全部可解析、描述非空、正文非空、无未声明的占位符）。

## 3. 临时 profile 装载（P1）

```
$ dsh --profile video-verify --from-default-profile web --dump-config    # 529 行，stderr 空
$ dsh plugin --profile video-verify add "link:<plugin dir>"
$ dsh --profile video-verify --dump-config
...
> # == dsh-video-pipeline
> - id: dsh-video-pipeline
>   name: dsh-video-pipeline
stderr: 空   exit 0
```

插件行出现在合成配置里，stderr 为空 → `dsh.bundle.patch` 被自动应用。

## 4. 真实挂载端到端（P3/P4）

用 headless 模板另建 profile，装同一个包，跑真实 agent 任务。

**4a. 内置 skill 进入了真实技能目录**

```
$ dsh --profile video-e2e "把技能目录里所有 skill 的 name 逐行列出来…"
… video-pipeline …（列表中含 video-pipeline，此前该名字在本机不存在）
```

反证：`%USERPROFILE%\.agents\skills\video-pipeline`、`%USERPROFILE%\.dsh\skills\video-pipeline`、`<cwd>\.dsh\skills`、`<cwd>\.agents\skills` 全部不存在 → 该条目只可能来自插件包内置目录。

**4b. 占位符在真实宿主里被替换**

```
$ dsh --profile video-e2e "加载 video-pipeline，报出占位符表 USER_HOME 一行的实际取值"
C:\Users\<user>
```

文件里写的是 `{{USER_HOME}}`，agent 看到的是本机真实路径 → 取值链（配置 → 环境变量 → 内置默认 → 本机 home）在真实宿主里生效。

**4c. rank 优先级：插件不遮蔽使用者自己的同名 skill**

```
$ dsh --profile video-e2e "加载 tangshi-pipeline，报出 skill 文件所在目录"
C:\Users\<user>\.agents\skills\tangshi-pipeline
```

解析到本机用户 skill（rank 500）而不是包内的内置副本（rank 600）→ 同名时使用者自己的版本胜出，符合设计。

**改动后复跑**（行尾归一、files 改 glob、新增 CI 与发布物检查之后，同一 profile 重跑一次）：

```
$ dsh --profile video-e2e "列出技能目录里 name 以 video- 开头的 skill"
video-compose
video-cover
video-pipeline
```

内置条目仍在目录里 → 上述改动没有破坏装载。

## 4b. 从 tarball 安装（分发路径，非 link:）

前面 3、4 节用的是 `link:` 指向源码目录，验证的是**开发路径**。真实安装（`dsh plugin add` 或从 npm/GitHub）走的是 tarball，于是另起一个 profile 装了打包产物：

```
$ npm pack --pack-destination <tmp>            # dsh-video-pipeline-0.1.0.tgz（564 KB）
$ dsh --profile video-tgz --from-default-profile headless --dump-config
$ dsh plugin --profile video-tgz add "file:<tmp>/dsh-video-pipeline-0.1.0.tgz"
+ dsh-video-pipeline file:.../dsh-video-pipeline-0.1.0.tgz

$ # 安装形态：确认是真的目录副本，不是软链
$ (Get-Item ...\profiles\video-tgz\node_modules\dsh-video-pipeline).LinkType
（空）→ 真实目录副本，等价于 npm 安装
包内 skill 数: 19    包内 lib: frontmatter.js, index.js, placeholders.js, provider.js

$ dsh --profile video-tgz --dump-config | grep dsh-video-pipeline
- id: dsh-video-pipeline
  name: dsh-video-pipeline
exit 0   stderr 空
```

**功能验收**：`dsh --profile video-tgz "加载 skill 'video-pipeline' 并报出目录规模那一行"` → 返回正文里那一行原文（`共 19 个内置 skill = 1 个总入口 + 1 个编排 + 17 个原子`）。

这次真实挂载还**抓出一处文档自相矛盾**：agent 在正文里找不到 skill 数量，并指出 README 写 18 个原子、CHANGELOG 写 17 个。核对后确认正解是「1 总入口 + 1 编排 + 17 原子 = 19」，README 把总入口算进了原子。已修 README 措辞、在正文里写明目录规模，并 remove+add 强制重装同版本 tarball（pnpm 对同路径同版本会跳过重装）复跑确认修复到达了安装副本。

## 4c. 发布自检

```
$ node tools/preflight.mjs
一、包清单 ✅ dsh.bundle.patch 存在 / 署名带主页 / repository 指回目标仓库 / files 白名单含 lib/**/*.js 与 skills/**
二、远端名字占用 ✅ npm dsh-video-pipeline 空闲（404）  ✅ GitHub 仓库未建（404）
三、git 状态 ✅ 工作区干净、分支 main、提交数 6
四、本地门 ✅ 隐私门 / 单测 / 发布物检查
五、发布凭据 ⏳ npm token 缺失  ⏳ GitHub 凭据未存
六、发布顺序（先建仓推送 → npm publish → 满 1 天后提市场 PR）
```

这是只读命令：不推送、不发布。本地问题非零退出；缺凭据只单独列出。凭据探测禁掉了交互提示与 GCM 弹窗（否则会挂住等人工输入）。**不进 CI**——它要探网络、本机凭据库与本地 git。

## 4d. 跨 skill 引用审计（包完整性）

包内 skill 会互相点名。在作者机器上所有本地 skill 都存在，所以「引用了一个没打进包的 skill」这件事**在作者机器上永远看不出来**，装到别人机器上才变成悬空引用。为此在导入器里加了一节审计：拿本机 skill 名单去比包内名单，列出所有「提到了但没进包」的 skill。

首轮结果：19 个包内 skill 中只有一处 —— `bilibili-upload` 与 `quad-platform-publish` 三处把 `paper-bilibili-uploader` 当「配套 skill」，并且 `bilibili-upload/SKILL.md` 里硬编码了 `~\.agents\skills\paper-bilibili-uploader\scripts\upload.py`。

它来自第三方仓库（`yhbcode000/paper-share-skills`），不在已确认的打包范围内，且还需单独核许可 → **不擅自扩范围，改为把文档说准**：新增 `DOC_FIXES`（与脱敏分开计数，不删任何隐私内容，只修正对安装者不成立的表述）把 5 处标注为「本包未含」，README 已知边界写明，报告保留该节作为后续回归。

```
合计：保留 45，脱敏 35，准确性改写 15，剔除 175，自撰 1，模板 4
⚠ 正文提到未打进包的 skill（3 处）：装到别人机器上它们不存在，须标明为外部或补进包
     ?  quad-platform-publish/SKILL.md  提到  paper-bilibili-uploader
     ?  bilibili-upload/SKILL.md  提到  paper-bilibili-uploader
     ?  bilibili-upload/references/pitfalls.md  提到  paper-bilibili-uploader
```

改写后重新打包、remove+add 重装进 `video-tgz`，确认标注到达了安装副本。

## 4e. 干净安装机环境（只有包内 skill）

前面所有测试都跑在作者本机——那里有 96 个本地 skill。真实用户只有包内 19 个，所以另跑一次：把 agents 根指到一个空目录，其余根确认不存在。

```
$env:DSH_AGENTS_HOME = <空目录>        # 本机 skills 从此不参与目录合并
~/.dsh/skills 不存在   D:\codes\.agents 不存在   D:\codes\.dsh 不存在

$ dsh --profile video-tgz "把技能目录里所有 skill 的 name 逐行列出来，最后输出 TOTAL=N"
ark-agent-plan-image  ark-seedance-video  ark-seedream-image  bilibili-upload  chinese-tts
douyin-publish  dreamina-canvas-cli  feishu-bitable  image-to-video  media-verify
multi-platform-publish-orchestrator  quad-platform-publish  tangshi-data-review
tangshi-pipeline  tencent-upload  video-compose  video-cover  video-pipeline
xiaohongshu-skills
TOTAL=19
```

**目录正好是包内那 19 个**，一个不多一个不少 → 插件自给自足，不依赖作者本机的 skill 库；同时这补上了第 4c 节 rank 结论的另一半：没有 rank 500 的竞争者时，内置副本（rank 600）正常胜出并被加载。

## 4f. 配置面（占位符覆盖）

README 与 `cordis.patch.yml` 都写了 `config.placeholders` 的用法，但此前从未端到端验证过。在 profile 层加一段覆盖后重跑：

```yaml
- id: dsh-video-pipeline
  config:
    placeholders:
      NAS_HOST: TEST-NAS-HOST-12345
      FEISHU_TABLE: tblOVERRIDDEN
      WORKSPACE: C:\verify\workspace
```

```
$ dsh --profile video-tgz --dump-config | grep -A6 dsh-video-pipeline
> # == dsh-video-pipeline, patched by ...\video-tgz\cordis.patch.yml
- id: dsh-video-pipeline
  name: dsh-video-pipeline
    config:
      placeholders:
        NAS_HOST: TEST-NAS-HOST-12345
        FEISHU_TABLE: tblOVERRIDDEN
        WORKSPACE: C:\verify\workspace
stderr 空

$ dsh --profile video-tgz "加载 video-pipeline，报出占位符表里 NAS_HOST / WORKSPACE / FEISHU_TABLE 的实际取值"
NAS_HOST = TEST-NAS-HOST-12345
WORKSPACE = C:\verify\workspace
FEISHU_TABLE = tblOVERRIDDEN
```

配置从 patch 层 → 宿主 → 插件 → 正文替换全链路生效。验证后已把该 profile 的 patch 恢复为 `[]`。

## 4g. 配置面（`enabledSkills` 过滤）

另一个写在 README 里、同样从未验证过的键。`enabledSkills` 非空时只放出指定的 skill：

```yaml
- id: dsh-video-pipeline
  config:
    enabledSkills:
      - video-compose
      - media-verify
      - video-pipeline
```

```
$ dsh --profile video-npm --dump-config | grep -A5 dsh-video-pipeline
> # == dsh-video-pipeline, patched by ...\video-npm\cordis.patch.yml
- id: dsh-video-pipeline
  name: dsh-video-pipeline
    config:
      enabledSkills:
        - video-compose
        - media-verify
        - video-pipeline
stderr 空

$env:DSH_AGENTS_HOME = <空目录>
$ dsh --profile video-npm "把技能目录里所有 skill 的 name 逐行列出来，最后输出 TOTAL=N"
media-verify
video-compose
video-pipeline
TOTAL=3
```

过滤生效：从 19 个收窄到配置的 3 个。这次跑的是**从 registry 安装的那份**，所以两个配置键都在真实分发包上验过了。验证后同样把 patch 恢复为 `[]`。

（本节用的 `video-npm` profile 在验证完成后已删除，同时删掉的是本地 tarball 用的 `video-tgz`；保留 `video-e2e`——它是 `link:` 安装，内容始终跟着源码，适合以后复跑。重建方式就是本节与 4b 节里那两条 `dsh --profile … --from-default-profile headless` + `dsh plugin … add` 命令。）

## 4h. 仓库元数据（市场条目 / 截图 / README 图地址）

这三个东西是给**别人**读的，格式错了在本仓库里看不出来：市场条目格式不合规会被 awesome-dsh-plugin 的 CI 打回；`screenshots.json` 路径写错则市场详情页 404；README 用 raw 绝对地址引图，路径或分支写错则 npm 页面与 GitHub 都是裂图。

`npm run verify:metadata` lint 了这些（**无依赖**实现——本包零依赖，不为 CI 引入 YAML 库，所以按结构规则校验并明确说明它不是解析器）：

```
$ node tools/verify-repo-metadata.mjs
一、市场条目 publish/market-entry.yml
  ✅ url 与 package.json 的仓库一致：https://github.com/439436269-ctrl/dsh-video-pipeline
  ✅ name 为 owner/repo：439436269-ctrl/dsh-video-pipeline
  ✅ category 合法：skill
  ·  条目落点名应为 data/plugins/439436269-ctrl__dsh-video-pipeline.yml（本文件是待提交的内容副本）
  ✅ description.en 结构合法（366 字符，引号=有，以句号结尾）
二、screenshots.json
  ✅ 条目数 2（市场要求 1-8）
  ✅ 相对路径存在：docs/skill-flow.png
  ✅ 相对路径存在：skills/tangshi-pipeline/references/orchestration-flow.png
三、README 里的图能不能取到
  ✅ 图文件在仓库里：docs/skill-flow.png
exit 0
```

另外用真正的 YAML 解析器（借 dsh 自带的 `js-yaml`）单独确认过一次条目能被解析、`installer's` 的单引号转义生效——lint 是常设门，解析是一次性确认。

CI 与 `preflight` 都跑这一条。

## 4i. 对「检查本身」做反向测试

通过的断言不代表它会咬人。本轮对三条新检查各做了一次反向测试（故意制造它该抓的情形），结果抓到两个问题：

| 检查 | 反向测试怎么做 | 结果 |
|---|---|---|
| 发布物：包内文档 = 最后一次提交 | 给 README 加 4 个字节但不提交，再跑 `verify:artifact` | **第一次没咬人** —— 见下 |
| `setup-repo` 凭据无效分支 | 设一个假 `GITHUB_TOKEN` 跑 `--check` | 报 `HTTP 401 Bad credentials` 且不崩，但把同一个 401 报成两个问题（仓库查询是后果）→ 改为「跳过仓库查询：先修上面那条」 |
| `preflight --offline` | 直接跑 | 正确地跳过两项网络检查，exit 0 |

**「包内文档一致」那条断言最初是错的**：它拿包内文档与**工作区**比，而打包本身就取自工作区——两边永远是同一份，断言不可能失败。反向测试时它照样打印通过，这才暴露。改成与 **`git HEAD`** 比之后：反向 exit 1（报 `README.md 与最后一次提交不一致`）、正常 exit 0，实测会咬人。它真正防的是「改了文档却没提交就打包发布」——npm 渲染的正是那份 README，没进版本库的内容不该出现在 npm 页面上。

顺带核过：`git log` 的提交信息与作者里没有 AI 生成标记。

## 5. 发布物检查（P7 前置）

```
$ npm pack --dry-run --json
total files: 100   tarball: 564 KB   unpacked: 1253 KB
顶层分布：skills 90 · lib 4 · package.json · cordis.patch.yml · README.md · LICENSE · CHANGELOG.md · THIRD-PARTY-NOTICES.md
```

`npm run verify:artifact` —— 源码树测试通过不代表 tarball 能用，所以对**解包后的产物**再验一次：

```
$ node tools/verify-artifact.mjs
一、打包
  ✅ tarball：dsh-video-pipeline-0.1.0.tgz（564 KB，解包 1253 KB）
二、包内清单
  ✅ 入口与文档齐备（6 项）
  ✅ lib 内 4 个模块的相对 import 全部落在包内
  ✅ 18 个导入 skill 的 SKILL.md 全部在包内（另含自撰 skill）
三、解包并真实加载
  ✅ 解包得到 19 个 skill 目录
  ✅ 插件入口导出正常：name=dsh-video-pipeline
  ✅ provider 从解包目录报告了 19 个 skill
  ✅ 正文加载正常：video-pipeline（3391 字符，rank 600，source bundled）
  ✅ 全部占位符都能取到默认值，正文无残留 token
发布物检查通过
exit 0
```

关键在于第三段 import 的是**解出来的** `lib/index.js`（安装者机器上真正会跑的那份），而不是源码树。它还断言 `tools/`、`authored/`、`test/` 没有混进包。

## 5b. CI

`.github/workflows/ci.yml` 在 ubuntu + Node 22/24 上跑四步：`npm run check` → `npm test` → `npm run privacy-gate` → `npm run verify:artifact`。

依赖本机环境的自检（临时 profile 装载、headless 端到端，即本文件第 3、4 节）**没有**进 CI——它们需要本机 DSH 与模型凭据，进 CI 只会一直红。这个包的主要风险是「把原作者的隐私信息发出去」，而隐私门是纯本地确定性检查，所以把它当 CI 硬门。

## 6. 本机 web profile 安装（P4）

```
$ dsh plugin --profile web add "link:<plugin dir>"
+ dsh-video-pipeline link:<plugin dir>

$ dsh --profile web --dump-config | grep dsh-video-pipeline
- id: dsh-video-pipeline
  name: dsh-video-pipeline
stderr: 0 字符
```

`dsh.profile.bundles` 与 `dependencies` 都已写入。**注意**：profile `package.json` 的变更需要**重启 DSH Desktop** 才会加载模块；重启后 `video-pipeline` 会出现在 GUI 会话的技能目录里。

## 7. 未验证 / 已知边界

- **npm 已发布；GitHub 仓库尚未创建**（2026-10-11）：

  | 需要 | 状态 |
  |---|---|
  | npm Automation token | ✅ 由作者提供，仅用于一次发布：写入临时 npmrc → `npm whoami` 确认账号 `vfvrpq` → `npm publish` → **立即删除**；未落任何持久文件、未进 git |
  | npm 包 | ✅ `dsh-video-pipeline@0.1.0` 已上传（发布记录见第 8 节） |
  | GitHub 凭据 | ❌ 仍未提供：`credential.helper=manager` 已配置但未存 github.com 凭据，非交互探测报 `Cannot prompt because user interactivity has been disabled` → 建仓 + `git push` 需要作者授权 |
  | 市场 PR | ⏸ 需先建仓，且仓库创建满 1 天后才能提（CI 自动检查仓库年龄） |

  本地 git 仓库已就绪（`main`，见第 8 节提交号），发布坐标与命令见 `PUBLISH.md`。

- **发布链路未在真实平台跑过**：本包只提供 skill，不含可离线执行的生产流水线；`quad-platform-publish` 等 skill 的执行需要平台凭据，未在本包内验证。
- **不含真实运营数据**：`tangshi-pipeline` 的五份数据复盘文档（`references/data-review-*.md`，含逐集播放量、放量清单、五轮复盘推理）**按作者要求整体剔除**；正文里对作者账号播放表现的绝对数字与实测倍率（如「EP18/19 因此只拿 33 播放」「12条=1.35×」这类）也改写成定性规则。原先我按「剥离真实播放数据 JSON」的口径保留了这些 md 与其中的数字，作者明确否决后已改为不保留任何数字。

  核查记录（2026-10-11）：作者的公开作品集公开了该短剧项目并链接到 `BV1Aiaj6vEkw`（EP01 读诗版），但资产数据里没有播放量数字——即数字并非本来就公开，作者的处置决定与这一事实一致。

  剔除后独立复扫：`÷` / `1.35×` / `0.69×` / `÷109` / `102.7` / `3164` / `0.995` / `T108/T127/T166/T181` 全部 0 命中；仅剩 `1360×1800`（图片尺寸）、`6×0.12`（价格算式）这类与运营数据无关的数字。
- 部分脚本引用的输入（`posts.json`、`*-stats.json`、`dy_works_all.json`）需先跑采集脚本产出；`tools/import-report.txt` 列出了全部这类引用。

## 8. npm 发布记录（P7）

```
$ node tools/preflight.mjs
（本地全绿；两条外部条件：npm token 缺失、GitHub 凭据未存）
exit 0

$ npm pack --pack-destination <tmp>
dsh-video-pipeline-0.1.0.tgz
sha1   7c40c1647b549b737c65497bb6b51c94d85ee1ff
sha256 87906c7cc625d2c0ca4e1d1a54c7cb0cd3e6fb60125fb07f78dfb44c2389d9ff
tar 条目 95

$ # 临时 npmrc（600，仅本次发布存活）
$ npm whoami
vfvrpq

$ npm publish --registry https://registry.npmjs.org/
+ dsh-video-pipeline@0.1.0
npm notice shasum:    7c40c1647b549b737c65497bb6b51c94d85ee1ff
npm notice integrity: sha512-XRVKYD01rv4ZF[...]pkH0a9xuTINJw==
npm notice total files: 95
临时 npmrc 已删除
```

**关键一致性**：npm 报告的 `shasum` 与本地打包的 sha1 **逐字节相同**（`7c40c164…`），即上传的产物就是我逐项验证过的那一份。

发布采用 npm 的 **staged publishing**：`npm publish` 打印成功只代表进暂存区，registry 自动 promote 需要 6~12 分钟。窗口期内 `GET /<name>/<version>` 返回 404、`dist-tags.latest` 仍指向旧值（本包是新包，窗口期内该包尚无 `latest`）、同版本重发报 `409 Cannot publish over previously staged version` —— **都不是失败**。为了不误判，另起后台任务轮询两个独立端点（`/-/package/<name>/dist-tags` 与 `/<name>/<version>`）直到二者都指向 0.1.0。

回读校验用 `dsh-plugin-publish-npm` 自带的 `scripts/verify_npm_artifact.py`（比对 `dist.shasum` / `dist.integrity`，并把 registry 上的 tarball 与本地 tgz 逐字节对比）。

**密钥存放**：作者要求把 token 存入本机唯一真源 `~/.secrets/keys.env`（该目录原先不存在，已新建；权限用 `icacls /inheritance:r /grant:r <user>:(OI)(CI)F /T` 收敛到仅本人可读，与 skill 约定的 700/600 等价）。同时补上该约定配套的 `load.ps1` / `load.sh`（内容 ASCII、不打印任何值）。验证：`. $HOME\.secrets\load.ps1` 后变量长度 40，用它做 `npm whoami` 返回 `vfvrpq`、exit 0。

**待办**：`keys.env` 里这一枚 token **已出现在对话记录中**，存起来只是方便，不等于没泄露——建议到 npm 设置 **revoke**，再新建一枚替换 `keys.env` 里的值（换值只需改那一行，`load.ps1` 不用动）。仓库侧还需建 GitHub 仓库（README 顶部的编排图用 raw 绝对地址，仓库公开后该图才会显示），再满 1 天后提市场 PR。

### 8b. promote 与回读校验

后台任务每 60s 轮询两个独立端点，**约 2 分钟**后 promote 完成（比 skill 里记的 6~12 分钟快）：

```
第 1 次 09:12:26  version=            dist-tags.latest=0.0.0-stage   ← 新包自动占位版，尚未 promote
第 2 次 09:13:26  version=            dist-tags.latest=0.0.0-stage
第 3 次 09:14:27  version=0.1.0       dist-tags.latest=0.1.0        ← PROMOTED
```

回读校验用 `dsh-plugin-publish-npm/scripts/verify_npm_artifact.py`：

```
dist-tags.latest = 0.1.0
versions = ['0.0.0-stage', '0.1.0']
published at = 2026-10-12T01:13:28.595Z
fileCount = 95  unpackedSize = 1050117
shasum = 7c40c1647b549b737c65497bb6b51c94d85ee1ff
downloaded sha1 = 7c40c1647b549b737c65497bb6b51c94d85ee1ff
OK  下载产物 sha1 == dist.shasum
OK  integrity(sha512) 校验通过
OK  本地 tgz 与 registry 产物逐字节一致
逐文件比对：一致 95 / 不同 0 / 仅包内 0
全部检查通过 ✅
exit 0
```

（脚本在 Windows 默认 GBK 控制台下会在最后打印 ✅ 时抛 `UnicodeEncodeError`，校验本身已全部通过；加 `PYTHONIOENCODING=utf-8` 即得 exit 0。）

### 8c. 从 registry 安装（真实用户路径）

```
$ dsh --profile video-npm --from-default-profile headless
$ dsh plugin --profile video-npm add dsh-video-pipeline@0.1.0     # 显式版本，不受 24h 观察期拦
+ dsh-video-pipeline 0.1.0
Done in 2.9s

$ dsh --profile video-npm --dump-config | grep dsh-video-pipeline
- id: dsh-video-pipeline
  name: dsh-video-pipeline
stderr: 空

安装形态：真实目录副本（非软链）  包内 skill 数：19  version：0.1.0
```

**功能验收（干净 agents 根，即真实用户环境）**：

```
$env:DSH_AGENTS_HOME = <空目录>
$ dsh --profile video-npm "把技能目录里所有 skill 的 name 逐行列出来，最后输出 TOTAL=N"
ark-agent-plan-image … video-pipeline … xiaohongshu-skills
TOTAL=19
```

从 registry 装出来的包，技能目录正好是那 19 个 → **发布链路端到端可用**：本地开发 → tarball → registry → 安装副本 → 真实 agent 目录。

### 8d. 0.1.1（纯文档版）发布记录

0.1.0 的 tarball 里是旧 README，而 npm 页面渲染的正是那份，所以发了一个只改文档的版本（`lib/` 与 `skills/` 内容与 0.1.0 一致）。

```
$ node tools/preflight.mjs
✅ 包清单 5 项   ✅ 待发版本 0.1.1 尚未发布   ✅ 工作区干净   ✅ 四道本地门
✅ npm Automation token 可用   ✅ GitHub token 可用（~/.secrets/keys.env）
exit 0

$ npm pack --pack-destination <tmp>        # 提交前后各打一次，sha1 相同才继续
sha1 4281b43005e54e6f1492de735a28149fc7ebce44    tar 条目 95

$ # token 从 ~/.secrets/keys.env 载入 → 临时 npmrc（用完即删）
$ npm whoami → vfvrpq
$ npm publish
+ dsh-video-pipeline@0.1.1
npm notice shasum: 4281b43005e54e6f1492de735a28149fc7ebce44     ← 与本地打包一致

# promote 约 1.5 分钟（3 次轮询：latest 仍 0.1.0 → 0.1.1）
$ python verify_npm_artifact.py dsh-video-pipeline 0.1.1 --tgz <本地 tgz> --src .
dist-tags.latest = 0.1.1
versions = ['0.0.0-stage', '0.1.0', '0.1.1']
OK  下载产物 sha1 == dist.shasum
OK  integrity(sha512) 校验通过
OK  本地 tgz 与 registry 产物逐字节一致
逐文件比对：一致 95 / 不同 0 / 仅包内 0
exit 0
```

**已知边界**：npm 页面上的编排图走 `raw.githubusercontent.com` 绝对地址。npm 服务端渲染时能取到（美国侧），但本机实测该域名**超时**（国内网络），所以作者本人浏览器可能看不到那张图——推文里因此建议直接上传 `docs/skill-flow.png` 而不是贴直链。
