---
name: feishu-bitable
description: 用官方 lark-cli（npm 包 @larksuite/cli）操作飞书多维表格/Bitable：解析 my.feishu.cn/base/... 链接、查表/字段/记录、增删改记录、批量更新、字段/视图管理。当用户给出飞书表格链接，或要求读写飞书多维表格、lark-cli 相关操作时使用。含本机 PowerShell 5.1 下 JSON 传参、后台进程、设备流授权的已验证解法。
---

# 飞书多维表格操作（官方 lark-cli）

> ✅ 状态：本机实测通过（2026-09-28，样片日记项目全链路：增删改查、上线回写均验证）
>
> 🔇 **铁律：cmd/命令一律静默执行（2026-09-30 用户两次强调）**——任何 `lark-cli` 调用不得弹出可见窗口。**优先直接复制下方「静默原子命令」执行**；禁止 `Start-Process`、`cmd /c`、`powershell.exe` 二次拉起、npm bin shim；多条命令**合并进同一次 bash 调用**（`;` 连接），减少外壳/会话重建次数。

## 静默原子命令（优先使用，2026-09-30 沉淀）
> 形态铁律：**直连原生 `lark-cli.exe`**（❌ 禁止经 `run.js`/node 包一层——见下方根因①）、单行、不经过 cmd；JSON 一律走 `@绝对路径` 文件；输出加 `2>&1`。每次 bash 调用把要用的多条用 `;` 串起来一次跑完。

```powershell
# 通用形态（$lark 只在同一次调用内定义一次）
$lark = '{{USER_HOME}}\.tools\larksuite-cli\node_modules\@larksuite\cli\bin\lark-cli.exe'
& $lark <domain> <subcommand> ... --as user 2>&1

# 0) 状态检查
& $lark whoami --json 2>&1

# 1) 表/字段/记录（bt=base_token, tb=table_id）
& $lark base +table-list --base-token <bt> --as user --json 2>&1
& $lark base +field-list --base-token <bt> --table-id <tb> --as user --json 2>&1
& $lark base +record-list --base-token <bt> --table-id <tb> --as user --format json 2>&1

# 2) 单条读/写（fields.json 必须 UTF-8 无 BOM、绝对路径、参数值加单引号）
& $lark base +record-get --base-token <bt> --table-id <tb> --record-id <rid> --as user --format json 2>&1
& $lark base +record-upsert --base-token <bt> --table-id <tb> --as user --json '@C:\abs\path\fields.json' 2>&1

# 3) 云盘搜索
& $lark drive +search --query '<词>' --as user --json 2>&1
```
- 已知坑仍生效：`@文件` 用**绝对路径+单引号**；CLI JSON 走 stderr 必须 `2>&1`；写后读回验证。
- 唯一例外：`install` 子命令走 run.js（装向导），平时禁用。
- **闪窗根因定论（2026-09-30 高速观察器 A/B 实锤，20ms 采样 EnumWindows）**：**真凶 = `run.js` 第 68 行 `execFileSync(bin, args, {stdio:'inherit'})`**——每次经 run.js 跑 lark 都会新建一个 **Windows Terminal 窗口**（CASCADIA 类，存活 ~450ms，标题从「Terminal」变为 `bin\lark-cli.exe` 路径）；对照组纯 PowerShell 命令零闪窗，**直连 `lark-cli.exe` 零闪窗**（挂到 bash 工具已隐藏的控制台，不新建窗口）。检测手段：WMI `ShowWindow=0` 后台观察器每 20ms `EnumWindows` 记录可见 ConsoleWindowClass/CASCADIA 窗口。附带事实：引擎拉 bash shell（`Xiaomi MiMo.exe → powershell.exe -NoLogo -NoProfile -NonInteractive`，父链无 cmd）和 zai/playwright MCP 实测均为隐藏窗口（hwnd=0）；zai-mcp 被引擎反复重复拉起（同日 80 秒内 6 次）属引擎行为，但窗口隐藏、不闪。


## 适用场景
用户给出形如 `my.feishu.cn/base/<app_token>?table=<table_id>&view=<view_id>` 的链接，或要求读写飞书多维表格：查记录、增/改/删记录、批量更新、改字段/选项/视图等。

## 我们的项目表（「开发项目」）
- 链接：https://my.feishu.cn/base/FEISHU_BASE_APP_ID?table=FEISHU_TABLE_ID&view=vewZi4wetc
- base_token `{{FEISHU_BASE_APP}}`，表 `{{FEISHU_TABLE}}`（表名「开发项目」），已授权账号：吕超杰
- 字段（12）：项目名称(text)、项目简介(text)、项目类型(单选：App/网页/小程序/插件/工具/其他/npm包/视频)、负责人(人员)、优先级(单选：高/中/低)、所处阶段(单选：规划中/设计中/开发中/测试中/已上线/Done/Cancel，**API 只读**)、时代(单选：古法时代/agent时代)、开始日期/目标日期(date)、当前进度(数字-进度条 0~1)、项目链接(text-url)、备注(text)
- 快速读全部记录：`& $lark base +record-list --base-token FEISHU_BASE_APP_ID --table-id FEISHU_TABLE_ID --as user --format json`
- 惯例：新建项目默认 负责人=吕超杰（ou_915ded8a9628d5786372589a9caa08bb）、进度 0

## 运行环境（本机）
- 官方 CLI = npm 包 **`@larksuite/cli`**（bin: `lark-cli`，GitHub: larksuite/cli）。npm 上**没有** `@larksuiteoapi/lark-cli`。
- 固定安装位置：`{{USER_HOME}}\.tools\larksuite-cli`。不存在则安装：
  `& $env:MIMO_NODE "$env:MIMO_NPM" install '@larksuite/cli' --prefix "{{USER_HOME}}\.tools\larksuite-cli" --no-audit --no-fund`
  （npm allow-scripts 会拦它的 postinstall，但直接跑 `bin\lark-cli.exe` 正常，无需处理）
- 入口（❌ 不要 npm bin shim，❌ 不要 run.js——run.js 会弹 Windows Terminal，见「闪窗根因定论」）：
  `$lark = '{{USER_HOME}}\.tools\larksuite-cli\node_modules\@larksuite\cli\bin\lark-cli.exe'`
  下文用 `& $lark <args>` 表示（原生 exe 直连，静默）。
- 所有调用统一带 `--as user`（用户身份；bot 身份默认没申请 base scope）。

## 授权（首次一次性，之后持久）
1. 应用配置：`& $lark config init --new --lang zh` 阻塞并打印 `https://open.feishu.cn/page/cli?user_code=...`，让用户在浏览器完成。凭证持久化。本环境跑法见「坑 3」。
2. 用户登录（base 全套 scope）：`& $lark auth login --domain base --no-wait --json` → 返回 `verification_url` + `device_code`（10 分钟有效）。把 URL 给用户（可加二维码：`& $lark auth qrcode "<url>" --output qr.png`，PNG 需展示给用户），**结束回合**；用户确认后 `& $lark auth login --device-code <code>` 收尾。code 不要缓存，过期重新发起。
3. 状态检查：`& $lark whoami --json`、`& $lark auth list --json`。

## 常用命令（base 域，前缀均为 `& $lark base`）
- 链接解析：`+url-resolve --url <链接> --as user` → base_token / block_id
- 表列表：`+table-list --base-token <bt> --as user --json`
- 字段列表：`+field-list --base-token <bt> --table-id <tb> --as user --json`（**写之前必看**：确认字段名、选项名、可写性）
- 读记录：`+record-list --base-token <bt> --table-id <tb> --as user --format json`；过滤 `--filter-json @f.json`；排序 `--sort-json @s.json`；只取部分字段 `--field-id 字段名`（可重复）；`--limit 1-200`
- 新建/更新单条：`+record-upsert --base-token <bt> --table-id <tb> --as user --json @fields.json`（不带 `--record-id` 即新建，返回 record_id；带则更新该条）
- 批量：`+record-batch-create` / `+record-batch-update`（先 `--help` 看参数，同样用 @file 传 JSON）
- 删除：`+record-delete --base-token <bt> --table-id <tb> --as user --record-id <rid> --yes`（Risk: high-risk-write）
- 查某个 API 参数：`& $lark schema base.<service.resource.method>`；逃生口 `& $lark api <METHOD> <path>`
- 每个 `--help` 里标 Risk（read | write | high-risk-write）。

## CellValue 形状（--json 里的值）
- 文本/URL：`"字符串"`；数字/进度：`0.6`
- 单选：`["选项名"]`（multiple=false 只能一个）；多选：`["A","B"]`
- 日期：`"2026-03-24 10:00"`；勾选：`true/false`
- 人员：`[{"id":"ou_xxx"}]`（**不要猜 ou_id**，先用 contact 域查询）
- filter-json 形状：`{"logic":"and","conditions":[["字段名","==","值"]]}`（日期 `ExactDate(2026-06-02)`，选项 `["P0","Blocked"]` 配 `intersects`）

## 本机已踩坑（必须遵守）
0. **命令一律静默执行（2026-09-30 用户多次强调，见文首铁律）**：不得弹出任何可见窗口——bash 工具内**直连 `bin\lark-cli.exe`**（⛔ 禁止 `run.js`/node 包一层，会弹 Windows Terminal）；必须后台时用「输出重定向 .cmd + WMI `ShowWindow=0`」（见坑 3），禁止任何会闪黑窗/弹控制台的启动方式（含 `Start-Process`、`cmd /c start`、交互式 `cmd`）。
1. **PS 5.1 会剥掉内联 JSON 的内层引号**（报 `invalid character 'l' looking for beginning of object key string` 之类）→ 所有 JSON 参数一律写文件后用 `@文件` 传：`--json @fields.json`、`--filter-json @f.json`。文件 UTF-8 无 BOM。**`@文件` 在参数位还会被 PS 当 splatting 解析**（报 `SplattingNotPermitted`）→ 给参数值加单引号：`--json '@fields.json'`（2026-09-27 实测必现，引号形式稳定通过）。**`@file` 用相对路径会按 cwd 解析**（2026-09-30 踩坑：写在 %TEMP% 却传裸文件名报 cannot open）——**一律传绝对路径** `'@C:\...\xx.json'`。
   - `@文件` 路径必须在允许根内：**当前工作目录、系统临时目录、`~/files`**，否则报 `outside the built-in allowlist`（如 `C:\Users\<user>\.tools\` 就不行）。
2. **CLI 的 JSON 输出走 stderr**：调用加 `2>&1`，清洗后再解析：
   `$clean = { param($o) ($o | ForEach-Object { "$_".Replace('node.exe : ','') } | Where-Object { $_ -notmatch '^(所在位置|\s*\+|CategoryInfo|FullyQualifiedErrorId|\s*$)' }) -join "`n" }`
3. **后台/交互进程**：bash 工具里 `Start-Process`（-NoNewWindow / -WindowStyle Hidden 都一样）会被整调用杀掉（Unknown: ChildProcess.kill），`interactive:true` 也不可用。挂后台唯一可靠解：写一个输出重定向到文件的 `.cmd`，用 WMI 启动，然后轮询日志文件。**必须带 `ShowWindow=0`，否则 cmd 黑窗会在桌面闪出来**（WMI 新建进程落在 Session 1 交互会话，2026-09-29 实测）：
   ```powershell
   $si = ([wmiclass]'Win32_ProcessStartup').CreateInstance(); $si.ShowWindow = 0
   Invoke-WmiMethod -Class Win32_Process -Name Create -ArgumentList @('cmd.exe /c <脚本路径>', $null, $si)
   ```
   坑：`Invoke-CimMethod` 传 `ProcessStartupInformation` 报「类型不匹配」；`Invoke-WmiMethod` 只传 2 个参数报 `ReturnValue=21`，必须是 `@(命令, $null, $si)` 三参；再叠 `CreateFlags=0x08000000` 也会 21——**只设 `ShowWindow=0`** 才返回 0。
4. **写后必须读回验证**：新建后按业务键过滤查回 record_id；删除后比对记录总数/ID 列表恢复原状。注意 Bitable 有几秒读延迟：**更新后立刻 record-list 可能拿到旧值**（更新响应本身 ok:true 即已生效），稍等 2-3 秒或用 `+record-get --record-id <rid>` 直查。
5. **阶段类单选字段（如「所处阶段」）API 只读**：upsert 会忽略它并在 `ignored_fields` 里提示"让用户手动改"，不是报错。**2026-09-28 复验（三层实验）**：绕过 CLI 直调 `api PUT /open-apis/bitable/v1/apps/{bt}/tables/{tb}/records/{rid}`（body `{"fields":{"所处阶段":["已上线"]}}`）同样 `ok:true` 但值被**服务端静默忽略**（fields 回显空、读回无变化），而同一 PUT 通路写「备注」立即生效——确认是飞书侧 stage 字段限制（field-list 显示 select 是 CLI 归一化，底层非普通 enum），非 CLI 拦截/传参问题，只能在 Base 网页手动改。**2026-09-30 读侧定论**：底层 `api GET .../records/{id}` 的 fields 里**完全没有「所处阶段」键**（该字段对 API 整体不可见）；CLI `+record-get` 显示的 `["规划中"]` 是字段缺失时的**缺省回填假值**，不代表真实状态（用户网页端已改完成，API 任何形式都读不到）。**阶段值只信网页端**，禁止用 API 读数质疑用户或反复重试。
6. **high-risk-write（如删除）**：仅当用户明确要求且目标唯一时才可直接 `--yes`；改数据前先 `+field-list` 确认可写字段。

## 建库与批量写入（2026-10-01 实战，景区数据资产项目）
- **建 base**：&  api POST /open-apis/bitable/v1/apps --data "@body.json" --as user --json（body 仅 {"name":"..."}，UTF-8 无 BOM）→ 返回 app_token/default_table_id/url，user token 的 base scope 可建
- **带 schema 建表**：+table-create --base-token <bt> --name <表名> --fields "@schema.json"——首个字段为主字段；number 的 type 就是 "number"、select 带 options:[{name}]（multiple:false 单选数组仅一项）
- **批量导入**：+record-batch-create --base-token --table-id --json @batch.json --as user，body 形状 {"create_records":[字段对象数组]}，**单次上限 200 行**；大表按批落 .json 文件循环调用 + 断点进度文件（doneBatches 数组）续跑
- **⚠ --json 撞名坑**：record-batch-create 的入参 flag 就叫 --json，**不能再跟第二个 --json 当输出格式**（会报 flag needs an argument）；输出格式改用 --format json
- 本项目资产表：余姚带娃地图·景区数据资产 base=SU9KbUYKoaMIPYsxp3ZcA1Nen1f，点位明细=tbl4f7VGUT1qpopV（12字段，10339行，URL https://my.feishu.cn/base/SU9KbUYKoaMIPYsxp3ZcA1Nen1f）
