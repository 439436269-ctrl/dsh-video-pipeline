---
name: video-compose
description: 成片合成原子能力：镜头 mp4 列表 + 配音 wav 时间轴（delay_ms）+ SRT 字幕，一条 manifest JSON 合成一条竖屏成片（归一化拼接、adelay/amix 混音、烧字幕、+faststart，字幕失败自动降级重试）。当需要把分镜镜头和配音合成最终视频、批量出片流水线的合成步骤、或替换 build_epxx 类手工脚本时使用。Use when composing final videos from shot clips, voiceover wavs and subtitles via a manifest.
---

# video-compose — 分镜+配音+SRT → 成片（原子）

> ✅ 状态：本机实测通过（2026-09-30，EP11A 全量 manifest 复现，输出 14,129,752 B 与官方成片逐字节同大小）

**原子边界**：manifest 进、一条成片出。manifest 由编排层生成（时间轴规划是编排的事）；镜头从哪来（`image-to-video` / `ark-seedance-video`）不归本 skill 管。

## 用法

```bash
python scripts/video-compose.py <manifest.json> [--keep-build]
```

## manifest 格式

```json
{
  "out": "EPxxA-成片.mp4",
  "total": 32,
  "fps": 24,
  "shots":  [{"file": "v1.mp4"}, {"file": "v2.mp4"}],
  "audio":  [{"file": "vo0.wav", "delay_ms": 0},
             {"file": "vo1.wav", "delay_ms": 5500}],
  "subtitles": "subs.srt",
  "style": "FontName=Microsoft YaHei,FontSize=10,..." 
}
```

- 路径（相对/绝对）以 **manifest 所在目录** 为基准解析
- `audio` 可 `[]`（纯画面）；`subtitles`/`style` 可省略（style 用内置竖屏样式 `FontSize=10, Outline=1.5, MarginV=90`——**2026-10-01 用户指定上移**：文字块底边落在 ~69% 高度、底部留 1/3 避开平台 UI 遮挡，参考抖音截图位置；旧 MarginV=14 贴底会被 @账号/描述区盖住；横版 18/20 会溢出裁切，已踩坑。全诗字卡行数多时注意：90+行数×15 ≤ 288（超出改 MarginV=60 或 FontSize=9）
- `total` 是 `-t` 硬截断，务必 ≥ 最后一条配音结束时刻

## 行为（与唐诗 build_epxx 逐参数一致）

1. 每个镜头归一化：`scale=720:1280:flags=lanczos,fps=<fps>,format=yuv420p` + libx264 crf18 无音轨
2. concat demuxer 顺序拼接
3. 配音拷入构建目录（规避中文/空格路径），逐路 `adelay=...:all=1` → `amix normalize=0 duration=longest apad`
4. `subtitles=subs.srt:force_style=...` 烧字幕；**失败自动降级为无字幕重试**
5. `-c:a aac 128k -movflags +faststart` → 拷到 `out`，清理 `<out>.build`（`--keep-build` 保留）

## 验收建议

合成后跑 skill `media-verify`：`astats` 核对配音窗/静默窗、`brightness` 防白屏。
