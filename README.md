# dsh-video-pipeline

把一条**跑通过的真实短视频生产流水线**作为内置 skill 装进 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)：共 19 个技能（1 个总入口 + 1 个编排 + 17 个原子），随插件一起出现在 agent 的技能目录里。

![流水线编排图](https://raw.githubusercontent.com/439436269-ctrl/dsh-video-pipeline/main/skills/tangshi-pipeline/references/orchestration-flow.png)

> 图：`tangshi-pipeline` 的编排流程图——左列是编排层（选题 → 门①报价 → 配音/素材/成片调度 → 门②发布确认 → 并行发布 → 回写），右列是被调用的原子 skill。素材生产分「图片运镜」与「Seedance t2v」两条路线，在 `video-compose` 汇合、可按镜头混用。

装完不需要往 `~/.agents/skills` 或 `~/.dsh/skills` 复制任何文件——插件自己注册一个 skill provider，把包内的 `skills/` 目录提供给 `ctx.skills`。

## 这个插件做了什么

- **提供 19 个 skill**（总入口 1 + 编排 1 + 原子 17），覆盖选题、配音、出图、出视频、运镜、合成、封面、核验、数据复盘、多平台发布、进度回写。
- **自撰一个总入口 skill**（`video-pipeline`），说明这包是什么、每个环节该加载哪个原子 skill、占位符怎么填。安装者没有原作者本机那套同名 skill，所以入口 skill 是这里唯一的起点。
- **不含任何运行时依赖**：只 import Node 内建模块，通过 `ctx.inject(['skills'])` 拿到注册表。没有 `dependencies`，也没有需要宿主解析的 `peerDependencies`，因此不存在 peer 范围解析失败（ERESOLVE）问题。
- **不动别人的 skill**：provider 以 rank 600 报告候选（内置 rank），如果你自己的项目/用户 skill 同名（rank 100-500），**你的版本胜出**，本包不会遮蔽它。

## 安装

```sh
# 从 npm
dsh plugin --profile web add dsh-video-pipeline

# 从 GitHub
dsh plugin --profile web add github:439436269-ctrl/dsh-video-pipeline

# 本地开发（软链到源码目录）
dsh plugin --profile web add "link:/path/to/dsh-video-pipeline"

# 卸载
dsh plugin --profile web remove dsh-video-pipeline
```

装完重启 DSH Desktop，然后问 agent「有哪些视频流水线的 skill」即可看到目录。

## 包内 skill

| skill | 类型 | 作用 |
|---|---|---|
| `video-pipeline` | 总入口（本包自撰） | 流水线骨架、环节与原子 skill 对照、占位符与前置依赖 |
| `tangshi-pipeline` | 编排 | 双版本（读诗版/故事版）批量生产与发布全流程：规格定稿、时序、成本基线、质量门 |
| `chinese-tts` | 原子·生产 | 中文配音：多音字读音校正（朝zhāo/还huán/重chóng/骑jì/教jiào/载zǎi）、音色与 context 模板 |
| `ark-agent-plan-image` | 原子·生产 | 火山 Agent Plan 通道文生图（扣 Plan 配额） |
| `ark-seedream-image` | 原子·生产 | 火山标准通道文生图（按量后付费），含价格表与开通指引 |
| `ark-seedance-video` | 原子·生产 | Seedance 文生视频 / 图生视频单条镜头，含 token 用量公式与任务管理 |
| `image-to-video` | 原子·生产 | 单张关键帧 → ffmpeg zoompan 运镜镜头 |
| `dreamina-canvas-cli` | 原子·生产 | 即梦画布 CLI（备用生成线） |
| `video-compose` | 原子·合成 | 镜头列表 + 配音时间轴 + SRT → 竖屏成片（一条 manifest） |
| `video-cover` | 原子·合成 | B 站 16:10 与竖屏双封面一次出图 |
| `media-verify` | 原子·核验 | astats 音频对位、线上音频版本比对、抽帧白屏检测 |
| `tangshi-data-review` | 原子·复盘 | 三平台播放数据采集、衰减分档与复盘报告 |
| `quad-platform-publish` | 编排·发布 | 四平台发布总控（含发布前读音核查与确认门） |
| `multi-platform-publish-orchestrator` | 编排·发布 | 按 JSON 配置顺序执行多平台发布 |
| `bilibili-upload` | 原子·发布 | B 站投稿与合集管理（biliup） |
| `tencent-upload` | 原子·发布 | 视频号上传与合集管理 |
| `douyin-publish` | 原子·发布 | 抖音创作者中心上传发布与合集管理 |
| `xiaohongshu-skills` | 原子·发布（第三方） | 小红书图文/视频发布、检索与互动，见 [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md) |
| `feishu-bitable` | 协作 | 飞书多维表格读写（进度回写） |

## 配置

在 profile 的 `cordis.patch.yml` 里按 entry id 覆盖。**patch 对 `config` 是整块替换**，想保留的键要一并写出：

```yaml
- id: dsh-video-pipeline
  config:
    enabledSkills:            # 省略或空数组 = 放出全部 19 个
      - video-pipeline
      - video-compose
      - media-verify
    placeholders:             # 覆盖内置占位符；加载 skill 时替换正文里的 {{TOKEN}}
      FEISHU_BASE_APP: your_base_app_token
      FEISHU_TABLE: tblXXXXXXXXXX
      FEISHU_RECORD: recXXXXXXXXXX
      NAS_DELIVERABLE_DIR: /your/nas/deliverables
      ARK_API_KEY_FILE: /your/path/ark_key.txt
```

| 键 | 默认值 | 作用 |
|---|---|---|
| `enabledSkills` | `[]`（全部） | 只放出指定 skill；用于把包装成只做某一段能力 |
| `placeholders` | `{}` | 覆盖 `{{TOKEN}}` 的取值。取值优先级：本配置 → 环境变量 → 内置可读默认值 |

### 占位符

发布前把原作者环境相关的内容全换成了占位符。加载 skill 正文时按上表优先级替换成你的值：

| 占位符 | 含义 | 可用的环境变量 |
|---|---|---|
| `USER_HOME` | 本机用户目录 | `USERPROFILE` / `HOME` |
| `WORKSPACE` | 工作区根目录 | `DSH_WORKSPACE` / `WORKSPACE` |
| `ARK_API_KEY` | 火山方舟 API key | `ARK_API_KEY` / `ARK_STD_KEY` |
| `ARK_API_KEY_FILE` | 本地存放 key 的文件 | `ARK_API_KEY_FILE` |
| `FEISHU_BASE_APP` / `FEISHU_TABLE` / `FEISHU_RECORD` | 飞书多维表格坐标 | 同名 |
| `NAS_DELIVERABLE_DIR` / `NAS_DELIVERABLE_PARENT` / `NAS_HOST` | NAS 交付目录与主机 | 同名 |

**只替换 skill 正文**。`skills/*/scripts/` 下是真实脚本文件，里面的占位符需要你自己改成实际值——skill 正文会说明每个值的含义。

## 前置依赖

本包只提供 skill（指令与脚本），**不安装任何工具**：

- **ffmpeg**：合成、运镜、核验都依赖。`xfade`/`ass`/`loudnorm` 等滤镜需要较新版本。
- **Python 3** + `Pillow`：`scripts/` 下的 py 脚本（封面、图处理、封面比对）。
- **Node.js**：`scripts/` 下的 mjs 脚本。
- **playwright**：发布类 skill 需要时自行安装。
- **各平台凭据**：B 站 `biliup` 凭据、视频号/抖音/小红书登录态，必须你自己登录获取。**本包不含任何凭据、cookie 或真实账号 ID。**

## 发布前的脱敏（重要）

本包基于一条真实生产流水线，公开前做了逐文件的剔除与替换，并有独立的复扫门（`tools/import-skills.mjs --verify`）来证明结果：

- **删除**：真实 API key 文件、登录态缓存、Python 字节码、以及 170 个只属于原作者项目历史的文件（真实播放数据快照、合集映射、逐集一次性脚本、当时操作截图）。
- **替换为占位符**：飞书 base/table/record ID、NAS 路径与内网地址、本机绝对路径、以及真实账号/作品标识（视频号 FINDER_ID、抖音 aweme_id、B 站 UID 与 seasonId、小红书笔记与合集 ID、B 站稿件号）。
- **保留但清空为模板**：4 个「被剔除但脚本仍要读」的输入文件，以空结构随包（`heji-state.json`、`map-dushi.json`、`map-gushi.json`、`dy_t.example.json`）。

复扫门检查 4 类东西：密钥/账号标识/本机路径/内网地址残留、33 个脚本的语法可解析性（防止脱敏改写坏代码）、被剔除文件仍被引用、以及 SKILL.md 是否可被 provider 正常解析。当前结果：**90 个文件、0 处残留、语法全通过**。

### 已知边界

- 部分脚本的**输入**是采集脚本自己写出的产物（`posts.json`、`*-stats.json`、`dy_works_all.json`），首次运行前并不存在——先跑采集再跑分析。`tools/import-report.txt` 列出了全部这类引用。
- 历史复盘文档（`tangshi-pipeline/references/data-review-*.md`）保留了**方法论与经验结论**；其中的具体播放数字来自原作者的真实运营，对应的数据文件未随包。（作者的公开作品集公开了这个短剧项目与一条 EP01 链接，但没有公开播放量；若要连数字一并剥离，改 `tools/scrub-rules.mjs` 后重跑导入。）
- `xiaohongshu-skills` 是第三方 MIT 代码；上游 README（含赞助位与作者联系方式）未随包。
- **有一处正文提到本包未含的外部 skill**：`bilibili-upload` 的「论文视频投稿」路径依赖外部 skill `paper-bilibili-uploader`（来自第三方 `yhbcode000/paper-share-skills`）。本包不含它，相关章节已标明为外部；B 站投稿引擎 `biliup` 本身已包含。导入报告里会列出所有这类「提到但未打进包」的 skill（`tools/import-report.txt`）。

## 结构

```
dsh-video-pipeline/
├── package.json          # dsh.bundle.patch 是市场收录的硬性要求
├── cordis.patch.yml      # 往 profile 插一行宿主插件行
├── lib/
│   ├── index.js          # 插件入口：apply() 里向 ctx.skills 注册 provider
│   ├── provider.js       # 扫描 skills/、解析 frontmatter、rank 600、resourceBase
│   ├── frontmatter.js    # 无依赖的 YAML frontmatter 子集解析（含块标量与嵌套 map）
│   └── placeholders.js   # {{TOKEN}} 取值与替换
├── skills/               # 19 个 skill（由 tools/import-skills.mjs 生成）
├── authored/             # 本包自撰的 skill 源文件（导入时写入 skills/）
├── tools/
│   ├── import-skills.mjs # 可复现导入器：--audit / --write / --verify
│   ├── scrub-rules.mjs   # 剔除、脱敏、文档准确性改写、残留扫描的唯一规则来源
│   ├── verify-artifact.mjs # 打包 → 解包 → 真实加载解出来的入口
│   └── preflight.mjs     # 只读发布自检（远端占用 / git / 三道门 / 凭据）
└── test/
    ├── provider.test.mjs # provider 行为 + 对真实 skills/ 的集成断言
    └── rules.test.mjs    # 规则回归：10 个用例各对应一个真实踩过的坑
```

## 开发

```sh
node tools/import-skills.mjs --audit   # 只报告：会保留/脱敏/剔除哪些文件
node tools/import-skills.mjs --write   # 重建 skills/
npm run privacy-gate                   # 隐私与语法门（发布前必过）
npm test                               # 22 个单测：provider 行为 + 规则回归
npm run verify:artifact                # 打包 → 解包 → 真实加载解出来的 lib/index.js
npm run preflight                      # 发布前只读自检（含远端名字占用与凭据）
```

导入器默认从 `%USERPROFILE%\.agents\skills` 读源，可用 `SKILLS_SOURCE` 指定别的根。

`npm run verify:artifact` 是发布前最该跑的一条：源码树测试通过不代表 tarball 能用（`files` 白名单漏子目录、相对 import 的目标没进包，都会变成「装上就报错」，而 npm 包不可撤回）。它会把 tarball 解出来，直接 import 解出来的 `lib/index.js`，核对 19 个 skill 与全部占位符。CI 里也跑这条。

发布坐标与三条渠道的落地命令见 [`PUBLISH.md`](PUBLISH.md)；验证记录见 [`VERIFY.md`](VERIFY.md)。

## 许可

MIT。第三方代码见 [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)。
