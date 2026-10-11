# 恢复与幂等

超时、进程中断、传输丢失、批量响应不完整或终态不确定时，读取本文件。

认证失败时，先遵循[认证恢复流程](authentication.md)，再续跑同一操作。

## 副作用前冻结身份

- node save：保存 release 声明的 Node ID 与 update ID；
- node run：为每个输入 item 保存一个 submit ID；
- 长 operation：保存返回的 operation reference；
- 最终选片：保存选中的 Resource ID。

不能因为第一次响应丢失就换新 identity。

`node run` 的每个 `data.items[].submitId`，就是 `operation status` / `operation wait` 接受的
`<operation-ref>`。用 `operation wait <submitId> --project-id <projectId>` 观察同一次工作；不要传
Node ID，也不要另造 UUID。

## 恢复决策表

| 观测 | 动作 |
| --- | --- |
| operation 仍为 `running` | 继续观察同一个 operation reference |
| 本地 wait 时间预算耗尽 | 返回可恢复状态（退出码 `20`）；服务端任务可能仍在运行 |
| 媒体 `--run --wait` 已受理，但 status 查询失败 | 保留 `partialData.items[0]` 的 `nodeId`、`submitId` 和 `state=ACCEPTED`；执行 `operation wait <submitId> --project-id <projectId>`，不要重跑 create/edit/run |
| **媒体 `--run` 报价后退出 `10`** | 节点已保存且没有扣费。复用 `partialData.items[0]` 里的 **两个**身份（`nodeId` 与 `submitId`），补上批准方式重跑 |
| submit 响应丢失 | 用同一个 submit ID 做只读检查，**不要重放运行**——原请求可能从未到达服务端，重放会成为首次提交并真实扣费 |
| submission 已 `completed` / `in_progress` | 重放记录结果，不重新索要确认 |
| submission 不存在且授权过期 | 重新报价，需要时重新批准 |
| item 终态 `rejected` | 修正输入/策略，盲目重试无效 |
| **submission 状态为 `absent`** | 不可据此断定没有运行：记录可能已过期。任何重提前先核对画布或积分账本 |
| identity 暂时无法解析且 submission 已 `accepted` | 保持 `unknown` 并要求 resume，绝不能返回空成功，也不要重新提交 |

status/inspect 必须只读，不能为了找到 Resource ID 暗中触发生成。

wait 对瞬态 status 查询失败按轮询间隔最多额外重试两次，共享原 timeout；绝不重复执行
save、quote、confirm 或 run。`--timeout 0` 只查一次。媒体提交已受理后，瞬态重试耗尽、
等待超时或中断返回 `ok=false`、退出码 `20`、`class=operation_incomplete`、
`retryable=false` 与 `requiredAction=resume`。这表示不能重跑原 create/edit/run；
可以用返回的 submit ID 发起新的只读 `operation wait`。保持原区域与环境。已受理不等于
生成完成，status 错误码及可获得的日志关联 ID 仍用于诊断。登录、权限、升级及无效响应
不自动重试，也不强行改为 `resume`：先处理原 `requiredAction`，再观察同一个 submit ID。

**`absent` 与 `unknown` 不是同义词，也分属不同维度，但两者都不能单独授权自动重提**：`absent`
是提交事实维度（这次提交在服务端存不存在），可能是记录已过期；`unknown` 是逐项裁决维度
（这份产物这次被受理还是被拒），表示服务端无法建立安全结论。必须结合完整提交事实与外部
证据决策，不能猜。

## 批量恢复

发请求前先为整个 batch 创建 submit ID，并保存等长同序的结果向量。传输失败不能让后续 item 的身份丢失。

批量运行的 submit ID **逐项可显式指定**：与节点清单等长、按顺序一一对应。自己先生成并落盘，
是「响应丢了还能原样重发」的前提——全部交给 CLI 代生成时，那批 ID 只活在这次进程里，
进程被杀就再也拿不回来，重跑等于第二次运行、会重复扣费。

数量不匹配、有重复、有空值或不是合法 UUID 时，命令在**发出运行请求之前**就以参数错误退出：
一次运行都不会触发，一分钱都不会花。所以这类输入错误不需要走恢复流程，直接修参数重跑。

逐项区分 `accepted`、`rejected`、`unknown`（run 裁决维度），以及 `pending` / `running` /
`succeeded` / `failed`（资源维度）。这些是不同维度的观测，不是同一个枚举。
`unknown` item 用原 submit ID 恢复；不能用新 ID 重跑已受理 item。

## 本地 job state

状态文件原子写入，并只允许当前用户读取。只保存恢复所需的 region、canvas、业务键、Node ID、
update ID、submit ID、operation reference 和选中 Resource ID。

不得保存凭据、signed URL、provider payload、访问材料或 credit-confirmation token。

## 完成规则

资源集合为空不等于“全部成功”。每个必要输出都必须有明确的终态资源事实。
详见 [completion-and-validation.md](completion-and-validation.md)。
