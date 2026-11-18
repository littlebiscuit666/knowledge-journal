---
title: 提示词存档：React Bits CrystalizedBall 等离子水晶球集成提示词（附在线实时演示）
date: 2026-11-18
category: 提示词
tags: [prompt, react, webgl, ogl, 组件]
---

站内第二个实时特效 demo：[React Bits](https://reactbits.dev) 的 **CrystalizedBall**——一颗封存了闪电与尘埃的水晶球：

**👉 在线效果演示：[/demos/crystalized-ball/](/demos/crystalized-ball/)**

边缘缠绕着抖动的电弧线条，球内上万颗尘埃粒子缓缓漂浮；光标掠过时边缘朝光标方向发热、扬起耀斑，尘埃随之打旋，点击会摇晃球体、激起放电。八种预设（plasma / aurora / nebula / ember / frost / solar / eclipse / abyss）一键切换。

## 小插曲：React Bits Pro 有墙

本来这期想做 React Bits **Pro** 的 Cipher Reveal（乱码解码标题），走到一半发现：

- Pro 是付费授权，要求 `REACTBITS_LICENSE_KEY` 配 Authorization 头走 shadcn registry 安装，机器上没有 key，直接卡死
- 果断换回免费版的 CrystalizedBall，同一个 ogl 体系、同一套提示词工作流，零阻力落地

结论：**没 license 别硬磕 Pro registry**，免费版 80+ 组件先玩起来，真需要 Pro 的再买。

## 提示词全文

和 PatternWaves 同款约定：演示页收录提示词的中文翻译（专有名词保留英文）——组件介绍、用法示例、24 个 props 的完整说明表和集成步骤，页面顶部即实时效果：

**👉 [CrystalizedBall 实时演示 · 集成提示词中文翻译](/demos/crystalized-ball/)**
