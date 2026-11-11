---
title: "本地电脑 AI 资产盘点"
date: 2026-08-16
category: 工具
tags: [盘点, ai, 本地, 日记归档]
draft: false
---

> 位置：本机（Windows 11 / Intel Arc 130T 核显）｜清理后快照
> 配套：服务器资产见 AutoDL westc 文件路径地图.md；混元3D见 2026-08-16_Hunyuan3D-mini部署完成.md

## 一、HuggingFace 缓存（C盘 ~/.cache/huggingface，3.2G）

清理后保留 5 个完整模型：

| 模型 | 大小 | 用途 |
|---|---|---|
| Qwen/Qwen2.5-0.5B-Instruct | 954M | 小语言模型（护符LoRA底座，见 weitiao 项目） |
| kyutai/pocket-tts | 888M | 迷你 TTS |
| timm ViT-B/32 CLIP | 578M | 图像编码器 |
| bert-base-chinese | 393M | 中文 BERT |
| shibing624/text2vec-base-chinese | 391M | 中文句向量 |

已清理（~10.9G）：Counterfeit-V2.5(4G，与ComfyUI V3重复)、ComfyUI里Qwen3-TTS安装zip(6.8G，文件夹保留)、Qwen3-0.6B/bge-reranker空壳、ChnSentiCorp×3重复数据集。

## 二、ComfyUI 便携版（D:\comfyui\ComfyUI_windows_portable）

版本 0.28.0 + Arc130T XPU（torch 2.x 原生 xpu，不 import ipex）。

### 底模（checkpoints/）
| 模型 | 类型 |
|---|---|
| animagineXLV31_v31 | ★主力 SDXL 动漫 |
| illustriousXL_v01 | SDXL 动漫 |
| sdxl_lightning_8step | SDXL 加速（配4/8步LoRA） |
| Counterfeit-V3.0_fix_fp16 | SD1.5 动漫 |
| AOM3B4_orangemixs | SD1.5 动漫 |
| anything-v5 | SD1.5 动漫 |
| Realistic_Vision_V5.1 | SD1.5 写实 |
| Qwen3-TTS-12Hz-1.7B-CustomVoice/ | TTS 模型文件夹 |

### 角色 LoRA（loras/，16个）
自训：feicui / feiying / haiseyin / heitiane / kafuka / liuying / robin / ruanmei / tingyun / yeshunguang（各218M，-v1-000014）+ agelaiya 两版
外部：Char-HonkaiSR-Tingyun（停云官方版）、c1_hysilens（星穹缇宁il版）
辅助：epiNoiseoffset_v2、sdxl_lightning 4/8步

### IPAdapter（vit-h 线）
- ip-adapter-plus_sdxl_vit-h + ip-adapter-plus-face_sdxl_vit-h
- clip_vision/open_clip_model（ViT-H/14 patch1280）
- ⚠️ vit-h 必须配 ViT-H/14，错配报 Resampler proj_in 维度错误；角色一致性靠 plus-face+plus 双组合

### 已装扩展
IPAdapter_plus 等

## 三、其他本地 AI 项目资产

| 项目 | 位置 |
|---|---|
| Qwen3-TTS 本地推理（XPU） | D:\Python_workspace_311\自主学习2\Qwen3-TTS（infer.py） |
| 护符 LoRA 微调 | weitiao（Qwen2.5-0.5B，复用 TTS 的 venv） |
| band-transcriber 扒谱 | D:\music\band-transcriber（专用 .venv torch2.1.2+cpu） |
| 视觉小说 agent | D:\comfyui-agent（Task1-7完成，等Task8真机验收） |
| Blender MCP | 本地 Blender 5.0.1，建模走 execute_blender_code 写 bpy |
| Penpot MCP | localhost:4400 单实例（第二个必 EADDRINUSE） |
| MuseScore 桥接 | agent_bridge.qml 插件 + 8766 端口 helper |
| Audiveris OMR | Program Files，图片须<2000万像素 |
| stock_analysis | .venv（TA-Lib），analyze.py 持仓技术分析 |
| 本机 Python 环境 | ①系统全局 311 ②XPU torch2.13（ComfyUI python_embeded + TTS .venv）③band-transcriber .venv |

## 四、本机 vs 服务器分工

- **本机（核显）**：轻量推理——SD出图（XPU ComfyUI）、0.5B级LLM、TTS、扒谱、Blender/Penpot/MuseScore 桌面工具链
- **AutoDL（4080S 32G）**：重活——SDXL+LoRA训练、Qwen3-4B聊天、混元3D、NotaGen
- 模型不双存：大底模只在服务器（本地的 animagineXL 是 ComfyUI 用，服务器那份独立）

## 五、维护备忘

- HF 缓存删掉的都是可重下的缓存，无风险
- ComfyUI 的 Qwen3-TTS **zip 已删、文件夹保留**，TTS 功能不受影响
- 本地 checkpoints 里 SD1.5 系较多，若 C/D 盘紧张可再评估（当前没动）
