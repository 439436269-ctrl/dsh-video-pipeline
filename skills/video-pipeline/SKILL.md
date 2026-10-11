---
name: video-pipeline
description: 短视频流水线的总入口：把「一条编排 skill + 一组原子 skill」的 AI 短剧生产链装进 DSH 后，按环节选对原子 skill。覆盖选题与报价门、中文配音读音校正、文生图、文生视频/图片运镜、成片合成、封面、成片核验、数据复盘、多平台发布。Use when starting or resuming a short-video production run, choosing which atomic skill handles a stage (TTS, image, video, compose, cover, verify, publish), or working out what this skill pack provides.
---

# video-pipeline — 短视频生产流水线总入口

本包把一条**已经跑通的 AI 短剧生产流水线**整体装进 DSH：一个编排 skill 负责调度与确认门，一组原子 skill 各管一个环节。所有 skill 随插件一起安装，直接出现在 agent 的技能目录里——不需要往 `~/.agents/skills` 复制任何文件。

## 先读哪一份

| 你的处境 | 加载哪个 skill |
|---|---|
| 要完整跑一集（选题到发布） | `tangshi-pipeline` —— 编排层，含双版本规格、时序、成本基线、质量门 |
| 只做其中一步（配音/出图/合成/核验…） | 下表的对应原子 skill |
| 要一次发到四个平台 | `quad-platform-publish` |
| 要按批次发到多个平台 | `multi-platform-publish-orchestrator` |
| 发布后回收数据 | `tangshi-data-review` |

## 环节 → 原子 skill

| 环节 | skill | 一句话 |
|---|---|---|
| 中文配音 | `chinese-tts` | 多音字读音校正（朝zhāo/还huán/重chóng…）+ 音色与 context 模板 |
| 场景图（配额通道） | `ark-agent-plan-image` | 火山 Agent Plan 专属端点出图，扣 Plan 配额 |
| 场景图（按量通道） | `ark-seedream-image` | 标准 API 按量出图，Plan 配额用尽时切这里 |
| 文生视频 / 图生视频 | `ark-seedance-video` | 一条镜头一次调用：create → poll → download，含 token 计费公式 |
| 图片 → 运镜镜头 | `image-to-video` | 单张关键帧用 ffmpeg zoompan 出缓推/缓拉镜头 |
| 合成成片 | `video-compose` | 镜头列表 + 配音时间轴 + SRT → 竖屏成片（一条 manifest） |
| 封面 | `video-cover` | 一次出 B 站 16:10 与竖版双封面 |
| 成片核验 | `media-verify` | 音频对位（astats）、版本比对、白屏检测 |
| 数据复盘 | `tangshi-data-review` | 三平台播放数据采集、衰减分档、复盘报告 |
| 发布（总控） | `quad-platform-publish` | 四平台并行发布、确认门、风控速查 |
| 发布（单平台） | `bilibili-upload` / `tencent-upload` / `douyin-publish` / `xiaohongshu-skills` | 各平台的登录、上传、合集管理 |
| 进度回写 | `feishu-bitable` | 飞书多维表格读写 |
| 备用生成线 | `dreamina-canvas-cli` | 即梦画布 CLI |

## 流水线骨架（五段）

1. **选题与门①**：定诗题/题材 → 出报价（图 + 视频张数/秒数 × 刊例）→ **等用户确认再动 API 花钱**。
2. **生产**：TTS 配音 → 场景图 → 镜头（图片运镜 或 t2v）→ 合成 → 核验。生产段可以整段并行：图与视频先生成、统一 poll。
3. **质量门**：`media-verify` 核音频对位与静默窗、抽帧查白屏与人物一致性；不合格回炉，不进入发布。
4. **门②发布确认**：标题、封面、可见性给用户确认一次。**这一步不能省**——发布是外部可见动作。
5. **发布与回写**：按平台并行发布 → 回读平台确认成功 → 把链接与状态回写飞书。

顺序上两条硬经验：**生产与发布重叠**（发布 agent 跑起来后主线程就开始下一集），**同平台资源不共享浏览器 profile**（互相杀进程会让发布卡住）。

## 配置：占位符怎么填

本包为了可以公开发布，把原作者环境相关的东西全部替换成了占位符（写成双花括号包住变量名，例如下表的 `USER_HOME` 字段）。加载 skill 时按下面的顺序取值：插件配置 `placeholders` → 环境变量 → 内置可读默认值。

| 占位符 | 含义 | 可用的环境变量 |
|---|---|---|
| `{{USER_HOME}}` | 本机用户目录 | `USERPROFILE` / `HOME` |
| `{{WORKSPACE}}` | 你的工作区根目录 | `DSH_WORKSPACE` / `WORKSPACE` |
| `{{ARK_API_KEY}}` | 火山方舟 API key | `ARK_API_KEY` / `ARK_STD_KEY` |
| `{{ARK_API_KEY_FILE}}` | 本地存放 key 的文件路径 | `ARK_API_KEY_FILE` |
| `{{FEISHU_BASE_APP}}` / `{{FEISHU_TABLE}}` / `{{FEISHU_RECORD}}` | 飞书多维表格坐标 | 同名 |
| `{{NAS_DELIVERABLE_DIR}}` / `{{NAS_DELIVERABLE_PARENT}}` / `{{NAS_HOST}}` | NAS 交付目录与主机 | 同名 |

在 profile 的 `cordis.patch.yml` 里按 entry id 覆盖（`config` 是**整块替换**，要保留的键得全写）：

```yaml
- id: dsh-video-pipeline
  config:
    placeholders:
      FEISHU_BASE_APP: your_base_app_token
      NAS_DELIVERABLE_DIR: /your/nas/deliverables
```

**脚本里的占位符不会自动替换**：`scripts/` 下的 python/mjs 是真实脚本文件，里面的 `{{USER_HOME}}`、`<你的 …>` 需要你改成自己的值再跑。skill 正文里会说明每个值的含义。

## 前置依赖

- **ffmpeg**（合成、运镜、核验都依赖）——版本越新越好，`xfade`/`ass`/`loudnorm` 需要较新版。
- **Python 3**（`scripts/` 下的 py 脚本），配 `Pillow`（封面/图处理）。
- **Node.js**（`scripts/` 下的 mjs 脚本）+ 各平台需要时装 `playwright`。
- **各平台自己的凭据**：B 站 `biliup` 凭据、视频号/抖音/小红书的登录态。这些必须你自己登录获取，本包不含任何凭据。

## 打包说明与第三方代码

- 本包的 skill 来自一条真实生产流水线，发布前已**剥离**：真实 API key、cookie/登录态、平台账号 ID（作品号/合集号/UID）、个人绝对路径、内网地址、以及真实运营数据快照（播放数据、合集映射、发布记录）。所以历史复盘文档里的经验结论都在，但**具体数字对应的数据文件不在包里**，需要你跑采集脚本自己产出。
- `xiaohongshu-skills` 是第三方 MIT 代码（`white0dew/XiaohongshuSkills`，LICENSE 署名 angiin），随包保留了其许可证与署名，详见 `THIRD-PARTY-NOTICES.md`。
- 部分 `scripts/` 里引用的输入文件（`posts.json`、`*-stats.json`、`dy_works_all.json` 等）是**采集脚本自己写出来的产物**，首次运行前并不存在——按顺序先跑采集再跑分析即可。
