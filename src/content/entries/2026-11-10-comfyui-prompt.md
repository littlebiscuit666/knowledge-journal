---
title: 提示词示例：让出图更稳定的负面词
date: 2026-11-10
category: 提示词
tags: [comfyui, stable-diffusion]
---

出图人物崩坏时，往负面提示词里加这组：

```text
lowres, bad anatomy, bad hands, extra fingers, worst quality, jpeg artifacts
```

## 为什么有效

- `bad anatomy` 直接对准肢体崩坏的高发区
- 质量类词（`worst quality` 等）在多数 SDXL 模型上都认识
- 记住：负面词不是越多越好，堆太多会互相干扰
