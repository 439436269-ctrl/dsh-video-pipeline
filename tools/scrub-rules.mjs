/**
 * Import/scrub rules.
 *
 * The bundled skills were written during one real deployment. This module is
 * the single place that decides what travels into the published package:
 * which files ship at all (`DROP_PATTERNS`), and which host-specific strings
 * inside a shipped file are replaced by a configurable `{{TOKEN}}`
 * (`SCRUB_RULES`). Keeping the rules declarative is what makes `--audit`
 * meaningful: the audit and the write share one code path, so the report
 * cannot describe something different from what the import does.
 *
 * `RESIDUAL_PATTERNS` is the independent check. It re-scans the written files
 * for the shapes that must never survive — credentials, personal paths, real
 * account identifiers — and fails the import if any remain, including in files
 * no rule matched. It is deliberately broader than `SCRUB_RULES`.
 *
 * @module dsh-video-pipeline/tools/scrub-rules
 */

/** The skills that make up the bundle, in the order the README lists them. */
export const SKILLS = [
  { name: 'tangshi-pipeline', group: '编排', role: '全流程编排：选题 → 门①报价 → 生产调度 → 门②发布确认 → 并行发布 → 回写' },
  { name: 'chinese-tts', group: '原子·生产', role: '中文配音：多音字读音校正 + 音色/context 模板' },
  { name: 'ark-agent-plan-image', group: '原子·生产', role: '火山 Agent Plan 通道文生图' },
  { name: 'ark-seedream-image', group: '原子·生产', role: '火山标准通道文生图（按量后付费）' },
  { name: 'ark-seedance-video', group: '原子·生产', role: 'Seedance 文生视频 / 图生视频，单条镜头' },
  { name: 'image-to-video', group: '原子·生产', role: '单张关键帧 → ffmpeg zoompan 运镜镜头' },
  { name: 'video-compose', group: '原子·合成', role: '镜头 + 配音时间轴 + SRT → 竖屏成片' },
  { name: 'video-cover', group: '原子·合成', role: 'B站 16:10 与竖版双封面出图' },
  { name: 'media-verify', group: '原子·核验', role: 'astats 音频对位 / 线上音频比对 / 抽帧白屏检测' },
  { name: 'tangshi-data-review', group: '原子·复盘', role: '三平台播放数据采集与复盘报告' },
  { name: 'quad-platform-publish', group: '编排·发布', role: '四平台发布总控（含发布前读音核查与确认门）' },
  { name: 'multi-platform-publish-orchestrator', group: '编排·发布', role: '按 JSON 配置顺序执行多平台发布' },
  { name: 'bilibili-upload', group: '原子·发布', role: 'B 站投稿与合集管理（biliup）' },
  { name: 'tencent-upload', group: '原子·发布', role: '视频号上传与合集管理' },
  { name: 'douyin-publish', group: '原子·发布', role: '抖音创作者中心上传发布与合集管理' },
  { name: 'xiaohongshu-skills', group: '原子·发布（第三方）', role: '小红书图文/视频发布、检索与互动' },
  { name: 'feishu-bitable', group: '协作', role: '飞书多维表格读写（进度回写）' },
  { name: 'dreamina-canvas-cli', group: '原子·生产', role: '即梦画布 CLI（备用生图/视频线）' },
];

/**
 * Relative paths (POSIX separators, relative to the skill directory) that must
 * not travel into the published package, with the reason shown in the report.
 * Each entry is `[matcher, reason]`; `matcher` is a RegExp tested against the
 * POSIX relative path.
 */
export const DROP_PATTERNS = [
  // Credentials and machine state — never publishable.
  [/(^|\/)ARK_KEY\.txt$/, '真实 API key 文件'],
  [/(^|\/)__pycache__(\/|$)/, 'Python 字节码缓存'],
  [/\.pyc$/, 'Python 字节码缓存'],
  [/(^|\/)tmp(\/|$)/, '登录态/临时缓存目录'],
  [/(^|\/)\.git(\/|$)/, '第三方仓库 git 元数据'],
  [/(^|\/)\.github(\/|$)/, '第三方仓库 CI 配置'],
  [/(^|\/)node_modules(\/|$)/, '依赖目录'],
  [/(^|\/)locales(\/|$)/, 'MiMo 宿主 i18n 元数据，DSH 不读取'],

  // Real operation data: play counts, work lists, collection maps, state.
  // These match at any depth — the same snapshot file sits at the skill root in
  // one skill and under scripts/ in another.
  [/(^|\/)[^/]*-stats\.json$/, '真实平台播放数据快照'],
  [/(^|\/)dy_works_all\.json$/, '真实作品列表快照'],
  [/(^|\/)dy_t_.*\.json$/, '真实合集映射'],
  [/(^|\/)map-.*\.json$/, '真实合集映射'],
  [/(^|\/)[^/]*-posts\.json$/, '真实发布记录'],
  [/(^|\/)posts\.json$/, '真实发布记录'],
  [/(^|\/)[^/]*-summary\.json$/, '真实发布汇总'],
  [/(^|\/)heji-state\.json$/, '真实合集状态'],
  [/(^|\/)heji-feeds-.*\.json$/, '真实合集清单'],
  [/(^|\/)(read|story)-final\.json$/, '真实合集终态'],
  [/(^|\/)collections\.json$/, '真实合集映射'],
  [/(^|\/)login_status_cache\.json$/, '登录态缓存'],
  // 作者明确要求不保留：五轮真实数据复盘（含逐集播放量、放量清单）。
  [/^tangshi-pipeline\/references\/data-review-.*\.md$/, '真实运营数据复盘（作者要求不保留）'],

  // Per-episode one-off scripts: project history, not reusable capability.
  [/(^|\/)scripts\/heji\/fix_heji_ep.*\.mjs$/, '逐集一次性合集修复脚本'],
  [/(^|\/)scripts\/heji\/ep\d+_post_check\.mjs$/, '逐集发布后校验脚本'],
  [/(^|\/)scripts\/heji\/del_ep.*\.mjs$/, '逐集删除操作脚本'],
  [/(^|\/)scripts\/heji\/cmp_cover_ep.*\.py$/, '逐集封面比对脚本'],
  [/(^|\/)scripts\/heji\/list\d+\.mjs$/, '逐集清单脚本'],
  [/(^|\/)scripts\/heji\/[^/]*\.png$/, '当时操作截图'],
  [/(^|\/)scripts\/heji\/explore_delete\.mjs$/, '一次性删除探路脚本'],
  [/(^|\/)scripts\/heji\/post_card_check\.mjs$/, '一次性作品卡片抓取校验'],
  [/(^|\/)scripts\/heji\/wx_rm\.mjs$/, '未被 SKILL.md 引用的重复能力（do.mjs 已覆盖）'],
  [/(^|\/)scripts\/heji\/xhs_final\.mjs$/, '一次性填合集脚本（硬编码真实合集 ID）'],
  [/(^|\/)scripts\/heji\/xhs_api\.mjs$/, '一次性合集 API 探针'],

  // Third-party repository scaffolding and third-party personal data.
  // Scoped to the skill that carries it, because these names are generic.
  [/^xiaohongshu-skills\/references\/README\.md$/, '上游仓库 README（含赞助位与作者联系方式）'],
  [/^xiaohongshu-skills\/AGENTS\.md$/, '上游仓库的 agent 规范，不属于本 skill 能力'],
  [/^xiaohongshu-skills\/\.gitignore$/, '上游仓库忽略规则，对 npm 包无意义'],
  [/(^|\/)todo\.md$/, '上游仓库待办'],
  [/(^|\/)assets\/star-history\.svg$/, '上游仓库 README 徽章'],
  [/(^|\/)images\/[^/]*\.(jpg|jpeg|png|gif|webp)$/, '上游仓库图片素材'],
  [/(^|\/)public\/[^/]*\.(jpg|jpeg|png|gif|webp)$/, '上游仓库图片素材（含他人二维码）'],
  [/(^|\/)scripts\/generate_star_history\.py$/, '上游仓库徽章生成脚本'],
  [/(^|\/)docs\/code-review-.*\.md$/, '上游仓库内部评审记录'],
];

/**
 * Ordered string replacements applied to every shipped text file.
 * Order matters: the most specific host path must be replaced before the
 * generic one, or the generic rule eats the prefix and leaves a stray suffix.
 */
export const SCRUB_RULES = [
  // NAS delivery root, most specific first.
  [/\/sata1\/public\/公共分组\/唐诗300首短剧/g, '{{NAS_DELIVERABLE_DIR}}', 'NAS 交付目录'],
  [/\/sata1\/public\/公共分组/g, '{{NAS_DELIVERABLE_PARENT}}', 'NAS 公共分组目录'],
  [/192\.168\.1\.3/g, '{{NAS_HOST}}', '内网 NAS 地址'],

  // Local secret file locations. The whole MiMo session output path is
  // machine-local (a dated session folder), so it goes before the generic home
  // rule that would otherwise leave the prefix behind.
  [/[A-Za-z]:[\\/]Users[\\/]19592[\\/]XiaomiMiMoProjects[\\/]\.mimo-sessions[\\/][^"'\s]*/gi, '<本机会话产物路径>', 'MiMo 会话产物绝对路径'],
  [/skill-300-ai[\\/]ark_std_key\.bak/g, '{{ARK_API_KEY_FILE}}', '本地 key 文件路径'],
  [/skill-300-ai/g, '<本地密钥目录>', '本地密钥目录名'],

  // Feishu identifiers. The app token also appears as a bare Python identifier
  // in one probe script, where a `{{TOKEN}}` substitution would not parse — the
  // identifier form is handled first so the quoted form still gets the token.
  [/(?<!["'`])KOIrbt4YqaWl05sXdjwczIJ5nei(?!["'`])/g, 'FEISHU_BASE_APP_ID', '飞书 app_token 作标识符'],
  [/(?<!["'`])tblWEJxknewXos0D(?!["'`])/g, 'FEISHU_TABLE_ID', '飞书 table_id 作标识符'],
  [/(?<!["'`])reczz28Gw33uhzZd(?!["'`])/g, 'FEISHU_RECORD_ID', '飞书 record_id 作标识符'],
  [/KOIrbt4YqaWl05sXdjwczIJ5nei/g, '{{FEISHU_BASE_APP}}', '飞书 base app_token'],
  [/tblWEJxknewXos0D/g, '{{FEISHU_TABLE}}', '飞书 table_id'],
  [/reczz28Gw33uhzZd/g, '{{FEISHU_RECORD}}', '飞书 record_id'],

  // Workstation paths.
  [/C:\\+Users\\+19592/gi, '{{USER_HOME}}', '本机用户目录'],
  [/C:\/Users\/19592/gi, '{{USER_HOME}}', '本机用户目录'],
  [/D:\\+lcj\\+codes/gi, '{{WORKSPACE}}', '本机工作区'],
  [/D:\/lcj\/codes/gi, '{{WORKSPACE}}', '本机工作区'],
  [/D:\\+lcj/gi, '{{WORKSPACE}}', '本机工作区'],
  [/D:\/lcj/gi, '{{WORKSPACE}}', '本机工作区'],
  [/C:\\+Users\\+19592/gi, '{{USER_HOME}}', '本机用户目录'],
  [/\b19592\b/g, '<user>', '本机 Windows 用户名'],

  // The author's own published works. `bili_api.mjs` embeds a whole EP→BV map,
  // so the rule matches any real稿件号 by shape rather than one known value;
  // the replacement keeps the same length and is obviously not a real id.
  [/BV1[0-9A-Za-z]{9}/g, 'BV0000000000', '真实的 B 站稿件号'],

  // Account ids and embedded work lists.
  // `dy_stats.mjs` filters by a hardcoded list of the author's own作品, which is
  // operation data rather than a capability: empty the list and leave a shape
  // comment, then let the shape rule below normalise anything left behind.
  [
    /const TARGET = new Set\(\[[\s\S]*?\]\);/,
    "// 填入要统计的作品 aweme_id（本包已剥离作者的真实清单）\nconst TARGET = new Set([\n  // '7xxxxxxxxxxxxxxxxxx',\n]);",
    '硬编码的真实抖音作品清单',
  ],
  [/\b7\d{18}\b/g, '<你的抖音作品 ID>', '抖音 aweme_id'],
  [/\b34078814\b/g, '<你的 B 站 UID>', 'B 站账号 UID'],

  // Real account and work identifiers that identify the author's channels.
  // These are the values a reader must never inherit: they point at someone
  // else's account, not at a capability.
  [/v2_[0-9a-fA-F]{16,}@finder/g, '<你的视频号 FINDER_ID>', '视频号 FINDER_ID'],
  [/event\/UzFf[A-Za-z0-9_\-=]{10,}/g, '<你的视频号合集 event id>', '视频号合集 event id'],
  [/export\/UzFf[A-Za-z0-9_\-=]{10,}/g, '<你的视频号作品 objectId>', '视频号作品 objectId'],
  [/7691218283269311785/g, '<你的抖音作品 ID>', '抖音 aweme_id'],
  [/\b9205761\b/g, '<你的 B 站合集 seasonId>', 'B 站 seasonId'],
  [/\b9205779\b/g, '<你的 B 站合集 seasonId>', 'B 站 seasonId'],
  [/6abcb179000000001803a18b/g, '<你的小红书笔记 ID>', '小红书笔记 ID'],
  [/6abc57ff1632000000000001/g, '<你的小红书合集 ID>', '小红书合集 ID'],
  [/6abc57e5130f000000000001/g, '<你的小红书合集 ID>', '小红书合集 ID'],
  [/玻璃玻璃奶瓶/g, '<你的 B 站昵称>', '本机作者的 B 站昵称'],

  // Platform-signed URLs carry time-limited credentials, but they only ever
  // appeared inside the dropped operation-data snapshots. Rewriting
  // `encfilekey=`/`token=` text here would instead corrupt legitimate parsing
  // code (`/encfilekey=([^&]*)/`), so this is left to the residual scan, which
  // looks for a real signed *value* rather than the parameter name.

  // Third-party personal data and sponsor placements.
  [/whitedewstory/g, '<上游作者微信>', '第三方作者微信号'],
  [/https?:\/\/code\.aistar\.cool[^\s)`"']*/g, '<赞助商链接>', '上游赞助商外链'],

  // Private-network example IPs in the bundled docs.
  [/\b10\.0\.0\.12\b/g, '<你的远程 CDP 主机>', '私有网段示例地址'],

  // Keep the xhs SKILL.md pointer honest after dropping the upstream README.
  [
    /补充：更完整的背景说明、安装说明与面向人工阅读的示例可参考 `README\.md`，但本文件中的命令样例应优先作为 agent 执行基线。/g,
    '补充：上游项目的完整背景与安装说明见 https://github.com/white0dew/XiaohongshuSkills（本包未随附其 README，因其含上游赞助位与作者联系方式）。本文件中的命令样例是 agent 执行基线。',
    '上游 README 指引改写',
  ],
];

/**
 * Files that are dropped because they *are* real operation data, but that a
 * kept script or the skill body expects to read. Shipping a structure-only
 * example keeps the capability runnable instead of half-deleted.
 * `[skill, relative path, contents, note]`.
 */
export const TEMPLATES = [
  [
    'tencent-upload',
    'scripts/heji/heji-state.json',
    '{\n  "read": {\n    "id": "",\n    "name": "一首诗一出戏 · 读诗版"\n  },\n  "story": {\n    "id": "",\n    "name": "一首诗一出戏 · 故事版"\n  }\n}\n',
    'do.mjs 读取的合集状态：真实 collectionId 已剥离，id 留空后由 create 写回',
  ],
  [
    'bilibili-upload',
    'scripts/heji/map-dushi.json',
    '[]\n',
    '读诗版合集映射：真实 aid/cid/bvid 已剥离；结构见 bili_api.mjs add 与 README',
  ],
  [
    'bilibili-upload',
    'scripts/heji/map-gushi.json',
    '[]\n',
    '故事版合集映射：真实 aid/cid/bvid 已剥离；结构见 bili_api.mjs add 与 README',
  ],
  [
    'douyin-publish',
    'scripts/heji/dy_t.example.json',
    '[\n {\n  "ep": "01",\n  "prefix": "一首诗一出戏01｜"\n },\n {\n  "ep": "02",\n  "prefix": "一首诗一出戏02｜"\n }\n]\n',
    '目标清单结构示例（dy_add.mjs 以 argv 接收，文件名随意）：真实批次清单已剥离',
  ],
];

/**
 * Independent residual scan. `[matcher, description]`; a hit means the import
 * must be treated as failed, because something publishable-unsafe survived.
 */
export const RESIDUAL_PATTERNS = [
  [/ark-[0-9a-fA-F]{8,}-[0-9a-fA-F-]{8,}/, 'ARK API key'],
  [/sk-[A-Za-z0-9]{20,}/, 'OpenAI 风格 API key'],
  [/eyJ[A-Za-z0-9_-]{20,}/, 'JWT'],
  [/KOIrbt4YqaWl05sXdjwczIJ5nei/, '飞书 base app_token'],
  [/tblWEJxknewXos0D/, '飞书 table_id'],
  [/reczz28Gw33uhzZd/, '飞书 record_id'],
  [/\/sata1\//, 'NAS 绝对路径'],
  [/192\.168\.\d+\.\d+/, '内网地址'],
  [/\b10\.0\.0\.\d+\b/, '私有网段地址'],
  [/C:\\+Users\\+19592/i, '本机用户目录'],
  [/C:\/Users\/19592/i, '本机用户目录'],
  [/D:\\+lcj/i, '本机工作区'],
  [/D:\/lcj/i, '本机工作区'],
  [/\b19592\b/, '本机 Windows 用户名'],
  [/skill-300-ai/, '本机密钥目录'],
  [/XiaomiMiMoProjects/, 'MiMo 会话产物路径'],
  [/BV1[0-9A-Za-z]{9}/, '本机作者的已发稿件号'],

  // Real account / work identifiers belonging to the author's channels.
  [/v2_[0-9a-fA-F]{16,}@finder/, '视频号 FINDER_ID'],
  [/event\/UzFf[A-Za-z0-9_\-=]{10,}/, '视频号合集 event id'],
  [/export\/UzFf[A-Za-z0-9_\-=]{10,}/, '视频号作品 objectId'],
  [/7691218283269311785/, '抖音 aweme_id'],
  [/\b7\d{18}\b/, '抖音 aweme_id 形态'],
  [/\b34078814\b/, 'B 站账号 UID'],
  [/\b(9205761|9205779)\b/, 'B 站 seasonId'],
  [/6abcb179000000001803a18b/, '小红书笔记 ID'],
  [/6abc57ff1632000000000001|6abc57e5130f000000000001/, '小红书合集 ID'],
  [/玻璃玻璃奶瓶/, '本机作者的 B 站昵称'],

  // Time-limited credentials and third-party personal data.
  // A real signed value, not the parameter name — the name appears in parsing
  // code that must survive verbatim.
  [/encfilekey=[A-Za-z0-9+/=_-]{40,}/, '平台签名 URL'],
  [/whitedewstory/, '第三方作者微信号'],
  [/code\.aistar\.cool/, '上游赞助商外链'],
];

/**
 * Documentation accuracy fixes, applied at import before scrubbing.
 *
 * These are not redactions: nothing private is removed. They correct statements
 * that would be *wrong* for an installer — chiefly a "companion skill" that
 * this package does not ship, whose hardcoded path therefore does not exist on
 * anyone else's machine. Keeping the fix here (rather than editing the source
 * skills) matters because the source is the author's live skill library, synced
 * to other machines and to a NAS.
 *
 * `[pattern, replacement, label]`.
 */
export const DOC_FIXES = [
  [
    /用 biliup 把视频投稿到 B站；配套 paper-bilibili-uploader 做论文视频投稿。/g,
    '用 biliup 把视频投稿到 B站。本文件另含一条论文视频投稿路径，它依赖**本包未包含**的外部 skill `paper-bilibili-uploader`；biliup 投稿引擎本身已包含在本包内。',
    '配套 skill 标明为外部',
  ],
  [
    /## 论文视频投稿（配套 skill：paper-bilibili-uploader）/g,
    '## 论文视频投稿（依赖**本包未包含**的外部 skill `paper-bilibili-uploader`；需先自行安装，下文命令里的路径按它的实际安装位置调整）',
    '配套 skill 章节标明为外部',
  ],
  [
    /因此 B 站唯一可用路径 = 本 skill（biliup）\+ `paper-bilibili-uploader`（论文投稿）/g,
    '因此 B 站唯一可用路径 = 本 skill（biliup）+ `paper-bilibili-uploader`（论文投稿，**本包未含**）',
    '配套 skill 标注为外部',
  ],
  [
    /- 用全局 skill `paper-bilibili-uploader` 的 upload 脚本/g,
    '- 用外部 skill `paper-bilibili-uploader`（**本包未含**）的 upload 脚本',
    '配套 skill 标注为外部',
  ],
  [
    /## 二、paper-bilibili-uploader 实测记录/g,
    '## 二、外部 skill paper-bilibili-uploader 实测记录（**本包未含**，此节为当时的选型记录）',
    '实测记录节标明为外部',
  ],

  // 作者明确要求不保留真实运营数字。这些是 tangshi-pipeline 正文里对作者自己账号
  // 播放表现的绝对计数与实测倍率；规则本身（产能上限、时段、采样制度）是方法论，
  // 保留并改成定性表述，去掉数字与指向已剔除数据文件的引用。
  [
    /  - \*\*每天 1-2 条、间隔 ≥4h、铺满 24 小时窗口\*\*（禁复刻 EP15-20 的 6 小时连发 12 条——同质内容互抢推荐池，EP18\/19 因此只拿 33 播放）/g,
    '  - **每天 1-2 条、间隔 ≥4h、铺满 24 小时窗口**（禁几小时内连发十几条——同质内容互抢推荐池，实测会让整体表现一起塌掉）',
    '去掉播放量：连发禁忌',
  ],
  [
    /  - \*\*首发后 0-24h 是生死线\*\*（视频号超 24h 条均播放 ÷15、48h ÷125）/g,
    '  - **首发后 0-24h 是生死线**（越过后条均播放按数量级衰减）',
    '去掉播放量：生死线倍率',
  ],
  [
    /  - \*\*产能铁律（2026-10-04 T166 定量线 \+ 10-07 T181 修订）\*\*：视频号单日条数→次日 0-6h 相对基线 \*\*12条=1\.35×（理想）、20条=0\.69×（硬上限）、40条=0\.04×（重伤且拆两波也救不了第二波）\*\*——\*\*单平台单日 ≤20 条、单波发完、主波 12:00–15:00、禁 22:00 后晚波（T181 实锤：晚波 0\/0\/5 全地板）\*\*；进池判定锚定 \*\*24-30h 龄期窗\*\*（固定250阈值跨龄期不可比）；\*\*÷109 衰减线四次复验（≈÷102\.7）\+ 30h 慢启动硬截止定稿\*\*；采样制度：\*\*T\+6h\/T\+24h 必采、发布后 1h 内置顶评论\*\*；视频号 cookie 约 2-3 天失效（有头扫码 7min 回存）/g,
    '  - **产能铁律（多轮实测定稿）**：单日条数越多、次日冷启动越差，**超量后哪怕拆成两波也救不回第二波**——**单平台单日 ≤20 条、单波发完、主波 12:00–15:00、禁 22:00 后晚波（晚波实测全地板）**；进池判定必须锚定同一**龄期窗**（固定阈值跨龄期不可比）；**慢启动条目 30h 后不再补量**（30h 是补量硬截止）；采样制度：**T+6h/T+24h 必采、发布后 1h 内置顶评论**；视频号 cookie 约 2-3 天失效（有头扫码 7min 回存）',
    '去掉播放量：产能铁律',
  ],
  [
    /  - \*\*衰减终值（T127 实测）\*\*：24-48h 单段 ÷11-14、进池组首窗→30-47h \*\*÷109（验证了理论 ÷125）\*\*，48h 后地板化（后窗仅 4\.3\/日）→ 24h 动作窗口不变/g,
    '  - **衰减终值（实测）**：24-48h 单段按数量级衰减、进池组继续衰减到接近地板，48h 后基本地板化 → 24h 动作窗口不变',
    '去掉播放量：衰减终值',
  ],
  [
    /  - 依据全量数据表与推理见 `references\/data-review-ep15-20\.md`（首轮）与 `references\/data-review-ep21-30\.md`（\*\*第二轮 T108，含节奏裁决：并行≥5min 不伤推荐、一天多批才压量 → 每天 1 批 ×2 集 4 条、批间隔 ≥12-24h、试 20:00 晚点位\*\*）与 `references\/data-review-ep21-40-48h\.md`（\*\*第三轮 T127：48h 终验、跨日冷却、产能铁律升级、EP31-40 专章\*\*）与 `references\/data-review-ep41-60\.md`（\*\*第四轮 T166：产能定量线 12\/20\/40 条、EP41-50 终局、冷却恢复、T\+6h 采样制度\*\*）与 `references\/data-review-ep61-70\.md`（\*\*第五轮 T181：晚波判死、阈值龄期效应、÷109 定稿、30h 硬截止、续航\/脉冲分型\*\*）/g,
    '  - 以上结论来自五轮真实数据复盘（原始数据表与逐轮推理**未随本包发布**）。本文件只保留提炼后的可执行规则；要复现同样的口径，用 skill `tangshi-data-review` 的采集脚本对自己的账号重跑。',
    '去掉数据表引用',
  ],
  [
    /\| ② 画面感强（奇观\/边塞\/夜景\/冲突） \| \*\*第一\*\* \| 边塞 EP15\/17=285\/275、夜景 EP16=262 vs 长诗抒情 EP18\/19=33，8 倍差 \|/g,
    '| ② 画面感强（奇观/边塞/夜景/冲突） | **第一** | 边塞/夜景类的播放比长诗抒情高一个数量级 |',
    '去掉播放量：选片权重表',
  ],
  [
    /\| ① 自带故事结构 \| 保持，不加码 \| A\/B 播放打平（B\/A≈1），故事结构未带来播放优势 \|/g,
    '| ① 自带故事结构 | 保持，不加码 | A/B 播放基本打平，故事结构本身未带来播放优势 |',
    '去掉播放量：A/B 比值',
  ],
  [
    /- \*\*时长不是变量\*\*（长短播放差 <5%）/g,
    '- **时长不是变量**（长短与播放无明显相关）',
    '去掉播放量：时长差',
  ],
  [
    /- 完整复盘数据表（36 行实采 \+ 6 洞察 \+ 放量清单）：`references\/data-review-ep15-20\.md`。/g,
    '- 复盘方法（采集脚本、龄期分档口径）见 skill `tangshi-data-review`；本包不含原始数据表。',
    '去掉数据表引用：完整复盘',
  ],
  [
    /进度与逐集发布实录全部在该记录「备注」字段（2026-10-01 已到 EP01-20 三平台合集全满、进度 0\.995）。/g,
    '进度与逐集发布实录全部在该记录「备注」字段。',
    '去掉项目进度数值',
  ],
];

/** Extensions treated as text and therefore scrubbed; everything else is copied raw. */
export const TEXT_EXTENSIONS = new Set([
  '.md', '.markdown', '.json', '.jsonc', '.js', '.mjs', '.cjs', '.ts', '.py',
  '.txt', '.yml', '.yaml', '.sh', '.bash', '.ps1', '.example', '.ass', '.srt',
  '.svg', '.css', '.html', '.csv', '.toml', '.ini', '.cfg', '.gitkeep',
]);

/**
 * Extension-less files that are still text. Missing this list is how a
 * `LICENSE` gets treated as a binary blob: it is then copied verbatim, keeps
 * CRLF, and — worse — is skipped by the residual scan and the syntax/line-ending
 * checks that key off {@link TEXT_EXTENSIONS}.
 */
export const TEXT_FILENAMES = new Set([
  'LICENSE', 'LICENCE', 'NOTICE', 'README', 'CHANGELOG', 'AUTHORS',
  'Makefile', 'Dockerfile', '.gitignore', '.gitattributes', '.npmignore',
  // `extname('.gitkeep')` is '' in Node, so dotfiles need naming explicitly.
  '.gitkeep', '.keep',
]);

/**
 * Return whether a path should be handled as text.
 * @param {string} path - POSIX-style relative path.
 * @returns {boolean} whether the file is text.
 */
export function isTextPath(path) {
  const segments = path.split('/');
  const name = segments[segments.length - 1];
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : '';
  return TEXT_EXTENSIONS.has(ext) || TEXT_FILENAMES.has(name);
}

/**
 * Apply the documentation-accuracy fixes to one text file.
 * @param {string} text - file contents.
 * @returns {{ text: string, applied: string[] }} corrected text and the labels that fired.
 */
export function fixText(text) {
  let output = text;
  const applied = [];
  for (const [pattern, replacement, label] of DOC_FIXES) {
    const re = new RegExp(pattern.source, pattern.flags);
    if (re.test(output)) {
      output = output.replace(new RegExp(pattern.source, pattern.flags), replacement);
      if (!applied.includes(label)) applied.push(label);
    }
  }
  return { text: output, applied };
}

/**
 * Apply the scrub rules to one text file.
 * @param {string} text - file contents.
 * @returns {{ text: string, applied: string[] }} scrubbed text and the rule labels that fired.
 */
export function scrubText(text) {
  let output = text;
  const applied = [];
  for (const [pattern, replacement, label] of SCRUB_RULES) {
    const re = new RegExp(pattern.source, pattern.flags);
    if (re.test(output)) {
      output = output.replace(new RegExp(pattern.source, pattern.flags), replacement);
      if (!applied.includes(label)) applied.push(label);
    }
  }
  return { text: output, applied };
}

/**
 * Return the drop reason for a skill-relative path, or `undefined` when it ships.
 * The path is passed with the skill name prefixed (`<skill>/<relative>`) so a
 * rule can be scoped to one skill when a generic file name would over-match.
 * @param {string} scopedPath - `<skill name>/<POSIX relative path>`.
 * @returns {string | undefined} reason to drop.
 */
export function dropReason(scopedPath) {
  for (const [pattern, reason] of DROP_PATTERNS) {
    if (pattern.test(scopedPath)) return reason;
  }
  return undefined;
}

/**
 * Scan text for strings that must never survive the import.
 * @param {string} text - text to check.
 * @returns {string[]} descriptions of the residual shapes found.
 */
export function residualFindings(text) {
  const found = [];
  for (const [pattern, description] of RESIDUAL_PATTERNS) {
    if (pattern.test(text) && !found.includes(description)) found.push(description);
  }
  return found;
}
