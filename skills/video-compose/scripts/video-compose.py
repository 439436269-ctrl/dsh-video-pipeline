#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""video-compose — 镜头 mp4 列表 + 配音 wav 时间轴 + SRT → 成片（原子合成一条）。

输入 = 一个 manifest JSON（编排层负责生成 manifest；本脚本只做合成）：
{
  "out": "EPxxA-成片.mp4",
  "total": 32,                    // 成片总秒数（-t）
  "fps": 24,
  "shots":  [{"file": "v1.mp4"}, {"file": "v2.mp4"}],      // 顺序即拼接顺序
  "audio":  [{"file": "vo0.wav", "delay_ms": 0}, ...],      // 可为 []
  "subtitles": "subs.srt",        // 可省略
  "style": "FontName=..."         // 可省略（用内置竖屏样式）
}
行为源自 build_ep11a/build_read_batch 的成熟路径：归一化 → concat →
adelay/amix 混音 → 烧字幕 → -movflags +faststart；烧字幕失败自动降级重试。
"""
import argparse
import json
import os
import shutil
import subprocess
import sys

DEFAULT_STYLE = ("FontName=Microsoft YaHei,FontSize=10,PrimaryColour=&H00FFFFFF,"
                 "OutlineColour=&H00000000,BorderStyle=1,Outline=1.5,MarginV=90")
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


def run(cmd, cwd):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    if r.returncode != 0:
        print((r.stderr or "")[-2500:])
    return r.returncode == 0


def main():
    ap = argparse.ArgumentParser(description="manifest → 成片")
    ap.add_argument("manifest", help="manifest JSON 路径")
    ap.add_argument("--keep-build", action="store_true", help="保留中间目录")
    a = ap.parse_args()

    ff = find_ffmpeg()
    if not ff:
        sys.exit("ffmpeg 未找到：设置环境变量 FFMPEG=<路径>")
    with open(a.manifest, encoding="utf-8") as f:
        m = json.load(f)
    shots = m["shots"]
    audio = m.get("audio") or []
    total = float(m["total"])
    fps = int(m.get("fps") or 24)
    out = os.path.abspath(m["out"])
    base = os.path.dirname(os.path.abspath(a.manifest))
    # 路径解析：shots/audio/subtitles 相对 manifest 所在目录
    def res(p):
        return p if os.path.isabs(p) else os.path.join(base, p)

    bdir = out + ".build"
    if os.path.isdir(bdir):
        shutil.rmtree(bdir)
    os.makedirs(bdir)

    # 1) 归一化 + 拼接
    paths = []
    for i, s in enumerate(shots):
        src = res(s["file"])
        if not os.path.exists(src):
            sys.exit(f"镜头不存在: {src}")
        shot = os.path.join(bdir, f"shot{i:02d}.mp4")
        vf = f"scale=720:1280:flags=lanczos,fps={fps},format=yuv420p"
        if not run([ff, "-y", "-i", src, "-vf", vf, "-c:v", "libx264",
                    "-preset", "veryfast", "-crf", "18", "-an", shot], bdir):
            sys.exit("归一化失败")
        paths.append(shot)
    with open(os.path.join(bdir, "shots.txt"), "w", encoding="utf-8") as f:
        for p in paths:
            f.write(f"file '{os.path.basename(p)}'\n")

    # 2) 拷贝配音与字幕（相对路径规避中文/空格问题）
    subs_src = m.get("subtitles")
    if subs_src:
        shutil.copyfile(res(subs_src), os.path.join(bdir, "subs.srt"))
    for i, au in enumerate(audio, 1):
        shutil.copyfile(res(au["file"]), os.path.join(bdir, f"vo{i}.wav"))

    # 3) 组装 filter
    n = len(audio)
    parts, mixes = [], []
    for i, au in enumerate(audio, 1):
        parts.append(f"[{i}:a]adelay={int(au['delay_ms'])}:all=1[a{i}]")
        mixes.append(f"[a{i}]")
    vf = f"subtitles=subs.srt:force_style='{m.get('style') or DEFAULT_STYLE}'"

    def build(with_subs, dest):
        cmd = [ff, "-y", "-f", "concat", "-safe", "0", "-i", "shots.txt"]
        for i in range(1, n + 1):
            cmd += ["-i", f"vo{i}.wav"]
        cmd += ["-map", "0:v"]
        if n:
            parts_all = parts + [
                "".join(mixes) + f"amix=inputs={n}:normalize=0:duration=longest,apad[out]"]
            cmd += ["-filter_complex", ";".join(parts_all), "-map", "[out]"]
        cmd += ["-vf", vf if with_subs else "null",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "20"]
        if n:
            cmd += ["-c:a", "aac", "-b:a", "128k"]
        cmd += ["-t", str(total), "-movflags", "+faststart", dest]
        return run(cmd, bdir)

    tmp = os.path.join(bdir, "out.mp4")
    if subs_src:
        if not build(True, tmp):
            print("retry without subs")
            if not build(False, tmp):
                sys.exit("合成失败")
    else:
        if not build(False, tmp):
            sys.exit("合成失败")

    os.makedirs(os.path.dirname(out), exist_ok=True)
    shutil.copyfile(tmp, out)
    if not a.keep_build:
        shutil.rmtree(bdir, ignore_errors=True)
    print(f"OK {out} {os.path.getsize(out)}B (total={total}s, shots={len(shots)}, voices={n})")


if __name__ == "__main__":
    main()
