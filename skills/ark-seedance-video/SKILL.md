---
name: ark-seedance-video
description: 火山方舟 Seedance 文生视频（t2v）原子调用：一次生成一条 720p 竖屏视频（create → poll → download）、查询任务列表、取消/删除任务、失败重试、token 用量实测公式与刊例价格表、model id/参数规则、401/失败排障。当用户要求「生成一段视频」「文生视频」「seedance 出镜头」「ark 生视频」「算视频生成多少钱」「查任务列表」「取消视频任务」「重跑失败镜头」，或唐诗短剧等项目要批量出动态镜头时使用。Use when generating one text-to-video clip via Volcengine Ark Seedance API, listing/cancelling/retrying generation tasks, checking token usage/cost, or troubleshooting ark video generation errors.
---

# ark-seedance-video — 火山方舟 Seedance 文生视频（原子能力）

> ✅ 状态：本机实测通过（2026-09-30，EP11 唐诗短剧 13 条 720p/9:16 镜头全成，usage 与刊例价对账一致）
> ✅ 列表/取消接口实测通过（2026-10-01：GET 列表 total=24、`filter.status`/`filter.task_ids` 过滤 OK；DELETE 假 id → 404 路由+鉴权 OK，未实际取消付费任务）

**原子边界**：本 skill 只做「一条 prompt → 一条 mp4」的生成闭环（创建/轮询/下载/查用量/查列表/取消/重试）。批量编排、时间轴拼接、多平台发布属于上层流程，分别见 `tangshi-pipeline`（成片合成）与 `quad-platform-publish`（发布）。

## 核心事实

| 项 | 值 |
|---|---|
| 端点 | `POST .../api/v3/contents/generations/tasks` 创建；`GET /tasks/{id}` 查单个；**`GET /tasks` 列表（2026-10-01 实测）**；**`DELETE /tasks/{id}` 取消/删除（官方 2026-09-09 新增）**，base 均为 `https://ark.cn-beijing.volces.com` |
| 鉴权 | `Authorization: Bearer <标准方舟 API Key>`；key 存 `{{ARK_API_KEY_FILE}}`（env `ARK_STD_KEY`），**只进环境变量，不写入记忆/文档明文** |
| 实测模型 | `doubao-seedance-2-0-mini-260615`（性价比款）；另有 `doubao-seedance-2.0-fast` / `2.0` / `2.5` |
| 与 Agent Plan 的区别 | Plan key 走 `/api/plan/v3/...` 专属端点（见 skill `ark-agent-plan-image`）；标准 key 才能打本文的 `/api/v3/`，混用必 401 |
| 计费 | **仅成功生成计费**，失败/审核不过不收费；按输出 token 计费，成功时 GET 返回 `usage.completion_tokens` |

## 原子调用（create → poll → download）

```python
import json, os, time, urllib.request, re
KEY = os.environ["ARK_STD_KEY"].strip()
H = {"Content-Type": "application/json", "Authorization": "Bearer " + KEY}
BASE = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks"

# 1) create
body = {"model": "doubao-seedance-2-0-mini-260615",
        "content": [{"type": "text", "text": "清晨轻舟从白帝城下解缆驶入彩云缭绕的江面，镜头随船出发跟拍，古风写实电影感，竖屏9:16构图，画面无水印"}],
        "generate_audio": False, "resolution": "720p", "ratio": "9:16",
        "duration": 5, "watermark": False}
tid = json.loads(urllib.request.urlopen(
    urllib.request.Request(BASE, data=json.dumps(body).encode(), headers=H), timeout=60).read())["id"]

# 2) poll（5s 间隔，14s 片实测 ~90s 内完成）
for _ in range(120):
    time.sleep(5)
    st = json.loads(urllib.request.urlopen(
        urllib.request.Request(f"{BASE}/{tid}", headers=H), timeout=30).read())
    if st["status"] == "succeeded":
        url = re.search(r'https://[^\s"]+?\.(?:mp4|mov)[^\s"]*', json.dumps(st)).group(0)
        break
    if st["status"] in ("failed", "cancelled"):
        raise SystemExit("FAILED: " + json.dumps(st, ensure_ascii=False)[:300])
else:
    raise SystemExit("poll timeout")

# 3) download + 记账
urllib.request.urlretrieve(url, "out.mp4")
print("tokens =", st["usage"]["completion_tokens"])
```

可复用成品脚本：`%TEMP%\ark_ep11a_vids.py` / `ark_ep11b_vids.py`（批量 CLIPS + 跳过已存在 >500KB 成品，断点重跑安全）。

### 防重复创建（2026-10-01 用户指定：先查远端，没有再重跑，很费钱）

- **任务注册表**：每个产物配 `<目录>/route2-tasks.json`（`{输出文件: taskId}`），**创建成功立即落盘**——进程被杀后重跑先 `GET /tasks/{id}` 续等/下载，**绝不新建**（每个任务 ¥1~4，重复即浪费）
- 流程：①查本地文件→②查注册表 id→③查历史已知 id→④**兜底查远端列表**（下节，找漏登记/重复任务）→全失败才 create（create 后先写注册表再轮询）
- ~~**本 API 无取消接口**~~（2026-09-30 结论已过时：当时试的 `/cancel`、PATCH 不对）——**2026-09-09 官方新增 `DELETE /tasks/{id}`**，排队中的重复任务现在可以取消止损
- 实测浪费案例：EP14 b2 因脚本被杀重建一次，重复任务 x6hlb 当时无法取消（≈¥4 刊例）；现在同类情况应立即 DELETE

## 查询列表 / 取消 / 重试（2026-10-01 实测）

> 官方文档：[查询视频生成任务列表](https://ark.volcengine.com/region:cn-beijing/docs/ark/list-video-generation-tasks-api?lang=zh)、[取消或删除视频生成任务](https://ark.volcengine.com/region:cn-beijing/docs/ark/cancel-or-delete-video-generation-tasks-api?lang=zh)

### 1) 查询任务列表

`GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks`

| 参数 | 说明 |
|---|---|
| `page_num` / `page_size` | 页码（默认 1）/ 每页数量（默认 20） |
| `filter.status` | `queued` / `running` / `cancelled` / `succeeded` / `failed` |
| `filter.model` | 推理接入点 ID（`ep-xxx`），精确匹配 |
| `filter.task_ids` | 任务 ID，**重复参数名传递**：`filter.task_ids=id1&filter.task_ids=id2` |
| `filter.service_tier` | `default`（在线）/ `flex`（离线），默认 default |

```python
import json, os, urllib.request, urllib.parse
KEY = os.environ["ARK_STD_KEY"].strip()
H = {"Authorization": "Bearer " + KEY}
BASE = "https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks"

def list_tasks(status=None, task_ids=None, page_size=20):
    q = {"page_size": page_size}
    if status: q["filter.status"] = status
    url = BASE + "?" + urllib.parse.urlencode(q)
    if task_ids:  # 重复参数名，urlencode(list) 不行，手动拼
        url += "&" + "&".join(f"filter.task_ids={i}" for i in task_ids)
    return json.loads(urllib.request.urlopen(
        urllib.request.Request(url, headers=H), timeout=30).read())
```

- **只保留最近 7 天**记录 `[T-7d, T)`（UTC）；响应 `{total, items[]}`
- item 含 `id/status/model/usage.completion_tokens/content.video_url/created_at/execution_expires_after` 等，**不含原始 prompt**——重试必须靠本地注册表存的 prompt
- 实测（2026-10-01）：`total=24`、`filter.status=failed`、`filter.task_ids=cgt-xxx` 均返回正确
- 视频 URL 24h 过期、Seedance 2.5 产物下载上限 100 次——拿到立即下载

### 2) 取消 / 删除任务

`DELETE https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}` → 成功 `200`，body `{}`

```python
req = urllib.request.Request(f"{BASE}/{tid}", method="DELETE", headers=H)
urllib.request.urlopen(req, timeout=30)   # 200 即成功
```

- **只有 `queued` 状态能真正取消**（取消后状态 `cancelled`，24h 自动删除记录）；对非 queued 任务 DELETE 是**删除记录**——运行中任务能否被中断官方未明确，**别依赖它省钱**
- 用途：误建/重复任务止损（排队窗口很短，创建后发现重复应立刻 DELETE）
- 实测（2026-10-01）：假 id → 404（路由+鉴权 OK）；**未对真实任务实测取消**（避免误伤付费任务），首次真用时先拿自己的 queued 任务验证

### 3) 重试（failed / 取消后重建）

- 失败任务不计费，重试 = **重新 create**（API 无 resume）
- 流程：`GET /tasks?filter.status=failed`（或查注册表）→ 对照本地注册表拿原 prompt → ①本地无成品 ②注册表无进行中 id → 才 create 新任务并落盘新 id
- `cancelled` 状态只可能来自人为 DELETE；同理按注册表重建
- 改 prompt 的重试排障见下表 failed 行

## 参数与 prompt 规则

- `duration`：实测 5~14 秒 OK（官方档 2~30 秒，超界以报错为准）
- `resolution`：mini 支持 `480p` / `720p`；`ratio`：`9:16`（竖屏短剧）/ `16:9` / `1:1`
- **480p 实测省 53.5% token**（2026-10-01：5s 50,638 vs 720p 108,900，¥1.16 vs 2.50 刊例）——降本可切 480p，但升采样到 720p 后轻微软化，**先抽检 1 条画质再批量**
- `generate_audio:false` + `watermark:false`（配音走 TTS，不接模型音频）
- prompt 配方：**一句镜头动作**（推近/跟拍/拉升/横移）+ 画面要素 + 统一风格后缀（短剧用 `，古风写实电影感，竖屏9:16构图，画面无水印`）；文字不要画进画面
- 返回：`content.video_url` 是签名 TOS 链接（任务结果保留 `execution_expires_after`=172800s/48h，**拿到立即下载**）

## i2v：首帧图锁定（2026-09-30 实测，人物一致性主力）

`content` 数组里**先放图后放文**即可把指定图片定为第一帧（data URL 或 http URL）：

```python
body = {"model": "doubao-seedance-2-0-mini-260615",
  "content": [
    {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + b64}},
    {"type": "text", "text": "镜头动作+画面描述+风格后缀"}
  ],
  "generate_audio": False, "resolution": "720p", "ratio": "9:16",
  "duration": 5, "watermark": False}
```

- 实测：EP12 k1 关键帧做首帧 → 5s 片，**首帧与参考图 MAD=9.7（<12 阈值，锁定）**；tokens 与纯文生相同（108,900/5s）
- 输入图先中心裁 9:16 再缩 720×1280（jpeg q85 ≈130KB payload 最稳）
- **只锁首帧**：运动中段可能漂移，人物镜头发布前抽帧目检
- 用途：人物镜头形象一致性（人设卡/基准图 → i2v，见 tangshi-pipeline §人物形象一致性）；空镜仍可纯文生

## token 用量与金额

- **实测公式**（720p / 9:16 / mini）：`completion_tokens = 21600 × 秒数 + 900`
  （5s→108,900；7s→152,100；14s→303,300，EP11 十二条逐一对账）
- **刊例价（2026-09-30 官网 model-pricing，单位：元/百万 token）**：

| 模型 | 刊例 | 限时活动 |
|---|---|---|
| doubao-seedance-2.0-**mini** | **23**（≈0.5 元/秒@720p） | 4 折 ≈0.2 元/秒（企业用户，2026-08-07~10-07） |
| doubao-seedance-2.0-fast | 37 | 75 折 ≈0.6 元/秒（同期） |
| doubao-seedance-2.0 | 46 | — |
| doubao-seedance-2.5 | 70 | — |

- **估价**：`金额 ≈ tokens ÷ 1e6 × 单价`，或按秒 `≈ 秒数 × 0.5 元`（mini 720p 刊例）
- **EP11 实账**：13 条 / 91 秒 / **1,977,300 tokens** → 刊例 **≈ ¥45.5**，若享 4 折 ≈ **¥18.2**
- 查账：`GET /tasks/{id}` 读 `usage.completion_tokens`（准确值以此为准，估算公式仅供预算）

## 排障

| 现象 | 原因 | 解法 |
|---|---|---|
| 401 AuthenticationError | 用 Plan key 打标准端点（或反之） | 确认 key 与端点配对：标准 key→`/api/v3`，Plan key→`/api/plan/v3` |
| 模型不存在/400 | model id 写错 | 用完整 id `doubao-seedance-2-0-mini-260615`（别写 `doubao-seedance-2.0-mini`） |
| failed 状态 | 内容审核/内部错 | GET 看 `error`；失败不计费，改 prompt 重试 |
| 轮询超时 | 高峰排队 | 间隔 5s、上限 20 分钟；任务可继续 GET，不必重建 |
| 误建/重复任务在排队 | 脚本重跑又 create 了 | 立刻 `DELETE /tasks/{id}`（仅 queued 可取消，不计费）；事后用 `GET /tasks?filter.task_ids=` 对账 |
| 想看这批跑了多少/花了多少 | 只有单个 id 查不了全局 | `GET /tasks?filter.status=succeeded&page_size=100` 汇总 `usage.completion_tokens`（仅近 7 天） |
| 要花多少钱先算 | — | tokens=21600×秒+900，mini 刊例 23 元/百万；批量前先向用户报量 |
