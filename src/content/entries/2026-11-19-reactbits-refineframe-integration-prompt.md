---
title: 提示词存档：React Bits RefineFrame 出图进度框集成提示词（附在线实时演示）
date: 2026-11-19
category: 提示词
tags: [prompt, react, canvas, 组件]
---

站内第六个实时特效 demo：[React Bits](https://reactbits.dev) 的 **RefineFrame**——一个 AI 出图风格的媒体进度框：

**👉 在线效果演示：[/demos/refine-frame/](/demos/refine-frame/)**

把图片放进框里，它就在五个阶段（queued / generating / refining / complete / error）之间演绎「生成感」：canvas 把图像预渲染成 9 级像素块，随阶段推进从马赛克逐行揭示到全清，接缝处用 14 条过渡条带 + 扫描光带抹平；左下角状态 chip 配 @hugeicons 图标（转圈 / 打勾 / 感叹号，阶段文字模糊淡入），完成后按 `hideAfter` 自动淡出，失败时中央弹重试按钮。和站内天天 AI 出图的日常绝配——素材直接用了站里的 FLUX / ComfyUI 测试图。

这次**零新依赖**：`@hugeicons/react` + `core-free-icons` 在 BranchedMenu 那次就装好了。React Bits 六连正好凑齐三种形态：带依赖的（motion、@hugeicons）、纯 CSS 3D 的（CircularCarousel、FlipCard）、canvas 手绘流的（PatternWaves、RefineFrame）。

Hero 会自动循环播放五阶段（含失败 → 重试回排队），也能手动点阶段看单帧、切换三张站内素材。

## 提示词全文

演示页底部有「一键复制：完整提示词（中文）」块（含用法示例、15 个 props 中文表、完整组件源码和 CSS），点按钮整段拷走就能投喂：

**👉 [RefineFrame 实时演示 · 集成提示词中文翻译](/demos/refine-frame/)**
