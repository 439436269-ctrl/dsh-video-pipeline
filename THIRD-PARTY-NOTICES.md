# Third-party notices

本包包含第三方代码。以下逐项声明来源、许可与本地改动。两份上游均为 **MIT License**，允许在保留版权声明与许可全文的前提下复制、修改与再分发。

## 1. `skills/xiaohongshu-skills/`

- **上游**：<https://github.com/white0dew/XiaohongshuSkills>（MIT，作者 white0dew）
- **包内 LICENSE**：`skills/xiaohongshu-skills/LICENSE`，版权行 `Copyright (c) 2026 angiin`
- **出处说明**：该 skill 的 frontmatter 记录 `metadata.source: Angiin/Post-to-xhs`，其 README 自述受 Angiin/Post-to-xhs 启发；因此**两方署名都保留**（包内 LICENSE 文件署名 angiin，本声明记录上游仓库 white0dew/XiaohongshuSkills）。
- **本地改动（衍生作品）**：`scripts/cdp_publish.py` 与 `scripts/publish_pipeline.py` 增加了视频封面设置能力（`_set_video_cover()` 与 `--cover` 参数），`SKILL.md` 增补了封面、合集 API 与官方引擎备选章节。按 MIT 要求保留上游版权声明。
- **未随包**：上游仓库的 README（含赞助位、作者微信号与二维码）、`AGENTS.md`、`.gitignore`、star 历史图表与其生成脚本、CI 配置、一次性代码评审记录、登录态缓存、以及一次性的合集填充/探针脚本。
- **本地实现的许可全文**：

```
MIT License

Copyright (c) 2026 angiin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 2. `skills/douyin-publish/`

- **上游**：<https://github.com/L1angjy/douyin-publish-skill>（MIT License，作者 L1angjy）
- **关系**：本 skill 是上游 OpenClaw 版的改写版——上游依赖 OpenClaw 的 `browser(target="host")` 工具并把上传路径写死为 `/tmp/openclaw/uploads`；本版逐步映射为 `playwright-cli` 等价命令，流程语义不变，平台无关。skill 正文与 `references/pitfalls.md` 中已注明该来源。
- **本地改动**：`SKILL.md` 的浏览器驱动段落、`scripts/heji/` 下三个参数化脚本（`dy_add.mjs` / `dy_api.mjs` / `dy_verify.mjs`）为本版实现。
- **未随包**：上游仓库本体、以及原作者项目的真实目标清单（`dy_t_read810.json` / `dy_t_story810.json`），后者以结构示例 `dy_t.example.json` 代替。

## 3. 其他引用的第三方资源

以下仅在 skill 正文中作为**建议音源/工具**被提及，本包未包含其任何素材：

- **Mixkit**（Mixkit Free License）、**Freesound**（CC0）、**incompetech**（CC-BY）：`tangshi-pipeline` 的美学升级文档中列为 BGM 白名单音源。
- **biliup**、**Playwright**、**ffmpeg**、**Pillow**、**lark-cli**：外部工具与库，由使用者按各自许可自行安装，本包不附带。
