#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""media-verify — 媒体核验三原子件：astats 窗口能量 / 音频版本 NCC 比对 / 亮度白屏。

  astats    成片分窗 RMS（配音段应 -18~-24dB，静默段应 -inf；input-seek 生效才可信）
  audio-ncc 成片某时刻音频 vs 参考 wav 的归一化互相关（corr≈1=同版，0.3~0.75=不同版）
  brightness 抽帧平均亮度（白屏/黑屏/Read 错图替代法）

坑位内置：ffmpeg -ss 必须放 -i 之前（本机 -ss 在后会被静默忽略）；
Read 工具会话级错图 bug → 视觉核验走本命令/亮度法，不靠 Read。
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import wave

import numpy as np

FALLBACK_FFMPEG = [
    r"<本机会话产物路径>",
]


def find_ffmpeg():
    p = os.environ.get("FFMPEG")
    if p and os.path.exists(p):
        return p
    w = shutil.which("ffmpeg")
    if w:
        return w
    for c in FALLBACK_FFMPEG:
        if os.path.exists(c):
            return c
    sys.exit("ffmpeg 未找到：设置环境变量 FFMPEG=<路径>")


def ffprobe_exe(ff):
    cand = os.path.join(os.path.dirname(ff), "ffprobe.exe")
    return cand if os.path.exists(cand) else None


def sh(cmd):
    return subprocess.run(cmd, capture_output=True, text=True,
                          encoding="utf-8", errors="replace")


def media_duration(ff, path):
    fp = ffprobe_exe(ff)
    if fp:
        r = sh([fp, "-v", "error", "-show_entries", "format=duration",
                "-of", "json", path])
        try:
            return float(json.loads(r.stdout)["format"]["duration"])
        except Exception:
            pass
    # ffprobe 缺失 → 解析 ffmpeg -i 的 Duration 行
    r = sh([ff, "-i", path])
    m = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.?\d*)",
                  (r.stderr or "") + (r.stdout or ""))
    if m:
        h, mn, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
        return h * 3600 + mn * 60 + s
    return None


def load_wav16k(path, ff, tag, tmpdir):
    """任意音频 → 16k mono wav（独立输出名防覆盖），返回 float32 数组。"""
    out = os.path.join(tmpdir, f"norm-{tag}.wav")
    r = sh([ff, "-y", "-i", path, "-ac", "1", "-ar", "16000", out])
    if r.returncode != 0:
        sys.exit("音频转换失败: " + (r.stderr or "")[-500:])
    with wave.open(out) as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return data.astype(np.float32) / 32768.0


def cmd_astats(a):
    ff = find_ffmpeg()
    rows = []
    for w in a.window:
        name, s, e = w.rsplit(":", 2)
        start, end = float(s), float(e)
        dur = end - start
        r = sh([ff, "-ss", str(start), "-t", str(dur), "-i", a.mp4,
                "-map", "a", "-af", "astats=metadata=1", "-f", "null", "-"])
        hits = re.findall(r"RMS level dB:\s*(-?inf|-?[\d.]+)", (r.stderr or "") + (r.stdout or ""))
        if not hits:
            rows.append((name, start, end, "NO-DATA"))
        else:
            rows.append((name, start, end, hits[-1]))
    print(f"{'window':<12} {'range':<16} {'RMS dB':>10}   期望(配音≈-18~-24 / 静默=-inf)")
    for name, s, e, v in rows:
        print(f"{name:<12} {s:>5.1f}-{e:<8.1f} {v:>10}")
    return 0


def ncc(x, y):
    x0 = x - x.mean()
    y0 = y - y.mean()
    return float(np.dot(x0, y0) / (np.linalg.norm(x0) * np.linalg.norm(y0) + 1e-9))


def cmd_audio_ncc(a):
    ff = find_ffmpeg()
    with tempfile.TemporaryDirectory() as td:
        seg = os.path.join(td, "seg.wav")
        r = sh([ff, "-y", "-ss", str(a.at), "-t", str(a.len), "-i", a.mp4,
                "-vn", "-ac", "1", "-ar", "16000", seg])  # input-seek
        if r.returncode != 0:
            sys.exit("抽段失败: " + (r.stderr or "")[-500:])
        seg_x = load_wav16k(seg, ff, "seg", td)   # 已是16k，再转一次仅统一样本
        ref_x = load_wav16k(a.ref, ff, "ref", td)
    results = []
    if a.window:
        for w in a.window:
            s, e = w.split(":")
            i0, i1 = int(float(s) * 16000), int(float(e) * 16000)
            part = seg_x[i0:i1]
            m = min(len(part), len(ref_x))
            results.append((f"{s}-{e}s", ncc(part[:m], ref_x[:m])))
    else:
        # 粗步进找峰 → 邻域细扫（语音 NCC 峰很尖，单一步长会跳过峰）
        L = len(ref_x)
        if len(seg_x) < L:
            results.append(("whole", ncc(seg_x, ref_x[:len(seg_x)])))
        else:
            ref0 = ref_x - ref_x.mean()
            rn = np.linalg.norm(ref0) + 1e-9
            best = (-2.0, 0)
            for i in range(0, len(seg_x) - L, 1280):
                w = seg_x[i:i + L]
                c = float(np.dot(w - w.mean(), ref0) / (np.linalg.norm(w - w.mean()) * rn + 1e-9))
                if c > best[0]:
                    best = (c, i)
            lo = max(best[1] - 1280, 0)
            hi = min(best[1] + 1280, len(seg_x) - L)
            for i in range(lo, hi + 1, 16):
                c = ncc(seg_x[i:i + L], ref_x)
                if c > best[0]:
                    best = (c, i)
            for i in range(max(best[1] - 16, 0), min(best[1] + 16, hi) + 1):
                c = ncc(seg_x[i:i + L], ref_x)
                if c > best[0]:
                    best = (c, i)
            results.append((f"best@{best[1]/16000:.2f}s", best[0]))
    for label, c in results:
        verdict = ("同版(NEW-OK)" if c >= 0.9 else
                   "疑似不同版" if c >= 0.3 else "确定不同版")
        print(f"{label:<14} NCC={c:.3f}  → {verdict}")
    return 0


def cmd_brightness(a):
    ff = find_ffmpeg()
    dur = media_duration(ff, a.mp4) or 0
    if dur <= 0:
        sys.exit("取不到时长（ffprobe 缺失？）")
    from PIL import Image
    vals = []
    with tempfile.TemporaryDirectory() as td:
        for i in range(a.frames):
            t = dur * (i + 0.5) / a.frames
            p = os.path.join(td, f"f{i}.png")
            r = sh([ff, "-y", "-ss", str(t), "-i", a.mp4, "-frames:v", "1", p])  # input-seek
            if r.returncode != 0 or not os.path.exists(p):
                vals.append((t, None))
                continue
            im = Image.open(p).convert("L")
            vals.append((t, float(np.mean(np.asarray(im, dtype=np.float32)))))
    ok = True
    for t, v in vals:
        if v is None:
            print(f"t={t:6.2f}s  EXTRACT-FAIL")
            ok = False
            continue
        flag = ""
        if v >= 250:
            flag = "  ⚠ 疑似白屏"
            ok = False
        elif v <= 5:
            flag = "  ⚠ 疑似黑屏"
            ok = False
        print(f"t={t:6.2f}s  meanL={v:6.1f}{flag}")
    print("PASS" if ok else "FAIL")
    return 0 if ok else 2


def main():
    ap = argparse.ArgumentParser(description="媒体核验（astats / audio-ncc / brightness）")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p1 = sub.add_parser("astats", help="分窗 RMS 能量")
    p1.add_argument("mp4")
    p1.add_argument("-w", "--window", action="append", required=True,
                    metavar="NAME:START:END", help="可多次，如 speech1:5.5:7.9")
    p1.set_defaults(func=cmd_astats)

    p2 = sub.add_parser("audio-ncc", help="音频版本比对（vs 参考 wav）")
    p2.add_argument("mp4")
    p2.add_argument("--ref", required=True, help="参考 wav（如新 TTS 源文件）")
    p2.add_argument("--at", type=float, required=True, help="成片中起始秒")
    p2.add_argument("--len", type=float, default=8.0, help="取段秒数")
    p2.add_argument("--window", action="append", metavar="START:END",
                    help="段内相对窗口（缺省=整段滑窗找峰）")
    p2.set_defaults(func=cmd_audio_ncc)

    p3 = sub.add_parser("brightness", help="抽帧亮度/白屏检测")
    p3.add_argument("mp4")
    p3.add_argument("--frames", type=int, default=5)
    p3.set_defaults(func=cmd_brightness)

    a = ap.parse_args()
    sys.exit(a.func(a))


if __name__ == "__main__":
    main()
