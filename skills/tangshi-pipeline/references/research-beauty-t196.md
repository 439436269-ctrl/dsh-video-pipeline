# T196 外部调研报告：唐诗短剧产线「更优美」增量方案（画面/声音升格）

> 调研日期：2026-10 · 只调研不碰产线。检索通道与可用性见 `progress.md`。**T144 已覆盖的导演式 prompt/一致性/每句一镜不再重复**；本报告只写增量（Q1-Q5）。每条结论附来源；取不到 URL 或未实测的条目明确标 **未核实**。
> 本报告最大特点：**Q2/Q4 全部在本机 ffmpeg 9.0.2 + Pillow 实测通过（21/21），附抽帧证据**，不是纸上谈兵。

## ≤200 字摘要

**3 条最大启发**：① 转场不需要任何素材站——ffmpeg `xfade` 自带 50+ 种转场（含 fadewhite 推白、circleopen、dissolve），「墨滴晕开」用 Pillow 生成噪声阈值扩散遮罩 + `alphamerge`+`overlay` 本机实测出片，纯零成本；② ASS `\\k` karaoke 逐字显现与竖排题卡在 libass 下**实测渲染成功且华文行楷字体本机已装**，video-compose 只需改约 5 行即可支持 `.ass`；③ 音源通道翻案一半：FreePD 已关站、淘声网 521、YouTube 不可达，但 **mixkit 直链 mp3 实测 200 可下**（Mixkit Free License），FMA/incompetech 可达——「无免费合规音源」对**中国风**仍成立，但对**通用底垫**不成立。

**5 条零成本技法**：1) 片段间转场用 `xfade=wipeleft/dissolve/fadewhite`（本机实测 PASS）；2) 墨滴晕开转场 = PIL 噪声遮罩 + alphamerge（实测 PASS）；3) 诗句逐字显现 = ASS `\\k` 标签 + SecondaryColour 全透明（实测 PASS）；4) 竖排题卡 = ASS 逐字 `\\N` 换行（实测 PASS）；5) zoompan/成片帧率直接把 25→30fps 重渲染（0 视频 token），比补帧更省。

---

## 通道实测（本机，2026-10）

| 通道 | 状态 | 说明 |
|---|---|---|
| WebFetch 百度 `baidu.com/s?wd=` | ✅ | 正文可取，SERP 含摘要级内容 |
| WebFetch 搜狗 `sogou.com/web?query=` | ✅ | 同上，URL 显示被截断（`https://www.sohu.com/a...`） |
| `tasks/T88/bing.py` | ⚠️ 可用但退化 | 多词英文查询被分词成词典结果（"frame rate"→字典条）；短专业词查询可用（HFR/RIFE/xfade 有结果） |
| B站搜索 API | ✅ | 需带 `Referer: https://search.bilibili.com/`（裸调 412）；直接复用 `tasks/T144/bili_search.py` |
| WebFetch ffmpeg 官方文档 | ✅ | `ffmpeg-filters.html` 全文可取 |
| 本机 ffmpeg 9.0.2 (gyan essentials) | ✅ | 位于 `{{WORKSPACE}}\sample-diary-map\.ff\ffmpeg-9.0.2-essentials_build\bin\`；xfade/alphamerge/maskedmerge/lumakey/geq/subtitles/ass/minterpolate/loudnorm **全部存在** |

---

## Q1 风格升级：彩水墨 / 岩彩「特别篇」怎么做且不破写实定版

### 1.1 风格词的 prompt 写法（找到的实证）

**a) 彩水墨·鎏金（《长安的荔枝》爆款路子，2025-06 抖音/搜狐热议）**
- 具体写法（搜狐 SERP 快照，2025-06-23《用AI打造〈长安的荔枝〉彩色水墨风视频，单条破百万播放》）：
  > 「唐代贵妃杨玉环，身着华丽唐装，妆容精致，体态丰腴，在宫殿中优雅地品尝荔枝，周围环境富有唐代宫廷特色，**彩色鎏金水墨风格，带金箔效果**」
  - 冲突镜头写法：「杨贵妃怒摔荔枝：**朱红宫墙 + 金箔碎裂特效 + 俯拍**」——注意其结构 = 主体描述 + 场景 + **风格词（彩色鎏金水墨/金箔）** + 单独的「冲突镜头构图句」。
  - **URL 未固化（搜狐链接带签名/截断）→ 标半核实**
- 配色公式（网易《古画五音疗愈AI视频》SERP 快照，2025-04-28，`https://www.163.com/d...` 截断 → **未核实**）：
  > 「中国古代彩色水墨画，横向长卷构图，**朱砂红主色调，琥珀黄辅色**……」
  - 即：彩水墨 = 水墨骨架 + **传统颜料色三件套（主色朱砂/辅色琥珀黄/点缀金）**，直接对应 T144 的主辅点缀 60/30/10 色彩秩序——**彩水墨不是另起炉灶，是把 P 色板换成矿物颜料色板**。
- 岩彩材料语汇（美篇《AI绘画新时代的丹青史诗》2025-03-14，SERP 快照 → **未核实**）：天然矿物岩彩（**赭石、朱砂、孔雀石**研磨成色）、**贴箔/烧箔/积色**技法、敦煌壁画与唐宋青绿山水脉络、木板基底逐层叠加「璀璨厚重的色彩层次」——这些词可直接进 prompt 的「材质细节」段。
- 岩彩壁画质感写法（腾讯云开发者社区 SERP 快照）：「[主体] 敦煌飞天仙女… **[风格] 岩彩壁画质感，青金石色为主色调** [参数] 8k…」——风格词短促、颜色点名到矿物本名（青金石/朱砂），是与「写实电影感」并列的**风格定位段**，可直接替换我们 prompt 五段结构里的「风格」段，其余四段（镜头/光/动态/稳定约束）不动。
- 岩彩山水 SD 系示例：简书《AI绘画:岩彩山水画(附提示词)》2024-05-10（Baidu/哔哩同源）：「(最佳质量,4k,8k,高分辨率,杰作:1.2),超精细,(逼真,照片级…:1.37),高山…」——SD 权重语法，**对我们 seedream/seedance 中文提示词仅参考结构**（质量词前置+风格词加权）。
- 即梦风格绑定原则（php.cn《可灵AI写国风短片的提示词》/《即梦AI如何生成中国风插画》SERP 快照，**未核实**）：「即梦对风格识别**高度依赖前置显性关键词组合**，需在提示词**最前端强制绑定**不可替代的国风构图」→ **风格词必须写在第一句，不能放句尾**。

**b) B站已核实案例（API 实测，按播放）**
| 作品 | URL | 播放 |
|---|---|---|
| 【AI短片】《晴雨之间》童趣色彩·国风水墨 | https://www.bilibili.com/video/BV0000000000 | 41,445 |
| 中国·最佳AI短片·极简水墨《一念》 | https://www.bilibili.com/video/BV0000000000 | 8,808 |
| 那抹青色《瑞鸟》AI 动画短片 | https://www.bilibili.com/video/BV0000000000 | 11,442 |
| 《长安的荔枝》虚拟拍摄（对照，非AI水墨） | https://www.bilibili.com/video/BV0000000000 | 271,396 |

### 1.2 「特别篇」与全系列写实定版怎么共存（共存机制设计）

前提：T144 已定「写实电影质感+P色板」为全系列定版。彩水墨/岩彩**不能改定版，只能开旁路**：

1. **片种隔离**：彩水墨只做「特别篇」（节气篇/片头 3 秒题卡/番外 1 集），正片 EP 序列不动。特别篇在标题与合集里显式标注「特别篇」，观众有预期，不算风格跳变。
2. **结构隔离**：特别篇用**同一套五段 prompt 骨架**，只替换两个变量——①「风格」段（写实电影感 → 彩色鎏金水墨/岩彩壁画质感）②色板（P色板 → 矿物颜料色板：朱砂主+琥珀辅+金点缀）。光五维、运镜 6 型、稳定约束、每句一镜**全部复用**，保证「变风格不变工艺」。
3. **风格词前置**：风格词写进 prompt 第一句（即梦/可灵的风格识别依赖前置关键词），避免被写实词稀释。
4. **锚点保留**：特别篇保留与正片相同的**字体（华文行楷）、版式（竖排/位置）、片尾钩子**——观众识别靠的是字体与结构，不只靠画面风格。
5. **共存成本**：风格段+色板是纯 prompt 变更，**0 额外工具成本**；只在生图阶段换词，t2v/zoompan/合成链路完全不变。
6. **风险**：① 彩水墨下人物一致性更难（色彩漂移），特别篇建议**少人物/多景物**（岩彩山水、长卷空镜为主，规避角色脸）；② 金箔效果在 480p t2v 上可能出噪点 → 优先走高分辨率生图 + zoompan（B 级工艺，0 视频 token），与 T88 镜头分级天然兼容。

---

## Q2 转场与剪辑：ffmpeg/Pillow 本地零成本实现（本机实测）

### 2.1 ffmpeg `xfade` 官方 50+ 转场（来源：https://ffmpeg.org/ffmpeg-filters.html#xfade ，官方文档实取）

完整列表：`custom, fade, wipeleft, wiperight, wipeup, wipedown, slideleft, slideright, slideup, slidedown, circlecrop, rectcrop, distance, fadeblack, fadewhite, radial, smoothleft, smoothright, smoothup, smoothdown, circleopen, circleclose, vertopen, vertclose, horzopen, horzclose, dissolve, pixelize, diagtl, diagtr, diagbl, diagbr, hlslice, hrlslice, vuslice, vdslice, hblur, fadegrays, wipetl, wipetr, wipebl, wipebr, squeezeh, squeezev, zoomin, fadefast, fadeslow, hlwind…`（约束：两路输入须同分辨率/同帧率/同像素格式——**video-compose 第 1 步已把所有镜头归一化到 720×1280/fps/format，天然满足**）。

**本机实测（ffmpeg 9.0.2，测试脚本 `tasks/T196/_test_trans.py`，证据抽帧在同目录）**：

| 转场 | 映射到我们的说法 | 结果 |
|---|---|---|
| `xfade=wipeleft` | 横向擦除（卷轴横向展开的简化版） | ✅ PASS（`xf_wipeleft.png`） |
| `xfade=dissolve` | 溶解（墨韵淡出的简化版） | ✅ PASS |
| `xfade=circleopen` | 圆形开合（题卡开卷感） | ✅ PASS |
| `xfade=fadewhite` | **推白入画**（白闪转场） | ✅ PASS |

命令模板（零成本、单条命令）：
```
ffmpeg -i prev.mp4 -i next.mp4 -filter_complex \
  "[0:v][1:v]xfade=transition=wipeleft:duration=1:offset=<前镜时长-1>,format=yuv420p" out.mp4
```

### 2.2 墨滴晕开（Pillow 遮罩 + alphamerge，本机实测 ✅）

思路：墨迹扩散 = 一张**噪声阈值随时间扩散**的灰度遮罩序列，作为新画面的 alpha：

1. **Pillow+numpy 生成遮罩**（`_test_trans.py` 实装，约 15 行）：随机场 → `GaussianBlur(9)` 低频化 → 与「中心距离场」加权混合（0.65·noise + 0.35·dist）→ 每帧按分位数取阈值二值化 → 逐帧存 PNG。
2. **ffmpeg 合成**：遮罩序列编码为灰度 mp4 → `[新镜头][遮罩]alphamerge` → `overlay` 到旧镜头上。

实测结果：✅ 全部 PASS，抽帧 `ink_t0.3.png` / `ink_t0.6.png` 可见**有机墨渍状扩散边缘**（非几何硬边）。可调参数：模糊半径（边缘毛糙度）、中心权重（从画面中心晕开 vs 全画面随机晕开）、帧数（转场时长）。分辨率建议 720×1280 全尺寸（测试用 360×640，边缘略块状，放大后平滑）。

**成本 = 0**（Pillow 12.3 + numpy 2.4 本机已装，无新依赖）。

### 2.3 其他常见转场的本地实现映射

| 想法 | 零成本实现 | 状态 |
|---|---|---|
| 推白入画 | `xfade=fadewhite` | ✅ 实测 |
| 墨滴晕开 | PIL 遮罩 + alphamerge + overlay | ✅ 实测 |
| 卷轴展开 | `xfade=horzopen` / `squeezev`（官方列表内），或 PIL 画两片卷轴纸横移遮罩 | 官方列表有、**未单独实测**（同族 circleopen 已过） |
| 卷轴左右拉开 | `xfade=squeezeh` 或 PIL 中心向两侧扩散的矩形遮罩 | 同上 |
| 溶解/淡入淡出 | `xfade=fade/dissolve/fadegrays` + 音频 `acrossfade` | 视频侧实测 PASS |
| 书法笔画入画 | 不适合本地零成本（需逐帧笔迹遮罩，工作量大） | **不建议** |

### 2.4 接入 video-compose 的成本与注意（增量判断）

- 现状：video-compose 用 **concat demuxer 硬切**（无转场）。加转场需改为「逐对 `xfade` 串联」的 filter_complex——属**脚本层改造，估 1 天内**，不是改参数。
- **时长陷阱**：`xfade` 的转场时长是两镜**重叠**，成片总长会缩短 `n×duration`。必须二选一：① 每镜入点前补时长（镜头源多渲 1s）；② 接受缩短并重算 `total` 与配音 `delay_ms` 对齐。**建议只在段落间（题卡→正文、诗与诗之间）加转场，诗句内部保持硬切**——既省改造复杂度，也符合「每句一镜」的节奏。
- 音频侧零改造：`acrossfade` 或直接不动（配音本来是 adelay 点状排布，硬切不受影响）。

---

## Q3 BGM 破局：免费商用音源实测可达性 + 合规路径

### 3.1 逐站实测（本机 2026-10，HEAD/GET 实测）

| 站点 | 实测 | 中国风内容 | 授权 | 结论 |
|---|---|---|---|---|
| **mixkit.co** | ✅ 200；**直链 mp3 实测 200 可下**（`https://assets.mixkit.co/music/<id>/<id>.mp3`，需带 UA+Referer） | 稀薄：`/free-stock-music/discover/chinese/` 仅 1 首《Happy Chinese New Year!》；`/traditional/` 8 首含 **《A Decade in Beijing》**（京味） | **Stock Music Free License**（https://mixkit.co/license/ 可达，分类页见 Free License；**具体条款本次未逐条核对 → 半核实**） | ✅ **通道可达、可下载**，曲目需人工筛 |
| **freemusicarchive.org** | ✅ 200，搜索页可用 | 搜 "guqin" 仅 **1 首**：《Guqin》by MASERPAN（Ambient Soundtracks, 03:13）；站点有 Public Domain / Commercial Use / Use in Video 筛选器 | 站内 CC 各级 + PD 筛选，**具体该曲 license 需打开曲目页核对** | ✅ 可达；中国风曲目极少 |
| **incompetech.com**（Kevin MacLeod） | ✅ 200 | 曲库有中国风曲目但站内检索本次未固化 | CC-BY（**署名必做**，业界通识；站内 license 页可达） | ✅ 可达；用则简介必挂署名 |
| **freesound.org** | ✅ 200 | 是音效库非音乐（风声/水声/环境层可用） | 有 CC0 筛选 | ✅ 可达，适合**环境层**（溪流/鸟鸣/风） |
| **imslp.org** | ✅ 200（跳 cn.imslp.org） | 谱面为主，演奏录音权利另计 | 谱面 PD ≠ 录音 PD | ⚠️ 不适合直接拿音频 |
| **爱给网 aigei.com** | ❌ 403（curl/PowerShell 均被拦，疑 JS/风控）；浏览器可开 | SERP 显示有「CC配乐 2万首免费商用」「古风点击 免费商用」分区 | 知乎 2024-06：「CC 协议素材库…**不商用就行**」；百家号 2026-07：免费用户**每天 1 首低码率**；版权配乐 99 元/商用 | ⚠️ **半核实**：需浏览器人工登录验证下载与授权书，机器人通道全 403 |
| **淘声网 tosound.com** | ❌ **521**（源站不可用） | — | — | ❌ 排除 |
| **YouTube Audio Library** | ❌ 超时（网络不可达） | — | — | ❌ 排除（还须登录 Google） |
| **freepd.com**（原公版音乐站） | ⚠️ **已永久关站**——页面原文：「After 17 years… **officially taken the service offline**… 2008-2025」 | 曾是 PD 音乐主要来源 | — | ❌ **排除（重要时效信息：别再引用 FreePD）** |
| **pixabay / pexels / chosic / musopen** | ❌ 403 | — | — | ❌ 本机通道不可达 |
| **Wikimedia Commons / archive.org** | ❌ 超时 | 公版古琴/编钟录音多存于此 | — | ❌ 不可达 → **「中国风公版演奏录音」具体可下载链接本次未取到 → 未核实** |
| **映品心（CC0）** | ❌ 检索无此站，疑名称误记 | — | — | ❌ 排除 |

### 3.2 三问直答

**a) 中国风器乐公版或 CC0 具体可下载链接？**
- **直取到的**：mixkit《A Decade in Beijing》直链模式 `https://assets.mixkit.co/music/<id>/<id>.mp3`（实测 200，需从曲目页拿 id）；FMA《Guqin》1 首（需开曲目页核 license）。
- **没取到的**：古琴《流水》、编钟等公版**演奏**录音——存放在 commons.wikimedia.org / archive.org，**本机网络不可达 → 未核实**（编钟/古琴老录音即使 PD，1950-60s 中国录制版本的邻接权也要单独确认，通识风险，未找到裁定来源）。
- **结论**：「中国风公版或 CC0 可下载」这条**目前只成立一半**——通用环境/氛围音源成立，纯正古风器乐仍缺。

**b) 「B 版加轻 BGM」的合规路径（可行版）**
1. **首选（0 成本 0 署名）**：mixkit Stock Music Free License，筛 `traditional/ambient`（如《A Decade in Beijing》），下载留 license 页快照存档。
2. **次选（0 成本，需署名）**：incompetech CC-BY / FMA CC-BY → 简介固定挂一行 `BGM: <曲名> – <作者> (CC BY 4.0)`。
3. **环境层（0 成本）**：freesound CC0 筛选的溪流/风/鸟鸣——**与 T144 的三层音频分层（环境-20dB/动作-12dB/BGM-8dB）直接对口**，即使不敢上旋律，先上环境层就已比现状丰满。
4. **国内站（待人工）**：爱给网 CC 分区——浏览器人工验证「下载→授权范围→能否商用」三件事后再入库；未验证前不进产线。
5. **底线**：不碰 YouTube Audio Library（不可达）、不碰无名聚合站、不引用已关站 FreePD。

**c) 响度标准与混音配方（BGM 底垫）**
- 工具已验证：ffmpeg 9.0.2 含 `loudnorm`（EBU R128）与 `ebur128` 滤镜（官方 filters 文档 8.97/20.10）。
- 推荐两段式（**业界通行做法，非来自单一可引用研究 → 配方本身标未核实，工具与命令可执行性已核实**）：
  1. BGM 先归一：`ffmpeg -i bgm.wav -af loudnorm=I=-24:TP=-2:LRA=11 bgm_norm.wav`（底垫 -24 LUFS，比人声低约 10 dB；若按任务口径要 -20 LUFS 底垫，把 `I=-24` 改 `I=-20`）
  2. 混入后终混：`amix`（BGM 权重 ≈ 0.3）→ `loudnorm=I=-14:TP=-1.5`（短视频平台通行响度，**-14 为目标值业界通识，平台具体规格未核实**）。
- 旁证：T144 摘到的简书分层增益「环境层 -20dB / 动作层 -12dB / 古琴 BGM -8dB」（URL 未固化，未核实）——方向一致：**BGM 低于人声 8-12 dB**。
- 与 T88 裁决的关系：T88「无免费合规音源」**对古风旋律仍成立**（公版录音通道全断），但 **mixkit/FMA/incompetech/freesound 可达性是新增事实**，支持「B 版先加一层轻环境/轻底垫」的小规模试验；**不建议直接推翻保守裁决全面上 BGM**，建议 1 集试点 + license 存档。

---

## Q4 字幕进阶：竖排 / 印章题卡 / 逐字显现（本机实测）

### 4.1 实测结果（ffmpeg 9.0.2 + libass，`_test_trans.py`，21/21 PASS）

| 能力 | 实现 | 结果 | 证据 |
|---|---|---|---|
| **诗句逐字显现** | ASS `{\k40}白`+`{\k40}日`… 每字 0.4s；Style 里 `PrimaryColour=&H00FFFFFF`（显形色）+ `SecondaryColour=&HFFFFFFFF`（alpha=FF 全透明=未显形色） | ✅ PASS | `kara_t0.3.png`＝「白」已显形、其余字仅剩描边；`kara_t1.1.png`＝「白日依」显形；`kara_t1.9.png`＝全显形 |
| **竖排字幕** | 逐字 `\\N` 换行（libass 纯排版，不用旋转） | ✅ PASS | `vert.png`＝五字成一竖列、行楷字形正确（注：ASS 不认 `<br>`，**必须用 `\\N`**——第一次实测就栽在这） |
| **华文行楷字体** | 探测 `C:\Windows\Fonts\STXINGKA.TTF` | ✅ FOUND | 本机已装，karaoke 抽帧里字形即行楷 |
| 印章题卡 | 未实测 | ⚠️ 推断可做 | 两条零成本路：① Pillow 画红底方印（圆角矩形+白/朱文）+ ffmpeg `overlay` 定点贴；② ASS `\pos(x,y)` 红色 Style 事件。篆体字库未必有，**用行楷/楷体红印即可**，成本半天内 |

### 4.2 成本与风险

**接入成本（低）**：`video-compose.py` 第 108 行现硬编码 `subtitles=subs.srt:force_style=...`。改为「后缀是 `.ass` 就走 `subtitles=subs.ass`（样式内嵌于 ASS，不带 force_style），否则维持 SRT 路径」——**约 5 行改动 + 一个 SRT→ASS 生成函数**，估半天。ffmpeg `subtitles` 滤镜同一套 libass，两种后缀都支持（官方 filters 11.248）。

**风险清单**：
1. **未显形字的描边残留**（实测可见）：karaoke 只改填充色，描边仍画 → 暗底上会出现「幽灵字」。解法：描边色改半透明（`&H60000000`）或给未显形字单独压 `alpha`，需在真片上目检一版。
2. **force_style 冲突**：ASS 内嵌样式优先，现有 `DEFAULT_STYLE`（MarginV=90 上移到 69% 高度的平台 UI 规避）**必须写进 ASS 模板**，否则字幕回落贴底被 @账号盖住（T88/产线已踩过的坑会复发）。
3. **失败降级**：现有「字幕烧失败自动降级重试」机制对 ASS 同样生效，风险受控。
4. **竖排行数限制**：竖排 5-7 字一列没问题；长句要断列，与现有「90+行数×15≤288」的排版约束需并表计算。
5. 时间轴：`\\k` 单位是 **1/100 秒**，需从现有配音 delay_ms 换算；逐字显现要与 TTS 逐字时长对齐（配音是整句 wav，**字时长只能均分或按字数估**——精确对齐做不到，标风险）。

**裁决**：竖排题卡 + 逐字显现 **值得做**（全零成本、字体已备、实测通过）；印章做**每集 1 枚的固定题卡章**（Pillow 预生成复用），不逐帧。

---

## Q5 动态增强：补帧值不值 & 25→30fps 感知

### 5.1 产线帧率现状（本地事实）

- `image-to-video` zoompan **默认 `--fps 25`**（SKILL L24）。
- `video-compose` manifest 示例 `"fps": 24`，每镜头 `fps=<fps>` 归一化。
- ⇒ 现状是 **25fps 素材 → 24fps 成片**，两者都**不是**平台主流的 30fps。**这是比补帧更优先要修的一致性问题**（零成本：改两个参数重渲，zoompan 不花视频 token）。

### 5.2 免费 vs 付费补帧

| 方案 | 性质 | 本机可达 | 判断 |
|---|---|---|---|
| **RIFE**（hzwer/ECCV2022-RIFE、Practical-RIFE、Squirrel-RIFE 中文补帧软件） | 开源免费，需 GPU | GitHub 可达（bing 实测返回 github.com/hzwer/ECCV2022-RIFE、Justin62628/Squirrel-RIFE） | ✅ 零成本可用，知乎/CSDN 有中文教程（zhuanlan.zhihu.com/p/565633270 等） |
| ffmpeg `minterpolate` | 免费（运动补偿插帧） | ✅ 本机滤镜存在（filters 列表实测） | ✅ 零成本，CPU 慢、快切镜头有伪影 |
| **Topaz Video AI** | 付费 | topazlabs.com 200 可达；**具体价格页未取到 → 未核实**；汉化破解版在流传（CSDN）→ 盗版不碰 | ❌ 不建议买（见下） |

### 5.3 25fps→30fps 对完播有无感知影响？

- **研究依据：未核实。** 本检索通道（百度/搜狗/退化的 Bing）未取到任何同行评议的帧率-完播率研究；抖音官方也未见公开数据 → **「更高帧率提升完播」标未核实，不做承诺**。
- 可核实的常识级说法（SERP 快照级）：24fps＝电影感、30fps＝网络视频主流（搜狐 2024-12 抖音拍摄技巧）、60fps+ 反而「不自然/肥皂剧效应」（百家号 2025-03、B站科普 2023-09：「24-60 帧内越高越真，超 60 提升不明显」）——**方向：25→30 是「从非主流到主流」，不是「从低到高」的画质跃迁**。
- **对本产线的推断（标未核实）**：内容全是慢运镜/zoompan/每句一镜，单镜 2-4s，**感知差异极小**；真正的收益是**平台编码器对 30fps 更友好、避免 24/25→平台重采样抽帧抖动**。

### 5.4 裁决

1. **先修帧率一致性（零成本，值）**：zoompan `--fps 30` + manifest `"fps": 30` 重渲——0 视频 token、0 新工具。
2. **A 级 t2v 素材**：若模型输出非 30fps，优先 `fps=30` 滤镜归一（丢/补帧法，video-compose 第 1 步本来就会做）；**上 RIFE/minterpolate 属可选精修**，先不做。
3. **RIFE（免费）**：仅当抽检发现 t2v 快切镜头卡顿时再启用，1 集试点。
4. **Topaz（付费）**：❌ **不值**——我们最清晰的镜头（静态特写/诗字卡）走生图+zoompan 无补帧需求，运动镜头短且被运动掩盖（T88 Q1 结论），花付费软件钱解决不了 480p 的软化问题；且价格未核实。

---

## 分栏清单

### ✅ 零成本可落地（按性价比排序）

| # | 项 | 落地动作 | 依据 |
|---|---|---|---|
| 1 | 帧率统一 30fps | `image-to-video --fps 30` + manifest `fps:30` | 本机事实；0 token |
| 2 | xfade 转场（段落间） | video-compose 加逐对 xfade，先只用于题卡↔正文 | 官方文档 + 本机 4/4 实测 |
| 3 | 墨滴晕开转场 | PIL 遮罩生成器（~15 行）+ alphamerge | 本机实测 PASS + 抽帧证据 |
| 4 | 诗句逐字显现 | ASS `\k` + 透明 SecondaryColour；改 video-compose ~5 行 | 本机实测 PASS + 3 帧证据 |
| 5 | 竖排题卡 | ASS 逐字 `\\N` | 本机实测 PASS |
| 6 | 固定印章题卡 | Pillow 预生成红印 PNG，overlay 定点贴 | 工具已装；未实测 |
| 7 | 环境层音 | freesound CC0 溪流/风/鸟鸣垫底（-20dB 层） | 站点 200 可达 |
| 8 | 轻 BGM 试点 1 集 | mixkit Free License（如《A Decade in Beijing》）+ loudnorm -24→-14 | 直链 mp3 实测 200 |
| 9 | 彩水墨特别篇 prompt | 风格段+色板两变量替换，骨架不动 | SERP 实证 + 设计推理 |

### 💰 付费值得

| # | 项 | 判断 |
|---|---|---|
| 1 | Topaz Video AI 补帧/增强 | ❌ **不值**（静态镜头无需求、运动镜头被掩盖、价格未核实） |
| 2 | 爱给网 99 元商用授权 | ⏸ 若人工验证 CC 区不够用再考虑；先完成浏览器人工验证 |
| 3 | 环境音效/古风 BGM 曲库商用授权 | ⏸ 等 mixkit/FMA 筛出的曲目不够「古风味」时再评估，别先花钱 |

### ❌ 明确排除

1. YouTube Audio Library（网络不可达）、淘声网（521）、FreePD（已永久关站）、映品心（疑误记）、pixabay/pexels/musopen/commons/archive.org（403/超时）。
2. 汉化破解版 Topaz。
3. 书法笔画逐帧入画转场（工作量不成比例）。
4. 「更高帧率提升完播」——**无研究依据，标未核实，不写进增长假设**。

---

## 附：未核实项清单

- 搜狐《长安的荔枝》彩水墨原文 URL、网易《古画五音疗愈》URL、美篇岩彩、腾讯云岩彩 prompt、php.cn 国风 prompt——**均仅 SERP 快照，URL 未固化或截断，标未核实/半核实**。
- mixkit Free License **逐条条款**（只核到 license 分类页）；FMA《Guqin》曲目页具体 license；incompetech 曲库中国风清单。
- 爱给网 CC 分区下载与商用条款（403，需浏览器人工）。
- 古琴/编钟公版**演奏录音**可下载链接（源站全不可达）。
- 帧率↔完播率研究（通道内无任何可引研究）；-14 LUFS 平台目标值（业界通识，未取平台官方规格）。
- `xfade=horzopen/squeezeh` 卷轴展开（官方列表有、未逐项实测）；印章题卡（未实测）。
