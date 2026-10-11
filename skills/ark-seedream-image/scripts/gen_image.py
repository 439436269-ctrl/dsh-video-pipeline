#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""gen_image — 火山方舟标准通道文生图（原子：一条 prompt → 一张图）。

标准 key 打 /api/v3/images/generations；Agent Plan key 走 /api/plan/v3（401 提示见
skill ark-agent-plan-image）。仅成功出图计费。
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

BASE = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
DEFAULT_MODEL = "doubao-seedream-5-0-pro-260628"


def load_key():
    for var in ("ARK_API_KEY", "ARK_STD_KEY"):
        v = os.environ.get(var)
        if v and v.strip():
            return v.strip()
    sys.exit("缺少 API key：设置 ARK_API_KEY / ARK_STD_KEY（Agent Plan key 不适用于本命令）")


def main():
    ap = argparse.ArgumentParser(description="文生图（标准通道）")
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--out", default="image.png")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--size", default="2K", help='如 "2K" / "1440x2560"；竖屏建议 prompt 写明竖屏构图')
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    key = load_key()
    body = json.dumps({"model": a.model, "prompt": a.prompt, "size": a.size,
                       "output_format": "png", "watermark": False},
                      ensure_ascii=False).encode()
    req = urllib.request.Request(BASE, data=body, headers={
        "Content-Type": "application/json", "Authorization": "Bearer " + key})
    try:
        r = urllib.request.urlopen(req, timeout=300)
        j = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            code = json.loads(raw)["error"]["code"]
        except Exception:
            code = "?"
        hint = ""
        if code == "ModelNotOpen":
            hint = ("\n→ 账号未开通该模型：到方舟控制台 https://console.volcengine.com/ark "
                    "「开通管理」免费开通后重试；或改用 Agent Plan 通道（skill ark-agent-plan-image）")
        elif code in ("AuthenticationError",) or e.code == 401:
            hint = "\n→ 401：Agent Plan key 请走 /api/plan/v3（见 ark-agent-plan-image）"
        sys.exit(f"HTTP {e.code} {raw[:300]}{hint}")

    img = (j.get("data") or [{}])[0].get("url")
    if not img:
        sys.exit("无图返回: " + json.dumps(j, ensure_ascii=False)[:300])
    urllib.request.urlretrieve(img, a.out)
    usage = j.get("usage") or {}
    info = {"out": a.out, "model": a.model,
            "bytes": os.path.getsize(a.out), "usage": usage}
    if a.json:
        print(json.dumps(info, ensure_ascii=False))
    else:
        print(f"OK {a.out} ({info['bytes']} B) usage={usage}")


if __name__ == "__main__":
    main()
