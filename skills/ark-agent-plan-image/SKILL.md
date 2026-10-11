---
name: ark-agent-plan-image
description: 火山引擎 Agent Plan 专属图片/视频生成 API（doubao-seedream/seedance）完整调用指南：专属端点、尺寸规则、配额计费、实测配方与排障。当用户要用 Agent Plan key 生图、ark seedream 文生图、调 plan/v3 images 接口、为唐诗短剧等批量生成竖屏关键帧，或排查 Agent Plan 生图 401/400/size 报错时使用。Use when generating images via Volcengine Ark Agent Plan API (doubao-seedream), including endpoint setup, size rules, quota billing and troubleshooting.
---

# ark-agent-plan-image — 火山 Agent Plan 生图 API

> ✅ 状态：本机实测通过（2026-09-29，doubao-seedream-5.0-lite 出图 1600×2848 竖屏，配额扣减确认）

## 核心事实（与普通方舟 API 完全不同，用错必 401）

| 项 | 值 |
|---|---|
| 图片端点 | `POST https://ark.cn-beijing.volces.com/api/plan/v3/images/generations` |
| 视频端点 | `POST https://ark.cn-beijing.volces.com/api/plan/v3/contents/generations/tasks`（查询 `/tasks/{id}`） |
| 鉴权 | `Authorization: Bearer <Agent Plan API Key>`（`ark-` 开头，**专属 key**；普通方舟/Coding Plan key 在此无效，反之亦然） |
| 实测生图模型 | `doubao-seedream-5.0-lite`（文档另有 5.0 Pro；套餐 Medium 及以上才含图像配额，Large+ 含视频） |
| 视频模型 | `doubao-seedance-2.5` / `2.0` / `2.0-fast` / `2.0-mini` |
| 官方文档 | `ark.volcengine.com/docs/ark/agent-plan-personal-visual-models`（接入视觉模型页，含 curl 示例） |
| 套餐/订阅地址 | `https://ark.volcengine.com/region:cn-beijing/subscription/agent-plan`（开通/升级/看配额余量） |

**401 根因**：打成 `ark.cn-beijing.volces.com/api/v3/...`（普通端点）→ 必 401 `AuthenticationError`。Agent Plan 只认路径里带 **`/api/plan/`** 的专属端点。诊断顺序：先确认端点，再怀疑 key。

## 图片请求配方（实测）

```python
import json, os, urllib.request
KEY = os.environ["ARK_KEY"]   # key 只进环境变量，不写入记忆/文档
URL = "https://ark.cn-beijing.volces.com/api/plan/v3/images/generations"
body = json.dumps({
    "model": "doubao-seedream-5.0-lite",
    "prompt": "……（prompt 里写明「竖屏构图」）",
    "size": "2K",            # 或 "1440x2560" 这类显式宽高
    "output_format": "png",
    "watermark": false,       # 可关水印
}, ensure_ascii=False).encode()
req = urllib.request.Request(URL, data=body, headers={
    "Content-Type": "application/json", "Authorization": "Bearer " + KEY})
data = json.loads(urllib.request.urlopen(req, timeout=120).read())
img_url = data["data"][0]["url"]          # 签名 TOS URL，24h 过期
usage = data["usage"]["output_tokens"]    # 实测约 17800/张，扣 Agent Plan 配额
```

### size 规则（400 报错全集，实测）

- 只接受：`"宽x高"`、`"2k"`、`"3k"`、`"4k"`（大小写如报错按提示）
- **像素下限 3,686,400**（≈1920×1920）：`864x1536` 会被拒（`image size must be at least 3686400 pixels`）
- 9:16 竖屏两条路：① `size:"2K"` + prompt 写「竖屏构图」→ 实测返回 **1600×2848**；② 显式 `size:"1440x2560"`（恰好过像素线）
- 返回体：`data[0].url` + `data[0].size` + `usage`（generated_images / output_tokens）

## 交付核验

- 下载后用 **Pillow 校验** `im.format/im.size/im.mode`（本例 PNG 1600×2848 RGB）
- **不要用 Read 工具做图质检**：会话级缓存 bug 会对新路径返回旧图（2026-09-28/29 两次实锤）；磁盘文件以 Pillow/哈希为准，人审让用户肉眼看

## 计费与配额

- 走 **Agent Plan 配额**（非按量后付费）；计费单位 **AFP**，用量明细在 Agent Plan 控制台（0.5~1 天延迟）
- 图像/视频/语音/Harness **无 5 小时/周额度**，只受模型日额度 + 套餐月额度限制；日额度=月额度一半
- 单张实测 `output_tokens≈17800`；批量前在控制台确认余量，批量消耗不得静默进行（先向用户报量）
- **套餐档位决定能力**（2026-09 官方表）：Small 40元/2万AFP、Medium 200元/10万AFP **均不支持视频**；Large 500元/25万、Max 1000元/50万 才含 seedance 视频。视频调用在低档位报 `404 UnsupportedModel`（不要误判为模型 ID 写错）
- **`doubao-seedream-5.0-lite` 已标"即将下线"**，新接入优先 `doubao-seedream-5-0-pro`（注意 pro 命名是连字符 `5-0`）；套餐/开通地址见文首

## 批量接管线（唐诗短剧模式）

- 提示词清单维护在交付包 `build_read_batch.py` 的 `EPS[].images` + 分镜 md
- 流程：本 API 批量出图落盘到各 EP 目录（文件名必须与 `EPS[].images` 完全一致）→ `python build_read_batch.py` 自动测长时间轴/SRT/分镜 → ffmpeg 合成竖屏读诗版
- 风格后缀固定：`写实国风电影感，唐代，柔和自然光，浅景深，胶片质感，竖屏构图，高细节，无文字水印`

## 坑速查

| 现象 | 根因 → 对策 |
|---|---|
| 401 AuthenticationError | 打错端点（`/api/v3`）→ 换 `/api/plan/v3`；或 key 不是 Agent Plan 专属 key |
| 400 size not valid | size 只认 `宽x高/2k/3k/4k` |
| 400 at least 3686400 pixels | 显式宽高乘积不足 → 用 `2K` 或 ≥1440×2560 |
| Chat 调用 401 而生图要通 | 文本走 `/api/plan/v1/messages`（Anthropic 兼容），图片走 `/api/plan/v3/images`，两者都是 plan 域 |
| Read 看到的图与磁盘不符 | Read 缓存 bug → Pillow/哈希核验 |
| 方舟文档页打不开正文 | SPA 微前端多 `<body>` 卡死 MCP 工具 → 用 playwright-cli（WMI 后台 + eval 提 innerText） |
