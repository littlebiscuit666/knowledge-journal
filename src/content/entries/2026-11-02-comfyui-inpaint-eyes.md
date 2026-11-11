---
title: "ComfyUI 本地启动 + 角色闭眼局部重绘方案"
date: 2026-11-02
category: 技术
tags: [comfyui, 局部重绘, inpaint, 日记归档]
draft: false
---

> 归档日期：2026-11-02
> 状态：环境已就绪（ComfyUI 运行中@8188），重绘工作流**待搭建**
> 明日从这里继续：搭工作流 JSON → 涂眼睛 mask → 跑通闭眼效果

## 一、今天做了什么

### 1. 启动了本地 ComfyUI（已验证跑通）

- 启动方式：`D:\comfyui\ComfyUI_windows_portable\` 下执行
  ```
  ./python_embeded/python.exe -s ComfyUI/main.py --windows-standalone-build --port 8188
  ```
- 访问地址：**http://127.0.0.1:8188**
- 后端确认：PyTorch 2.13.0+xpu，Intel Arc 130T 核显（16G 显存空闲）
- 自定义节点无报错，ComfyUI-Manager 正常工作
- ⚠️ `run_intel_gpu.bat` 里没带 `--port`，所以默认端口是 8188（不是记忆里的 6005）

### 2. 端口排雷（重要，以后别踩）

| 端口 | 现状 | 说明 |
|---|---|---|
| ~~6005~~ | **被 Godot 编辑器占用**（godot-ai 插件，PID 是 Godot_v4.7.2） | 本机 6005 不能再给 ComfyUI 用 |
| 8188 | ✅ ComfyUI 本地 | 今天起的 |
| 6007 | lora-studio config.json 当前指向这里 | AutoDL 4080S 隧道后端，需开机+隧道 |

- lora-studio（8899）的 config.json 目前 `comfy_url: http://localhost:6007`（AutoDL 隧道）。**要用本地出图须改成 `http://localhost:8188`，模板配套换 comic_local.json**。
- 顺带：库里有张临时签名图链今天已失效过一次，归档文档时开放网络图链要注意时效。

### 3. 确定闭眼需求的技术路线（不下载 inpainting 模型）

需求：已有角色立绘，让角色**闭眼，其他地方完全不变**。

结论：**不需要下载专门的 inpainting 模型**，animagine XL 3.1 + `Set Latent Noise Mask` 就够。专门的 inpainting 模型主要解决大面积重绘融合问题，闭眼这种小面积修改用不上。

## 二、明日待办：搭建闭眼局部重绘工作流

### 工作流结构

```
LoadImage（右键节点 → Open in MaskEditor，涂住双眼区域）
  → VAE Encode
  → Set Latent Noise Mask
  → KSampler（prompt = 原图提示词 + closed eyes）
  → VAE Decode → Save Image
```

### 关键参数

| 参数 | 建议值 | 原因 |
|---|---|---|
| denoise | 0.5~0.7 | 太低画不出闭眼，太高会改脸型 |
| Grow Mask | 外扩 8~15px + 边缘模糊 | 眼睛小，涂太准反而留接缝 |
| prompt | 原图提示词不动，只加 `closed eyes` | 锁画风、发色、其余五官不漂移 |
| negative | 加 `open eyes` | 防止采样又画回去 |
| seed | 固定，多试几个 | 睫毛弧度每次不同，挑自然的 |

底模：`animagineXLV31_v31.safetensors`（已认识 `closed eyes` danbooru 标签）。

### 备选方案（仅当 latent mask 重绘出现边缘色差再上）

**Fooocus inpaint head**（约 120MB 补丁，非整个模型），打在任意 SDXL 底模上，animagine 直接兼容，融合质量更好。

## 三、验收标准

- [ ] 工作流 JSON 搭好，可加载
- [ ] MaskEditor 涂眼 → 出图，眼睛闭合自然
- [ ] mask 外区域与原图逐像素一致（对比验证）
- [ ] 至少 3 个 seed 可选，挑最好的一版
