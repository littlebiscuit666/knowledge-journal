---
title: "AI 视频能力栈：HyperFrames + MiniMax"
date: 2026-08-21
category: 技术
tags: [hyperframes, minimax, 视频, 日记归档]
draft: false
---

## 今天完成了什么

### 1. comic-bubble 漫画字幕工具立项
- 项目落址 `D:\comic-bubble`（独立 git 仓库），详细方案与决策见其 `docs\2026-08-21-方案讨论纪要.md`
- 一句话：从**表情包**起步（单图单气泡），v0.1 = YOLO 动漫脸检测 + 规则排版 + **Penpot MCP 渲染**（求设计感）
- 卡点：开工第一步要先验证 Penpot MCP 四件套（建画板/放底图/实例化气泡组件/填中文文本）

### 2. HyperFrames 全家桶装进 Claude Code
- 安装命令（备忘）：`npx skills add heygen-com/hyperframes --skill '*' -g -y`
- 约 20 个 skills 全局生效，CLI 验证：`npx hyperframes --version` → 0.8.5
- **定位**：代码驱动（HTML + GSAP/Lottie/Three.js/CSS）的**确定性渲染**视频框架——排版动画靠写代码，不是生成式视频
- 三类技能：
  - 工作流：`hyperframes`（总入口）、general-video、motion-graphics、music-to-video、product-launch-video、talking-head-recut、embedded-captions（talking-head字幕）、slideshow、changelog-video
  - 知识：hyperframes-core/animation/audio/creative、motion-doctrine、cut-the-curve（转场目录）、seam-craft、captions-overlay
  - 工具：hyperframes-cli（init→render→publish 全链）、media-use（BGM/音效/TTS/媒体解析）、figma（设计稿导入）
- 依赖：Node ≥ 22、ffmpeg
- ⚠️ 第三方技能包拥有完整 agent 权限，用它干活前先通读 SKILL.md

### 3. 示例项目：MiniMax 中文音色合集视频
- 路径：`D:\minimax-ai-product\minimax-voice-collection`
- 内容：**14 女声 + 15 男声**试听，每音色一句"你好，欢迎使用MiniMax"，底部黄字实时显示音色 ID，女性段→男性段用官方 `flash-through-white` 闪白 Shader 转场
- 结构：`index.html`（合成）+ `hyperframes.json` + `public/audio.mp3`（合并音频）+ `renders/*.mp4`
- 重新渲染：`npm run render`

## 新能力栈的意义

```
mmx CLI（MiniMax：文本/图像/视频/TTS/搜索）   ← 素材生成
        ↓
HyperFrames（HTML+动效排版，本地渲染 MP4）     ← 合成出片
```

素材生成与排版渲染解耦，各用最强的工具。今天这条链已用 29 音色视频完整验证。

**与 comic-bubble 的潜在组合**：动态表情包（气泡弹入动画）、漫画分镜配动态字幕出短视频——静图字幕工具（Penpot 线）+ 动态视频线（HyperFrames 线）互补。

## 下一步
- [ ] comic-bubble：验证 Penpot MCP 四件套 → 通过后开写 bubble.py
- [ ] mmx CLI 具体能力摸底（语音/图像/视频 API 的额度与用法）
