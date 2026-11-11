---
title: "Hunyuan3D-2 本地 XPU 部署总结"
date: 2026-08-17
category: 技术
tags: [xpu, hunyuan3d, intel, 3d, 日记归档]
draft: false
---

> 日期：2026-08-17 ｜ 状态：**✅ 部署完成，CLI 验收通过 + 网页自测通过**
> 效果：图片 → 3D 白模 GLB，Intel Arc 130T 核显推理，**全程约 134 秒/模，峰值显存 4.14G**
> 姊妹项目：AutoDL 上的 Hunyuan3D-mini 部署（`2026-08-16_Hunyuan3D-mini部署完成.md`，4080S 10秒/模）

## 一、最终架构

```
D:\Hunyuan3D\
├── Hunyuan3D-2-main\Hunyuan3D-2-main\    # 官方代码（sys.path 注入，不 pip install）
├── hunyuan3d-dit-v2-0\                   # ★主权重 3.82G + config.yaml
│                                          #   单文件内置 DiT + DINOv2-giant + VAE
├── hunyuan3d-vae-v2-mini\                # 归档：mini 系列 VAE(407M)，与 v2-0 不兼容
├── infer.py                              # ★自写推理脚本（CLI + Gradio 双模式）
├── outputs\                              # 出模结果
├── 设计文档-本地XPU部署.md / 实施计划-本地XPU部署.md
└── pip-before.txt / pip-after.txt        # TTS 环境前后快照
```

- **模型**：Hunyuan3D-DiT-v2-0 **全量版**（已验证 8 double + 16 single blocks；mini 是更小结构）
- **环境**：完全复用 Qwen3-TTS 的 venv（`D:\Python_workspace_311\自主学习2\Qwen3-TTS\.venv`，py3.11.9 + torch 2.13.0+xpu），只补了 9 个叶子包 + torchvision，torch/transformers 分毫未动
- **服务**：`--web` → `http://127.0.0.1:7860`，gr.Model3D 旋转预览 + 下载

## 二、启动命令

```bat
:: 网页模式（cmd/PowerShell 直接跑，无需 cd）
D:\Python_workspace_311\自主学习2\Qwen3-TTS\.venv\Scripts\python.exe D:\Hunyuan3D\infer.py --web

:: CLI 模式
D:\Python_workspace_311\自主学习2\Qwen3-TTS\.venv\Scripts\python.exe D:\Hunyuan3D\infer.py 图片.png [输出.glb]
```

常用参数：`--steps 30 --guidance 5 --octree 256`（默认即最优）｜`--port 7861` 换口｜`--model 子目录名` 换权重变体｜`--device cpu` 应急

权重加载约 20 秒；端口被占报 `Cannot find empty port` 就是上一个服务没退，Ctrl+C 或换 `--port`。

## 三、实测性能（Arc 130T 核显 16G，fp16）

| 阶段 | 耗时 | 备注 |
|---|---|---|
| 权重加载 | ~20s | 热缓存时 |
| 30 步扩散采样 | **49s** | 1.66s/步 |
| VAE 体解码 2122 块 | 3.4s | 很快 |
| Marching cubes + 后处理 | **~80s** | CPU 上，**全程大头** |
| **合计** | **~134s/模** | 峰值 XPU 显存 4.14G |

验收样张（官方 demo.png）：155,304 顶点 / 310,626 面，三轴 extent 1.32/1.99/1.08（thin ratio **0.54**，立体饱满），封闭无开口边。

用户实测（2026-08-17）：自己出杯子 **~200s/模**——形状越复杂 MC 后处理越重，134~200s 都属正常。推理期间系统明显卡顿为核显通病（算力被占满，桌面渲染同卡抢资源），出完即恢复。

**结论：XPU 全链路 fp16 零报错**——DiT、SDPA、VAE 解码都原生跑通，继 Qwen3-TTS 之后核显栈成熟度的又一例证。比 4080S 慢一个数量级，但胜在零成本、随身、显存富余（可与浏览器等共存）。

## 四、使用经验

- **透明底图片效果最好**：u2net 抠图模型没下（GitHub 直连没试），白底图会降级直接送入，背景会被建模进去——喂 RGBA 透明底完全没这问题
- **45° 视角**出立体，正面平拍/图标会压片（AutoDL 同款结论）
- results 自动存 `outputs\`，网页里也能直接下载 GLB 进 Blender

## 五、踩坑记录

### 1. torchvision 必须从 xpu 专用索引装（★最重要）
TTS venv 里没有 torchvision（Qwen3-TTS 用不到）。**PyPI/国内镜像直装会拉错配对、可能连带重装 torch**。正确姿势（参照 ComfyUI python_embeded 里同款 0.28.0+xpu）：
```
pip install --no-deps torchvision==0.28.0 --index-url https://download.pytorch.org/whl/xpu
```
`download.pytorch.org` 平时直连可通，不用等周日代理。

### 2. `watertight=False` 不是 bug
首跑 demo.png 报 watertight=False，深挖后真相：**boundary edges = 0（网格完全封闭）**、单组件、euler 数 -7 → 是 marching cubes 的**非流形夹点边**（一边被 3+ 面共享），CUDA 同参数也会出。看模/进 Blender 零影响，只有 3D 打印在乎且切片软件能自动修。验收时别被这行吓到。

### 3. 散落的 `model.fp16 (1).safetensors`(407M) 是 mini 系列 VAE
张量比对：geo_decoder 宽 512 vs v2-0 内置 VAE 的 1024，架构不同装不上。已归档 `hunyuan3d-vae-v2-mini\`——以后下 mini DiT 变体时能复用。

### 4. 3.8G 主权重是"全家桶"
单 safetensors 里 model 336 张量 + conditioner(DINOv2-giant) 727 张量 + vae 266 张量 → `from_single_file` 一个文件全加载，**完全离线**，不用联网下 DINOv2（当时担心的联网问题不存在）。

### 5. 端口/日志小坑
- 我会话里挂的后台服务占了 7860，用户自起时报 `Cannot find empty port in range: 7860-7860` → 停掉旧的或 `--port 7861`
- python stdout 重定向有缓冲：日志文件里半天看不到 `Running on local URL`，实际服务已就绪——直接 curl/开浏览器确认，别傻等日志

### 6. 官方代码的 cuda 兼容性比想象中好
`device='cuda'` 全是默认参数值（传 xpu 覆盖即可）；`torch.cuda.Event` 计时器只在 `HY3DGEN_DEBUG=1` 时激活。**一行官方代码都没改**。

## 六、能力边界

- ❌ 文生 3D：conditioner 是 SingleImageEncoder(DINOv2)，无文本通道（系列通病）
- ❌ 贴图：白模而已；要贴图需 hy3dpaint ~10G
- ✅ 图生 3D 白模 GLB：本地 134s/模，随时可跑

## 七、后续可选

- [ ] **u2net.onnx**（~176M，GitHub releases 直连）→ 白底普通照片也能抠图；RGBA 图不需要
- [ ] **贴图模块 hy3dpaint**（~10G 下载 + 16G 核显显存评估，风险较高）
- [ ] **两段式文生 3D 本地化**：本地 ComfyUI(Animagine) 出 45° 白底图 → 本地 Hunyuan3D 转 3D（AutoDL 的 text2mesh.py 可直接移植）
- [ ] **turbo 变体提速**：v2-0-turbo 步数更少，预计能把 134s 压到 ~100s 内（下载 3.82G）
- [ ] GLB → Blender MCP 流程（本地 Blender 5.0.1 已连通）

---
本地资产：设计/实施文档在 `D:\Hunyuan3D\`；AutoDL 对照部署见昨日日记
