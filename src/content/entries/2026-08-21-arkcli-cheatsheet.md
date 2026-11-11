---
title: "火山方舟 arkcli 速查手册"
date: 2026-08-21
category: 工具
tags: [arkcli, 火山方舟, 速查, 日记归档]
draft: false
---

> 记录日期：2026-08-21
> arkcli 版本：v1.0.17（已检测到 1.0.18 但 npm 升级路径有问题，待修）
> 安装路径：`C:\Users\yaya\AppData\Roaming\npm\arkcli`（npm 全局安装）
> 真实包名：`@volcengine/ark-cli`

---

## 1. 安装与升级

### 1.1 当前安装

```bash
where arkcli
# → C:\Users\yaya\AppData\Roaming\npm\arkcli
# → C:\Users\yaya\AppData\Roaming\npm\arkcli.cmd

arkcli --version
# → arkcli version 1.0.17
```

### 1.2 升级（⚠️ 当前有 bug）

```bash
arkcli update              # 命令本身能检测新版本（1.0.17 → 1.0.18）
                           # 但实际升级失败：npm root -g returned an empty path
```

**问题根因**：npm 11.6.2 + arkcli 内部子进程调 npm 时 PATH/环境丢失。

**绕过方案**（手动升级）：
```bash
npm install -g @volcengine/ark-cli@latest
```

**当前状态**：未升级（用户决定先不升）。

---

## 2. 认证

### 2.1 SSO 登录（火山账号）

```bash
arkcli auth login volc-sso
```
- 浏览器跳转 + SSO 授权，**交互式**——AI 不能代跑
- 登录一次后会缓存 STS refresh_token

### 2.2 查状态

```bash
arkcli auth status
```
- **历史坑**：refresh_token 会失效（2026-08-21 就遇到过），报
  `invalid_request - The request parameter refresh_token is invalid`
- 解决办法：再跑一次 `arkcli auth login volc-sso`

### 2.3 生成 ARK API Key

```bash
arkcli auth apikey        # 生成新的 API Key
```
> 反触发：TTS/ASR/语音模型要走 `models search`，不要走 `auth apikey`

---

## 3. 全局 flags（任何命令都能用）

| flag | 作用 |
|---|---|
| `--profile <name>` | 切 profile（agent-plan / coding-plan / 自建等） |
| `--api-key <key>` | 临时覆盖 API Key（不写回 profile） |
| `--base-url <url>` | 临时覆盖数据面 Base URL |
| `--format json\|yaml\|table\|csv\|jsonl\|pretty` | 输出格式（默认 json） |
| `--page-all` | 自动翻页，配合 `--page-limit` `--page-delay` |
| `--lang zh_cn\|en_us` | UI 语言 |
| `--debug` | 打请求/响应详情到 stderr |
| `--env prod\|stg` | 控制面环境（默认 prod） |

---

## 4. 快捷命令（`+xxx`，高频入口）

### 4.1 `+chat` — 快速对话/推理

```bash
arkcli +chat "用三句话介绍方舟 Agent Plan"
arkcli +chat --model ark-code-latest "分析这段代码"
arkcli +chat --file ./report.pdf "总结这份 PDF 的要点"   # 多模态 @file
```

### 4.2 `+gen` — 图片 / 视频生成

```bash
# 图片（同步返回）
arkcli +gen --model doubao-seedream-5-0-260128 --size 1024x1024 \
  "赛博朋克少女，霓虹灯，雨夜"

# 视频（异步，加 --wait 阻塞到完成）
arkcli +gen --model doubao-seedance-1-5-pro-251215 \
  "柴犬在樱花树下奔跑" --wait
```

### 4.3 `+understand` — 多模态理解（12 个配方）

```bash
arkcli +understand --input ./demo.png "提取所有文字"
arkcli +understand --input ./meeting.mp4 "转写对话+加字幕"
```
- 开放式对话走 `+chat`，**有明确产出形态**（转写/抽取/字幕/定位）走 `+understand`

### 4.4 `+deploy` — 创建接入点 ⭐

```bash
arkcli +deploy --model doubao-seedream-5-0-260128 --name my-img-ep
```
- **创建成功后**会自动渲染多语言调用示例到 `./ark-examples/<ep-id>/`
- 创建外的 CRUD 走 `arkcli infer endpoint ...`（不要走 +deploy）

### 4.5 `+code-example` — 多语言示例代码

```bash
arkcli +code-example --model doubao-seedream-5-0-260128 --lang python
```
- 数据源：方舟 OpenTOP OpenGetSampleCode
- **TTS/ASR/语音模型无示例代码**——只能转 models search

### 4.6 `+connect` — 把 arkcli 能力注入本机 AI Agent

```bash
arkcli +connect              # 装到所有检测到的 agent
arkcli +connect --list       # 列出已支持 agent
arkcli +connect --uninstall  # 卸载
```

### 4.7 `+iterate` / `+new-agent` / `+tail` / `+debug` / `+export` — Managed Agent 全流程

```bash
arkcli +new-agent --name my-bot --model ark-code-latest
arkcli +iterate --agent my-bot
arkcli +tail --session ses-xxxxx
arkcli +debug --session ses-xxxxx
arkcli +export --session ses-xxxxx
```

---

## 5. 业务命令（按域）

### 5.1 `models` — 公共基础模型查询

```bash
arkcli models search seedream
arkcli models search seedance
arkcli models get doubao-seedream-5-0-260128
arkcli models list --page-all
```

### 5.2 `custommodel` — 自定义模型（cm-xxx）

```bash
arkcli custommodel list
arkcli custommodel get cm-xxxxx
arkcli custommodel import --from-tos tos://...
```

### 5.3 `pricing` — 价格

```bash
arkcli pricing --model doubao-seedream-5-0-260128
arkcli pricing plan agent     # Agent Plan 套餐价
arkcli pricing plan coding    # Coding Plan 套餐价
```
- **TTS/ASR 语音模型价格不支持**——只能转 models search

### 5.4 `infer endpoint` — 接入点生命周期管理 ⭐

```bash
arkcli infer endpoint list
arkcli infer endpoint get ep-xxxxx
arkcli infer endpoint start ep-xxxxx
arkcli infer endpoint stop ep-xxxxx
arkcli infer endpoint delete ep-xxxxx
arkcli infer endpoint update ep-xxxxx --name new-name
```
- **新建走 `+deploy`**，不要走这里的 create（+deploy 带护栏）

### 5.5 `helper` — 把本机 AI Agent 配置到方舟 ⭐

```bash
# Claude Code / Codex / OpenCode / OpenClaw / Hermes 都支持
arkcli helper configure claude-code \
  --profile agent-plan_cn-beijing_personal \
  --model ark-code-latest

# 只挂 MCP（豆包搜索 / DataPro / OpenViking），不动 model
arkcli helper mcp claude-code# 查状态
arkcli helper list

# 还原
arkcli helper reset claude-code
```

#### 路由强制（Agent Plan / Team）

当上下文出现 **ARKCLI ROUTING ENFORCEMENT** 或 **routing.v1**，或要求在豆包搜索/DataPro/OpenViking/Supabase 之间强制分流时：
- 先提交 Route Plan
- 再调用唯一授权的 Provider
- 原生 WebSearch/WebFetch/WebExtract 不在路由管理范围

**默认行为**：`helper configure` 成功后默认关闭目标客户端原生 WebSearch；传 `--keep-native-websearch` 保留。

### 5.6 `plans` — 套餐管理（Agent Plan / Coding Plan）

```bash
arkcli plans team seat-list            # 列席位
arkcli plans team seat-assign --seat <id> --user <email>
arkcli plans team rotate-apikey --seat <id>
```
- **用量类问题（用 / 消耗 / 多少）走 `usage`**——不要走 plans

### 5.7 `usage` — 用量查询

```bash
# Token / 请求数（5-30 分钟延迟）
arkcli usage stats --start 2026-08-01 --end 2026-08-21

# 套餐额度快照
arkcli usage balance --type plan

# 按模型时间序列（套餐内/外拆分）
arkcli usage plan-details

# 团队席位用量 by seat
arkcli usage seats --with-usage
```

### 5.8 `billing` — T+1 账单

```bash
arkcli billing --billing-month 2026-08
arkcli billing --billing-month 2026-08 --endpoint ep-xxxxx
arkcli billing --billing-month 2026-08 --api-key <key>
```
- 账单 = 结算金额（T+1 出账，财务口径）
- stats = 推理量（近实时）
- **不要混用**

### 5.9 `train` — 精调训练任务

```bash
arkcli train finetune create --base-model doubao-pro-32k --dataset my-ds
arkcli train finetune list
arkcli train finetune get mcj-xxxxx
arkcli train finetune export --task mcj-xxxxx --step best
```

### 5.10 `resources` — 控制面资源可见性

```bash
arkcli resources                   # 当前 profile 可见资源
arkcli resources resolve ep-xxxxx  # 把 ep 解析为权威模型+模态+候选工作流
```
- 用户临时给 ep-xxx 但没说走 Chat/Understand/Gen 时**优先用这个**

### 5.11 `doctor` — 健康度 / 错误码排查

```bash
arkcli doctor                      # 整体健康
arkcli doctor error --code 429     # 排查限流
arkcli doctor infer-endpoint --id ep-xxxxx
arkcli doctor verify-origin --urls <url1>,<url2>   # 验图片/视频是否方舟生成
```

### 5.12 `api` — 原始 API 兜底

```bash
arkcli api model.list_foundation_models --params '{"PageSize":5}'
arkcli api <registered-action> --params '{...}'
```
- 当产品命令 `arkcli <domain> <verb>` 不够用时用

### 5.13 `iam` — 身份权限

```bash
arkcli iam role list
arkcli iam policy list
```

### 5.14 `profile` / `config` — 配置管理

```bash
arkcli profile list
arkcli profile switch <name>
arkcli profile new --name my-prod
arkcli config                      # 当前生效配置
arkcli config reset
```
- profile 类操作**优先 `profile`**，`config` 子命令已 deprecated

### 5.15 `update` — 升级 arkcli

```bash
arkcli update --check   # 仅检查
arkcli update           # 实际升级（当前有 npm root -g bug，见 §1.2）
```

---

## 6. 路由 / 反触发速查

| 你想做的事 | 该走的命令 | 反触发（**不要走**的） |
|---|---|---|
| 查方舟公共模型 | `models search` | `custommodel`（那是 cm-xxx） |
| 查自己精调的模型 | `custommodel` | `models search`（找不到 cm-xxx） |
| **新建** Endpoint | `+deploy` | `infer endpoint create`（无护栏） |
| 已有 Endpoint CRUD | `infer endpoint ...` | `+deploy`（只能新建） |
| 用量 / 消耗多少 | `usage` | `plans`（那是管理） |
| 套餐席位绑定/轮换 | `plans` | `usage`（只看量） |
| 账单 / 结算金额 | `billing` | `usage stats`（近实时推理量） |
| TTS/ASR/语音 价格 | ❌ 不支持 | `pricing` 会拒绝 |
| 验图片/视频是否方舟出 | `doctor verify-origin` | `+understand`（那是理解内容） |
| 开放式对话 | `+chat` | `+understand`（那是转写抽取） |
| 明确产出（字幕/抽取） | `+understand` | `+chat`（太开放） |
| 配 Agent Plan 给本地 Agent | `helper configure` | `auth apikey`（API Key 不通用） |

---

## 7. 关键经验 & 坑

1. **SSO refresh_token 会失效**——遇到 `invalid_request - refresh_token is invalid` 就重新跑 `arkcli auth login volc-sso`（2026-08-21 实测）
2. **arkcli update 当前有 npm 子进程 bug**——要手动 `npm install -g @volcengine/ark-cli@latest`
3. **新建 Endpoint 一律走 `+deploy`**——它会渲染示例到 `./ark-examples/<ep-id>/`，且带复用检查护栏
4. **TTS/ASR 语音模型能搜不能调**——`models search` 能找，但 `+chat`/`+gen`/`+deploy`/`+code-example`/`usage`/`pricing`/`+chat` 都不支持
5. **OpenClaw 旧 config 用的是 Coding Plan 端点**——和 Agent Plan 的 key 不通用，迁移时要把 volcengine provider 带进新工具（2026-08-19 Hermes 接入时遇到过）
6. **环境变量失效的 DASHSCOPE_API_KEY 会被 provider auto 捡走**——导致 401，显式指定 provider 即可绕过
7. **Hermes 实际读 `%LOCALAPPDATA%\hermes\config.yaml`**——arkcli helper 写 `~/.hermes`，要手动合并（详见 `project_hermes_agent_plan.md`）
8. **verb 路由记忆**：列/绑/分/轮换 → plans；用/消耗/多少 → usage

---

## 8. 一页纸常用命令（贴在桌面上）

```bash
# 认证
arkcli auth login volc-sso
arkcli auth status

# 内容生成
arkcli +chat "..."
arkcli +gen --model doubao-seedream-5-0-260128 --size 1024x1024 "..."
arkcli +gen --model doubao-seedance-1-5-pro-251215 "..." --wait

# 模型 & 价格
arkcli models search <keyword>
arkcli models get <model-id>
arkcli pricing --model <model-id>

# 部署
arkcli +deploy --model <model-id> --name <ep-name>
arkcli infer endpoint list
arkcli infer endpoint get ep-xxxxx

# 本机 Agent 接入
arkcli helper configure claude-code --profile <p> --model ark-code-latest
arkcli helper list

# 用量 & 账单
arkcli usage stats --start 2026-08-01 --end 2026-08-21
arkcli usage balance --type plan
arkcli billing --billing-month 2026-08

# 排障
arkcli doctor
arkcli resources resolve ep-xxxxx
arkcli doctor verify-origin --urls <url>
```

---

## 9. 相关记忆

- `project_hermes_agent_plan.md` — Hermes 接入方舟 Agent Plan 的实战 + Hermes/AppData 路径坑
- `feedback_proxy_sundays_only.md` — 本机代理仅周日可用（升级时若需要代理下载）
