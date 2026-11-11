---
title: "Hermes Agent 接入火山方舟 Agent Plan 踩坑记录"
date: 2026-08-19
category: 技术
tags: [hermes, arkcli, 火山方舟, 日记归档]
draft: false
---

日期：2026-08-19
结果：已配通。Hermes 使用火山方舟 Agent Plan（模型 ark-code-latest，Responses API），实测调用成功。

---

## 背景

- 本机原先装着 OpenClaw（旧 agent 框架），这次换装 Hermes Agent
- 目标：让 Hermes 用上我已订阅的火山方舟 **Agent Plan**（不是旧的 Coding Plan）
- 全程踩了 5 个坑，逐个记录

---

## 坑 1：安装时的 Migration Preview 是什么

装完 Hermes 后弹出 OpenClaw 迁移预览（`hermes claw migrate`），列出 14 个待导入项和一大堆 skip 项。

**含义**：
- Would import：SOUL.md（人设）、USER.md、MEMORY.md、3 个 skill（copywriter / nano-banana-pro / novel-writer）、模型配置、两个环境变量（HERMES_GATEWAY_TOKEN、VOLCENGINE_API_KEY）
- Would skip：全是"没找到所以没得导"（Discord/Slack/WhatsApp 等我没配过的东西），不是错误
- 三条警告：OpenClaw 配置项与 Hermes 不一一对应、导入的 .md 可能含 OpenClaw 专属步骤

**结论**：选 y 没问题，只复制文件、不破坏原文件。但导完后要检查 `memories\MEMORY.md` 和 `SOUL.md`，删掉 OpenClaw 专属内容，免得新 harness 被旧指令带偏。

## 坑 2：启动后 HTTP 401 invalid_api_key

**现象**：问一句话就报错

```
API call failed: AuthenticationError [HTTP 401]
Provider: alibaba  Model: anthropic/claude-opus-4.6
Endpoint: https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

**排查过程**：
1. Hermes 的 `.env` 里所有 API_KEY 全被注释掉，一个可用 key 都没有
2. 但 `auth.json` 的 credential_pool 里有一条 alibaba 凭证，来源是 `env:DASHSCOPE_API_KEY`，状态 401 invalid_api_key
3. 追查发现：**Windows 用户级环境变量里设过一个 DASHSCOPE_API_KEY**（sk-2d6 开头、35 字符，已失效）
4. Hermes 的 `model.provider: auto` 会自动扫描环境变量找 key，捡到这把失效 key 就去打阿里云国际版，被拒

**教训**：`provider: auto` + 环境变量里有失效 key = 必 401。要么删掉失效 key，要么显式指定 provider。

## 坑 3：OpenClaw 迁移丢了火山配置，且新旧 Plan 不通用

**现象**：迁移预览里写着 `full-providers → config.yaml custom_providers[volcengine]`，但实际 Hermes 的 config.yaml 里根本没有这个块。

**更大的坑**：OpenClaw 旧配置（`~/.openclaw/openclaw.json`）用的是火山 **Coding Plan**：

```
baseUrl: https://ark.cn-beijing.volces.com/api/coding/v3
```

而我现在订阅的是 **Agent Plan**，端点是：

```
https://ark.cn-beijing.volces.com/api/plan/v3
```

两个 Plan 是不同产品，**端点不同、API key 不通用**。我一开始没看官方文档，直接把 OpenClaw 的 coding 端点+key 手工搬进 Hermes 配置——方向就错了。后来对照官方文档才发现，回滚重来。

**教训**：迁移工具不会替你判断订阅类型；换 Plan 必须重新对文档拿新端点和新 key。

## 坑 4：正确姿势 —— arkcli helper 一条命令配好

官方文档给了两种方式：手动 `hermes config set` 五条命令（要自己粘 API Key），或 **arkcli helper（推荐）**。

前提（本机已满足）：

```powershell
npm install -g @volcengine/ark-cli@latest
arkcli auth login          # 消费模式选 agent-plan
```

本机 arkcli 已登录 profile：`agent-plan_cn-beijing_personal`。非交互一条命令：

```bash
arkcli helper configure hermes --profile agent-plan_cn-beijing_personal --model ark-code-latest
```

要点：
- key 由 arkcli 自动注入，全程不露面，安全
- `ark-code-latest` 是智能路由模型，官方默认推荐；想固定底层模型就换 `--model <具体模型名>`
- **Hermes 只支持 model/provider 配置，不支持 MCP 注入**（别加 --with-mcp）

## 坑 5：配置文件位置错配（最隐蔽）

**现象**：arkcli 提示配置成功，写入 `C:\Users\yaya\.hermes\config.yaml`。但一查：

```bash
hermes config get model
# 返回的还是旧值 anthropic/claude-opus-4.6 / auto
```

**原因**：官方文档和 arkcli 都写 `~/.hermes/config.yaml`，但**这台机器上的 Hermes 实际读 `%LOCALAPPDATA%\hermes\config.yaml`**（即 `C:\Users\yaya\AppData\Local\hermes\config.yaml`）。两个位置，各写各的。

**解决**：把 arkcli 写好的 model 块和 providers 块手动合并进 AppData 那份（动手前备份为 `config.yaml.bak.pre-arkcli-merge`）。合并后再 `hermes config get model`，返回正确：

```
default: ark-code-latest
provider: volcengine-agent-plan
```

`~/.hermes/config.yaml` 留着别删，arkcli helper list/reset 认的是它。

**教训**：配完别信工具嘴上的"已配置"，用 `hermes config get model` 实测一遍才算数。以后如果重跑 `arkcli helper configure hermes`，记得再做一次这个同步。

---

## 最终生效的配置

`%LOCALAPPDATA%\hermes\config.yaml` 关键部分：

```yaml
model:
  default: ark-code-latest
  provider: volcengine-agent-plan

providers:
  volcengine-agent-plan:
    api_key: <ARK_API_KEY>          # arkcli 自动注入
    base_url: https://ark.cn-beijing.volces.com/api/plan/v3
    models:                          # 套餐可用模型清单（arkcli 写好）
      - id: ark-code-latest
      - id: doubao-seed-2.0-code 系列、deepseek-v4-flash/pro、kimi-k3、glm-5.3、minimax-m3 ...
```

验证：用 `arkcli +chat --model ark-code-latest` 真实发了一条最小对话，返回 `status: completed`。

---

## 日常使用速查

| 操作 | 命令/说明 |
|---|---|
| 启动 | PowerShell 里 `hermes`（exe 在 `%LOCALAPPDATA%\hermes\hermes-agent\bin\hermes.exe`，Git Bash 的 PATH 里没有） |
| 查当前配置 | `hermes config get model` |
| 切换模型 | 改 `model.default`（可选值见上面 models 清单）；或保持 ark-code-latest，去火山控制台切路由目标，3-5 分钟生效 |
| 重新配置 | `arkcli helper configure hermes ...` 之后 **必须** 再同步一次 AppData 的 config.yaml（见坑 5） |
| 验证 key | `arkcli +chat --profile agent-plan_cn-beijing_personal --model ark-code-latest "测试"` |

## 收尾清理记录（2026-08-19 全部完成）

### 清理 1：删除失效的 DASHSCOPE_API_KEY 环境变量

- **为什么要删**：坑 2 的 401 根因就是它——失效 key 挂在用户级环境变量上，任何 `provider: auto` 的工具都可能捡走
- **删除前检查**：全盘搜了 `.openclaw`、`.hermes`、`.claude`、`AppData\Local\hermes`、`.config` 等配置区，引用它的只有 Claude 的会话历史记录，没有任何工具的配置文件依赖它
- **操作**：PowerShell 执行 `[Environment]::SetEnvironmentVariable('DASHSCOPE_API_KEY', $null, 'User')`
- **验证**：重查 User 级环境变量，已清空

### 清理 2：检查迁移过来的记忆文件

逐个检查了 `%LOCALAPPDATA%\hermes\` 下的迁移产物，结论是**没有 OpenClaw 残留，无需改动**：

| 文件 | 检查结果 |
|---|---|
| `SOUL.md` | Hermes 默认人设文本（"You are Hermes Agent..."），无 OpenClaw 内容 |
| `memories\USER.md` | 全是有用的用户偏好：中文交流、Obsidian 库路径（D:\Obisidian\技术栈的学习Mermaid\）、D 盘优先、付费 API 调用前必须先确认、在意 API 费用、火山即梦 AK/SK 等。且 Hermes 已在正常读写维护它 |
| `memories\MEMORY.md` | 不存在——迁移预览虽列了 daily-memory 项，实际源文件缺失没迁过来，无东西可清 |

### 补充：TERMINAL_CWD deprecated 警告是 Hermes 误报（已查实源码）

每次启动都出现的这条警告**不是配置脏数据**：Hermes 启动时自己把 `terminal.cwd` 桥接成环境变量 `TERMINAL_CWD`（值=启动目录），然后弃用检查（`hermes_cli/config.py` 的 `warn_deprecated_cwd_env_vars`）读 `os.environ` 看到它，误以为是 `.env` 残留——代码注释写着 "likely from .env"，纯粹是它猜的。本机 `.env` 里那行本来就是注释状态。

要关掉警告只能把 `terminal.cwd: .` 改成明确路径（如 `C:\Users\yaya`），但会让工作目录固定死、不再跟随启动目录。**建议忽略该警告**。

---

## 附：同日小事 —— npx @deepseek-ai/dsh 看似下载卡死

跟 Hermes 无关但同一天发生：`npx @deepseek-ai/dsh web` 输完 y 后长时间没动静。实际是**在下载，只是没进度显示**：dsh 依赖 255 个包，直连 npmjs 每个 tarball 要 8-16 秒（周三 Clash 不开）。几分钟后装完并监听 `127.0.0.1:3080`。加速办法：`npm config set registry https://registry.npmmirror.com/`。
