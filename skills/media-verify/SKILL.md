---
name: media-verify
description: 视频/音频核验原子件三合一：astats 分窗 RMS 能量核验（配音/静默窗对位）、audio-ncc 线上音频与参考 wav 的版本比对（判新旧读音/错版）、brightness 抽帧亮度白屏黑屏检测。当需要验收成片音频对位、核对平台上的视频是不是本版文件、防白屏、或替代会错图的 Read 工具做视觉核验时使用。Use when verifying video audio windows, comparing published audio against reference wavs, or detecting blank frames.
---

# media-verify — 媒体核验（原子三件）

> ✅ 状态：本机实测通过（2026-09-30，EP11A：astats 配音窗/静默窗正确、新音频 NCC=1.000 / 旧音频 0.065、亮度 PASS）

**原子边界**：只读核验，不改任何文件。发布前验收、发布后线上复核都用它；剪辑合成归 `video-compose`。

## 1) astats — 分窗能量（音频对位）

```bash
python scripts/media_verify.py astats video.mp4 \
  -w speech1:5.6:7.8 -w gap1:8.6:10.3 -w speech4:20.6:23.3
```

- 期望：配音窗 **-18 ~ -24 dB**；静默窗 **-inf**；窗内无数据=NO-DATA
- 铁律：`-ss` 已内置在 `-i` **之前**（本机 ffmpeg 把 -ss 放后面会被静默忽略，读数=没 seek，曾推翻过旧结论）

## 2) audio-ncc — 音频版本比对（新旧读音/错版判定）

```bash
python scripts/media_verify.py audio-ncc video.mp4 --ref new-tts.wav --at 5.4 --len 3
# 可选：--window 0:2.4 只比段内窗口
```

- **粗步进 80ms 找峰 → ±80ms 细扫（步16）→ ±16 微调（步1）**——语音 NCC 峰很尖，单一步长会跳过峰（踩过：真峰 lag=1600 不在 1280 步长格点上，读数 0.067 假阴性）
- 判读：**≥0.9 同版**；0.3~0.75 疑似不同版（同词不同合成）；<0.3 确定不同版
- 参考 wav 可为任意采样率（内部统一转 16k mono）；平台侧复核 = 先把线上视频 DASH/下载到本地再比
- 案例：EP11 读音修复后，线上成片 vs 新 TTS=1.000、vs 旧 TTS=0.065 → 证实四平台换血成功

## 3) brightness — 抽帧亮度（白屏/黑屏）

```bash
python scripts/media_verify.py brightness video.mp4 --frames 5
```

- 均匀抽 N 帧取 meanL；**≥250 白屏 / ≤5 黑屏 → FAIL（exit 2）**
- 时长取法：ffprobe → 缺失时解析 `ffmpeg -i` 的 Duration 行（本机 ffprobe 不在）
- **Read 工具会话级错图 bug 的替代法**：视觉核验先跑本命令 + `Get-FileHash`，别拿 Read 下结论

## 依赖

numpy + Pillow；ffmpeg 定位：`FFMPEG` 环境变量 → PATH → 项目内置路径。
