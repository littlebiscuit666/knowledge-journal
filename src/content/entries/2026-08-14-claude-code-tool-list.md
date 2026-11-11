---
title: "Claude Code 工具与操作清单"
date: 2026-08-14
category: 工具
tags: [claude-code, 工具, 日记归档]
draft: false
---

> 整理日期：2026-08-14
> 记录本机当前 Claude Code 会话能调用的全部工具、MCP、Skill 与关键操作/函数。
> 用于：随时查阅「我能干什么」，方便派活时对齐能力边界。

---

## 0. 环境

- 主工作目录：`C:\Users\yaya`
- 平台：Windows 11（win32），Shell 为 Git Bash（POSIX sh 语法）
- 模型：glm-5.1（当前会话）
- 是 git 仓库，主分支 `main`

---

## 1. 文件与代码操作（核心）

| 工具 | 作用 | 关键点 |
|---|---|---|
| **Read** | 读文件 | 绝对路径；默认前 2000 行；可读图片/PDF/Jupyter；**改完别重复读校验** |
| **Write** | 写/覆盖文件 | 覆盖前必须先 Read；新文件可直接写 |
| **Edit** | 精确字符串替换 | `old_string` 必须唯一；`replace_all` 替换全部 |
| **NotebookEdit** | 编辑 .ipynb 单元格 | 按 `cell_id` 替换/插入/删除 |
| **Glob** | 文件名模式匹配 | 如 `**/*.py`，按修改时间排序 |
| **Grep** | 内容搜索（ripgrep） | 支持正则/行号/上下文/`output_mode`/`glob`/`type`；优先于命令行 grep |
| **Bash** | 跑 shell 命令 | Git Bash 语法；`/dev/null` 不 `NUL`；可后台 `run_in_background` |

> 原则：能用专用工具（Glob/Grep/Read/Edit）就别用 Bash 的 find/grep/cat。

---

## 2. 任务编排与计划

| 工具 | 作用 |
|---|---|
| **TaskCreate / TaskUpdate / TaskList / TaskGet** | 多步任务待办清单（≥3 步或复杂任务时建） |
| **EnterPlanMode** | 进入规划模式，先探索再出方案 |
| **ExitPlanMode** | 方案写好后请求用户批准 |
| **AskUserQuestion** | 关键岔路（你拍板才行的决策）问选项 |
| **Agent** | 派子 agent 干独立活，可并行（一条消息多个调用） |
| **Workflow** | 多 agent 编排脚本（fan-out/审查/迁移，需用户明确 opted-in） |

### Agent 可用子类型

| 类型 | 用途 |
|---|---|
| **claude** | 通用兜底 |
| **Explore** | 只读广度搜索（medium / very thorough），只要结论不要文件堆 |
| **general-purpose** | 复杂多步研究/搜索 |
| **Plan** | 软件架构师，设计实现计划 |
| **claude-code-guide** | Claude Code/SDK/API 知识问答 |
| **statusline-setup** | 配置状态栏 |
| **vercel:*** | ai-architect / deployment-expert / performance-optimizer |

---

## 3. 网络

| 工具 | 作用 |
|---|---|
| **WebSearch** | 网页搜索（仅美国源） |
| **WebFetch** | 抓 URL→markdown，按 prompt 提取；不支持需鉴权的私链 |
| **mcp__web_reader__webReader** | URL 转大模型友好输入（markdown/text，带图/链接摘要） |

---

## 4. Penpot MCP ✅（已确认连通）

> 接的是本地 Penpot MCP（npx 单实例绑死 4400，见 [[project_penpot_mcp]]）。

| 工具 | 作用 |
|---|---|
| **mcp__penpot__high_level_overview** | 读总览文档（握手后必读，已读过无需再调） |
| **mcp__penpot__execute_code** | 在插件上下文跑 JS，直接操作设计稿 |
| **mcp__penpot__export_shape** | 导出 shape/填充图为 PNG/SVG |
| **mcp__penpot__penpot_api_info** | 查 API 类型/成员文档 |

### execute_code 里可用的关键对象/函数

- `penpot`：主对象
  - `penpot.root`（当前页根 shape）、`penpot.selection`（用户选中，**立即拷进 storage**）
  - `penpot.generateStyle()` / `penpot.generateMarkup()`（生成 CSS/HTML/SVG）
  - `penpot.library`（组件/颜色/字体的素材库）
  - `penpot.fonts`（字体发现，`findByName`）
  - `penpot.createVariantFromComponents()`
- `penpotUtils`：**优先用，别自己写**
  - `getPages()` / `getPageById(id)` / `getPageByName(name)`
  - `shapeStructure(shape, maxDepth)`（结构概览）
  - `findShape(predicate, root?)` / `findShapes(predicate, root?)`
  - `findShapeById(id)`
  - `isContainedIn(shape, container)`
  - `setParentXY(shape, parentX, parentY)`
  - `analyzeDescendants(root, evaluator, maxDepth?)`
  - `addFlexLayout(container, dir)`（**已有子元素时用这个，别直接 addFlexLayout**）
  - token 系列：`tokenOverview()` / `findTokenByName()` / `findTokensByName()` / `getTokenSet()`
- `storage`：跨调用存中间结果/工具函数

### 常用 shape 方法

- 定位：`shape.x` / `shape.y` 可写；`width/height/bounds/parentX/parentY` 只读
- 改尺寸：`shape.resize(w, h)`
- 层级：`parent.appendChild(shape)` / `insertChild(i, shape)` / `clone()` / `remove()` / `detach()`
- z 序：`bringToFront()` / `sendToBack()` / `bringForward()` / `sendBackward()` / `setParentIndex(i)`
- 样式：`fills/strokes/shadows`（**数组内容只读，整体替换**）；颜色用大写 hex（`#FF5533`）
- 布局：`board.flex` / `board.grid`；自动尺寸 `verticalSizing/horizontalSizing`（`fix|auto|fill`）
- token：`shape.applyToken(token, properties)` / `shape.tokens`

> 规则：fills/strokes 改动要整体替换数组；空填充用 `shape.fills = []`；图片走 `Fill.fillImage`。

---

## 5. 浏览器自动化（两套）

### Chrome DevTools MCP（适合调试 + 性能）

- 页面：`new_page` / `navigate_page` / `list_pages` / `select_page` / `close_page` / `resize_page`
- 检视：`take_snapshot`（a11y 树，优先于截图）/ `take_screenshot`
- 交互：`click` / `fill` / `fill_form` / `hover` / `drag` / `type_text` / `press_key` / `upload_file`
- 求值：`evaluate_script`
- 网络/控制台：`list_network_requests` / `get_network_request` / `list_console_messages` / `get_console_message`
- 性能：`performance_start_trace` / `performance_stop_trace` / `performance_analyze_insight`
- 审计：`lighthouse_audit` / `take_heapsnapshot`
- 模拟：`emulate`（网络/CPU/视口/暗色/地理位置/UA）/ `wait_for` / `handle_dialog`

### Playwright MCP（适合端到端测试）

- 页面：`browser_navigate` / `browser_navigate_back` / `browser_close` / `browser_tabs` / `browser_resize`
- 检视：`browser_snapshot`（优先）/ `browser_take_screenshot`
- 交互：`browser_click` / `browser_type` / `browser_fill_form` / `browser_select_option` / `browser_hover` / `browser_drag` / `browser_drop` / `browser_press_key` / `browser_file_upload`
- 求值：`browser_evaluate` / `browser_run_code_unsafe`（RCE 级，慎用）
- 网络/控制台：`browser_network_requests` / `browser_network_request` / `browser_console_messages`
- 其它：`browser_wait_for` / `browser_handle_dialog`

---

## 6. 其它 MCP

| 工具 | 作用 |
|---|---|
| **mcp__4_5v_mcp__analyze_image** | 远程图片视觉分析（仅 URL） |
| **mcp__comfy-cloud__authenticate** | comfy-cloud OAuth 流（需鉴权） |
| **mcp__plugin_cloudflare_*** | cloudflare-api / bindings / builds / docs / observability，多数需 OAuth |
| **mcp__plugin_vercel_vercel__*** | Vercel，需 OAuth |
| **WaitForMcpServers** | 等还没连上的 MCP 服务 |

### cloudflare 文档（无需鉴权可直接用）
- `mcp__plugin_cloudflare_cloudflare-docs__search_cloudflare_documentation`
- `mcp__plugin_cloudflare_cloudflare-docs__migrate_pages_to_workers_guide`

---

## 7. 调度 / 定时

| 工具 | 作用 |
|---|---|
| **CronCreate** | 定时任务（cron 表达式，本地时区；recurring 默认 7 天过期） |
| **CronDelete / CronList** | 删 / 列定时任务 |
| **ScheduleWakeup** | `/loop` 动态节奏自调度（60–3600s） |

---

## 8. Agent 间通信

- **SendMessage** — 给 teammate（按名）/ main（后台子 agent）发消息
- **TaskOutput / TaskStop** — 取/停后台任务输出

---

## 9. Skill（用 Skill 工具调用，节选）

> 完整列表见会话 skill 清单；下面是**和你项目高相关**的。

### 通用流程类（superpowers）
- `superpowers:brainstorming`（脑暴，开工前先来）
- `superpowers:systematic-debugging`（系统化 debug）
- `superpowers:writing-plans` / `executing-plans`
- `superpowers:test-driven-development`
- `superpowers:requesting-code-review` / `receiving-code-review`
- `superpowers:dispatching-parallel-agents` / `subagent-driven-development`
- `superpowers:using-git-worktrees`
- `superpowers:verification-before-completion`
- `superpowers:writing-skills` / `skill-creator`

### 金融/行情（你的富途模拟盘）
- `futuapi`、`install-futu-opend`

### AI 训练 / SD / LoRA（你的一堆项目）
- `stable-diffusion`、`peft`、`trl-fine-tuning`、`unsloth`、`axolotl`、`llama-factory`
- `vllm`、`sglang`、`grpo-rl-training`、`simpo`、`deep-research`
- `weights-and-biases`、`swanlab`、`tensorboard`、`mlflow`

### 研究/写作
- `deep-research`、`ml-paper-writing`、`systems-paper-writing`、`rigor-reviewer`、`academic-plotting`
- `doc-coauthoring`、`pdf`、`docx`、`xlsx`、`pptx`

### 前端/部署
- `frontend-design`、`canvas-design`、`brand-guidelines`
- `vercel:*`、`cloudflare:*`、`godot:godot`

### 内置斜杠命令（部分）
- `verify`（跑起来看效果）、`code-review` / `simplify`（查 diff bug / 清理）
- `run`（启动项目 app）、`loop`（周期跑命令）
- `init`、`review`、`security-review`
- `update-config`（改 settings.json / 权限 / hooks / 环境变量）
- `keybindings-help`（改快捷键）、`fewer-permission-prompts`（减少权限弹窗）

---

## 10. 记忆系统

- 路径：`C:\Users\yaya\.claude\projects\C--Users-yaya\memory\`
- 索引：`MEMORY.md`（每会话自动载入，一行一条）
- 单文件单事实，带 frontmatter（`name/description/metadata.type`）
- 类型：`user` / `feedback` / `project` / `reference`
- 关联用 `[[name-slug]]` 链接

---

## 11. 关键操作约定（来自 CLAUDE.md / 记忆）

- **下载命令交给用户跑**（拉镜像/pip install/大文件），我只给命令文本（[[feedback_user_runs_download_commands]]）
- **爬取先获许可**，触发风控立即停（[[feedback_scrape_permission_fail_fast]]）
- **futu 调用前查历史 K 线额度**（开户档仅 100），循环加 sleep；优先 V2 选股因子（[[feedback_futu_api_rate_safety]]）
- **选股偏好**：避开 Mag7/SPY/QQQ 等大众蓝筹，找潜力股（[[feedback_stock_picks]]）
- 提交/推送只在用户明确要求时；默认分支先开分支
- 引用代码用 `file_path:line_number`（可点击）

---

## 附：典型工作流速查

| 想做的事 | 用什么 |
|---|---|
| 改 Penpot 设计稿 | `execute_code` + `penpotUtils` |
| 看设计稿长啥样 | `export_shape`（PNG/SVG） |
| 查股票行情 | `Skill: futuapi` |
| 跑 LoRA 训练 | `Skill: peft` / `trl-fine-tuning` / `unsloth` |
| 排查 bug | `superpowers:systematic-debugging` |
| 开新功能 | `superpowers:brainstorming` → `EnterPlanMode` |
| 批量并行搜索代码 | `Agent: Explore`（多个并行） |
| 大规模审查/迁移 | `Workflow`（需用户 opted-in） |
| 调试前端 + 性能 | Chrome DevTools MCP |
| 端到端测网页 | Playwright MCP |
