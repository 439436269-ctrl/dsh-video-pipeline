# T195 外部调研报告：唐诗短剧产线「更划算」方案——成本还能怎么降

- 日期：2026-10-07（检索时点 20:53–21:20 北京时间）
- 范围：只调研 + 写 `tasks/T195/`，不碰产线
- 口径声明：**每条外部结论标注来源 URL；取不到的标「未核实」，不编造**
- 检索通道实测：① WebFetch（百度/搜狗/火山活动页可用，火山 docs 为 JS 壳）→ ② **playwright 跨页 evaluate 渲染火山方舟文档**（本页双 body 注入 bug 需绕行，见附录）→ ③ bing.py（英文，本次结果质量差仅作辅）→ ④ 百度/搜狗中文检索。websearch skill 未用（对子 agent 不可用）

---

## 结论速览（≤200字）

**现价**：4折活动已于 **2026-10-07 14:00 到期**（检索时点 20:53，已过期约 6.9 小时），mini 恢复刊例 **23 元/百万 token**，未发现接续折扣活动；seedream flash 0.12 元/张仍为最低价档。**三条省钱动作**：① S 级 720p 镜头改 480p 出片 + 本机 RTX 4060 本地超分（待抽检），单条 2.50→1.16；② 立即领「单模型 50 万 tokens 免费额度」（≈11.5 元）；③ 花 2 分钟查节省计划 mini 独立折扣率（6 个月 100 元/月起，折扣率未核实）。**预估新单集成本：4.26 → ≈2.92 元**（动作①落地且抽检通过后）。

---

## Q1 火山方舟现价核实（最优先）

### 1.1 4 折是否已到期 —— **已到期（实锤）**

| 项 | 值 | 来源 |
|---|---|---|
| 活动时间 | 北京时间 2026-08-07 14:00 — **2026-10-07 14:00** | https://docs.volcengine.com/docs/ark/seedance-2-0-mini-fast-limited-time-discount?lang=zh （「Seedance 模型限时折扣活动规则」，页面最近更新 2026.09.21；本次 playwright 渲染抓取） |
| 本机当前时间 | **2026-10-07 20:53**（`Get-Date` 实测） | 本机 |
| 判定 | **已过期 ≈6.9 小时**，后付费恢复刊例价 | 规则原文：「活动结束或达到优惠上限后恢复原价。出账时间在活动结束后的请求……按刊例价（原价）结算」 |
| 优惠形式 | 自动生效，无需领取；仅企业用户；mini 折后累计上限 36 亿 token（9-18 14:00 起计） | 同上 |
| 是否有接续活动 | **未发现**。限价规则文档（09-21 更新）与模型价格页均只写至 10-07；百度检索「Seedance 限时折扣活动规则」无新档期公告 | 同上 + https://ark.volcengine.com/region:cn-beijing/docs/ark/model-pricing?lang=zh + 百度检索（2026-10-07） |

> ⚠️ 活动期间 4 折价（9.20 元/M、720p 0.2 元/秒）**不再有效**，长期预算一律按刊例。

### 1.2 当前刊例价总表（官方模型价格页实抓，2026-10-07）

来源：https://ark.volcengine.com/region:cn-beijing/docs/ark/model-pricing?lang=zh （「模型价格」，playwright 渲染抓取）

**视频生成（输入不含视频，480p/720p，元/百万 token，在线推理）**

| 模型 | 刊例 | 页面标注 |
|---|---|---|
| doubao-seedance-2.5 | **70.00**（1080p 77） | 无活动 |
| doubao-seedance-2.0 | **46.00**（1080p 51、4k 26） | 无活动 |
| doubao-seedance-2.0-fast | **37.00** | 「原价 37.00 限时75折」（活动已过期，恢复 37） |
| doubao-seedance-2.0-**mini**（现用） | **23.00**（含视频输入 14.00） | 「原价 23.00 限时4折」（活动已过期，恢复 23） |
| doubao-seedance-1.0-pro / pro-fast | 15.00 / 4.20 | 旧款 |

**官方价格示例（与产线实测对账一致）**：mini 480p 16:9 5s = 1.16 元（0.23/s）；mini 720p 16:9 5s = 2.48 元（0.50/s）。产线 9:16 实测 5s：480p=50,638 tok=1.16 元、720p=108,900 tok=2.50 元（来源：ark-seedance-video SKILL 实测账）。

**企业价/合同价**：需与火山商务谈，公开页无标价 → **未核实**。

### 1.3 预付折扣：资源包（已核实：对 t2v **零折扣**）

来源：https://docs.volcengine.com/docs/ark/seedance-2-0-model-resource-pack-rules?lang=zh （「Seedance 2.0-2.5 模型资源包使用规则」，最近更新 2026.09.21）

- mini 资源包刊例：1400 万 tokens = **196 元**（=14 元/M）；1000 万 = 140 元（2 个起售）；1 亿 = 1400 元。有效期 90 天，7 天内未使用可全额退款。
- **抵扣换算**：t2v 属「输入不含视频」场景，官方抵扣比例 **1 : 1.6429**（消耗 1 实际 token 扣 1.6429 资源包 token）→ 有效单价 = 14 × 1.6429 ≈ **23 元/M = 刊例价，零折扣**。资源包本质是预付锁量，不是折扣。
- 资源包**不参与**限时折扣活动；规则明确建议「账户预充值……按量后付费并享受折扣优惠」（指活动期内）。
- 模型开通门槛：余额 >200 元 或 任一资源包有余量。

**同类换算（2.0 标准版）**：100 万 tokens = 28 元，t2v 抵扣 1:1.6429 → 28×1.6429 ≈ 46 元/M = 刊例，同样零折扣。（依据同页抵扣表）

### 1.4 预付折扣：AI 统一节省计划（**折扣率未核实，值得花2分钟查**）

来源：https://docs.volcengine.com/docs/6269/2091675?lang=zh （「AI统一节省计划」，本次渲染抓取）

- 形式：承诺 **6 或 12 个月**、月承诺 100 元–300 万元（可自定义），内置阶梯折扣**最高可省 50%**；未用完额度可结转（≤承诺额 20%/月）。
- **Seedance 2.0 fast & mini 于 2026-08-29 起改为「独立折扣体系」**（非影视版权计费项；mini 影视版权部分仍归 B 类）——即 mini 有自己的节省计划折扣率。
- 折扣优先级：节省计划内置折扣 vs 合同折扣 **取低者**；抵扣的是「已按当时活动价结算的折后账单」。
- **具体折扣率：需登录控制台「费用中心-节省计划-折扣查询」或购买页查看，公开文档未列 → 未核实。** 对本产线（月支出约百元级）门槛 = 100 元/月 × 6 个月 = 600 元起承诺；若 mini 独立折扣 ≤9 折则年省约 50–100 元，>8 折则明显划算。**建议动作：打开 https://console.volcengine.com/finance/saving-plan 查 mini 折扣率（2 分钟，0 成本）。**

### 1.5 新活动线索（已核实存在，价值有限）

来源：https://ai.volcengine.com/activity/ai618 （「AI 普惠季」，WebFetch 抓取）

1. **2500 万 Tokens 免费领**：登录方舟控制台「开通服务」一键授权，**单模型免费领 50 万 tokens**。seedance mini 50 万 tokens ≈ **11.5 元** ≈ 9 条 480p 5s 片。**建议立即领取**（0 成本）。
2. Seedance 2.0 系列资源包/量产包（轻量创作包、全能臻享包、高效量产包「约生成 52 个 480p 视频」）：页面明示**适用 Doubao-Seedance-2.0（不含 fast、mini）**→ 与现用 mini 不匹配；页面价格 JS 动态加载显示「价格查询中」→ 具体价 **未核实**。按资源包抵扣规则推算即使购买也≈刊例（见 1.3）。
3. 活动规则文档：https://docs.volcengine.com/docs/86680/2307023 （未逐条展开，仅普惠季页引用）。

### 1.6 按现价重算单集成本

| 配方 | 图 | A级 480p t2v | S级 720p i2v | 合计 |
|---|---|---|---|---|
| **现状（刊例，今天 14:00 后）** | 5×0.12=0.60 | 1 条 =1.16 | 1 条 =2.50 | **≈4.26 元**（与起点一致，刊例无变化） |
| 活动期 4 折（已失效，仅对照） | 0.60 | 0.47 | 1.00 | ≈2.07 元 |
| **省钱动作①后（S改480p+本地超分）** | 0.60 | 1.16 | 1.16 | **≈2.92 元** |

> 活动到期的真实影响：最近几天按 4 折出的片恢复刊例，**同配方成本回到 4.26 元（≈活动期的 2.1 倍）**；对照 T88 结论「4折不要写进长期预算」，本报告确认其到期并按刊例重建基线。

---

## Q2 draft 样片模式实测价值

### 2.1 官方计费规则（已核实——**draft 不是省钱预览，是额外计费的两步工作流**）

来源：https://ark.volcengine.com/region:cn-beijing/docs/ark/model-pricing?lang=zh 「Seedance 2.5 样片（Draft）模式」原文：

> 「包含两步任务，**每个任务独立计费**：Step 1：生成 Draft 视频，按 480p 视频计费。Step 2：基于 Draft 生成正式视频，按目标分辨率计费……计算 token 用量时，输入视频时长按 Step 1 的输入视频计算，**Draft 视频不计入**。」

### 2.2 官方宣传原文（「480P预览与成片内容一致」出处）

来源：本地留档 `<本地密钥目录>\ark-vid-doc2.log`（火山「创建视频生成任务」文档页，页面更新 2026.09.22 抓取），侧栏推广位：

> 「Doubao-Seedance-2.5 **样片模式 重磅上线**：第1步，低成本快速生成 480P 预览样片；第2步，基于样片生成高质量成片，**保持内容一致**。」

API 参数（同文档请求参数表）：`draft boolean 默认值 false 样片模式`、`draft_task_id`（SDK 签名实录 `draft=False, draft_task_id=None`）。

### 2.3 价值判定

| 问题 | 答案 |
|---|---|
| 能用 draft 预览省钱吗？ | **不能直接省**——Step1 按 480p 照常计费，Step2 成片按目标分辨率全额计费，两步相加**比直接出成片更贵**（多花一条 480p 的钱） |
| 那它有什么用？ | **省「废片」**：先花 480p 价（mini 5s≈1.16 元）看样片，不满意就不跑 Step2，把废片损失从 2.50 元压到 1.16 元。价值 = f(废片率)；废片率≈0 则纯亏 |
| 适用模型 | 官方计费与推广位**均挂在 Seedance 2.5 名下**；`draft` 参数在通用 API 文档中存在，**mini 是否支持未核实**（需实测一次 create `draft:true`，本任务不碰产线） |
| 「480P预览与成片内容一致」可信度 | 官方宣称「保持内容一致」，**未见第三方验证 → 未核实**；即便一致，一致性也只服务于「预览选片」，不改变计费 |
| 对本产线建议 | ⏸ **暂缓**。理由：① mini 支持性未核实；② 我们 S 镜头每集 ≤1 条、有 i2v 首帧锁定（MAD=9.7 实测），废片风险本就低；③ 现在刊例价下每条 draft 白花 1.16 元。若后续某集废片率 >30% 再试 |

---

## Q3 模型档位性价比：mini（23）vs 2.0（46）画质差异

社区/第三方评价（均为二手文章，非严格盲测，**来源如下**）：

| 观点 | 来源 |
|---|---|
| mini = 「量产性价比款，快、便宜，批量出片打工神器」；2.0 = 「全能旗舰款，画质、真实感拉满，高端精品内容」；2.5 = 长叙事+编辑 | 百家号《别再乱选 AI 视频模型！字节 Seedance 三款型号深度对比》2026-07-16（百度检索结果快照） |
| mini 特性：支持 480p 草稿/720p 主力/可导 1080p；生成速度是 fast 两倍；运动稳定性强；**「精细人物刻画表现力偏弱」** | 百家号《Seedance 2.0 Mini杀到！各大版本区别一览表！》2026-06-17（百度检索快照） |
| mini 动作序列更流畅，时间帧故障/画面抖动/撕裂瑕疵更少，适配 8-10 秒 | 哔哩哔哩《seedance 2.0 mini与2.0的区别》2026-06-30（百度检索快照，原文页 B站 API 连发412未直读） |
| fast 细节纹理保留更完整 vs mini 画面稳定性突出（运动场景更流畅） | 百度知道《seedance2.0 fast比mini强吗》2026-07-09（百度检索快照） |
| Seedance 2.0 打斗戏「画面清晰、人物从头到尾保持得很好，没有换人/穿模/身份错乱」（vs MiniMax H3 后半段失稳） | 百家号《MiniMax-H3与Seedance2.0全方位对比》2026-08-07（百度检索快照） |
| Seedance 2.0 常规提示词可用率约 90%，运镜稳定/光影层次/动作逻辑优于 1.5；古风武打场景有专门提及 | 百家号《Seedance 2.0 视频生成效果怎么样？API 使用技巧与实测经验分享》2026-08-12（百度检索快照） |

**结论（对本产线）**：

1. mini 短板 = **精细人物刻画**；2.0 长板 = **人物一致性/细节纹理/光影**（46 vs 23，×2 价）。
2. **哪些镜头值得升**：只有 S 级（人物面部近景、双人同框、情绪高潮）是 2.0 的受益面。但我们 S 级已用 **i2v 首帧锁定**（产线实测 MAD=9.7<12）解决一致性，且单条只 5 秒——**升 2.0 的增量收益存疑，不建议默认升**。
3. 建议：**先不升**；仅当某集 S 镜头 i2v 中段漂移/面部崩坏复现时，对该单条升 2.0 试对比（增量成本 2.50→4.97 = +2.47 元/条），用实拍对比替代社区文章。
4. 升 2.5（70 元/M，720p 5s≈7.56 元）**不建议**——卖点是样片模式/多参考/长叙事，产线用不上。

---

## Q4 本地超分降本：480p → 720p 可行性

### 4.1 本机 GPU（已核实）

- `Get-CimInstance Win32_VideoController` 实测：**NVIDIA GeForce RTX 4060**，驱动 32.0.16.1060（AdapterRAM 字段 WMI 32 位截断显示 4GB，4060 实际为 8GB 显存 → 8GB 为推断，**未核实**）。
- ⚠️ `nvidia-smi` 报 `Failed to initialize NVML: Unknown Error`（驱动/权限层面异常，**未排查**）——不影响 CUDA 应用可能性，但上超分前应先修复或验证 torch/ncnn 能否用卡。

### 4.2 工具与模型（来源）

| 事实 | 来源 |
|---|---|
| Real-ESRGAN 官方提供 `realesr-animevideov3`（动漫视频专用，4x）与 `RealESRGAN_x4plus`（通用）等权重；另有 anime_6B 小模型 | https://github.com/xinntao/Real-ESRGAN （README/README_CN，bing 检索快照；github 直连本机超时） |
| animevideov3 官方文档 `docs/anime_video_model.md` | https://github.com/xinntao/Real-ESRGAN/blob/master/docs/anime_video_model.md （搜狗检索快照） |
| 「realesr-animevideov3 模型处理**速度最快**，画风更偏向动漫的柔和画风」；三模型可选，默认即 animevideov3 | 微信公众号/腾讯云开发者社区《牛逼！图片糊成这样也可以分分钟变高清！》（搜狗检索快照，2022-12/2023-02） |
| 「视频超分：realesr-animevideov3-x4（**适用于漫画，速度快，质量普通**）」 | danji100《Real-ESRGAN超分辨率工具下载》（搜狗检索快照，2024-07） |
| 实操链路 = ffmpeg 拆帧 → 逐帧超分 → 重封装（`-n realesr-animevideov3`） | 极术社区《图片、视频修复并超分 – Real-ESRGAN项目使用（一）》2024-04-19（搜狗检索快照）；CSDN《视频超分辨率_ffmpeg 超分》blog.csdn.net/lingxuanning/article/details/124865480 |
| 存在 **4060 显卡通用地案例**（修复老视频到 4K） | 什么值得买《4060显卡用AI修复老视频变成4K教程》2023-12-01（搜狗检索快照） |
| video2x 集成 animevideov3 + RIFE 补帧，带显卡检测向导 | CSDN《Video2X:AI视频超分辨率3步修复模糊老片》2026-09-07（搜狗检索快照） |
| 便携版（免安装 exe，Windows）可用 | CSDN 绿色版 exe 教程（bing 检索快照，2025-09） |

### 4.3 对本产线的价值判断

- **账**：S 级 720p i2v 2.50 元 → 480p i2v 1.16 元 + 本地超分 ≈ 0 元电费 → **每条省 1.34 元（−54%）**；每集 1 条即省 1.34 元，300 集 ≈ **400 元**。
- **速度**：480×854 → 超分再缩到 720×1280，5s×25fps=125 帧，4060 上逐帧 animevideov3 量级为分钟级/条（**具体帧率未核实**，需本机实测一条计时）。
- **质量风险（结构推断，需抽检）**：
  1. animevideov3 是**动漫柔和画风**调教，我们是「古风写实电影感」真人质感 → 可能出现蜡感/过度平滑，**首选 `RealESRGAN_x4plus` 对比试**；
  2. 逐帧独立超分无时序约束 → **闪烁/抖动风险**，必须抽帧+连续播放目检；
  3. 官方与第三方均未给「写实人像 480p→720p 等效直出」的对标数据 → **未核实，只能实测**。
- **显存**：ncnn-vulkan/CUDA 版 720p 级别单帧远小于 8GB，纸面无压力（推断）。
- **建议动作**：抽 1 条已发布 S 镜头 480p 版 → x4plus 与 animevideov3 各超一版 → 与原 720p 直出并排目检（半天量级）。**通过才切换**；不通过则维持 720p 直出。

---

## Q5 生图 / 其他降本

### 5.1 seedream 生图现价（官方模型价格页实抓）

来源：https://ark.volcengine.com/region:cn-beijing/docs/ark/model-pricing?lang=zh

| 模型 | 输出单价（元/张） | 判定 |
|---|---|---|
| **doubao-seedream-5-0-flash（现用）** | **0.12**（输入免费） | **已是最低价档，无可降** |
| doubao-seedream-5-0-lite | 0.22 | 更贵 |
| doubao-seedream-4-5 | 0.25 | 更贵 |
| doubao-seedream-4-0 | 0.20 | 更贵 |
| doubao-seedream-5-0-pro | 单图 0.30（≤1.5K）/0.60（>1.5K）；输入第 2 张起 0.02 | 贵，质档不同 |
| 未成功出图 | **不计费**（官方注意项） | 重跑失败不花钱 |

另：MiMo 桌面 `image_gen` 工具走订阅图片配额（周重置），**产线实测会 403 `subscription_quota_exhausted`**（来源：tangshi-pipeline SKILL L83）——配额恢复周内的补图可走该免费通道，批量生产仍以 ark flash 为准。

### 5.2 TTS（MiMo API）

- 产线实测记录：「**图片配额 403（周重置）：TTS 不受影响**」（来源：tangshi-pipeline SKILL L83，https://github.com/… 不适用，本地 skill 文件）——即 TTS 不吃订阅图片配额。
- 本任务范围内**未发现 TTS 单独计费证据**（memory/历史检索无记录）；TTS 按 MiMo 桌面内置 `tts_speech` 调用，**是否在底层对账户计量 → 未核实**。现状成本表未计 TTS，维持 0 元假设。
- 火山豆包语音合成另有官方计价（模型价格页「音频/语音模型」段，本次未抓数）——**若未来 TTS 开始计费**，可切火山 TTS 比价，标未核实。

### 5.3 免费额度

- 方舟「单模型 50 万 tokens 免费领」（普惠季页，见 1.5）≈ mini 11.5 元，**领取入口**：https://console.volcengine.com/ark/region:ark+cn-beijing/openManagement?LLM=%7B%7D&OpenAuthorizeModal=true&OpenTokenDrawer=false&advancedActiveKey=model

---

## 三条省钱动作 + 新单集成本

| # | 动作 | 成本 | 预估收益 | 状态 |
|---|---|---|---|---|
| ① | **S 级 720p i2v → 480p + 本机 RTX 4060 本地超分**（首选 RealESRGAN_x4plus，对比 animevideov3；过抽检再切换） | 0 元 + 半天抽检 | 单条 2.50→1.16，**单集 −1.34 元**，300 集 ≈ −400 元 | 待抽检 |
| ② | **领「单模型 50 万 tokens 免费额度」**（普惠季） | 0 元，2 分钟 | ≈ **11.5 元**（≈9 条 480p 5s） | 立即可做 |
| ③ | **查节省计划 mini 独立折扣率**（console 费用中心-节省计划-折扣查询；6 个月 100 元/月起承诺） | 2 分钟查询；购买需 600 元起承诺 | 折扣率 ≤9 折即年省数十元；**具体率未核实** | 待查 |

**新单集成本预估**：

- 今天起（刊例、配方不动）：**≈4.26 元/集**
- 动作①落地且抽检通过：图 0.60 + 480p t2v 1.16 + 480p i2v 1.16 = **≈2.92 元/集**（−31%）
- 动作③若 mini 节省计划给到 8 折：2.92 × 0.8 ≈ **2.34 元/集**（未核实，取决于折扣率）

**明确不建议**：升 seedance 2.0/2.5 当默认档（Q3）、买 mini 资源包（t2v 零折扣，Q1.3）、在 mini 上默认开 draft（两步都计费+支持性未核实，Q2）、换外部供应商（T88 结论维持）。

---

## 附录 A：未核实清单

1. 火山企业价/合同折扣、活动后是否有商务口头续期 → 未核实
2. 节省计划 mini「独立折扣体系」具体折扣率 → 未核实（需登录 console）
3. Seedance 2.0 量产包/权益包具体价格（页面 JS「价格查询中」）→ 未核实（且不适用 mini）
4. `draft` 样片模式 mini 是否支持 → 未核实（需 1 次实测 create）
5. 「480P 预览与成片内容一致」第三方验证 → 未核实
6. 4060 实际显存（8GB 推断）、超分实测帧率/画质、nvidia-smi NVML 报错原因 → 未核实
7. MiMo TTS 底层是否计量计费 → 未核实
8. 接续 4 折档期（若存在）→ 检索时点未发现

## 附录 B：检索通道实况（供后续任务复用）

- **playwright 跨页 evaluate**：火山 docs 页会注入第二个 `<body>`（`#garfish_app_for_vcopilot-sandbox-entry_*`），导致本页一切 `evaluate/find/snapshot` 报 strict mode violation。**解法**：在无污染页（如 example.com）保持 current tab，`run_code_unsafe` 里 `page.context().pages().find(p => p.url().includes('volcengine.com'))` 跨页取 `document.body.innerText` —— 本报告火山文档正文全部由此获得。
- 百度 `www.baidu.com/s?wd=` 可用但返回体巨大（~3 万 token），结论靠结果快照即可；**搜狗 `www.sogou.com/web?query=` 更干净**。
- bing.py 本次两次查询返回无关结果（QQ邮箱/游戏），质量不稳定；github.com 直连超时、r.jina.ai connection reset、知乎 403、CSDN 搜索 API 404、B站 API 412（任务已知）。
- `nvidia-smi` NVML 报错时用 `Get-CimInstance Win32_VideoController` 查卡。

## 附录 C：本报告引用来源 URL 汇总

1. https://docs.volcengine.com/docs/ark/seedance-2-0-mini-fast-limited-time-discount?lang=zh （限时折扣活动规则，2026-09-21 更新）
2. https://ark.volcengine.com/region:cn-beijing/docs/ark/model-pricing?lang=zh （模型价格：视频/生图刊例 + Draft 计费规则）
3. https://docs.volcengine.com/docs/ark/seedance-2-0-model-resource-pack-rules?lang=zh （资源包规则，2026-09-21 更新）
4. https://docs.volcengine.com/docs/6269/2091675?lang=zh （AI 统一节省计划）
5. https://ai.volcengine.com/activity/ai618 （AI 普惠季：免费 tokens / 量产包）
6. https://docs.volcengine.com/docs/86680/2307023 （普惠季活动规则，未展开）
7. 本地留档 `<本地密钥目录>/ark-vid-doc.log`、`ark-vid-doc2.log` （创建视频生成任务文档 2026-09-22 快照：draft 参数 + 样片模式宣传）
8. `{{USER_HOME}}\.agents\skills\ark-seedance-video\SKILL.md` （token 实测公式与实账）
9. `{{USER_HOME}}\.agents\skills\tangshi-pipeline\SKILL.md` （TTS 不受图片配额影响）
10. https://github.com/xinntao/Real-ESRGAN （官方权重/文档，经检索快照）
11. https://blog.csdn.net/lingxuanning/article/details/124865480 （ffmpeg 超分链路）
12. 极术社区《Real-ESRGAN项目使用（一）》、腾讯云/公众号《…分分钟变高清！》、danji100、什么值得买 4060 教程、CSDN Video2X（均经搜狗检索快照，见 Q4 表）
13. Q3 六条社区评价（百度检索快照，见 Q3 表）
