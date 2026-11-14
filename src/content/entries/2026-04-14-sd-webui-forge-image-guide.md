---
title: "图片生成指南：SD WebUI Forge 模型补充与画质改善"
date: 2026-04-14
category: 技术
tags: [sd, webui, autodl, 出图, 日记归档]
draft: false
---

## 📊 当前已安装的图片生成相关内容

### ✅ 已安装的组件

| 组件 | 状态 | 说明 |
|------|------|------|
| **主模型** | ✅ 已安装 | `v1-5-pruned-emaonly.safetensors` (SD 1.5, 4.0GB) |
| **ControlNet** | ❌ 空目录 | 未安装任何ControlNet模型 |
| **VAE** | ❌ 空目录 | 未安装VAE模型 |
| **Lora** | ❌ 空目录 | 未安装任何Lora模型 |
| **ESRGAN** | ❌ 仅说明文件 | 未安装超分辨率模型 |
| **GFPGAN** | ❌ 空目录 | 未安装面部修复模型 |

### 目录结构

```
/root/stable-diffusion-webui-forge/models/
├── Stable-diffusion/          # 主模型目录
│   └── v1-5-pruned-emaonly.safetensors  ✅ SD 1.5 主模型 (4.0GB)
├── ControlNet/                 # ControlNet 模型目录 (空)
├── VAE/                       # VAE 模型目录 (空)
├── Lora/                      # Lora 模型目录 (空)
├── ESRGAN/                     # 超分辨率模型目录 (仅说明文件)
├── GFPGAN/                     # 面部修复模型目录 (空)
├── Codeformer/                 # 面部修复模型目录 (空)
├── hypernetworks/              # Hypernetworks 目录 (空)
├── text_encoder/               # 文本编码器目录
└── diffusers/                 # Diffusers 模型目录
```

---

## 🎯 为什么图片效果不好？

目前**只有基础的SD 1.5模型**，缺少以下关键组件：

1. **没有VAE** - 影响色彩和细节质量
2. **没有Lora** - 无法添加风格或特定效果
3. **没有ControlNet** - 无法精确控制构图、姿态等
4. **没有更好的模型** - SD 1.5 是较老的模型（2022年发布）

---

## 💡 改善图片质量的建议

### 方案1：升级到SDXL（推荐）

SDXL 是更新的模型（2023年发布），画质显著提升：

```bash
# 下载 SDXL Base 1.0 模型
python3 -c "from modelscope import snapshot_download; print(snapshot_download('AI-ModelScope/stable-diffusion-xl-base-1.0', cache_dir='/root/autodl-tmp/models/', allow_patterns=['sdxl_base_1.0.safetensors']))"

# 复制到模型目录
cp /root/autodl-tmp/models/AI-ModelScope/stable-diffusion-xl-base-1.0/sdxl_base_1.0.safetensors /root/autodl-tmp/models/checkpoint/
```

**SDXL 优势：**
- 更高分辨率（推荐 1024x1024）
- 更好的细节和色彩
- 更先进的架构

### 方案2：安装VAE

VAE（变分自编码器）可以改善色彩和细节：

```bash
# 下载 SD 1.5 的 VAE
python3 -c "from modelscope import snapshot_download; print(snapshot_download('AI-ModelScope/sd-vae-ft-mse-original', cache_dir='/root/autodl-tmp/models/'))"

# 复制到 VAE 目录
cp /root/autodl-tmp/models/AI-ModelScope/sd-vae-ft-mse-original/*.safetensors /root/stable-diffusion-webui-forge/models/VAE/
```

**VAE 作用：**
- 改善色彩饱和度
- 增强细节清晰度
- 减少噪点

### 方案3：安装ControlNet

ControlNet 可以精确控制生成结果：

```bash
# 下载常用 ControlNet 模型
python3 -c "from modelscope import snapshot_download; print(snapshot_download('AI-ModelScope/control_v11p_sd15_canny', cache_dir='/root/autodl-tmp/models/'))"
python3 -c "from modelscope import snapshot_download; print(snapshot_download('AI-ModelScope/control_v11f1p_sd15_depth', cache_dir='/root/autodl-tmp/models/'))"
python3 -c "from modelscope import snapshot_download; print(snapshot_download('AI-ModelScope/control_v11p_sd15_openpose', cache_dir='/root/autodl-tmp/models/'))"

# 复制到 ControlNet 目录
cp /root/autodl-tmp/models/AI-ModelScope/control_v11p_sd15_canny/*.safetensors /root/stable-diffusion-webui-forge/models/ControlNet/
cp /root/autodl-tmp/models/AI-ModelScope/control_v11f1p_sd15_depth/*.safetensors /root/stable-diffusion-webui-forge/models/ControlNet/
cp /root/autodl-tmp/models/AI-ModelScope/control_v11p_sd15_openpose/*.safetensors /root/stable-diffusion-webui-forge/models/ControlNet/
```

**ControlNet 类型：**
- **Canny** - 边缘检测，保持轮廓
- **Depth** - 深度图，控制空间关系
- **OpenPose** - 姿态控制，保持人物姿势
- **Scribble** - 涂鸦控制
- **Tile** - 瓦片控制，用于高清放大

### 方案4：安装Lora

Lora 可以添加特定风格或效果：

```bash
# 下载常用 Lora 模型（示例）
python3 -c "from modelscope import snapshot_download; print(snapshot_download('AI-ModelScope/Lora模型ID', cache_dir='/root/autodl-tmp/models/'))"

# 复制到 Lora 目录
cp /root/autodl-tmp/models/AI-ModelScope/Lora模型ID/*.safetensors /root/stable-diffusion-webui-forge/models/Lora/
```

**Lora 类型：**
- 风格类（动漫、写实、油画等）
- 人物类（特定人物风格）
- 概念类（赛博朋克、古风等）
- 技术类（增强细节、改善手部等）

### 方案5：安装超分辨率模型

```bash
# 下载 ESRGAN 模型
python3 -c "from modelscope import snapshot_download; print(snapshot_download('AI-ModelScope/Real-ESRGAN', cache_dir='/root/autodl-tmp/models/'))"

# 复制到 ESRGAN 目录
cp /root/autodl-tmp/models/AI-ModelScope/Real-ESRGAN/*.pth /root/stable-diffusion-webui-forge/models/ESRGAN/
```

---

## 🚀 立即改善的方法（无需下载）

### 1. 调整生成参数

在WebUI中尝试以下参数：

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| **Steps** | 30-50 | 采样步数，越高越精细但越慢 |
| **CFG Scale** | 7-12 | 提示词相关性，过高可能导致失真 |
| **Sampler** | DPM++ 2M Karras / Euler a | 采样器选择 |
| **Resolution** | 512x512 或 768x768 | 生成分辨率 |
| **Seed** | -1（随机） | 固定种子可复现结果 |

### 2. 优化提示词

**基础提示词模板：**
```
(质量词), (风格词), (主体描述), (环境描述), (细节描述), (技术参数)
```

**质量关键词：**
```
masterpiece, best quality, high resolution, highly detailed, 8k, 4k, ultra detailed
```

**风格关键词：**
```
digital art, anime, photorealistic, oil painting, watercolor, concept art
```

**示例提示词：**
```
masterpiece, best quality, 8k, highly detailed, 
a beautiful girl, long hair, blue eyes, 
sunset, beach, ocean waves, 
soft lighting, cinematic lighting, 
digital art, vibrant colors
```

**负面提示词（Negative Prompt）：**
```
low quality, worst quality, blurry, nsfw, ugly, deformed, bad anatomy, extra limbs, missing fingers
```

### 3. 使用Hires. Fix（高清修复）

在WebUI中启用 Hires. Fix：
- **Upscale by**: 1.5-2.0
- **Upscaler**: R-ESRGAN 4x+
- **Denoising strength**: 0.3-0.5

---

## 📋 推荐的下载优先级

### 优先级1（立即改善画质）
1. ✅ 安装VAE
2. ✅ 下载SDXL模型

### 优先级2（增强控制能力）
3. ✅ 安装ControlNet（Canny, Depth, OpenPose）
4. ✅ 安装ESRGAN超分辨率模型

### 优先级3（添加风格）
5. ✅ 下载Lora模型（根据需求）

---

## 🔄 下载后需要重启WebUI

下载新模型后：
1. 在WebUI界面点击"Settings" → "Reload checkpoints"
2. 或者重启WebUI服务

```bash
# 重启WebUI
# 在运行终端按 Ctrl+C 停止
# 然后重新启动
cd /root/stable-diffusion-webui-forge
python3 launch.py --listen --port 7860 --skip-torch-cuda-test
```

---

## 📝 常用下载命令速查

```bash
# 启动WebUI
cd /root/stable-diffusion-webui-forge
python3 launch.py --listen --port 7860 --skip-torch-cuda-test

# 检查已安装的模型
ls -lh /root/autodl-tmp/models/checkpoint/
ls -lh /root/stable-diffusion-webui-forge/models/ControlNet/
ls -lh /root/stable-diffusion-webui-forge/models/VAE/
ls -lh /root/stable-diffusion-webui-forge/models/Lora/

# 检查GPU状态
nvidia-smi

# 查看磁盘空间
df -h
```

---

*最后更新: 2026-04-14*
