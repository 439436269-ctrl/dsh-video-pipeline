# 完成与交付验证

按用户要求的交付范围选择检查项。任务受理、运行终态、资源选定和文件下载是不同状态，
不能把其中一个当成另一个；用户只要求生图或生视频时，无需增加下载或时间轴检查。

## 逐项状态

每个需要生成的输出都要确认：

1. 预期 Node ID 和 submit ID 已知；
2. submission 已受理或已安全恢复；
3. operation 已到终态；
4. 至少存在一个可用 Resource ID；
5. 选中资源符合媒体类型和创作意图。

不能从 HTTP 成功、任务受理或 operation reference 推断成片成功。

## 按需校验引用

用户要求保留或验证引用关系、需要精确绑定正文对象，或发现引用异常时，建议采用以下检查。
这些方法适用于图片、视频、主体和时间轴；不是每次生成的固定前置流程，无引用时跳过。

1. 读取保存响应的 `data.node`，或 `node show` 对应 FOUND 项的 `node`。按节点类型检查
   `generation.references[]`、`subjectBindings.main/voice/auxiliaries[]` 或
   `timelineTracks.tracks[].clips[].source`。预期来源必须是 `kind=node`，`id` 为原 Node ID；
   内嵌的 `resource.resourceId` 是解析后的产物元信息，不能替代来源身份。
2. `upstreamNodeIds` 必须包含每个预期上游 Node ID。参考缩略图、可用资源或生成成功都不足以证明连线。
   片段/引用顺序另行检查，连线列表不代表槽位顺序。
3. 当创作计划要求把某个上游对象落到 prompt 的具体语义位置时，回读 `generation.prompt`
   和 `generation.promptParts[]`：prompt 中应保留对应 `{{node:<node-id>}}` 占位符，
   `promptParts[]` 应出现 reference part，且其 `referenceIndex` 指向 `generation.references[]`
   中同一个 Node ID。只看到 `generation.references[]` 或 `upstreamNodeIds` 不能证明 prompt
   中的对象及其动作、位置或关系已经绑定到预期节点。
4. 有意使用资源引用时，核对其 ID 及记录的原因（无来源节点或用户明确要求冻结）。
   不要求系统反查恰好持有该资源的节点并连线。
5. 来源身份错误或 prompt 落位缺失时，不带 `--run` 编辑已有节点，保留无关字段及编辑契约要求的完整生成配置或时间轴轨道，
   然后回读复验。不要为修引用重新生成或扣分。若保存来源已是 `kind=node` 但缺少连线，
   保留 `meta.requestId`、Node ID 和 `savedDraftVersion` 排查，不降级为资源引用。

来源、连线或 prompt 落位信息缺失/截断时，该项仍未验证。交接时说明缺口，不能宣称画布结构完整。

## 画布/镜头序列校验

以下是 Agent 对最终结果的验收，仅在用户要求多镜头或多轨序列时执行。独立图片、视频或音频素材
不要求时间轴(timeline)，也不要求无关媒体节点。序列工作需要确认：

- 用户要求的镜头和音频均存在且没有重复；
- 依赖顺序、时间轴顺序、clip 数量和时长符合用户确认的方案；
- 需要音画对齐时，画面覆盖用户要求的完整音频时段；
- 用户要求验证引用关系时，下游引用符合上述适用检查。

## 下载校验

用户要求文件时：

- 显式选择 destination，避免意外覆盖已有文件；
- 检查 CLI 返回的字节数；零字节或明显异常的文件不能作为有效交付；
- 记录 CLI 返回的 SHA256；用户提供期望 checksum 时，显式比对两者；
- 需要确认文件格式时检查实际内容，不只根据扩展名判断。

## 交接

向用户提供结果入口及必要的未解决项。简单任务通常只需画布链接或产物；
以下身份与恢复信息按续作、排障或文件交付需要保留，不要求全部展示：

- 画布/项目身份；
- 最终节点/时间轴身份；
- 选中 Resource ID；
- 用户要求下载时的路径与 CLI 返回的 SHA256；
- 保留的备选方案或未解决项；
- 每次运行的 operationRef（=submitId），用于恢复同一次工作。
