#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""image2video — 单张图片 → 竖屏运镜镜头 mp4（原子：一图一条，批量由外层循环）。

源自 tangshi-pipeline build_read_batch.py 的 zoompan 段，行为一致：
1440x2560 渲染 → zoompan 0.10 缓推/缓拉 → 720x1280 lanczos → yuv420p。
"""
import argparse
import os
import shutil
import subprocess
import sys

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
    return None


def main():
    ap = argparse.ArgumentParser(description="图片 → 竖屏 zoompan 镜头")
    ap.add_argument("--in", dest="src", required=True, help="输入图片")
    ap.add_argument("--out", required=True, help="输出 mp4")
    ap.add_argument("--seconds", type=float, required=True, help="镜头秒数")
    ap.add_argument("--dir", choices=["in", "out"], default="in",
                    help="运镜方向：in=缓推(默认) / out=缓拉")
    ap.add_argument("--fps", type=int, default=25)
    ap.add_argument("--width", type=int, default=720)
    ap.add_argument("--height", type=int, default=1280)
    ap.add_argument("--zoom", type=float, default=0.10, help="总变焦幅度")
    ap.add_argument("--crf", type=int, default=18)
    a = ap.parse_args()

    ff = find_ffmpeg()
    if not ff:
        sys.exit("ffmpeg 未找到：设置环境变量 FFMPEG=<路径>")
    if not os.path.exists(a.src):
        sys.exit(f"输入图片不存在: {a.src}")

    nn = max(int(round(a.seconds * a.fps)), 1)
    mid_w, mid_h = a.width * 2, a.height * 2
    if a.dir == "in":
        z = f"1+{a.zoom}*on/{nn}"
    else:
        z = f"{1 + a.zoom}-{a.zoom}*on/{nn}"
    vf = (
        f"scale={mid_w}:{mid_h}:flags=bicubic,"
        f"zoompan=z='{z}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':"
        f"d={nn}:s={mid_w}x{mid_h}:fps={a.fps},"
        f"scale={a.width}:{a.height}:flags=lanczos,format=yuv420p"
    )
    cmd = [ff, "-y", "-i", a.src, "-vf", vf, "-frames:v", str(nn),
           "-c:v", "libx264", "-preset", "veryfast", "-crf", str(a.crf),
           "-an", a.out]
    r = subprocess.run(cmd, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if r.returncode != 0 or not os.path.exists(a.out):
        sys.exit("ffmpeg 失败:\n" + (r.stderr or "")[-2000:])
    print(f"OK {a.out} {os.path.getsize(a.out)}B ({a.seconds}s@{a.fps}fps, {a.dir})")


if __name__ == "__main__":
    main()
