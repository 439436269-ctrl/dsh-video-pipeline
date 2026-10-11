# 认证与执行权限

## 本地业务状态存储

`error.localStorage` 表示当前画布或任务恢复记录失败，与凭据存储独立。请检查 `reason`、`stage` 和本机 `directory`，不要据此判断服务故障或开启完全访问。通过宿主支持的流程申请该目录内的操作权限，包括临时文件、替换和清理。必要时显式设置 `DREAMINA_CANVAS_STATE_DIR`，让所有相关 CLI 调用使用已获准的私有持久目录绝对路径。该选项只改变业务记录，不改变认证凭据，且需要支持此选项的 CLI 版本。

显式 `--project-id` 可避免读取当前画布记录，但生成仍需要恢复记录。保留原画布和提交 ID；遇到权限、损坏或空间错误，不自动清除记录或切换目录。本地失败不能证明远端生成失败。分享诊断时不要包含凭据值、记录内容或私人提示词。

根据 `error.localStorage` 区分存储类别、读写阶段、原因和 `submissionPhase`。`before_submit` 仅说明本次调用在发送前停止，仍需保留原画布和提交 ID；`after_submit` 应使用 `operation status/wait <submitId> --project-id <projectId>` 只读查询，不能重新创建或提交。即使本地状态不可用，远端查询仍可继续；`localStorageWarning` 不否定已返回的远端结果。`canvas create --use` 返回 `current=false` 和警告时，画布已经存在：打开其 `webUrl`，后续显式传入该 `--project-id`。保留损坏记录供排查，不通过覆盖或删除记录让重试通过。

## 认证

在模型发现前，对目标 profile 执行 `auth status`。已有可用登录态则继续，否则按已安装
schema 使用 `auth login`。根据 `error.reason`、`class` 和 `requiredAction` 判断；JSON 错误
消息固定英文，人类输出跟随制品 distribution。

| `error.reason` | 恢复方式 |
| --- | --- |
| `dns_resolution_failed` | 检查实际 CLI 进程的 DNS 和网络权限。首页 curl 成功不能证明 CLI 访问正常。 |
| `network_permission_denied` | 通过宿主支持的审批流程申请必要网络权限。 |
| `credential_store_permission_denied` | 申请必要本地凭据存储权限；仅批准网络可能不足。 |
| `credential_store_unavailable` / `credential_store_corrupt` | 检查系统存储和用户上下文；保留记录，在清除或替换前联系支持人员。 |
| `network_timeout` | 最多额外退避重试两次，仍失败则保留脱敏错误供排查。 |
| `auth_dependency_failed` | 原因尚未分类。仅做一次获批执行或普通终端对照，不据此认定服务故障。 |

DNS 或权限错误只在条件改变后验证一次。复用已获得的授权，不自动启用完全访问。如果宿主
无法授予必要访问，让用户在同一系统用户的普通终端中，用同一二进制和 profile 执行。
终端授权完成后，在 Agent 环境再次检查 `auth status`；后续请求仍可能需要权限。
旧版没有 `reason` 时，同样最多做一次对照。

取得 challenge 后，展示其中的官方授权地址和用户验证码，按已安装 schema 继续等待。
不能仅因授权未完成就再次登录、退登或使用 `--force`。

| OS | 当前凭据后端 |
| --- | --- |
| macOS | Keychain；保存前使用 `~/Library/Caches/byted_auth_client/locks` 下的缓存锁。 |
| Linux | `~/.local/share/<service>/<account>.json` 用户文件；当前 SDK 不使用 Secret Service 或 D-Bus。 |
| Windows | `HKCU\Software\BytedAuthClient\keychain` 当前用户注册表，使用当前用户 DPAPI 加密。 |

通用存储错误不能证明具体哪个后端操作失败。不默认使用 sudo 或管理员模式，不更改存储权限，
不导出 token，也不将凭据迁入工作区或共享临时目录。

## 安装与升级权限

安装器需要二进制安装目录和 Skill 目标目录内的写入权限；首次创建目标目录时，还需要父目录的创建权限。升级会保留 `dreamina-canvas-cli` 根目录，只更新其内容，不需要移动或删除该根目录。

权限被拒绝时，对实际安装命令申请宿主支持的单次批准；宿主无法授予时，在同一系统用户的普通终端完成安装。安装失败不需要注销账号或清理钥匙串。已有安装锁时先检查是否仍有安装进程；若输出备份保留位置，先恢复或核对该备份，不重复清理。安装过程中不要加载该 Skill，完成后在新会话中使用。

安装提供的完整包时，解压后执行其中的 `install.sh`，或通过 `DREAMINA_CANVAS_PAYLOAD_DIR` 指定包目录的绝对路径。保留同目录的 `payload.sha256`、匹配平台二进制、`skill.tar.gz` 与 `version.json`；包不完整或不匹配时不能回退到 CDN。按安装器输出的目标绝对路径和版本核对实际 CLI，并在新会话加载更新的 Skill。PATH 警告不代表安装失败。
