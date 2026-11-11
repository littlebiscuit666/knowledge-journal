---
title: "GitHub 最复杂提示词项目盘点"
date: 2026-10-13
category: 提示词
tags: [提示词, github, agent, 日记归档]
draft: false
---

> 日期：2026-10-13
> 背景：天池自出题《task1_hard_10x10》《task1_superhard_50blocks》做完后，想看看业界最复杂的提示词长什么样。
> 所有星数为 2026-10-13 通过 GitHub API 实时核实。

---

## 一、工业级系统提示词（真正意义上的"最复杂"）

### ⭐ x1xhlol/system-prompts-and-models-of-ai-tools（144k stars，天花板）
- 链接：https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools
- 号称"AI史上最大提示词泄露"。收录 Cursor、Devin、v0（Vercel）、Lovable、Claude Code、Windsurf、Kimi、Replit、Kiro、Augment Code 等 30+ 个 AI 编程工具的**完整系统提示词 + 工具定义**。
- 单条提示词动辄数千行、上万 token。
- 复杂度结构：角色定义 → 数百条行为规则 → 工具调用协议（JSON Schema）→ 安全红线 → 输出格式约束，多层嵌套。
- **想看"最复杂"，先翻 Cursor 和 Devin 的**。

### LouisShark/chatgpt_system_prompt（10.8k stars）
- 链接：https://github.com/LouisShark/chatgpt_system_prompt
- GPT 商店里官方 GPT 的系统提示词大合集，附带提示词注入（prompt injection）/防泄露知识。

### asgeirtj/system_prompts_leaks
- 另一个系统提示词泄露合集，与上面互补。

---

## 二、结构化提示词方法论（中文社区出品）

### langgptai/LangGPT（12.6k stars）
- 链接：https://github.com/langgptai/LangGPT
- "结构化提示词"框架提出者。用 Markdown 模板（变量 / 流程 / 约束 / 角色分层）把提示词写成"程序"。
- 教你怎么**组织**复杂提示词的经典，中文友好。

---

## 三、文生图方向（和自出题同一路数）

### QwenLM/Qwen-Image（8.4k stars）
- 链接：https://github.com/QwenLM/Qwen-Image
- 通义千问文生图官方仓库，主打**复杂中文文字渲染 + 精确图像编辑**。
- 官方案例提示词与自出题 q003（茶饮海报）/q004（茶馆门头）几乎同款：海报 + 精确汉字 + 排版方位 + 渐变背景 + 装饰元素。
- **自出题的直接参考系**。

### willwulfken/MidJourney-Styles-and-Keywords-Reference（12.3k stars）
- 链接：https://github.com/willwulfken/MidJourney-Styles-and-Keywords-Reference
- MJ 风格关键词百科全书，看"堆料式"复杂提示词怎么写。

---

## 四、大合集 / 资源索引

| 项目 | 星数 | 说明 |
|------|------|------|
| [f/prompts.chat](https://github.com/f/prompts.chat)（原名 awesome-chatgpt-prompts） | 172.8k | 最有名但单条很短，"广"不"深" |
| [promptslab/Awesome-Prompt-Engineering](https://github.com/promptslab/Awesome-Prompt-Engineering) | 6.4k | 提示词工程资源总索引 |
| [microsoft/promptflow](https://github.com/microsoft/promptflow) | 11.2k | 提示词应用开发框架（工程化方向） |

---

## 五、复杂度的两个极端（心得）

1. **文生图类**："单段长文 + 多约束交缠"（几百字）
   - 考模型的空间关系 / 精确数量 / 中文文字执行力
   - 自出题 50 方块属于其中最刁钻的"精确网格"类
   - 极简形态参考 Qwen-Image 文字渲染案例

2. **Agent 系统提示词**："万行法规式结构"（上万 token）
   - 考覆盖度 / 鲁棒性 / 工具调用协议
   - 极繁形态参考 Cursor 系统提示词里的 UI 生成规则

> 出题启发：干扰维度设计可借鉴 x1xhlol 仓库里 Agent 提示词的"规则枚举"思路——把一条长指令拆成 10 个可交换的原子约束（数量 / 颜色 / 方位 / 状态 / 光照…），每个干扰项只动其中一个原子。

---

## 访问提示

- GitHub raw 下载被墙，单文件走 `api.github.com contents API`（本机已验证可用）
- 克隆整库可走代理（Clash 7890）或镜像前缀
