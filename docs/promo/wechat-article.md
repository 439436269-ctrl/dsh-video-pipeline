# 我把一条短视频生产流水线拆成了 19 个 skill，发布前扫出一个真的 API key

> 公众号版。配图用 `docs/skill-flow.png`（正文里标了插图位置）。

---

## 先说结论

我把一条真实跑着的短视频生产流水线（唐诗短剧方向）拆成了 **19 个 skill**：

- **1 个总入口**：告诉你这包是什么、每个环节该加载谁
- **1 个编排 skill**：选题 → 门①报价 → 生产调度 → 门②发布确认 → 并行发布 → 回写
- **17 个原子 skill**：中文配音读音校正、文生图（两条通道）、文生视频、图片运镜、成片合成、双平台封面、成片核验、数据复盘、四平台发布、进度回写……

现在已经能直接用了：

```sh
# DeepSeek Harness（DSH 插件）
dsh plugin --profile web add dsh-video-pipeline

# Claude Code / Codex（宿主中立的 skills 仓）
claude plugin marketplace add 439436269-ctrl/video-pipeline-skills
claude plugin install video-pipeline@video-pipeline-skills
```

这 19 个 skill 之间的关系与数据流是这样的：

但真正想跟你聊的不是功能，是发布前那道坎。

---

## 一、我原以为「这插件没有隐私信息」

这是我开工时的判断。毕竟它只是把一堆 skill 打包——skill 里是流程、提示词、脚本，能有什么隐私？

于是我老老实实扫了一遍。结果是：

- 有一个 **`ARK_KEY.txt`，里面是一枚 46 字符的真 key**
- 脚本里硬编码了 **12 条抖音作品 ID**、一张 **EP→BV 号映射表**、B 站 UID、视频号 FINDER_ID、小红书笔记与合集 ID
- `C:\Users\...`、`D:\...`、NAS 内网地址、平台签名 URL 到处都是
- 还有 **175 个文件被剔除**：真 key 文件、登录态缓存、字节码，以及只属于我个人项目历史的真实播放数据快照、合集映射、逐集一次性脚本、当时操作截图
- 甚至夹着**别人**的东西：第三方 skill 的上游 README 里有作者的微信号和二维码

「没有隐私信息」这句话，是错的。

所以我没有靠肉眼手改，而是写了一个**可复现的导入器**：剔除规则、脱敏规则、残留扫描规则都在一个文件里，每次发布前跑一遍机器门。

最后的结果：**剔除 175 个文件、脱敏 35 个文件、改写 15 处表述、残留 0 处。**

---

## 二、更值得说的是：这道门抓住了我自己 5 次

这才是我觉得这活儿真正有意思的地方。我写的门，在写入前/后抓出了 5 个真 bug——**全是我自己的**：

1. 我把剔除规则改成带 skill 前缀之后，锚定文件名的规则**静默失效**，于是**那枚真 key 被复制进了包里**。是残留扫描拦下的。
2. 我的「签名 URL」脱敏规则**改坏了源码**：把 JS 里的解析正则 `/encfilekey=([^&]*)/` 替换成了乱码。于是我给门加了一关——**所有脚本逐个做语法解析**。
3. 飞书的 table_id 在我某个 Python 脚本里被当成了**变量名**，替换后直接语法错误。语法那一关又拦下了。
4. 一条锚定规则匹配不到子目录，**真实的合集映射差点被当成要保留的文件**。
5. 有个脚本内嵌了整张 BV 号映射表，我只替换了我「知道」的那一个——按形态替换才修好。

第 2 条给了我一个教训，后来变成了习惯：**一条通过的断言，不代表它会咬人。**

我新加了一条「包内文档必须和最后一次提交一致」的断言，写完顺手做了个反向测试——故意改一个字节。结果它**照样通过**。原因很蠢：打包本来就取自工作区，我却拿包内文档跟工作区比，两边永远是同一份。

改成跟 `git HEAD` 比之后，反向测试立刻失败、正常情况通过。

同类的事还遇到了两次：

- 一个 `if (!bad.length)`，判的是**函数的参数个数**（恒为 1），那行确认永远不会打印，等于静默跳过了一次检查
- PowerShell 写文件带的 **BOM**，会让 Claude 的清单 JSON 解析失败（`JSON Parse error: Unrecognized token`），而 `claude plugin validate` 只给 warning、**退出码仍是 0**

所以现在的规矩是：**每加一条检查，先试着让它失败一次。**

---

## 三、几个「看起来是失败、其实不是」的坑

顺手记几条，做同类事的人能省时间：

**npm 发布成功 ≠ 立刻上线。** npm 现在是 staged publishing：`publish` 打印成功只代表进了暂存区，registry 自动 promote 要等一会儿（我这次实测约 2 分钟，官方文档口径是更久）。窗口期内 `latest` 还是旧值、新版本号 404、同版本重发报 `409` —— **全都不是失败**，改版本号重发反而会留下烂摊子。

**npm 页面显示的是「那个版本 tarball 里的 README」。** 你改了仓库的 README，npm 页面上纹丝不动。想让 npm 页面更新，就得发一个新版本——哪怕只改了一个字。

**README 里的图，用相对路径在 npm 上看不到。** 必须用 GitHub raw 绝对地址。而图片本身不必进 npm 包。

**插件优先级要设计对。** 我做成了：同名 skill 时，**使用者自己的版本赢**（内置的是低优先级）。否则你装个插件，会把自己精心调过的同名 skill 悄悄盖掉。

---

## 四、还做了两件「不显眼但必要」的事

**第一，宿主中立。** 同一套 skill，除了 DSH 插件，我还生成了一个专门给 Claude Code / Codex 的仓。不复刻内容——用一个生成器从同一份源单向导出，避免两边漂移。差异主要是一件事：DSH 会在加载 skill 时替换 `{{TOKEN}}` 这类占位符，别的宿主没有这个机制，所以在导出的时候就**落成可读值**（`%USERPROFILE%`、`<飞书 base app_token>` 这种）。

**第二，装完能卸载得干净。** 我实测装进了自己的 Claude Code（`claude plugin list` 显示 enabled、缓存里 19 个 skill），确认可用之后**把它卸了**——因为它会给我每个会话都加上 19 个 skill 的上下文开销。插件 skill 不会污染用户级的 `~/.claude/skills`，这点是好的。

---

## 五、怎么用

```sh
# 1. DSH 插件（视频流水线全流程）
dsh plugin --profile web add dsh-video-pipeline

# 2. Claude Code / Codex（同一套 skill，宿主中立）
claude plugin marketplace add 439436269-ctrl/video-pipeline-skills
claude plugin install video-pipeline@video-pipeline-skills
#    或不用插件机制，直接把 skill 装进用户目录：
#    node install.mjs --host claude
```

需要自己准备：**ffmpeg**、**Python 3 + Pillow**、**Node.js**，以及各平台自己的登录凭据。这套东西**不含任何凭据**——这也是上面那一大段的意义。

仓库：

- DSH 插件：<https://github.com/439436269-ctrl/dsh-video-pipeline>
- Claude Code / Codex：<https://github.com/439436269-ctrl/video-pipeline-skills>
- npm：<https://www.npmjs.com/package/dsh-video-pipeline>

---

## 最后

这套 skill 最大的价值不是「自动化」，而是**它把流程里的判断固化下来了**：什么时候必须停下来问用户（报价门、发布门）、什么样的情况绝对不允许发布（核验不通过）、一批发几条、什么时候止损。这些东西原本在脑子里，写下来之后才真的可复用。

以及一句我现在的习惯：**发布不可逆，所以发布前一定要有一道能自己咬人的门。**
