---
name: ark-seedream-image
description: 火山方舟标准通道文生图（doubao-seedream 系列，按量后付费）：GET /api/v3/models 探模型、POST /api/v3/images/generations 出图、gen_image 一条命令生成、按张价格表（pro 0.30/flash 0.12/lite 0.22 等）、ModelNotOpen 开通指引、与 Agent Plan 通道的选择。当用标准 API key 生图、ark seedream 文生图、查生图价格、或 Agent Plan 配额用尽要切按量通道时使用。Use when generating images via the standard Volcengine Ark channel (doubao-seedream) with pay-as-you-go billing.
---

# ark-seedream-image — 标准通道 Seedream 文生图（原子）

> ✅ 状态（2026-10-01 更新）：**`doubao-seedream-5-0-flash-260915` 已开通并 e2e 实测出图**（gen_image.py 7 张 EP15 场景图全过，0.12 元/张，size "2K" → 1584×2816/1440×3040）；`ModelNotOpen` 错误引导实测有效；**pro/其他档位仍未开通**（要用先去控制台点亮）。**Plan 月配额与内置 image_gen 周额度耗尽时，本通道是首选后备**（同 seedream 家族画风同源）；免开通生图走 Agent Plan（ark-agent-plan-image，需配额）。

**原子边界**：一条 prompt → 一张 png + usage。批量由外层循环；与 Agent Plan 通道二选一，不混用 key。

## 通道选择

| 通道 | key | 端点 | 计费 | 状态 |
|---|---|---|---|---|
| **标准（本 skill）** | 标准方舟 key（`ark_std_key.bak`，env `ARK_API_KEY`/`ARK_STD_KEY`） | `/api/v3/images/generations` | 按张后付费 | ⚠ 模型未开通 |
| Agent Plan | `ark-` 开头 Plan key（skill 目录 ARK_KEY.txt） | `/api/plan/v3/images/generations` | Plan 配额 | ✅ 实测出图 |

**key/端点混用必 401**；标准 key 打 plan 端点、Plan key 打 /api/v3 同样 401。

## 用法

```bash
python scripts/gen_image.py --prompt "唐代江边清晨远景，写实国风电影感，竖屏构图，高细节，无文字水印" \
  --out k1.png [--model doubao-seedream-5-0-pro-260628] [--size 2K] [--json]
```

## 模型与价格（2026-09-30 官网刊例，元/张）

| 模型 | 输出图单价 | models 列表 id（实测） |
|---|---|---|
| seedream-5.0-pro | ≤1.5K **0.30** / >1.5K **0.60**（图层拆分 0.15/0.30；输入图首张免费、第2张起 0.02） | `doubao-seedream-5-0-pro-260628` |
| seedream-5.0-flash | **0.12** | `doubao-seedream-5-0-flash-260915` |
| seedream-5.0-lite | **0.22** | `doubao-seedream-5-0-260128`（lite 归一 id 待开通后确认） |
| seedream-4.5 | **0.25** | `doubao-seedream-4-5-251128` |
| seedream-4.0 | **0.20** | `doubao-seedream-4-0-250828` / `doubao-seedream-4-0-20260415` |
| seedream-3.0-t2i | 见官网 | `doubao-seedream-3-0-t2i-250415` |

- **审核不过/未出图不计费**；组图按张数计费
- 探模型（实测可用）：`GET /api/v3/models` → 135 个模型，过滤 `seedream` 即上表

## 开通指引（当前卡点）

`HTTP 404 ModelNotOpen: Your account … has not activated …` → 到 **方舟控制台 → 开通管理**（console.volcengine.com/ark）免费开通模型服务，开通即用（按张扣费）。`InvalidEndpointOrModel.NotFound` = 该 id 对 images 端点不可用，换表中 id。

## size 规则（与 Plan 通道同族 API，按实测口径）

- 像素下限 **3,686,400**（≈1920×1920）：`864x1536` 会被拒
- 竖屏两条路：`size:"2K"` + prompt 写「竖屏构图」→ 实测（Plan 通道）返回 1600×2848；或显式 `size:"1440x2560"`
- prompt 尾缀固定风格词，**不要把文字画进图**；`watermark:false`

## 下载核验

- urlretrieve 后 **Pillow 校验** `im.format/im.size`（本机 Read 工具会话级错图 bug → 图质检用 Pillow/哈希，别用 Read 下结论）
