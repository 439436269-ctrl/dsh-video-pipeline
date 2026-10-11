# VERIFY.md — 验证记录

本文件记录 0.1.0 的验证过程与原始证据。按发布要求，路径已脱敏为 `%USERPROFILE%` / `<plugin dir>`。

环境：Windows，Node v22.16.0，pnpm 11.7.0，`dsh` CLI 0.1.5-rc.3。

## 1. 隐私门（P5）

```
$ node tools/import-skills.mjs --write
合计：保留 48，脱敏 37，剔除 170，自撰 1，模板 4
写入 90 个文件

$ node tools/import-skills.mjs --verify
校验 90 个文件（其中 33 个脚本做了语法解析）；残留 0 处
未发现密钥、账号标识、本机路径、内网地址残留，脚本语法全部可解析。
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

- **未发 npm、未建 GitHub 仓库**。前置条件实测（2026-10-11）：

  | 需要 | 状态 |
  |---|---|
  | GitHub 凭据 | ❌ `credential.helper=manager` 已配置但未存 github.com 凭据；非交互探测报 `Cannot prompt because user interactivity has been disabled` → 首次 push 需弹窗授权或提供 token |
  | npm Automation token | ❌ `~/.secrets/keys.env` 不存在，`NPM_AUTOMATION_TOKEN` 未设置 |
  | 市场 PR | ⏸ 需仓库创建满 1 天后才能提（CI 自动检查仓库年龄） |

  本机已建本地 git 仓库并完成首次提交（`main`，109 文件），发布坐标与命令见 `PUBLISH.md`。

- **发布链路未在真实平台跑过**：本包只提供 skill，不含可离线执行的生产流水线；`quad-platform-publish` 等 skill 的执行需要平台凭据，未在本包内验证。
- **历史复盘文档保留了真实运营数字**：`tangshi-pipeline/references/data-review-*.md` 里的方法论与结论保留，具体播放数字也保留了（按「剥离真实播放数据 **JSON**」的口径执行）。对应数据文件未随包。若需连数字一并剥离，改 `tools/scrub-rules.mjs` 后重跑导入即可。
- 部分脚本引用的输入（`posts.json`、`*-stats.json`、`dy_works_all.json`）需先跑采集脚本产出；`tools/import-report.txt` 列出了全部这类引用。
