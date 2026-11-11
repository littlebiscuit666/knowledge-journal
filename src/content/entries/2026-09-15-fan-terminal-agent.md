---
title: "fan：终端 AI 编程智能体开发总结"
date: 2026-09-15
category: 技术
tags: [ai agent, cli, 上下文管理, 日记归档]
draft: false
---

- **日期**：2026-09-15
- **项目位置**：`D:\zcode-workspace\fan`
- **当前版本**：v0.2.6（当天从 v0.1.0 迭代到 v0.2.6，共 7 个版本）
- **技术栈**：Node.js 18+（零第三方依赖，纯内置模块）
- **安装方式**：`cd /d/zcode-workspace/fan && npm install -g .`，全局命令 `fan`

---

## 一、它是什么

一个跑在终端里的 Claude Code 风格 AI 编程智能体：用自然语言让它读代码、改文件、执行命令、完成多步骤开发任务。支持流式输出、工具自主调用循环、权限确认、会话持久化。

当前接入的是**腾讯云 Coding Plan**（Anthropic 兼容端点 `https://api.lkeap.cloud.tencent.com/plan/anthropic`，模型 `hy4-preview`），同时兼容任意 OpenAI 兼容后端（智谱 GLM / DeepSeek / Kimi / Ollama 本地等）。

## 二、功能全景

### 1. 双协议引擎
- **Anthropic Messages 协议**（`/v1/messages` 流式）：完整支持 thinking 块（含 signature 回传，多轮工具调用必需）
- **OpenAI 兼容协议**（`/chat/completions` 流式）：reasoning_content 思考流、工具调用分段解析
- 协议按 baseUrl 自动识别，也可 `--protocol` / `FAN_PROTOCOL` 强制指定

### 2. 工具系统（7 个内置工具）
| 工具 | 说明 | 权限 |
|---|---|---|
| bash | 执行命令（自动识别 Git Bash，支持超时/中断） | 需确认 |
| read_file | 带行号读文件 | 自动 |
| write_file | 写文件（自动建目录） | 需确认 |
| edit_file | 精确替换片段 | 需确认 |
| list_dir / grep / glob | 目录、内容、文件名搜索 | 自动 |

权限确认支持 `y/n/a`（a = 本会话总是允许）；Ctrl+C 可随时终止整个任务（包括正在跑的命令）。

### 3. 终端 UI
- ASCII 大 logo 开场（F/A/N 三色渐变）+ 圆角信息面板（模型/协议/目录，中文按 2 列宽度精确对齐）
- 输入框上方常驻目录面包屑（`C: › Users › yaya › 项目名`，超长自动省略中段）
- 工具输出卡片：带边框、状态图标、耗时，超 6 行自动截断
- 工具执行期间实时秒数转圈；思考期默认只显示"思考中… N 字"（可 `showThinking: true` 展开灰字）
- `NO_COLOR=1` / `FAN_NO_ANIM=1` 可关颜色/动画

### 4. 记忆机制（四层）
1. **会话内**：messages 数组全量携带（含工具结果）
2. **System prompt** 每次现拼（OS/shell/cwd/日期），不受裁剪影响
3. **上下文裁剪**：超预算时按"完整轮次"滑窗丢弃（保证不产生孤儿 tool 消息），实测 input tokens 优先于字符估算
4. **跨会话**：每轮自动存档 `~/.fan/sessions/`，`fan -c` 接续最近一次；自动只保留 50 份

注：无长期记忆/RAG，靠 system prompt 要求模型"先查再答"来补偿。

### 5. Token 计量与上下文限制
- 每轮结束显示 `[tokens] 入 X · 出 Y · 会话累计 …`，数据来自 API 真实 usage；缺失项按字符估算并标注"（部分为估算）"
- `contextTokens`（默认 96k）：裁剪时机优先用实测 input tokens；超 70% 显示水位、超 90% 建议清历史；单条超长输入自动截断；服务商报超限 400 时给处理提示

### 6. 任务收敛控制
- `maxToolRounds`（默认 40）轮数预算；剩最后 10 轮时向工具结果注入收敛提醒；**到上限自动移除工具、强制模型汇总作答**（而不是直接放弃）
- system prompt 要求：网络命令必须带超时；多轮工具时在正文汇报进度（不许只写进 thinking）

## 三、版本演进史（当天迭代全程）

| 版本 | 内容 |
|---|---|
| v0.1.0 | 初版：OpenAI 协议 + 7 工具 + 权限 + 会话持久化 + mock 端到端测试 |
| v0.2.0 | 接入腾讯云 agent plan：新增 Anthropic 协议（thinking 块带签名回传）、`--setup` 预设 |
| v0.2.1 | ASCII 渐变 logo + 信息面板 + 入场动画（CJK 显示宽度对齐） |
| v0.2.2 | 修复 `blue/magenta` 未导入导致真机启动崩溃（管道测试盲区） |
| v0.2.3 | 思考默认隐藏（防刷屏）+ 真机终端丢弃预输入（防连发误触发） |
| v0.2.4 | 工具执行实时秒数转圈 + Ctrl+C 可杀运行中命令 + system prompt 强制网络超时 |
| v0.2.5 | 轮次进度显示 + 收敛提醒 + 轮数上限强制汇总 |
| v0.2.6 | token 真实计量 + 上下文三层限制 + EOF 队列修复 |

## 四、踩坑记录（Windows 特供）

1. **readline prompt 不能带 ANSI 颜色**——长行编辑时光标错位，提示符只能纯文本，颜色写在正文里
2. **管道 EOF 竞态**：回答进行中 stdin 结束会触发 `close` 事件直接杀进程 → 忙碌时先挂起 EOF，队列清空后再退
3. **libuv 断言崩溃**：Windows 下在 readline 关闭过程中同步 `process.exit()` 会触发 `UV_HANDLE_CLOSING` 断言 → 分路径处理（/exit 延迟 5ms，EOF 场景让事件循环自然排空）
4. **msys2 管道延迟**：taskkill 成功杀掉 bash 后，stdio 管道要 ~4.5s 才释放，`close` 事件迟迟不来 → kill 时立即返回已捕获输出
5. **GLM 的 usage 在 `choices[0].usage`**，OpenAI 标准在顶层——两处都要查
6. **腾讯 Anthropic 端点的 `message_start` 不带 input_tokens** → input 走估算并标注
7. **测试盲区教训**：管道模式测不出 TTY-only 的代码路径（v0.2.2 崩溃即此因），颜色分支必须 `FORCE_COLOR=1` 补测

## 五、使用速查

```bash
fan                  # 交互模式（面包屑 + ❯ 提示符）
fan -c               # 继续上次会话
fan -p "问题"        # 非交互单次（支持管道，token 汇总走 stderr）
fan --setup          # 配置向导（含腾讯云预设）
fan -m hy4           # 临时换模型

# 会话内：/help /clear /model /permission /status /setup /exit
# Ctrl+C 中断当前任务（能杀运行中的命令）；Ctrl+D 退出
```

配置文件 `~/.fan/config.json` 常用项：`model`、`maxToolRounds`(40)、`contextTokens`(96000)、`showThinking`(false)、`shell`(留空自动)。

## 六、待办 / 未来方向

- [ ] `/compact`：旧对话压缩成摘要再继续（当前是硬截断）
- [ ] 跨会话项目记忆（如 `~/.fan/MEMORY.md` 自动注入）
- [ ] 工具输出卡片着色分级（错误红色边框已做，可再细分）
- [ ] 对话中注入用户插话（busy 时输入转向为引导，而不是丢弃）
- [ ] 子代理 / 并行工具调用
