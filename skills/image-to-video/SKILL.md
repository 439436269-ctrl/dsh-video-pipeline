---
name: image-to-video
description: 图片转视频原子能力：单张图片用 ffmpeg zoompan 生成竖屏 720x1280 运镜镜头 mp4（缓推/缓拉、可调秒数/帧率/变焦幅度），批量由外层循环调用。当需要把关键帧/场景图变成动态镜头、做图片运镜、ken-burns 效果、或成片流水线要出镜头素材时使用。Use when converting a still image into a vertical zoompan video clip with ffmpeg.
---

# image-to-video — 图片 → 运镜镜头（原子）

> ✅ 状态：本机实测通过（2026-09-30，frame-A.png → 2s@25fps 竖屏镜头）

**原子边界**：一图进、一条 mp4 出。批量/时间轴/成片合成属于编排层（外层 for 循环调用本命令即可）；成片合成走 skill `video-compose`。

## 用法

```bash
python scripts/image2video.py --in scene.png --out shot1.mp4 --seconds 3.5 [--dir in] [--fps 25]
```

| 参数 | 默认 | 说明 |
|---|---|---|
| `--in` | 必填 | 输入图片（png/jpg） |
| `--out` | 必填 | 输出 mp4 |
| `--seconds` | 必填 | 镜头时长 |
| `--dir` | `in` | `in`=缓推（1→1.10）、`out`=缓拉（1.10→1） |
| `--fps` | 25 | 帧率 |
| `--zoom` | 0.10 | 总变焦幅度 |
| `--width/--height` | 720x1280 | 输出尺寸（竖屏短剧标准） |

## 行为（与唐诗项目 build_read_batch.py 逐参数一致）

1. 图片放大到 2x（1440x2560）bicubic
2. `zoompan`：`z=1+0.10*on/N`（推）或 `1.10-0.10*on/N`（拉），x/y 居中，`d=N` 帧
3. 缩回 720x1280 lanczos + `format=yuv420p`，libx264 crf18 无音频
4. 交替方向由外层传 `--dir` 控制（题卡推、尾镜拉是项目惯例）

## ffmpeg 定位

依次找：环境变量 `FFMPEG` → PATH → 项目内置 `…\<本地密钥目录>\ai\.tools\ffmpeg\ffmpeg.exe`。

## 不做的事

- 不做多图批量（外层循环）；不做拼接/配音/字幕（`video-compose`）；不生成图（`ark-agent-plan-image` / `image_gen`）；t2v 直出视频用 `ark-seedance-video`。
