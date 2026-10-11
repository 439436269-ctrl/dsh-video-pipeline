# 积分与人工批准

积分协议是服务端强制执行的消费上限授权，不是客户端提示，也不要求批准后草稿参数完全不变。

## 心智模型

```text
保存最新草稿
  -> 权威报价
  -> 需要时由用户批准 ceiling
  -> 服务端在运行前按最新草稿裁决
  -> 只有最新总价 <= 已批准 ceiling 才执行
```

用户可在报价后编辑已保存节点。run 以最新权威草稿为准；最新价格仍在 ceiling 内时，
批准可以继续有效；超过 ceiling 时必须停下重新申请。

## Agent 必须遵守

1. 先保存预期 node plan：`node quote` 按已保存节点报价，未保存的计划报不出价。
2. `node quote` 只是只读信息，不授权花费，也永不签发 token。
3. 所有 item 都低于服务端阈值时可以不需要 token。
4. 需要批准时，展示逐项报价、总价、积分单位和建议 ceiling；不得自动批准。
5. 只有得到用户明确批准后，才调用 `node confirm --credit-ceiling <n>`；
   它显式返回普通节点运行的 token；组合命令在用户批准后内部自动处理批准。
6. 得到的 opaque token 只传给对应的 `node run --credit-token`，不写日志和 job state。
7. 最新权威总价超过 ceiling 时交回用户，不能静默降低 count 或质量。

## 媒体 `--run` 已经替你走完这四步

`node create|edit image|video|audio --run` 在一次调用内完成保存、报价、批准、运行，并在报价与运行之间停下。
它**不取消**批准要求，只是改变了你在哪里提供批准：

| 批准方式 | 语义 |
| --- | --- |
| `--credit-ceiling <n>` | 只在报价不超过 `n` 时继续。比 `--yes` 严；该上界无条件生效，服务端免确认也不解除它 |
| `--credit-token <t>` | 已通过 `node confirm` 批准过，复用该 token |
| 交互式 `y/N` | 提示语带金额；答 `n` 即停，没有任何扣费 |
| `--yes` | 批准任意金额。仅在价格确实无从预知时使用 |

非 TTY 且以上都不给时，命令**停在报价之后**并以退出码 `10` 返回。
**此时节点已保存，但没有扣费。** 失败 envelope 同时给出你需要的两半：

```json
{
  "error": { "code": "cli.generation_confirmation_required", "requiredAction": "confirm" },
  "creditConfirmation": { "reason": "unconfirmed", "minimumCreditCeiling": 120 },
  "partialData": { "items": [{ "nodeId": "node_xxx", "submitId": "uuid" }] }
}
```

不要把这个退出码当成生成失败。先把金额交给用户，再复用 `partialData` 里的
**两个**身份续跑：

- 复用同一 `submitId` 是重放首次运行，不会二次扣费；换新 `submitId` 就是第二次运行、会再扣一次；
- 复用同一 `nodeId` 才不会在画布上留下孤立节点。

`minimumCreditCeiling` 缺席表示服务端算不准占用（`occupancy_unknown`），
它**不等于 0** —— 按 0 去批准必然再次被拒，此时应交回用户处理。

图片、视频和音频都走同一条四步链路。省略 `--run` 就只保存；批量或需要逐步控制时，使用
`node quote` → `node confirm` → `node run`。

## 图片超清使用独立批准作用域

`node upscale image` 处理已有成功图片节点，不运行来源节点的普通生成草稿。
每个来源创建新节点和新资源；不能用普通 `node quote/confirm/run` 为超清报价或执行。
命令先报价再批准，使用图片超清专用的批准作用域；普通 `node confirm` 凭证不能互换。
即使阈值内免确认，显式 ceiling 仍然生效。没有批准时退 `10`，返回
`partialData.items[].sourceNodeId/submitId`，尚未创建输出节点。
批准后复用这些 submitId 和原超清参数继续；已提交后使用只读 `operation status/wait` 恢复，
不能换新 submitId。默认返回受理结果，`--wait` 才观察新资源（默认最长 10 分钟、间隔 5 秒）。
`--dry-run` 仅本地校验，不能证明来源可用、价格正确或生成成功。

## 批量规则

- 确认批次必须全部可报价，partial total 不能作为原批次的安全 ceiling。
- 即使批次仅部分受理，也要保留每个 item 的 submit ID 和结果。
- 每个已 claim item 必须持久化 authorized credit ceiling，恢复时才能核算已占用上限。
- 单个 item 失败不能抹掉已受理 item 的身份与积分事实。

## 确认与幂等不是一回事

确认 token 授权的是消费上限，不是防重复运行的主要机制。submit ID 和服务端已 claim submission
记录负责幂等。

恢复时先重放已 claim submission，不应因为 token 过期要求再次确认。只有服务端尚不存在的新 submission
才需要当前有效的授权。

## 向用户展示什么

- 准备运行的内容和输出数量；
- 最新报价与建议 ceiling；
- 无法报价的 item；
- 当前是新运行，还是恢复已有 submit ID；
- 为什么需要重新批准。

除非 release 暴露能证明最终结算/退款的账本事实，否则不能把名义预扣快照描述为最终净花费。
