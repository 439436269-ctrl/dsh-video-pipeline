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

## 5. 打包预检（P7 前置）

```
$ npm pack --dry-run --json
total files: 100   tarball: 564 KB   unpacked: 1253 KB
顶层分布：skills 90 · lib 4 · package.json · cordis.patch.yml · README.md · LICENSE · CHANGELOG.md · THIRD-PARTY-NOTICES.md
```

`package.json` / `cordis.patch.yml` / 三份文档 / 4 个 lib 模块 / 90 个 skill 文件全部在 tarball 内，无缺失。

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

- **发布链路未在真实平台跑过**：本包只提供 skill，不含可离线执行的生产流水线；`quad-platform-publish` 等 skill 的执行需要平台凭据，未在本包内验证。
- **未发 npm / 未建仓**：0.1.0 尚未发布，本节记录的是本地验证。
- 部分脚本引用的输入（`posts.json`、`*-stats.json`、`dy_works_all.json`）需先跑采集脚本产出；`tools/import-report.txt` 列出了全部这类引用。
