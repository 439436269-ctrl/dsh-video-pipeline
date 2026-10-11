---
name: tangshi-data-review
description: 唐诗短剧三平台（B站/抖音/视频号）数据回收与复盘流程：播放数据采集脚本、龄期衰减分档、A/B与题材对照、发布节奏实验裁决、EP选片权重修正、复盘报告模板与落点。Use when 回收数据、数据复盘、看播放量/涨粉、验证发布节奏效果、复盘报告、选片权重、T+24h复测，或每批发布收官后需要数据结论时。
---

# tangshi-data-review — 唐诗短剧数据回收与复盘

> ✅ 状态：本机实测通过（2026-10-01 首轮 T83 全量 36 行实采 + 2026-10-02 第二轮 T108；脚本均带真实数据验证）

## 何时用

- **每批发布收官后立即**做一次全量快照（T83/T108 模式）
- **固定三点采样**：T+6h、T+24h、T+48h（上轮只有首日快照导致衰减结论缺次日数据——这是硬教训）
- 发布节奏/并行实验改动后必须做**同龄期对照**才能下结论
- 选新一批 EP 之前：先复盘，再按权重修选片（`tangshi-pipeline` §选片权重 的数据来源就是本流程）

## 采集口径（2026-10-01 实测定论，脚本已内置）

| 平台 | 接口 | 指标 | 关键坑 |
|---|---|---|---|
| **B站** | `seasons_archives_list`（mid=<你的 B 站 UID>，读诗 season <你的 B 站合集 seasonId> / 故事 <你的 B 站合集 seasonId>）→ 逐 BV `x/web-interface/view?bvid=` | view/like/reply/fav/coin/share/danmaku | **裸 `archive/stat` 被 WAF 挡成 HTML**，必须带 cookie 调 `view` |
| **抖音** | `creator.douyin.com` headless（profile 见脚本）→ `POST /janus/douyin/creator/pc/work_list` 分页 | `statistics` 自带 play/digg/comment/share/collect | A/B 判定**不能用** `desc.includes('故事版')`（A 版正文也会提），用 `/^一首诗一出戏\d{2}故事版/` |
| **视频号** | `post/get_post_info`（按 objectId）+ `collection/get_collection_list.totalReadCount` | `readCount`=累计播放（已交叉验证差<1%） | `statistic/*` 除 fans_trend 外全 404；cookie 会在服务端失效，解法 = skill `quad-platform-publish` 内 tencent-login-save.js 长轮询扫码 |

- **龄期基准**：NOW 实算，「播放/日」= 播放 ÷ 龄期小时 × 24，发几天算几天不外推
- **版本判定**：B站按合集分；抖音按 desc 正则；视频号同 EP 按 createTime 升序（先发=A）

## 脚本（scripts/）

```powershell
# 逐个跑（node 系统版；改头部的 EP 范围 / NOW 时间戳）
node scripts\bili_stats.mjs   # → bili-stats.json
node scripts\dy_stats.mjs     # → dy-stats.json（含 statistics）
node scripts\wx_stats.mjs     # → wx-stats.json（另存 wx-collections.json 交叉验证）
node scripts\decay.mjs        # → decay.json（龄期分档：0-6/6-12/12-24/24-48/48h+ 条均播放/日）
node scripts\analyze.mjs      # → tables.json + analyze-out.txt（A/B、长短、题材、分批汇总）
node scripts\report_tables.mjs
```

- 读 JSON **一律走 node**（PS5.1 `Get-Content` 默认 GBK 读 UTF-8 必乱码）
- 原始 JSON 与报告归档到当轮任务目录 `tasks/Txx/`

## 分析框架（六维 + 一实验）

1. **平台权重**：三平台累计占比 + 分批条均（按龄期折算）→ 定 P0/P1/P2
2. **A vs B**：分平台 B/A 比值（<1 说明该平台 B 无分发优势）
3. **长短/题材**：短<40s vs ≥40s 的播放/日差；题材按 视频号逐集播放 排强弱（边塞/夜景/送别 vs 长诗抒情）
4. **衰减**：decay 分档（视频号历史规律：24h ÷15、48h ÷125，每轮复测修正）
5. **互动**：评论/转发/赞率——0 评论是算法飞轮卡死信号，前置动作要写进建议
6. **合集连播**：同集 A/B 播放接近度（≈1 → 连播特征，非独立命中推荐池）
7. **发布节奏实验**：改动前后**同龄期对照**（如 连发12条/6h vs ≥5min 间隔并行），不同龄期的数字严禁直接比

## 报告模板（tasks/Txx/report.md）

1. 采集时间/范围/口径（§采集口径引用）
2. 主数据表（行=EP×版本×平台；列=播放/赞/评/转/龄期h/播放日）
3. 龄期衰减表 + 上轮结论修正
4. 节奏/实验对照表（同龄期）
5. 题材强弱表（视频号逐集）
6. 洞察 5-6 条（每条带数字证据）
7. **下一批执行建议**：平台加投清单、发布节奏裁决、选片权重修正、互动前置动作
8. 待补数据（完播率/次日采样/涨粉）

## 输出落点

- 全量报告 → 当轮 `tasks/Txx/report.md`（历史首轮 T83 已归档为 skill `tangshi-pipeline` 的 data-review-ep15-20 参考文档）
- **结论固化**：平台优先级/节奏铁律/选片权重 → 改 `tangshi-pipeline` SKILL 对应小节（改完 validate + zspace-skills-sync）
- 数据决策进飞书备注（可选）：`feishu-bitable` 流程，record 回读验证

## 已知数据坑速查

- B站第二批自然分发≈归零：个位数播放别当信号，只做搜索长尾存档
- 视频号方差极大（同日 145 vs 23）：单条样本 n=1 的题材结论标注方向性、需下批再验证
- 抖音 work_list 新发作品有延迟：find 带 30s×5 重试
- 龄期不对齐的两批**禁止**直接比条均（必须折算 播放/日 或同档位）
- PS 读 JSON / Read 读图（错图 bug）都不可信 → node / Pillow+MD5 / WinRT OCR
