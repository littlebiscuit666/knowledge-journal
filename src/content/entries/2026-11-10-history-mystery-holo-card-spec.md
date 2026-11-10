---
title: 「历史谜局」典藏闪卡规范：海报 v2，从平面到鎏金动效卡牌
date: 2026-11-10
category: 提示词
tags: [历史谜局, 海报设计, 卡牌动效, 前端]
---

「历史谜局」海报体系的 **v2 演进**：平面海报 → **典藏闪卡**（Holo Card）。三段式规范卡，贴给任何 AI 一句话即可复刻同一质感。Demo 存档：`D:\gemini-workspace\poster_demo.html`。

## 模块一：AI 底图引擎

- **垂直 2:3 画幅**，上半部预留 **40% 纯净留白**（`generous clean negative space for typography`）——给排版留位置，AI 不把画面画满
- **绝对无字无水印**（`no text, no watermark`）——文字层全部归前端（铁律延续 v1）
- 风格从 8 种历史视觉体系匹配（胶片纪实 / 古典铜版画 / 浮世绘 / 艺术电影 / 古典油画 / 瑞士现代主义 / 复古科幻 / 中世纪手稿）

## 模块二：纯英文 Editorial 排版（6 组件）

| 组件 | 字体/做法 |
|------|----------|
| 顶栏期刊号与日期平衡条 | Space Mono |
| 分类眉标 + 罗马大写主标题 | Cormorant Garamond + Cinzel |
| 诗意斜体名言 + 细金引线 | Playfair Display Italic |
| 底部博物馆典藏事实注脚 | — |
| 倾斜连笔流金手写签名 | Great Vibes（Yihong） |
| 双层内嵌 1px 白金细线框 | Museum Inset Border |

## 模块三：典藏闪卡动效引擎

原则：**拒绝二次元彩虹渐变**，只用两种贵金属光。

- **3D 鼠标悬浮景深视差倾斜**（3D Tilt Parallax）
- **连续 UV 丝绸光扫**（Continuous UV Light Sweep，45° 柔光划过）
- **画面慢速深沉微呼吸**（Organic Atmospheric Breathing，7s 周期微缩放与光暗浮沉）
- **银盐冷白光 + 香槟暖金追光覆膜**（Silver & Champagne Gold Lustre）
- **点击 3D 翻转卡背**：绝密历史档案袋（Top Secret Declassified Dossier）+ 红色火漆印章（Wax Seal）——彩蛋层

## 为什么「暗号」能跨会话复刻

三个行业级关键词锁死了质感：

1. `clean negative space for typography` → 构图不满，标题有位
2. `Silver & Champagne Gold Lustre` + `Continuous UV Sweep` → 调用高雅的银盐金箔，而非廉价七彩彩虹
3. `Cormorant Garamond + Great Vibes` → 字体库精确锁死，画廊典藏级排版永远一致

## 一键激活暗号（新会话直接用）

> 「请使用我之前做过的【历史谜局 · 典藏闪卡海报规范】，为 [阿波罗登月 / 工业革命 / 庞贝古城] 制作海报与前端演示。」
