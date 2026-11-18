---
title: 提示词存档：React Bits CircularCarousel 环形轮播集成提示词（附在线实时演示）
date: 2026-11-18
category: 提示词
tags: [prompt, react, css3d, 轮播, 组件]
---

站内第三个实时特效 demo：[React Bits](https://reactbits.dev) 的 **CircularCarousel**——一圈会转的 3D 照片环：

**👉 在线效果演示：[/demos/circular-carousel/](/demos/circular-carousel/)**

纯 CSS 3D 变换（这次连 ogl 都不用）：一排照片围成圆环持续旋转，可以抓住甩一下看它带着惯性滑行，点击任意卡片把它转到正前方，前排卡片下方还有滚动数字的页码器。四种形状预设一键切换：`cylinder`（卡片朝外圆筒）/ `orbit`（卡片全转向你）/ `wheel`（上下摩天轮）/ `panorama`（相机站在环中央）。

演示页用的是**站内自己的素材**（艾尔登法环 AI 图、FLUX 测试图、金毛）——组件默认图源是 Unsplash，大陆访问偏慢，同源图片才是正解。

## 三个 React Bits 组件落地后的共同心得

1. **提示词模板的「组件完整源码」段永远是占位符**——投喂前必须把真实源码粘进去，这是最容易漏的一步
2. **免费版组件都是「JSX + 一份 CSS + 零/一个依赖」**的形态，集成路径完全一致，区别只在依赖装不装（ogl 有、这次没有）
3. 组件的默认示例资源（Unsplash 图）在大陆是慢源，**换成站内素材又快又有人味**

## 提示词全文

演示页底部有「一键复制：完整提示词（中文）」块（含用法示例、29 个 props 中文表、完整 CSS 和集成步骤），点按钮整段拷走，粘上源码就能投喂：

**👉 [CircularCarousel 实时演示 · 集成提示词中文翻译](/demos/circular-carousel/)**
