---
title: "DataAgent 项目代码结构详解（自然语言问数智能体）"
date: 2026-09-08
category: 技术
tags: [dataagent, llm, sql, 日记归档]
draft: false
---

> 项目位置：`D:\zcode-workspace\data-agent`
> 一句话：自然语言问数智能体——用户用中文提问，大模型自动生成并执行只读 SQL，返回带数字支撑的结论。

## 全局地图：一次提问的旅程

```
用户提问
  → cli.py / web.py        （入口：接收问题）
    → config.py            （读 .env 拿数据库和模型配置）
    → db.py                （读表结构缓存，给模型准备 schema）
    → llm.py               （把 system prompt + 问题发给 DeepSeek）
      → agent.py           （循环：模型要调工具 → 执行 → 结果回传）
        → sql_guard.py     （模型给的 SQL 先安检）
        → db.py            （安检通过后真正执行）
      ← 循环直到模型给出最终答案
  ← 结论 + SQL + 数据 展示给用户
```

## 逐个文件讲

### `config.py` —— 配置中心（约 40 行）

只在启动时干一件事：用 `load_dotenv` 把项目根目录的 `.env` 加载进环境变量，然后把配置整理成模块级常量（`DB_HOST`、`LLM_API_KEY`、`MAX_ROWS=200` 等）。其他所有文件都 `from . import config` 来取配置，**配置读取只写一处**。`.env` 里数据库密码、API Key 这些敏感信息因此不会出现在任何代码文件里。

### `db.py` —— 数据库层（连接 + schema 目录）

两个职责：

**① `connect()`**：新建 MySQL 连接。有个细节：连接时用 `init_command` 设置 `SET SESSION max_execution_time=15000`，给这个会话的所有查询加 15 秒超时；老版本 MySQL 不支持这个变量时会抛错，代码捕获后降级为普通连接重连一次。

**② `SchemaCatalog` 类**：管表结构。第一次运行时连库执行 `SHOW TABLES` + 对每张表 `SHOW FULL COLUMNS`，把 28 张表的结构存成 JSON 写进 `.schema_cache.json`；之后启动直接读缓存文件，不重复连库。`has_table()/resolve_table()` 提供表名白名单校验（给 sample_table 用，防止模型传奇怪的表名），`to_prompt()` 把 JSON 拼成一段紧凑文本（`- 表名(列 类型, 列 类型...)`），这段文本就是最终发给模型的 schema。

### `glossary.py` —— 业务术语表（纯文本常量）

一个字符串常量 `GLOSSARY`，手写的"数据库说明书"：每个分层（ads/dim/dwd/event/model）每张表是干什么的、关键枚举值有哪些（如 `payment_status` 只有 `success`）、口径约定（哪些字段单位是元、哪些是游戏币、MySQL 5.7 不支持 CTE）。它没有代码逻辑，但它是**整个项目准确率贡献最大的文件**——数据库本身没有注释，模型全靠它理解业务。

### `sql_guard.py` —— 安全防护（约 60 行）

核心函数 `guard_sql(sql)`，模型生成的 SQL 进数据库前的安检门，四步：

1. 去注释、去末尾分号；把字符串字面量替换成空串（`_strip_literals`，防止关键字藏在引号里）得到"裸语句"；
2. 检查开头必须是 `SELECT/SHOW/DESCRIBE/EXPLAIN`，否则拒绝（拦掉一切写操作）；再在裸语句上跑关键字黑名单正则（`INSERT/DROP/INTO OUTFILE/系统库名...`）；裸语句里有分号说明是多语句，拒绝；
3. `SELECT` 语句若没有 LIMIT 或 LIMIT 超过 200，外面包一层 `SELECT * FROM (...) _capped LIMIT 200` 强制封顶；SHOW/DESC 类不能包子查询，原样放行；
4. 返回改写后的安全 SQL。

未通过就抛 `SQLGuardError`，错误信息会回传给模型让它重写。

### `llm.py` —— 大模型客户端（约 40 行）

`get_client()` 懒加载一个 OpenAI 兼容客户端（没配 Key 时抛出友好提示）；`chat()` 封装一次调用：固定 `temperature=0.1`（SQL 生成要稳定不要发散），可选传入 `tools`（工具说明书），失败自动重试一次。它把"方舟/DeepSeek/OpenAI"的差异全部隔离在这一层，换厂商只改 `.env`。

### `agent.py` —— 智能体核心（约 200 行，最值得精读）

四个部分：

**① `TOOLS`**：发给大模型的"工具说明书"JSON（不是给 Python 执行的代码），声明 `run_sql` 和 `sample_table` 两个工具：模型靠 description 判断什么时候用什么工具，调用时只输出"工具名 + 参数"，真正的执行在 `_execute_tool()`——**模型动嘴，代码动手**，这也是安全的根基。

**② `Step` / `AskResult` 数据类**：记录每次工具调用的 SQL、行数、耗时、成败；`AskResult` 是最终打包给前端/命令行的结果（含完整执行步骤，Web 界面上那些 "✔ 查询 7行 320ms" 就是它）。

**③ `_execute_tool()`**：模型的"申请"到这里变成真实执行。`run_sql` → `guard_sql` 安检 → `db.run_query` 执行 → 结果截断（最多 30 行、单格 200 字符、总 24000 字符，防止撑爆上下文）后返回；`sample_table` → 先用白名单校验表名再抽样。**任何异常（安检拒绝或 SQL 报错）都不抛出，而是包成 `{"error": ...}` 返回给模型**——这是"自我修正"机制的机关。

**④ `ask()` 主循环**：拼 system prompt（角色设定 + `GLOSSARY` + schema + 工作规范 + 今天的日期），然后最多循环 `AGENT_MAX_ROUNDS=8` 次：调模型 → 有 `tool_calls` 就逐个执行、把结果以 `role:"tool"` 追加进 messages 继续循环 → 没有工具调用说明模型给出最终答案，返回。轮数用尽则强制要求模型总结，保证一定有回应。

### `cli.py` —— 命令行入口

三种模式：`--selftest`（不依赖大模型的自检：跑 guard 的恶意 SQL 测试用例、验证连库、查三行数据、检查 Key 配置）；`-q "问题"`（单次提问）；不带参数进入交互式循环。`_print_result()` 负责把 `AskResult` 打印成 SQL + 分隔线 + 结论的格式。

### `web.py` —— Web 服务（约 50 行）

FastAPI 应用，三个路由：`GET /` 返回聊天页面；`GET /api/tables` 返回表清单（给左侧栏）；`POST /api/ask` 接收 `{"question": ...}`，调用 `agent.ask()`，把 `AskResult.to_dict()` 返回 JSON。错误处理分两层：没配 Key 这类"配置问题"返回 400 带提示，其他异常返回 500 带堆栈信息。

### `static/index.html` —— 聊天界面（单文件，无框架）

左侧栏（示例问题 + 表清单），右侧对话流。几个值得看的实现：`md()` 是个 ~40 行的**手写迷你 Markdown 渲染器**（只支持表格/代码块/加粗/列表，避免依赖 CDN 的 marked.js）；`renderSteps()` 把每个工具调用渲染成"✔ 查询 · 7行 · 320ms · SQL"的执行轨迹条；回车发送、Shift+回车换行。

### 其他文件

`requirements.txt`（5 个依赖）、`.env`（真实配置，已 gitignore）、`.env.example`（带三家厂商注释的模板）、`.schema_cache.json`（运行时生成的 schema 缓存）、`start_web.bat`（双击启动）、`README.md`（架构图 + 快速开始 + 安全说明）。

## 依赖关系

`config` 是根 → `db` 依赖 `config` → `sql_guard` 只依赖正则（纯函数，最容易单测）→ `llm` 依赖 `config` → `agent` 串起前面所有 → `cli`/`web` 是两个平行的外壳。**换 UI 不动核心，换数据库驱动只动 `db.py`，换模型厂商只动 `.env`**——这就是分层带来的可替换性，面试画架构图就按这个讲。
