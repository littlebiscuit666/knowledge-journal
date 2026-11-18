---
title: 提示词存档：React Bits PatternWaves 波浪背景组件集成提示词（附在线实时演示）
date: 2026-11-18
category: 提示词
tags: [prompt, react, webgl, ogl, 组件]
---

把 [React Bits](https://reactbits.dev) 的 **PatternWaves** 组件做成了站内第一个带实时效果的组件收录页——一篇提示词存档，同时也是一个能玩的可视化 Demo：

**👉 在线效果演示：[/demos/pattern-waves/](/demos/pattern-waves/)**

PatternWaves 用 `ogl`（WebGL）在网页上渲染一片可交互的波浪表面：点阵 / 方块 / 等高线 / 字符雨都是它的「打印」方式，光标划过留下捕捉光线的涟漪尾迹，点击溅起水花。演示页顶部是实时效果，六个预设（silk / ocean / pond / lines / terminal / mesh）一键切换，直观感受 `preset` prop 的差异。

## 这类「集成提示词」怎么用

React Bits 的发布方式：官方给一段结构化提示词，内含**组件源码 + 用法示例 + Props 表 + 集成步骤**，整段交给 Claude Code、Cursor 这类 AI 编码工具，它就会自动装依赖（`ogl`）、落文件、渲染组件。

两个注意点：

- 提示词模板里「组件完整源码」一段是**占位符**，投喂前记得把真实源码粘进去，否则 AI 只能靠猜
- 想找更多组件，直接抓 [reactbits.dev/llms.txt](https://reactbits.dev/llms.txt) 的完整索引

## 提示词全文

演示页收录了提示词的中文翻译（专有名词保留英文）：组件介绍、用法示例、26 个 props 的完整说明表和集成步骤，页面顶部即是组件的实时效果：

**👉 [PatternWaves 实时演示 · 集成提示词中文翻译](/demos/pattern-waves/)**
