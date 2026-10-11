---
name: chinese-tts
description: 中文配音 TTS 读音校正与配音规范（原子）：多音字同音字替换表（朝zhāo/还huán/重chóng/骑jì/教jiào/载zǎi等）、pinyin_fix 的 fix/check/pinyin 三模式（pinyin=逐字拼音校准：整句语境读音+多音字⚠裁决）、TTS 安全文本产出、茉莉/冰糖/白桦/苏打音色与题卡/逐句/尾钩/点诗/旁白 context 模板。当给古诗文或中文旁白做 TTS 配音、纠多音字读音、逐字校验拼音、确认某个字怎么念、或准备 tts_speech 调用参数时使用。Use when generating Chinese TTS voiceovers with per-character pinyin verification and proven voice/context templates.
---

# chinese-tts — 中文 TTS 读音校正与配音规范（原子）

> ✅ 状态：本机实测通过（2026-09-30 EP11 三组用例 + NCC 换血验证；2026-10-01 EP13 逐字校准首跑：抓出载 zài、空余 kòng 两处，千宰/崆余修复后重发）

**原子边界**：文本进 → TTS 安全文本出 + 调用参数（音色/context）。实际发声：**首选桌面 `tts_speech` 工具**，其 403 membership_required 时**备用通道 = `scripts/mimo_tts.py`（MiMo API key 直调，2026-10-01 打通，EP16 起在用）**；测长、合成归 `video-compose`。

## 备用 TTS 通道（mimo_tts.py，桌面工具 403 时用）

```bash
python scripts/mimo_tts.py --text "安全文本" --out voA1.wav \
  --voice 茉莉 --context "与节目报幕完全相同的正常语速…"
```

- 端点：`POST api.xiaomimimo.com/v1/chat/completions`，`model=mimo-v2.5-tts`，`modalities=["audio","text"]`，`audio.format=wav`
- **messages 必须含 assistant 角色**（放朗读文本）；`voice=茉莉/冰糖/白桦/苏打` **实测生效**（茉莉 vs 冰糖 corr=0.009）
- **流畅性指令（2026-10-01 用户 A/B 选定，EP17 起用）**：直搬桌面 context 会发闷（EP16 教训，用户评为「没 EP15 流畅」）——context 必须显式带流畅约束：
  - 诗句段/句：`茉莉音色，把这几（两）句诗像日常说话一样一气呵成地读出来，流畅连贯不停顿，中等偏快语速，干净利落不拖音不朗诵`
  - 题卡/尾钩/点诗等在其基础上加场景词（报幕/收尾/深情吟诵），保留「一气呵成、流畅连贯」核心
  - **结构配合**：A 版多句成段连读（双句/三句一档），避免一句一断的短槽（EP16 逐句短槽是发闷次因）
- key 自动读 `~/.config/mimocode/mimocode.jsonc` 的 `providers.xiaomi.options.apiKey`（或 env `MIMO_API_KEY`）
- 返回 base64 WAV(24kHz) 落盘；EP16 十三条实测全过；**桌面 tts_speech 恢复后优先桌面**（流畅度更佳）

## 为什么需要它（EP11 教训）

TTS 默认按语言模型概率念多音字：`朝辞白帝彩云间` 被念成 **cháo**（应为 zhāo）。**context 风格指令纠不了读音**。可靠做法 = 输入文本同音字替换（招/环/虫…），发音必然正确；**字幕/SRT 一律保留原字**。

## 工作流

```bash
# 1) 读音校正（fix = 输出安全文本；check = 只诊断；pinyin = 逐字全量校验）
python scripts/pinyin_fix.py fix  --text "朝辞白帝彩云间，千里江陵一日还。"
python scripts/pinyin_fix.py check --file 剧本文本.txt --json
# 2) 逐字校验：整句语境读音 + 每个多音字标 ⚠（含 RISK 提示），逐⚠人工裁决后才进 TTS
python scripts/pinyin_fix.py pinyin --file 全部台词.txt   # 依赖 pypinyin（pip install pypinyin）
# 3) 用输出文本调 tts_speech，音色+context 见下表
# 4) 测长 → video-compose 排时间轴
```

- `fix` 输出到 stdout；applied/warnings 走 stderr（`--json` 合并输出）
- **WARN = 表未覆盖的高危字**，只提示不擅改——人工确认后加 `--table extra.json` 规则
- 追加规则格式：`[{"phrase": "将进酒", "repl": "...", "pinyin": "...", "why": "..."}]`
- **裁决输出表**：每个 ⚠ 三选一记录——①同音替换保障 ②人工判定 TTS 大概率正确（写依据）③修复（改词或重录）；审计存档进 EP 目录（如 `EPxx-逐字读音校验.txt`）

## 内置替换表（节选，完整见 scripts/pinyin_fix.py）

| 原文 | 安全文本 | 读音 | 出处 |
|---|---|---|---|
| 朝辞 | 招辞 | zhāo cí | 早发白帝城 |
| 一日还 | 一日环 | huán | 早发白帝城 |
| 还给 | 环给 | huán gěi | 归还义 |
| 万重山 | 万虫山 | chóng shān | 早发白帝城 |
| 一骑 | 一计 | yī jì | 过华清宫 |
| 悔教 | 悔叫 | jiào | 闺怨 |
| 少小 | 哨小 | shào | 回乡偶书 |
| 石径斜 | 石径瑕 | xiá | 山行（古音） |
| 见牛羊 | 现牛羊 | xiàn | 敕勒歌 |
| 千载 | 千宰 | zǎi | 黄鹤楼（**禁换词成「千年」**，会丢 zǎi） |
| 空余 | 崆余 | kōng | 黄鹤楼（语境引擎误判 kòng） |
| 燕山 | 烟山 | yān | 马诗 |
| 单于 / 可汗 | 缠于 / 克寒 | chán yú / kè hán | 称谓 |

## 音色（tts_speech voice= {"mode":"preset","name":...}）

| 音色 | 用途 |
|---|---|
| 茉莉 | 女声旁白/逐句跟读/点诗/尾钩（系列默认） |
| 冰糖 | 活泼女声（少女角色） |
| 苏打 | 阳光男声 |
| 白桦 | 沉稳男声（船夫/男角色） |

## context 模板（唐诗项目实测原文）

| 场景 | context |
|---|---|
| 题卡报幕 | 诗题报幕，中速偏快，自然流畅，干净利落，不拖音 |
| 逐句跟读 | 与节目报幕完全相同的正常语速，像日常自然把这句诗读出来，干净利落，不要朗诵腔，不要拖长尾音，不要字与字之间停顿 |
| 尾钩 | 节目收尾预告，中速明快亲切，不拖沓 |
| 点诗（全诗） | 深情吟诵全诗四句，中速不拖沓 |
| 故事旁白 | 叙事旁白，自然中速（可加：意气飞扬/豪迈转深沉/讽刺意味内敛…） |
| 悬念钩子 | 短视频悬念钩子，语速偏快，命运感 |

## 铁律

1. **同音替换铁律（2026-10-01 用户纠正后立）**：替换必须**听感与正确读音完全一致**——只许同音字（招/环/虫/宰/崆…），**禁止语义换词**（反例：千载→千年 把 zǎi 读丢了、室中更无→再无 读音变了；正例：千载→千宰 qiān zǎi、空余→崆余 kōng yú）。字幕/SRT 永远用原文
2. **发布前跑一遍 `check` + `pinyin` 逐字校验**，每个 ⚠ 有裁决记录（quad-platform-publish §发布前读音核查 指向这里）
3. 已发内容发现错读 → 平台替换/删旧重发（B站换视频用 `ep11-rep7-intercept.mjs`）
