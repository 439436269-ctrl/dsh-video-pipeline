#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""make_cover — 底图 + 系列角标 + 标题 + 诗行 → 双平台封面（原子：一次出两张）。

输出：
  <prefix>-bili-cover.png   1146x717（B站 16:10，居中横裁 + 底部诗文面板）
  <prefix>-mobile-cover.png 1080x1920（小红书/抖音竖版，底部半透明诗文面板）

源自唐诗项目 ep11cov2.py，布局参数逐项保留。
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFont

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\msyhbd.ttc",   # 微软雅黑粗体（首选）
    r"C:\Windows\Fonts\msyh.ttc",
    r"C:\Windows\Fonts\simhei.ttf",
]


def pick_font(size):
    for p in FONT_CANDIDATES:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    sys.exit("未找到中文字体（msyhbd.ttc/msyh.ttc/simhei.ttf）")


def panel_text(dr, lines, x, y, size, lh, stroke=3):
    f = pick_font(size)
    for ln in lines:
        dr.text((x, y), ln, font=f, fill=(255, 255, 255),
                stroke_width=stroke, stroke_fill=(0, 0, 0))
        y += lh
    return y


def draw_series_badge(dr, series, x, y, size):
    f = pick_font(size)
    tb = dr.textbbox((0, 0), series, font=f)
    dr.rectangle([x - 8, y - 8, tb[2] + 16, tb[3] + 16], fill=(0, 0, 0, 120))
    dr.text((x, y), series, font=f, fill=(255, 255, 255),
            stroke_width=3, stroke_fill=(0, 0, 0))


def mobile(bg, series, title, poem, out):
    im = Image.open(bg).convert("RGB").resize((1080, 1920), Image.LANCZOS)
    ov = Image.new("RGBA", (1080, 1920), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ov)
    pstart = 1430
    dr.rectangle([0, pstart - 130, 1080, 1920], fill=(0, 0, 0, 145))
    draw_series_badge(dr, series, 60, 70, 56)
    dr.text((60, 1370), title, font=pick_font(50), fill=(255, 255, 255),
            stroke_width=3, stroke_fill=(0, 0, 0))
    panel_text(dr, poem, 60, 1430, 48, 64)
    Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB").save(out, "PNG")
    print("OK", out)


def bili(bg, series, title, poem, out):
    im = Image.open(bg).convert("RGB")
    w, h = im.size
    band = int(w * 717 / 1146)
    y0 = (h - band) // 2
    im = im.crop((0, y0, w, y0 + band)).resize((1146, 717), Image.LANCZOS)
    ov = Image.new("RGBA", (1146, 717), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ov)
    box_y = 717 - (90 + len(poem) * 54) - 20
    dr.rectangle([0, box_y, 1146, 717], fill=(0, 0, 0, 145))
    draw_series_badge(dr, series, 40, 36, 42)
    dr.text((40, box_y + 14), title, font=pick_font(40), fill=(255, 255, 255),
            stroke_width=3, stroke_fill=(0, 0, 0))
    panel_text(dr, poem, 40, box_y + 66, 40, 54)
    Image.alpha_composite(im.convert("RGBA"), ov).convert("RGB").save(out, "PNG")
    print("OK", out)


def main():
    ap = argparse.ArgumentParser(description="底图 → B站+竖版双封面")
    ap.add_argument("--bg", required=True, help="底图（关键帧 png/jpg）")
    ap.add_argument("--out-dir", default=".", help="输出目录")
    ap.add_argument("--prefix", required=True, help="文件前缀，如 EP11A")
    ap.add_argument("--series", required=True, help="系列角标，如 《一首诗一出戏》 EP11 读诗版")
    ap.add_argument("--title", required=True, help="标题行，如 早发白帝城 · 读诗版")
    ap.add_argument("--line", action="append", default=[],
                    help="诗行/文案行，可多次；顺序即排版顺序")
    ap.add_argument("--lines-file", help="从 UTF-8 文件读诗行（每行一条，替代 --line）")
    ap.add_argument("--only", choices=["bili", "mobile", "both"], default="both")
    a = ap.parse_args()

    poem = list(a.line)
    if a.lines_file:
        with open(a.lines_file, encoding="utf-8") as f:
            poem += [l.rstrip("\n") for l in f if l.strip()]
    if not poem:
        sys.exit("缺诗行：--line 或 --lines-file")

    os.makedirs(a.out_dir, exist_ok=True)
    if a.only in ("mobile", "both"):
        mobile(a.bg, a.series, a.title, poem,
               os.path.join(a.out_dir, f"{a.prefix}-mobile-cover.png"))
    if a.only in ("bili", "both"):
        bili(a.bg, a.series, a.title, poem,
             os.path.join(a.out_dir, f"{a.prefix}-bili-cover.png"))


if __name__ == "__main__":
    main()
