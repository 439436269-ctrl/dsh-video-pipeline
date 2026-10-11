# -*- coding: utf-8 -*-
"""T196 本机可行性实测：xfade / 墨迹遮罩溶解 / ASS karaoke 逐字显现 / 竖排。"""
import os, subprocess, sys, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FF = r"{{WORKSPACE}}\sample-diary-map\.ff\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe"
OUT = os.path.dirname(os.path.abspath(__file__))
W, H, FPS = 360, 640, 24
results = []

def run(args, name, cwd=None):
    try:
        p = subprocess.run([FF, "-y", "-hide_banner", "-loglevel", "error"] + args,
                           capture_output=True, text=True, timeout=90, cwd=cwd)
        ok = p.returncode == 0
        err = (p.stderr or "")[:300]
    except subprocess.TimeoutExpired:
        ok, err = False, "TIMEOUT"
    results.append((name, "PASS" if ok else "FAIL", err))
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" :: {err}" if not ok else ""), flush=True)
    return ok

def solid(path, color, seconds=3.0):
    run(["-f","lavfi","-i",f"color=c={color}:s={W}x{H}:r={FPS}:d={seconds}",
         "-pix_fmt","yuv420p", path], f"gen:{os.path.basename(path)}")

# ---- A. xfade 三种转场 ----
a, b = f"{OUT}/a.mp4", f"{OUT}/b.mp4"
solid(a, "0x224466"); solid(b, "0x884422")
for tr in ("wipeleft", "dissolve", "circleopen", "fadewhite"):
    ok = run(["-i", a, "-i", b, "-filter_complex",
              f"[0:v][1:v]xfade=transition={tr}:duration=1:offset=2,format=yuv420p",
              f"{OUT}/xf_{tr}.mp4"], f"xfade={tr} 编码")
    if ok:
        run(["-ss","2.5","-i",f"{OUT}/xf_{tr}.mp4","-frames:v","1",
             f"{OUT}/xf_{tr}.png"], f"xfade={tr} 抽帧t=2.5s")

# ---- B. 墨滴晕开：PIL 生成噪声阈值扩散遮罩 -> alphamerge -> overlay ----
rng = np.random.default_rng(7)
# 生成墨渍状噪声：低频化（多尺度高斯模糊后的随机场）
noise = rng.random((H, W)).astype(np.float32)
img = Image.fromarray((noise*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9))
base = np.asarray(img).astype(np.float32)/255.0
base = (base - base.min())/(base.max()-base.min())
# 中心加权，让墨从画面中偏心处晕开
yy, xx = np.mgrid[0:H, 0:W]
cx, cy = W*0.5, H*0.42
dist = np.sqrt(((xx-cx)/W)**2 + ((yy-cy)/H)**2)
dist = dist/dist.max()
field = 0.65*base + 0.35*dist          # 越小越先被墨覆盖
frames = []
N = FPS  # 1 秒
for i in range(N):
    t = (i+1)/N
    thr = np.quantile(field, min(max(t, 1e-3), 0.999))
    mask = np.where(field <= thr, 255, 0).astype(np.uint8)  # 255=新画面可见
    frames.append(mask)
os.makedirs(f"{OUT}/maskf", exist_ok=True)
for i, m in enumerate(frames):
    Image.fromarray(m).save(f"{OUT}/maskf/{i:04d}.png")
run(["-framerate",str(FPS),"-i",f"{OUT}/maskf/%04d.png","-pix_fmt","gray",
     f"{OUT}/mask.mp4"], "墨迹遮罩序列编码")
# a 为底，b 带 alpha（由遮罩luma提供）-> overlay 到 a 上
run(["-i", a, "-stream_loop","-1","-i", b, "-stream_loop","-1","-i", f"{OUT}/mask.mp4",
     "-filter_complex",
     f"[1:v]scale={W}:{H},format=yuva420p[bv];[2:v]scale={W}:{H},format=gray[mk];"
     f"[bv][mk]alphamerge[ba];[0:v][ba]overlay=0:0:format=auto,format=yuv420p",
     "-t","3", f"{OUT}/ink.mp4"], "墨滴晕开(遮罩+alphamerge+overlay) 编码")
for t in ("0.3","0.6"):
    run(["-ss",t,"-i",f"{OUT}/ink.mp4","-frames:v","1",f"{OUT}/ink_t{t}.png"],
        f"墨滴晕开抽帧 t={t}s")

# ---- C. ASS karaoke 逐字显现 ----
# 字体探测
def find_font():
    cands = [r"C:\Windows\Fonts\STXINGKA.TTF", r"C:\Windows\Fonts\STXINGKAI.TTF",
             r"C:\Windows\Fonts\simkai.ttf", r"C:\Windows\Fonts\simfang.ttf"]
    for c in cands:
        if os.path.exists(c): return c
    return None
font_path = find_font()
font_name = "STXingkai" if font_path and "XING" in font_path.upper() else "KaiTi"
text = "白日依山尽"
dur_cs = 40  # 每字 0.4s = 40 cs
kara = "".join(f"{{\\k{dur_cs}}}{ch}" for ch in text)
ass = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},48,&H00FFFFFF,&HFFFFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,0,2,20,20,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:02.50,Default,,0,0,0,,{kara}
"""
with open(f"{OUT}/kara.ass","w",encoding="utf-8") as f: f.write(ass)
run(["-f","lavfi","-i",f"color=c=0x101820:s={W}x{H}:r={FPS}:d=3",
     "-vf","ass=kara.ass","-frames:v","1","kara_t0.5.png"],
    "ASS karaoke 烧录(t=0.5s)", cwd=OUT)
# ---- D. 竖排字幕：逐字换行模拟（libass 纯排版，无旋转） ----
vert_lines = "\\N".join(list(text))
ass_v = ass.replace(kara, vert_lines)
with open(f"{OUT}/vert.ass","w",encoding="utf-8") as f: f.write(ass_v)
run(["-f","lavfi","-i",f"color=c=0x101820:s={W}x{H}:r={FPS}:d=1",
     "-vf","ass=vert.ass","-frames:v","1","vert.png"],
    "竖排(逐字换行)烧录", cwd=OUT)

# ---- 真正生成 karaoke 视频再抽两帧 ----
run(["-f","lavfi","-i",f"color=c=0x101820:s={W}x{H}:r={FPS}:d=3",
     "-vf","ass=kara.ass", "kara_full.mp4"], "ASS karaoke 全片", cwd=OUT)
if os.path.exists(f"{OUT}/kara_full.mp4"):
    for t in ("0.3","1.1","1.9"):
        run(["-ss",t,"-i",f"{OUT}/kara_full.mp4","-frames:v","1",
             f"{OUT}/kara_t{t}.png"], f"karaoke 抽帧 t={t}s")

# ---- 字体确认 ----
results.append(("华文行楷字体", "FOUND" if font_path else "MISSING", font_path or "回退KaiTi"))
print(f"[{'FOUND' if font_path else 'MISSING'}] 华文行楷字体 :: {font_path}", flush=True)
npass = sum(1 for _,s,_ in results if s in ("PASS","FOUND"))
print(f"TOTAL: {npass}/{len(results)} PASS/FOUND", flush=True)
