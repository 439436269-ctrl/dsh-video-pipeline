---
name: video-cover
description: 视频封面生成原子能力：底图关键帧 + 系列角标 + 标题 + 诗行/文案行，一次输出 B站 16:10（1146x717）与竖版（1080x1920）双平台封面 PNG。当需要给成片做 B 站封面、竖版封面、小红书/抖音封面、或从关键帧出带字幕面板的封面时使用。Use when generating Bilibili 16:10 and vertical video covers from a keyframe with series badge, title and poem lines.
---

# video-cover — 底图 → 双平台封面（原子）

> ✅ 状态：本机实测通过（2026-09-30，frame-B 底图 → 1146×717 + 1080×1920 双图）

**原子边界**：一张底图进 → 两张封面出。关键帧从成片抽（`media-verify`/ffmpeg）或直接用生成的图；文案由编排层给。

## 用法

```bash
python scripts/make_cover.py --bg frame.png --out-dir . --prefix EP11A \
  --series "《一首诗一出戏》 EP11 读诗版" \
  --title "早发白帝城 · 读诗版" \
  --line "朝辞白帝彩云间，" --line "千里江陵一日还。" \
  --line "两岸猿声啼不住，" --line "轻舟已过万重山。"
```

| 参数 | 说明 |
|---|---|
| `--bg` | 底图（关键帧 png/jpg） |
| `--prefix` | 输出前缀 → `<prefix>-bili-cover.png` / `<prefix>-mobile-cover.png` |
| `--series` | 左上角系列徽标 |
| `--title` | 面板标题行 |
| `--line` | 文案行，可多次；或 `--lines-file`（UTF-8 每行一条） |
| `--only` | `both`（默认）/ `bili` / `mobile` |

## 输出规格

- **B站 16:10**：底图按比例**居中横裁** → 1146×717；底部半透明诗文面板（每行 54px），行数自适应面板高度
- **竖版**：底图拉伸 1080×1920；1430 起半透明面板放标题+诗行；左上角系列徽标
- 字体：`msyhbd.ttc`（雅黑粗）→ `msyh.ttc` → `simhei.ttf` 逐级回退；文字白色+3px 黑描边

## 惯例（唐诗项目）

- 底图 = 成片里无字幕的干净帧（frame-A/frame-B.png，取帧避开字幕窗口）
- 诗行用**原文**（读音校正是 TTS 的事，封面永远原文）
- `--prefix` 与成片命名对齐（EPxxA / EPxxB）
- **四平台分发（2026-09-30 起）**：bili 封面给 `biliup --cover`；**mobile 封面是小红书/抖音/视频号三家的统一竖版封面**（上传接入见各平台 skill §自定义封面）——不再用平台自动抽帧，否则封面没有诗标题
