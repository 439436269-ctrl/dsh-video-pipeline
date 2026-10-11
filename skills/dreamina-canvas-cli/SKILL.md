---
name: dreamina-canvas-cli
description: >
  通过 dreamina-canvas CLI 创建、查看、修改与交付 Dreamina/即梦画布，
  并处理媒体生成、资源下载、积分确认与中断恢复。
---

# Dreamina Canvas CLI

当用户希望在 Codex、Claude Code 等外部 Agent 宿主中创建、查看、续作或交付
Dreamina/即梦画布时，使用本 Skill。

本 Skill 面向 Agent，用词偏技术化（如 canonical model、Node ID、submit ID、mode、报价 ceiling
等）。这些是你调用与推理时的内部事实；与用户交流时应转述成用户能听懂的日常说法，不要直接抛这些术语。

## 操作前核对

命令、flag、模型等一切可执行事实以已安装二进制为准，本 Skill 只描述能力与边界。开始操作前：

1. 查看已安装二进制版本及其 `schema` 输出。
2. 对目标 profile 执行 `auth status`。需要登录或认证失败时，按[认证与执行权限](references/authentication.md)处理。
3. 通过 `model list --type <image|video|audio>` 读取当前模型与可填写 flag，需要 TTS 时通过
   `voice list` 读取音色目录。用户只知道熟知名/别名（如 `seedance_1.0_fast`）时，用
   `model find <name...>` 把它解析到 canonical model，返回与 `model list` 同形的可调用规格。
   只有集成需要查看某个 canonical 模型的底层完整规格时，才使用 `model <name...>`。
4. 只使用该 release 实际暴露的命令和字段。
5. 如果本 Skill 与二进制冲突，停止使用有争议的说明并报告版本不匹配。

不得凭记忆猜测命令、flag、模型、比例、分辨率、枚举或 JSON 字段。

`model` 返回的 `generation.isVip` 是模型级会员要求，`vipConfigs[]` 是分辨率档位级会员要求。
显式 `false` 与字段缺席含义不同；缺席不得推断为不要求会员。它们描述的是规格，不是当前账号
会员状态、积分余额或积分批准结果，实际保存与运行是否允许以服务端的最终准入为准。

`model list` 返回的 `model` 是传给 `--model` 的 canonical 值；`aliases` 只用于把用户说法或
展示名匹配到 canonical 值，禁止把 alias 当作模型入参。调用方只知道这类名字（营销版本号、简称或
别名）时，运行 `model find <name...>`：它在实时目录上按 canonical `model` 与 `aliases` 做大小写
不敏感匹配（精确先于子串），返回 canonical `model` 及其可填写 flags。`flags` 只包含当前 CLI 真实
接受、且动态约束来自实时 generation spec 的 flag。规格没有下发 materials 时不返回 `references`；
`references.types` 也只包含规格明确允许的素材类型。字段缺席时不得自行补写或推断。

## 模型与音色发现

### 选择可调用模型

```bash
dreamina-canvas model list --type image
dreamina-canvas model find "用户给出的模型名" --type image
```

- `model list` 必须指定 `--type image|video|audio`。`data.items[]` 按 canonical `model`
  聚合；一个模型可有多个 `modes[]`，每个 mode 只列当前 CLI 可填写的 `flags[]`。
- `references.min/max` 是该 mode 的素材总数范围；`references.types[]` 给出每种素材的
  `mediaType/min/max`。`references` 缺席表示上游规格未提供 materials，`types: []` 表示规格
  明确没有启用任何素材类型，两者不能混为一谈。
- 已知用户说法、展示名或 alias 时优先用 `model find`；它的 `--type` 可省略，已知媒体类型时应传入以缩小结果。
  匹配顺序是：精确 canonical model、
  精确 alias、canonical 子串、alias 子串；返回多项时必须结合用户意图或让用户选择，不能默认第一项。
- 创建/编辑节点时只把返回的 canonical `model` 写入 `--model`；服务端仍会按提交时的最新规格
  重新校验，发现结果不是永久授权。
- `model <canonical-name>` 只用于查看单个模型的底层完整规格，
  输出是 `matches[].generation`，不要把它当作 `model list/find` 的紧凑结构解析。

### 选择 TTS 音色

```bash
dreamina-canvas voice list --offset 0 --count 50
```

- 读取 `data.models[model].items[].voiceName`；对每个 hasMore=true 的模型，把其 nextOffset 原样用于下一页
  --offset 并携带对应 --model，直到 `hasMore=false`。`totalCount` 是目录总数，不是当前页条数。
- `voice list` 接受 `--offset`、`--count` 和可选 `--model <canonical-model>`。
  不传 model 返回当地已接入的全部 TTS 模型目录；指定 model 返回单键 map。当地没有模型返回空 map；显式指定未支持的路由会失败。翻页时保持 model 和地区不变。
  offset/count 默认分别为 `0`、`50`，且 `--count` 必须在
  `1..100`。它没有 `--language`。界面语言或用户文本语言都不能用来推导数据区域。
- TTS 把选中的 `voiceName` 原样传给 `--voice-name`；禁止翻译、音译、归一化或编造名称。
  canonical ID 与 platform 由服务端解析和持有，不进入 CLI 对外契约。
- TTS 不传 `--model`。音乐生成则相反：用 `model list --type audio` 选择包含 `music` mode 的
  canonical model，不传 `--voice-name`。

## 按协议主题读取

CLI 的命令、参数与输出以当前 release 的 `schema` 为准；Markdown 只补充代码无法完整表达的
跨领域协议边界。按当前问题读取：

| 协议问题 | 读取 |
| --- | --- |
| 处理 Node ID、Resource ID 或正文引用 | [references/identity-and-references.md](references/identity-and-references.md) |
| 处理报价与积分确认 | [references/credits-and-hitl.md](references/credits-and-hitl.md) |
| 恢复中断或结果不确定的操作 | [references/recovery-and-idempotency.md](references/recovery-and-idempotency.md) |
| 判断是否已完成交付 | [references/completion-and-validation.md](references/completion-and-validation.md) |

## 打开当前画布

创建画布成功或确定要操作的已有画布后，使用 CLI 返回、与目标 `projectId` 匹配的 `webUrl`，
在用户可见的浏览器中打开画布。`canvas create` 与 `canvas ls` 会返回该 URL。
遵循用户指定的浏览器；未指定时，优先使用 AI 工具宿主的内置浏览器，其次使用系统默认浏览器。
复用已有的对应标签页，不因连续执行 CLI 命令重复打开。用户明确要求不打开浏览器，或当前环境
无法打开时，提供可点击链接并继续已获授权的 CLI 操作。

## 最小充分创作图

外部 Agent 根据用户目标、输入素材与实时 `schema` / `model` / `voice` 事实自主规划，不从
Markdown 套用任何特定创作领域的配方。节点用于交付用户要求的内容、组织满足目标所需的复用素材或承接模型的真实依赖；
不得为了让流程看起来完整而增加剧本、主体(Element)、关键帧、音频、时间轴(timeline)或固定镜头数。

简单生图或生视频可直接使用满足需求的生成路径；下文的一致性、主体、正文引用及分阶段执行建议
仅在任务需要时采用，不是前置步骤。没有引用对象时使用普通 prompt 即可。

先创建能完成目标的最小充分节点图。生成后检查真实资源内容，而不只检查接口成功；结果不满足
用户目标时，针对失败部分局部重规划，不无条件重建整张图。扩大交付范围或增加积分花费不得静默发生。

### 按需建议可复用能力

主体(Element)与时间轴(timeline)是可选能力，不是必经流程：

- **主体(Element)** 表达会在多次生成中复用的人物、物体、产品、环境或其他视觉要素；
  同一对象需要跨多个独立画面保持身份一致时，建议优先考虑创建或复用主体，作为后续图片/视频的统一引用入口。
- **时间轴(timeline)** 把已有素材组装成多片段或多轨成片；它不等于必须有音频。
  用户需求未提到音频时，不为了补全流程而创建或建议旁白、音乐和音效。

按实际复用需求选择结构，不按交付次数判断：一部作品也可能包含多个独立生成的画面。
单次生成或直接延续一张画面的构图、运动时，可直接引用图片/视频节点。
Agent 可在用户目标与已授权范围内自主采用主体等能力，无需用户先说出功能名称或额外选择。
直接引用已有素材足以满足目标时，也可保持简单路径；主体不是所有任务的前置步骤。

创建时间轴(timeline)前先读取待合成媒体的实际时长。无法对齐时，给出裁剪、重生成或保持分离的选项；
不自动补音频、不静默拉伸素材，也不留下未解释的尾段。

### 跨产物一致性

要在多个输出里复用同一视觉对象，应引用能够体现其身份的视觉素材。
仅重复相同名字或描述不能绑定具体对象；引用能为一致性提供依据，结果仍需检查。

优先复用已有或导入的合适素材；缺少素材时再按用户目标生成。
画布已有来源节点时优先使用 Node ID；保持一致性不需要冻结其 Resource ID：

- **引用图片/视频节点**：用 `--ref node:<node-id>` 复用其选中产物并保留画布上游连线。
  不要默认提取该节点的 Resource ID 作为下游引用。
- **引用主体(Element)**：需要复用或组织主/辅素材时，可创建或复用主体节点，再用 `--ref node:<element-node-id>` 引用。
  适合跨多个独立画面复用同一身份。已有合适素材时可直接绑定，不必为了创建主体额外生成。
- **在 prompt 中定位引用对象**：需要将对象绑定到正文具体位置时，使用 `{{node:<node-id>}}`。
  仅传 `--ref node:<node-id>` 不表达正文位置。适用类型、示例与引用顺序见
  [references/identity-and-references.md](references/identity-and-references.md)。

需要表现不同角度或辨识细节时，可围绕同一对象准备正面、侧面、背面或局部参考，
选清晰、能辨认身份的素材作为主体主素材，其余适用图片作为辅助素材；具体绑定按当前 schema。
新增视角时建议引用已有对象素材，保持外观和细节连续。多对象需独立复用时，建议分别组织，
避免把多人合照当作每个对象唯一的身份依据。

道具若只是对象的辨识细节，可作为局部参考；需要独立出镜、变化或复用时，可单独组织为素材或主体。
视角、素材数量及是否创建主体由用户要求、画面需要和模型能力决定，不固定要求多视图、道具或完整套图。
创建主体或增加参考图本身不保证一致性，仍需检查实际产物。

Resource ID 用于资产库等没有来源节点的素材，或用户明确要求冻结某次产物的场景。
资源引用不会反查生成它的节点并连线。导入素材一旦已有画布节点，后续仍优先引用该 Node ID。

可以先保存对尚未就绪节点的引用；运行下游生成前，媒体来源必须有可用素材。
引用与所选 mode 的配合规则见 [references/identity-and-references.md](references/identity-and-references.md)。

## Agent 执行主循环

以下是参考流程，具体执行按用户目标诉求借鉴，避免强制套用这个路径：

1. **发现上下文。**解析 region、已认证账号、当前画布和二进制版本。不得从语言推导数据区域。
2. **先读后写。**回读当前画布和相关节点，聊天记忆不能替代权威画布状态。
3. **发现实时能力。**选模型和生成参数前，先查询 schema。按类型浏览用 `model list --type <type>`；
   已知用户说法或 alias 时用 `model find <name...>`。写入时只使用返回的 canonical `model`。
   需要 TTS 时查询 `voice list`。
4. **规划最小创作图。**为每个请求的交付物和镜头建立稳定业务键，只记录真实依赖和人工决策点。
5. **副作用前冻结身份。**保存重试所需的公开 Node ID、Resource ID、update ID 和 submit ID。
6. **按需先保存结构。**引用关系复杂或需要排查连线时，建议先保存、检查，再生成。
   简单生成可直接使用当前 schema 支持的保存并运行路径。引用校验方法见
   [references/completion-and-validation.md](references/completion-and-validation.md)。
7. **报价并按需停下。**报价不等于授权；需要批准时向用户展示金额和 ceiling，等待明确决定。
8. **按依赖阶段执行。**不得把有依赖的 DAG 无序并发；只恢复失败或不确定的 item。
9. **继续同一次工作。**超时、响应丢失或进程重启后，复用原 submit ID 或 operation reference。
10. **验证交付。**必须看到资源终态和用户要求的结构；只有时间轴(timeline)或下载文件属于交付物时才校验它们；
    受理不等于完成。

## 持久化最小 job state

可能跨进程执行的工作，应维护一份用户拥有的状态记录。推荐形态：

```json
{
  "jobKey": "job-example",
  "canvasId": "...",
  "items": {
    "output-1": {
      "nodeId": "...",
      "submitId": "...",
      "operationRef": "...",
      "selectedResourceId": "..."
    }
  }
}
```

只保存持久公开身份和创作选择。不得保存 access token、signed URL、provider payload、
临时下载材料或 credit-confirmation token。

## 必须交回用户的停顿点

以下情况必须停下并询问用户：

- 用户需求存在明显不同且都合理的创意方向；
- 服务端要求积分批准，或最新价格超过已批准 ceiling；
- 来源素材不再有权限；
- 用户要求破坏性或不可逆选择；
- 多个终态方案需要主观选片；
- 结果不确定，自动重试可能重复创建或重复花费。

不得代替用户追加确认。便利性的 `--yes` 只能在该 release 明确允许时回答本地提示，
绝不能绕过授权、安全策略、区域策略或服务端积分闸门。

## 错误处置

只按结构化字段和退出分类分支，不能解析本地化 message：

- 需要确认：展示计划和 ceiling，等待用户决定；
- 需要登录：恢复认证后复用原身份重试；
- 权限或安全策略拒绝：停止，换 retry ID 没有用；
- 可恢复/不确定：继续观察同一个 operation；
- 可重试的传输或服务失败：退避并复用该操作原本的提交身份（生成走 submit ID，纯保存走 update ID），不要换新 ID；
- 需要人工介入：保存状态并解释未解决的选择。

## 硬边界

- 公开身份使用 Node ID 与 Resource ID，只持久化 release schema 明确公开的标识。
- 使用 `node find` 选择节点时，必须从该次响应的 `data.items[].nodeId` 取得所选身份，
  不能用记忆中或其他命令的无关 Node ID 替代；事先明确持久化的 Node ID 是另一条有效身份来源。
- Node ID 跟随节点最新选中产物；Resource ID 冻结某一份具体素材。
- 批量 `node run` 为每个 `--node-id` 配一个 `--submit-id`（数量相同、按位置对应）；
  不能用一个 request-level submit ID 代表整批。详见
  [references/recovery-and-idempotency.md](references/recovery-and-idempotency.md)。
- 选择视频 mode 前必须先解析被引用对象的真实类型；按来源选 mode 的规则与
  `first_last_frame` / `m2v` 区别见
  [references/identity-and-references.md](references/identity-and-references.md)。
- 音频 `music` 需要查询获得的 `--model`（`model list --type audio` 中 `modes[].name` 为 `music` 的结果）；
  TTS 不传 `--model`，改用 `--voice-name`。详见
  [references/identity-and-references.md](references/identity-and-references.md)。
- 引用只认文档化形态；未文档化的存储标识本地即拒，Resource ID 只接受小写规范 UUID。
  跨画布 Resource 使用是 borrow，不是所有权转移。详见
  [references/identity-and-references.md](references/identity-and-references.md)。
- Markdown 不能覆盖 schema、model/voice 发现结果、授权或服务端状态。
- 保留 JSON 响应顶层的 `meta.requestId`（存在时）。它就是该请求及其下游调用的关联 ID，
  反馈问题、请求支持时使用。
- 不得暴露或持久化未公开的存储/provider 标识和访问材料。
- 不调用未公开端点，也不自行拼 raw HTTP。
- 运行已受理或拿到 provider task ID 都不能作为成片完成标准。
