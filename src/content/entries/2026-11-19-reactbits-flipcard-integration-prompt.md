---
title: 提示词存档：React Bits FlipCard 3D 翻转卡片集成提示词（附在线实时演示）
date: 2026-11-19
category: 提示词
tags: [prompt, react, motion, css3d, 组件]
---

站内第五个实时特效 demo：[React Bits](https://reactbits.dev) 的 **FlipCard**——一张会翻面的 3D 卡片：

**👉 在线效果演示：[/demos/flip-card/](/demos/flip-card/)**

motion 弹簧驱动的翻面动画：点一下翻过去，抓住拖拽能手动翻，快速一甩带着角速度落回最近的面；悬停时卡片朝光标倾斜（tilt）、表面跟着光标走眩光（glare），翻到侧面时下方阴影收窄。x / y 双轴一键切换，键盘 Enter / 空格也能翻，开启系统「减少动态」偏好后自动降级成交叉淡入淡出——交互细节相当齐全。

这也是站内集成的**第一个带运行时依赖**的 React Bits 组件：前四个要么零依赖、要么只用站内已有的 ogl，这次要 `npm install motion`（gzip 约 50KB，React 生态常用的弹簧动画库，framer-motion 的新名字）。

正面照旧用**站内素材**（琥珀之卵、蕾娜菈、金毛），背面做成说明卡，Hero 上可以切轴、换素材。

## 提示词全文

演示页底部有「一键复制：完整提示词（中文）」块（含用法示例、28 个 props 中文表、完整组件源码和 CSS），点按钮整段拷走就能投喂：

**👉 [FlipCard 实时演示 · 集成提示词中文翻译](/demos/flip-card/)**
