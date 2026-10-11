#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""mimo_tts — MiMo API key 直调 TTS（原子：文本+音色+风格 → wav）。

桌面 tts_speech 工具 403 membership_required 时的备用通道（2026-10-01 实测打通）：
POST https://api.xiaomimimo.com/v1/chat/completions
  model=mimo-v2.5-tts，modalities=[audio,text]，audio.format=wav
  messages = [{user: 风格/context}, {assistant: 待朗读文本}]   # assistant 必须存在
  voice    = 茉莉/冰糖/白桦/苏打 …（实测生效：茉莉vs冰糖 corr=0.009）
返回 choices[0].message.audio.data = base64 WAV(24k) → 落盘。

key 来源：~/.config/mimocode/mimocode.jsonc 的 providers.xiaomi.options.apiKey
（或 env MIMO_API_KEY）。用法：
  python mimo_tts.py --text "朝辞白帝彩云间。" --out voA1.wav \
      --voice 茉莉 --context "与节目报幕完全相同的正常语速，像日常自然把这句诗读出来，干净利落"
"""
import argparse
import base64
import io
import json
import os
import re
import sys
import urllib.request
import urllib.error

URL = "https://api.xiaomimimo.com/v1/chat/completions"


def load_key():
    env = os.environ.get("MIMO_API_KEY")
    if env and env.strip():
        return env.strip()
    cfg = os.path.join(os.path.expanduser("~"), ".config", "mimocode", "mimocode.jsonc")
    try:
        raw = io.open(cfg, encoding="utf-8").read()
        m = re.search(r'"xiaomi"\s*:\s*\{[\s\S]*?"apiKey"\s*:\s*"([^"]+)"', raw)
        if m:
            return m.group(1)
    except OSError:
        pass
    sys.exit("缺少 MiMo API key：设 env MIMO_API_KEY 或 providers.xiaomi.options.apiKey")


def main():
    ap = argparse.ArgumentParser(description="MiMo API TTS（桌面工具 403 备用）")
    ap.add_argument("--text", required=True, help="待朗读文本（先过 pinyin_fix！）")
    ap.add_argument("--out", required=True, help="输出 wav 路径")
    ap.add_argument("--voice", default="茉莉", help="音色：茉莉/冰糖/白桦/苏打…")
    ap.add_argument("--context", default="", help="风格指令（user 消息；空则用音色句）")
    a = ap.parse_args()

    key = load_key()
    style = a.context or f"{a.voice}音色，自然朗读"
    body = {
        "model": "mimo-v2.5-tts",
        "modalities": ["audio", "text"],
        "audio": {"format": "wav"},
        "voice": a.voice,
        "messages": [
            {"role": "user", "content": style},
            {"role": "assistant", "content": a.text},
        ],
    }
    req = urllib.request.Request(URL, data=json.dumps(body, ensure_ascii=False).encode(),
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + key})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            j = json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read()[:300]}")
    try:
        b64 = j["choices"][0]["message"]["audio"]["data"]
    except (KeyError, IndexError):
        sys.exit("响应无 audio: " + json.dumps(j, ensure_ascii=False)[:300])
    raw = base64.b64decode(b64)
    os.makedirs(os.path.dirname(os.path.abspath(a.out)) or ".", exist_ok=True)
    open(a.out, "wb").write(raw)
    print(f"OK {a.out} {len(raw)}B voice={a.voice}")


if __name__ == "__main__":
    main()
