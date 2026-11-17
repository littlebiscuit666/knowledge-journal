---
title: Colab L4 跑 FLUX.1 生图：手搓 diffusers vs ComfyUI 全流程对比实验
date: 2026-11-17
category: 技术
tags: [colab, comfyui, flux, gpu, 生图]
---

接昨天 Colab Pro MCP 那篇，今天用官方 CLI 的 SSH 直连（`colab new --gpu L4` → ProxyCommand 桥接 root shell）在同一张 L4 上做了完整对比实验：**同一个小目标（免登录跑 FLUX.1 出图），一条路自己写胶水代码（diffusers），一条路用现成的 ComfyUI**。结论值得单独记一笔。

![FLUX.1-schnell 出图：4步，霓虹东京滑板金毛](/images/2026-11/flux-schnell-golden-retriever.png)
![FLUX.1-dev 出图：20步，同提示词明显更电影感](/images/2026-11/flux-dev-golden-retriever.png)

## 一、结论速览

| 阶段 | A：ComfyUI（主力） | B：diffusers 手搓（备用） |
|---|---|---|
| 装环境 | 28 秒（clone 2.4s + pip 25s） | 40 秒（pip diffusers） |
| 权重下载 | 17.2GB 全家桶单文件 | 22GB（transformer+组件拼装） |
| 冷启动出图（含模型加载） | **35.0 秒** | 139.9 秒 |
| 热生成 20 步 | **25.0 秒 = 1.25 秒/步** | 63.1 秒 ≈ 2 秒/步 |
| 研发摩擦 | 零失败 | 摔了 5 跟头 |

**ComfyUI 路线全面胜出**：不仅省掉全部调试，运行时也快 2.5~4 倍。

## 二、路线A：ComfyUI 全流程（推荐照抄）

1. **安装**：`git clone --depth 1 ComfyUI` + `pip install -q -r requirements.txt`（Colab 自带 torch，28 秒搞定）
2. **模型**：`Comfy-Org/Flux-1-Dev` 的 `flux1-dev-fp8.safetensors`（17.2GB 全家桶=模型+T5+VAE，无门禁）直接 curl 进 `models/checkpoints/`
3. **启动**：`python3 main.py --listen 127.0.0.1 --port 8188 --fast fp8_matrix_mult`（`--fast` 是 scaled_mm fp8 快速矩阵乘，等价于手搓路线里 torchao 那步）
4. **出图**：HTTP API 提交节点图（`CheckpointLoaderSimple` + `FluxGuidance 3.5` + `KSampler` euler/simple cfg 1.0 20 步）→ 轮询 `/history/<id>`。模板脚本已存 `D:\flux-test\comfy_gen.py`，改提示词和种子即可复用

![ComfyUI fp8 出图：雨窗霓虹咖啡店（发光文字仍有乱码）](/images/2026-11/comfyui-fp8-coffee.png)

## 三、路线B：diffusers 手搓（快速小实验用）

最终能跑的配方：`FluxPipeline` + transformer 用 torchao 转真 fp8（`quantize_` + `float8_dynamic_activation_float8_weight`）+ `enable_model_cpu_offload()`。热生成 63 秒可用，但加载前要做 fp8→bf16→fp8 两段转换（白付 44 秒），每步还比 ComfyUI 慢 0.7 秒——diffusers 不原生认 fp8 存储，全靠胶水补。

![diffusers fp8 路线出图：赛博朋克女孩，肉眼接近无损](/images/2026-11/flux-dev-fp8-cyberpunk.png)

## 四、踩坑清单（本次精华）

1. **BFL 官方仓库全部门禁**：FLUX.1-schnell 虽是 Apache 2.0 也设了门禁（我记忆里"免登录"的印象过时了）。无门禁镜像：`unsloth/FLUX.1-schnell`（diffusers 全套布局）、`unsloth/FLUX.1-dev`、`Comfy-Org/Flux-1-Dev`、`Kijai/flux-fp8`。查门禁用 HF API：`curl https://huggingface.co/api/models/<repo>` 看 `gated` 字段
2. **L4 的 22GB 显存三连败**：bf16 transformer 本体 23.8GB。①`enable_model_cpu_offload` 整组件卸载→落地即 OOM；②bnb 8bit 量化→量化模块搬不动、和 T5 挤爆显存；③原生 fp8→diffusers 的 Linear 不做 fp8 矩阵乘，报 dtype 墙。**`enable_sequential_cpu_offload` 逐层卸载是保底解**，但 12 秒/步（时间全花在 PCIe 搬运）
3. **torchao 新版 API**：`quantize_` 的 `filter_fn` 要收两个参数 `(module, fqn)`，按老签名写一个参数直接 TypeError
4. **ComfyUI `--fast` 合法值**：这版（0.45.0）是 `fp8_matrix_mult / fp16_accumulation / cublas_ops / autotune`，想当然写 `fp8_e4m3fn` 直接 argparse 报错
5. **桥接僵尸**：报 `HTTP 429 Already-active SSH session` = 上个连接没断干净，`taskkill //F //IM colab.exe` 杀本地桥进程 + 等 20 秒即愈
6. **后台进程拖住 ssh channel**：nohup 常驻进程（curl/服务器）会让命令不返回。生成类任务改**前台长命令**（超时给足），必须后台时接受本地挂起、断开重连查结果
7. **新 VM 指纹必变**：每次开新会话 host key 都换，固定加 `-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`
8. **Git Bash 三件套**：`/root` 参数要 `MSYS_NO_PATHCONV=1`（否则被转成 `C:/Program Files/Git/root`）；`pkill -f flux_gen.py` 会匹配到自己的命令行自杀，写 `pkill -f '[f]lux_gen'`；上传脚本和启动必须分两条 ssh（合着用 `&` 会吃掉 stdin）

## 五、认知修正：别急着给"慢"找物理借口

中途我曾断言"2 秒/步就是 L4 的物理极限，瓶颈是 PCIe 搬运和显存带宽，ComfyUI 也一样"——**被实测打脸**。ComfyUI 靠原生 fp8 加载（免掉格式转换）+ 内置编译器和 CUDA graph（消灭内核启动开销）直接做到 1.25 秒/步。"现成的"不只是省研发摩擦，运行时也更快；自己写胶水代码时找不到优化点，往往是因为缺的那块本来就在成熟引擎的默认行为里。

**成本核算**：三个会话（diffusers 实验 + fp8 快路径 + ComfyUI 全流程）共烧 2.20 计算单元（余额 93.83 → 91.63），L4 计费 1.94 CU/小时。全部产物图和可复用脚本在 `D:\flux-test\`。

## 六、收尾备注

- 文字渲染仍是 FLUX 短板：提示词要 "ANTIGRAVITY FLUX"，出来的是 "Cofenity Flux"——20 步 dev 也hold不住精确文字，需要文字还是得走排版叠加
- VM 是一次性的：模型和产物**必须** `colab download` 拉回本地，关机即蒸发；每轮实验控制在 0.5 CU 左右的诀窍是"跑完立即 stop"
