# 身份与引用

判断该持久化什么身份、下游应如何消费上游素材时，读取本文件。

## 先选来源节点，再看产物

目标画布已有来源节点时，下游生成、主体(Element)绑定和时间轴片段都使用其 Node ID。
不要仅为了构建引用而读取或复制它的 Resource ID，生成成功后也一样。节点引用保留上游连线，
使用来源节点的选中产物；资源引用冻结素材，不会反查来源节点并连线。

| 用途 | 画布已有来源节点时的默认写法 |
| --- | --- |
| 图片/视频生成，包括首尾帧 | `--ref node:<node-id>` |
| 正文中的媒体占位符 | `{{node:<node-id>}}` |
| 主体的主素材/音色/辅助素材 | `--main <node-id>`、`--voice <node-id>`、`--auxiliary <node-id>` |
| 时间轴视觉/音频片段 | `--clip <node-id>,kind=canvas_node`、`--audio-clip <node-id>,kind=canvas_node` |

节点返回的 Resource ID 标识具体产物，供资源状态和元信息查询、下载与选片记录使用。
操作轮询本身使用 `operation status|wait <submitId>`，不要求 Agent 先从节点取 Resource ID。

资源引用只用于资产库/上传后尚无来源节点的素材，或用户明确要求固定某一产物、不跟随后续选片。
适用例外时记录原因及选中的 Resource ID；其他情况保留 Node ID。导入资源一旦已有画布节点，
后续优先引用该节点。保持一致性、生成成功或响应包含 `resources[]` 都不是冻结理由。

需要确认引用结构或排查连线时，可按 [completion-and-validation.md](completion-and-validation.md)
校验保存后的来源身份和上游连线。没有引用的生成无需执行这些检查。
生成成功或出现参考缩略图，不能证明节点关系存在。

## 公开身份模型

生成引用有四个显式协议类型，其中只有两类当前会解析成业务对象：

| 身份 | 书写形态 | 含义 | 适用场景 |
| --- | --- | --- | --- |
| Node ID | `node:node_xxx` | 画布节点，其选中媒体产物或 Text 内容可能变化 | 画布已有来源节点时的默认选择，保留上游连线 |
| Resource ID | `res:<小写规范 UUID>` | 某一份具体素材结果 | 无来源节点，或用户明确要求冻结；不反查节点连线 |
| URI / VID | `uri:<value>` / `vid:<value>` | 仅预留协议值，当前不解析 | 只用于对象与枚举表达 |

生成引用 flag 与正文占位符使用 `type:value` / `{{type:value}}`。主体(Element)和时间轴(timeline)
selector 沿用现有裸 Node ID / Resource ID 契约，它们不是本次生成引用协议。

其余形态由 CLI 在**本地**拒绝并以参数错误退出，**不会发出请求**：

- `uri` / `vid` 可以作为带类型的协议值传输，但服务端会明确返回暂不支持；不要在 CLI
  解析或当作访问能力。
- Resource ID **只认小写规范 UUID 一种写法**：大写、`urn:uuid:` 前缀、去掉连字符、加
  `resource_` 前缀都被拒。

存在性、类型、状态、项目关系和授权仍由服务端权威判断：形态合法只说明「写法对」，不代表可用。

## 解析规则

1. 每次解引用都针对已认证 actor 和目标画布/项目实时判断。
2. 仅知道 ID 不代表可用；无权、不存在或关系已失效的素材不能继续引用。
3. 主体(Element)绑定使用的 Node ID 必须属于目标主体(Element)所在画布；跨画布、不存在与无权 Node ID
   在公开面返回同形错误。
4. 跨画布 Resource 使用是 borrow，不会隐式建立新的持久所有权关系；来源权限撤销后可能失败。
5. 语法或 capability hint 不是授权快照。
6. 临时访问材料只能在内存中立即消费，永远不是持久身份。
7. 引用什么决定何时校验终态：`res:`（Resource ID）引用要求素材已达成功终态，还在生成中就在
   **保存期**被拒；`node:`（画布节点）引用则**允许指向还在生成中的上游节点**，其终态留到
   **run 期**才校验。所以想承接一个尚未出图的上游产物，应该引用它的节点（`node:node_xxx`），
   不要用它尚不存在的 Resource ID。Text 上下文不要求先生成 Resource，但源节点必须可访问、
   内容必须可读（可访问性与可读性主要在 run 期兜底校验）。
8. 「不存在」「无权」「已解绑」三种情形返回**同一个**错误，刻意不可区分。不要试图从错误码
   推断某个 ID 是否存在。

## 上传素材的身份

> 仅适用于 schema 暴露 `resource upload` 的制品；`schema` 中没有它时跳过本节。

注册了 `resource upload` 的制品会在 `schema` 中暴露它；本地文件上传是受限的运行时能力，并非每个
这类制品都装配。未装配时以服务端准入为准。本地图片、视频与音频都直传后登记为项目资源；
图片 `--source-url` 仍由服务端抓取转存。结果始终包含 `resourceId + mediaType`，不按 `--import-kind`
区分，也不下发服务端存储句柄；`resourceId` 可用于 `res:<resourceId>`、`resource get/download`
与 `node create --resource-id`。用 `--resource-id` 导入已登记资源时，必须同时声明 `--import-kind`，
取值与登记意图同一套词汇：
`local_upload` 表示本地上传素材，`external_generated` 表示外部平台生成产物。
两种取值也都可不绑定 Resource 单独声明。`--resource-id` 接受其中任一种 import kind，自定义位置仅允许
`--import-kind external_generated`；该值只作为创建意图消费，不进草稿。

`resourceId` 同时是 `node create image|video|audio --resource-id` 的入参：创建时声明「这些已登记
资源属于本节点」，让节点落地即带产物。用于把本地上传或外部平台已生成的产物导入画布，同时带上
原平台的 prompt 与模型参数以便继续改、再生成。多个 resourceId 视为同一批次内的候选，顺序即候选
顺序，首个为主选；仅 create 支持，仅媒体节点支持资源声明。`text` / `element` / `timeline` 也可声明
同一组 `--import-kind` 取值，但不得传 `--resource-id`。

仅 `external_generated` 的六类 `node create` 可成组传入 `--x --y`。两个值必须全有；显式位置优先于
服务端智能布局，整组缺席时保持智能布局。资源归属、状态与类型匹配由服务端裁决且
拒绝而非静默丢弃；节点 source 由服务端物化，调用方无法指定。

跨项目或区域复刻画布时，先用 `node show` 读取每个源节点，并把 `node.layout.x/y` 原样传给
目标节点的 `--x --y`；应保留源画布坐标系，不得另造网格。`layout.width/height/zIndex` 是读回与
布局验收事实；当前 `node create` 只接收位置，尺寸和层级仍由 Core 与 Sync 物化。

批次身份取同一条命令的 `--submit-id`（省略则自动生成）：重试复用同一值即批次身份稳定。
这是 `--submit-id` 唯一能脱离 `--run` 使用的场景——导入走纯保存链，但同样需要提交身份。

## Prompt 引用

生成引用使用上述显式类型。当前可用公开身份是 `node` 与 `res`；`uri` 与 `vid` 仍是预留
协议值，不是 upload 结果提供的访问能力。

Prompt 中有两种不同用途，不能混淆：

- `--ref node:<node-id>` 把来源节点加入生成引用集合，提供素材槽、顺序和上游连线。
- `{{node:<node-id>}}` 将来源节点绑定到正文当前位置，相当于产品 prompt 里的对象 @ 引用。
  CLI 使用稳定的公开占位符；自然语言名称或手写的 `@名称` 不会建立节点引用。

当 prompt 同时描述多个可复用人物、物体或环境，并且这些对象在句子里承担不同动作、位置或关系时，
建议在对应词语位置使用 `{{node:<node-id>}}`。仅把同一批节点追加到 `--ref`，虽然能建立引用集合和
画布上游关系，但不会表达每个节点对应正文中的哪个对象及其动作、位置或关系。

以下为参数片段；`node_a`、`node_b` 代表已查询确认、类型适配当前 mode 的实际 Node ID，
使用时替换并补齐当前 schema 要求的字段：

```bash
--mode i2i \
--prompt "将{{node:node_a}}放在左侧，将{{node:node_b}}放在右侧" \
--ref node:node_a \
--ref node:node_b
```

同一个节点同时出现在正文占位符和 `--ref` 中时，会合并为一个引用槽；最终槽位顺序以保存后
`generation.references[]` 为准，不能仅从 flag 顺序推断。正文占位符不替代 mode 的首尾帧等槽位配置。
若该节点只作为额外风格、背景参考或 Text 前导上下文，
不需要绑定到正文位置，则可只放在 `--ref`。Text 节点仍遵守下文的限制，不能写成正文占位符。

首尾帧、主辅素材或模型 slot 的引用顺序可能有语义，必须保留用户计划与 model schema 的顺序。

读回节点时，正文以你写入时的同一套公开占位符形态返回——写 `{{node:node_xxx}}`，读出来也是
`{{node:node_xxx}}`。这条闭合正是读回结果能直接
当下一次写入输入的理由，也正是 Resource ID 只允许一种书写形态的原因：接受大写或 `urn:uuid:`
之类的等价写法，读回时就只能给规范化后的那一份，逐字闭合随即失效。

正文只从节点的 `generation` 读，不要从响应里同时存在的 opaque 画布草稿 body 读。非生成型节点没有
`generation`。它的 `references` 就是槽位序，混用正文占位符与显式引用 flag 时，读它来确认
最终顺序。

### 视频 mode 取决于解析后的来源类型

不能仅凭「恰好有一个 Node 引用」就选择帧模式。`node_` 前缀只能说明它是画布 Node，不能区分
图片、主体(Element)、Text、视频或音频。先查询被引用 Node 或 Resource 的真实类型，再根据解析后的
素材类型与实时模型能力选择公开 mode：

| 解析后的生成素材 | 公开 `--mode` | 约束 |
| --- | --- | --- |
| 没有媒体素材 | `t2v` | 不能携带媒体引用 |
| 一张图片作为锁比例首帧 | `first_last_frame` | 图片占首帧槽位并决定输出 ratio |
| 两张有序图片 | `first_last_frame` | 顺序依次为首帧、尾帧，两张原图 ratio 必须一致 |
| 单图但需保留调用方指定 ratio | `m2v` | 使用兼容的多模态模型 |
| 主体(Element)节点或混合多模态素材 | `m2v` | 使用实时模型查询返回的兼容模型 |

主体(Element)仍使用带类型的 Node 引用。通过 `--ref node:<element-node-id>` 引用，并搭配 `--mode m2v`：

```bash
--mode m2v \
--ref node:node_element \
--prompt "让{{node:node_element}}在描述的场景中动起来。"
```

`m2v` 是 CLI 对 multimodal 模式的公开写法。服务端生成规格中可能使用 `multi_modal`，但
`multi_modal` 不是 CLI `--mode` 的合法值。主体(Element)不能占用 `first_last_frame` 的帧位。

### Text 节点仅作为上下文引用

Text 不是图片/视频素材，但在所选 mode 允许时，可以通过 `--ref node:<text-node-id>` 提供
prompt 上下文。不能在 prompt 正文中写 `{{node:<text-node-id>}}` 占位符。图片、视频保存入口
都有这条限制，即使同时提供了合法图片引用也不例外。
把 Node ID 写成正文占位符前，先查询源节点类型；不能仅凭 `node_` 前缀区分
Text 与媒体节点。

运行时会读取被引用 Text 的内容，并作为上下文拼到 prompt 前面；它不占媒体素材位，也不是在
正文指定位置展开。仍须满足所选 mode 对 `--prompt` 与引用的要求。

引用位置与 mode 必须一起判断：

生成 mode 使用简短的协议名，完整含义为：`t2i` = text-to-image（文生图）、
`i2i` = image-to-image（图生图）、`t2v` = text-to-video（文生视频）、
`m2v` = multimodal-to-video（多模态生视频），视频另有 `first_last_frame`（首尾帧），
音频有 `tts`（text-to-speech，文本转语音）/ `music`（音乐）。image-to-video 不是公开 CLI 模式：
单图生视频用 `first_last_frame`（一张首帧图），图片或视频引导的生成用 `m2v`。模型发现服务可能
返回内部写法，但 CLI 始终归一回这些公开名。

| 输入 | 引用约束 |
| --- | --- |
| 图片 `t2i`：Text 放 `--ref`，正文为普通文字 | 合法的上下文形态，不要求图片素材；T2I 不等于引用列表必须为空。 |
| 图片 `i2i`：`--ref` 里只有 Text | 拒绝：Text 不能满足 I2I 至少需要一份图片、主体(Element)或图片 Resource 的要求。只有 Text 上下文时用 `t2i`。 |
| 图片 `i2i`：图片和 Text 都放 `--ref`，正文为普通文字 | 合法的混合形态：图片提供素材，Text 提供上下文。 |
| 图片 `t2i`：引用图片、主体(Element)或 Resource | mode 不匹配；图片素材输入应使用 `i2i`，额外添加 Text 不会使其变成 T2I。 |
| 图片/视频：Text 写进正文占位符 | 拒绝；即使同一个 Text 也放了 `--ref`，或者存在合法图片素材，仍然拒绝。 |
| 视频 `m2v`：图片素材加 `--ref` 中的 Text | 合法的上下文形态，仍需满足所选模型的素材与参数要求。 |
| 视频 `t2v`：存在任何引用 | 当前 CLI 拒绝，包括 `--ref` 中的 Text；不能把图片 T2I 的规则照搬到视频 T2V。 |

视频 `first_last_frame` 还有 CLI 引用数量约束：合并后必须为一条或两条。
额外添加 Text 会占用这项数量校验的条目，虽然它不算媒体素材，也不能替代帧。
不要给所有视频 mode 无差别添加 Text。

上述合法形态描述的是引用契约，不保证任意模型、制品版本或环境都能保存或运行成功。
源节点权限、媒体就绪状态和模型约束仍需满足；协议校验与实际端到端验证必须区分。

下面是参数片段，`node_text`、`node_image` 分别代表已经查询确认的真实 Text、图片 Node ID，
使用时另行补齐命令所需的其他字段。

图片只有 Text 上下文：

```bash
--mode t2i --ref node:node_text --prompt "根据参考文字生成海报。"
```

图片素材与 Text 上下文都使用引用列表：

```bash
--mode i2i --ref node:node_image --ref node:node_text \
--prompt "按参考文字修改参考图片。"
```

视频混用 Text 与图片时，只有图片可以放进正文占位符：

```bash
--mode m2v \
--ref node:node_text \
--prompt "让{{node:node_image}}中的画面动起来。"
```

需要在正文指定位置使用某段文字时，直接写普通文字，不使用 Text 节点占位符。复制后的文字
不会跟随源节点后续修改；除非确实需要它再次作为前导上下文出现，否则不要同时添加同一个 Text 引用。

### 引用拒绝的诊断边界

`service.2` 只是参数错误分类，不能证明 Text 全面不支持，也不能证明请求被生成模型拒绝。
存在 `validation` 时，按 `requiredAction` 处理，用 `reasonCode` 判断校验类别，用 `fieldPath`
定位字段。`detail` 仅用于展示和辅助修正，其措辞及动态值可能变化，不能用于自动化判断；数量、时长和
模型上限以 `model list`、报价结果或结构化字段为准。`validation` 缺席时也不要匹配 `message`；
排障优先保留 `requestId`，缺失时回退到 `traceId`。

下表只用于人工排查，不是稳定机器契约：

| 日志中的原始诊断（可获得时） | 含义与修正 |
| --- | --- |
| `i2i requires at least one image, subject, or resource reference` | 缺少真实 I2I 素材。只有 Text 上下文时用 `t2i`，或补充合适的图片素材。 |
| `text canvas reference must not appear in the prompt; pass it through the reference list only` | 删除正文里的 Text 占位符，把 Text 留在 `--ref`；其余输入仍须符合所选 mode。 |
| `t2i accepts only Text canvas references` | T2I 输入包含非 Text 素材；需要这些素材时应选择 `i2i`。 |

服务端先校验公开引用身份的格式，再解析节点真实类型，并在保存期校验 mode/素材及正文引用位置。
不能因为服务端返回错误，就判定是节点类型白名单拒绝 Text，或认为生成已经派发。

未加 `--run` 时，`ok=true`、保存后的 prompt parts 和 upstream 连线只证明保存成功，不证明
媒体生成成功；用户要求生成时，还需单独验证运行和 Resource 终态。

## 图片与视频生成配置编辑

`node create|edit image|video` 一旦提供任一 generation 参数，就必须显式传入非空 `--mode`：
包括 `mode`、`prompt`、`model`、`ratio`、`resolution`、`count`、`ref`，以及视频的 `duration`。
没有默认模式，edit 也不继承已保存节点的模式。缺失或空 mode 会在本地以
`cli.generation_mode_required` 和退出码 2 拒绝。

Generation 是完整替换，不是字段级 patch。需要保留原 prompt 或引用时，先读回保存的
`generation`，再提交包含 mode 与目标 prompt 的完整输入。模型规格允许时，图片/视频草稿可保存空正文；
保存成功不证明已经可以运行。服务端在 Run claim 和扣费之前校验投影后的生效正文。
空正文无法自动命名节点时，`create --run` 必须显式给标题。只改 title/tag、`--clear-tags`
或单独 `--clear-generation` 无需 mode。不能同时传 `--clear-generation` 和 generation 参数。
添加 `--run` 不改变上述输入规则。

## 音频模型与音色选择

命令参数、输出字段和分页示例见 [主 Skill 的“模型与音色发现”](../SKILL.md#模型与音色发现)。

音频 `music` 的模型必须**查询获得**，不能凭空构造。执行 `model list --type audio`，
选择 `modes[].name` 为 `music` 的结果，把该 canonical `model` 通过 `--model` 传入。音频固定单输出，
不接受 `--count`。TTS 相反：不传 `--model`，改选 `--voice-name`。

TTS 音色名必须**查询获得**，不能凭空构造。只能从实时分页 `voice list` 目录中选择。

规则：

1. TTS 必须给 `--voice-name`；不要翻译、规范化或音译查询到的名称。
2. Audio 保存域会把名称解析为运行时身份；CLI 全程不处理或持久化 canonical ID。
3. 目录分页返回。想要的音色未出现在第一页时，用返回的 `nextOffset` 继续翻页，
   而不是断定它不存在。
4. 音色平台不属于该入口，由服务端注入。
5. 把你选定的音色名作为创作决策的一部分持久化，使重跑能复现同一音色。

## 需要保存的状态

可恢复创作任务应保存：

- 画布/项目身份；
- 稳定业务键到 Node ID 的映射；
- 每次运行的 submit ID 和 operation reference；
- 选中的终态 Resource ID；
- 下游关系是跟随 Node 还是冻结 Resource。

不得持久化未公开内部标识、signed URL、provider task payload 或短期确认材料。
