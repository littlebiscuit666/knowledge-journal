---
title: 提示词存档：React Bits AeroShards 玻璃碎片飘带集成提示词（本站首个 WebGPU 特效）
date: 2026-11-20
category: 提示词
tags: [prompt, react, webgpu, vgpu, 组件]
---

站内第七个实时特效 demo：[React Bits](https://reactbits.dev) 的 **AeroShards**——丝绸质感的厚玻璃碎片飘带：

**👉 在线效果演示：[/demos/aero-shards/](/demos/aero-shards/)**

1300 片棱镜状玻璃碎片分成五条飘带、五个景深层缓缓流动，边缘沿程序化「摄影棚灯光」捕捉高光，远处飘带随景深虚化。交互是它最好玩的部分：光标掠过时拨开经过的碎片、镜头朝光标微微倾斜；点击向所有层深发出一道光环，途经的碎片成片翻转；按住不放把附近碎片聚成漩涡，松手炸散回去。placement（全景/左/右/环心）、material（厚玻璃/镀铬）、markers（十字/圆点/无）都能在 Hero 上切换。

## 为什么这次不一样：WebGPU

这是站内**第一个走 WebGPU 而不是 WebGL** 的特效。前面 PatternWaves、CrystalizedBall 用 ogl（WebGL 封装），这次依赖换成了 `vgpu@0.6.0`——新一代 WebGPU 声明式库，`init / frame / draw / target / uniforms / storage` 那套 API 直接对着 WebGPU 的 command buffer 建模。

代码上最值得看的两点：

1. **逐像素棱柱光线追踪在 WGSL 片元里做**。每片碎片不是一个贴图矩形，而是一个最多五边的棱柱：顶点着色器把棱柱 5 个顶点的投影坐标当 flat varying 传给片元，片元里 `trace(prism, origin, ray)` 对棱柱做 ray-prism trace，`plane()` 逐个面求进出交点，再按入射/出射面做法涅尔（schlick）、折射色散、倒影——玻璃的"厚度感"是算出来的，不是画的。
2. **省电的 quiet 机制**。tick 循环里维护一个 `state.quiet` 计数器：页面不可见（IntersectionObserver）、没有瞬态动画、碎片静止时逐帧 +1，连续 30 帧安静就 `return` 完全停渲染；鼠标一动、一点击、光环还在扩散，计数器归零。比传统的"切后台暂停"更细——在长页面里把 demo 滚出视口也会自动停下来。

另外工程细节也齐全：`prefersReduced()` 尊重系统减少动态偏好、`onError` 回调让 WebGPU 不可用时能展示降级文案（我的 Hero 里就是渲染一段「此浏览器不支持 WebGPU」提示）、`cleanups.push()` 统一回收事件监听和 GPU 资源。

## 这次踩的一个坑

集成提示词全文 2300+ 行（组件源码就占 2231 行），往对话框里粘贴时被逐行截断了三十多次才拼出个残缺片段。最后是写成 `提示词/1.txt` 文件、让 agent 用脚本按代码块行号切片提取的——**长提示词走文件，别走剪贴板**。

## 提示词全文

演示页底部有「一键复制：完整提示词（中文）」块（含用法示例、30 个 props 中文表、完整组件源码和 CSS），点按钮整段拷走就能投喂：

**👉 [AeroShards 实时演示 · 集成提示词中文翻译](/demos/aero-shards/)**

## 运行环境要求

- 浏览器需要支持 WebGPU：Chrome / Edge 113+（国内网络下 reactbits.dev 官网抓取可能超时，但组件代码全在提示词文本里，不需要访问官网也能集成）
- `npm install vgpu`，React 18+
