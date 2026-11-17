---
title: 提示词存档：Colab L4 + ComfyUI + FLUX.1 部署提示词两式（公网交互版 / 无头 API 版）
date: 2026-11-17
category: 提示词
tags: [prompt, colab, comfyui, flux, 部署]
---

刚做完 ComfyUI vs diffusers 的对比实验，把「复现这套环境」的过程打磨成了两条可交付指令，同一个部署体系的两种用法：

- **公网交互版**：穿透到 trycloudflare.com，人在浏览器里玩 ComfyUI，会话常驻、玩完人叫关机
- **无头 API 版**：不开穿透，脚本走 `127.0.0.1:8188` 的 HTTP API 出图，图片拉回本地后**自动关机止损**

原文完整归档如下。

## 式一：公网交互版

```text
请帮我在 Google Colab 上从零拉起一台 L4 GPU 虚拟机，部署好 ComfyUI + FLUX.1 并交付公网访问链接：

【阶段一：机器启动与 SSH 连通】
1. 检查或新建会话：
   - 使用本地 `colab` CLI 新建一台 L4 显卡虚拟机（例如会话名 `comfy-flux`）：
     `colab new --gpu L4 --session comfy-flux`
2. 远程连接方式（Windows 宿主机）：
   - 请通过 OpenSSH 的 ProxyCommand 机制直连 VM 的 root：
     `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ProxyCommand="colab.exe ssh --proxy-mode -s comfy-flux" root@localhost "<命令>"`
   - ⚠️【关键避坑指令】：所有耗时或后台运行的命令（如 nohup、curl、python），必须切断标准输入并重定向日志（例如：`nohup 命令 </dev/null >/root/log.txt 2>&1 &`），严禁让 SSH 挂起，否则会触发 Google Colab 的单连接排他限制（HTTP 429）。

【阶段二：部署 ComfyUI】
1. 在远端 VM 的 `/root` 目录下拉取 ComfyUI：
   `git clone https://github.com/comfyanonymous/ComfyUI.git`
2. 安装依赖（Colab 已自带 PyTorch-CUDA，只需装 requirements）：
   `pip install -r /root/ComfyUI/requirements.txt`

【阶段三：下载 17.2GB FLUX.1 FP8 全家桶单文件】
1. 后台静默下载 Comfy-Org 官方免门禁模型到 checkpoints 目录：
   `nohup wget -c "https://huggingface.co/Comfy-Org/flux1-dev/resolve/main/flux1-dev-fp8.safetensors" -O /root/ComfyUI/models/checkpoints/flux1-dev-fp8.safetensors </dev/null >/root/dl.log 2>&1 &`
2. 轮询监控下载进度，确认文件达到约 17.2GB 并校验完成。

【阶段四：启动服务与公网穿透】
1. 启动 ComfyUI（使用最新版 FP8 硬件加速参数）：
   `nohup python3 /root/ComfyUI/main.py --listen 0.0.0.0 --port 8188 --fast fp8_matrix_mult </dev/null >/root/comfy.log 2>&1 &`
2. 在 VM 上安装 cloudflared 并将 8188 端口穿透到公网：
   - 下载 cloudflared 二进制文件并执行：
     `nohup cloudflared tunnel --url http://127.0.0.1:8188 </dev/null >/root/tunnel.log 2>&1 &`
3. 从 `/root/tunnel.log` 中抓取生成的公网域名（通常是 `https://xxx.trycloudflare.com`）。

【交付物】
- 将生成的 `https://xxx.trycloudflare.com` 链接输出给我，让我能直接在浏览器里打开 ComfyUI 玩 FLUX；
- 保持会话常驻，等待我玩完后通知你执行 `colab stop comfy-flux` 关机。
```

## 式二：无头 API 版

```text
请帮我在 Google Colab 上从零新建一台 L4 GPU 虚拟机，通过无头（Headless）ComfyUI API 跑通 FLUX.1 并将生成的图片拉回本地：

【阶段一：机器启动与 SSH 连通规范】
1. 检查或新建会话：
   - 使用本地 `colab` CLI 新建一台 L4 显卡虚拟机（例如会话名 `comfy-run`）：
     `colab new --gpu L4 --session comfy-run`
2. 远程连接方式（Windows 宿主机）：
   - 请通过 OpenSSH 的 ProxyCommand 机制直连 VM 的 root：
     `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ProxyCommand="colab.exe ssh --proxy-mode -s comfy-run" root@localhost "<命令>"`
   - ⚠️【关键避坑指令】：所有长时间或后台任务（nohup/curl/python），必须使用标准断开格式：`nohup 命令 </dev/null >/root/log.txt 2>&1 &`，严禁挂住 SSH 通道导致 Google 报 HTTP 429 占线。

【阶段二：部署 ComfyUI 与下载 17.2GB 单文件】
1. 在 VM 的 `/root` 目录下拉取 ComfyUI 并安装依赖：
   - `git clone https://github.com/comfyanonymous/ComfyUI.git`
   - `pip install -r /root/ComfyUI/requirements.txt`
2. 后台下载 Comfy-Org 官方免门禁的 FP8 单文件到 checkpoints 目录：
   - `nohup wget -c "https://huggingface.co/Comfy-Org/flux1-dev/resolve/main/flux1-dev-fp8.safetensors" -O /root/ComfyUI/models/checkpoints/flux1-dev-fp8.safetensors </dev/null >/root/dl.log 2>&1 &`
   - 轮询监控文件大小，确认达到约 17.2GB 并下载完毕。
3. 后台启动 ComfyUI 服务（注意：必须使用最新的 `--fast fp8_matrix_mult` 参数）：
   - `nohup python3 /root/ComfyUI/main.py --listen 127.0.0.1 --port 8188 --fast fp8_matrix_mult </dev/null >/root/comfy.log 2>&1 &`
   - 确认 8188 端口已正常监听。

【阶段三：API 调用与生成任务】
1. 编写一个 Python 脚本在 VM 本地运行，通过 HTTP API 向 `http://127.0.0.1:8188/prompt` 提交标准 FLUX 生图工作流：
   - 模型名：`flux1-dev-fp8.safetensors`
   - 提示词：A cinematic portrait of a cyberpunk girl in a rain-soaked neon street, intricate details, photorealistic, 8k
   - 参数：1024×1024 分辨率，20 步去噪，guidance_scale=3.5。
2. 脚本轮询 `/history` 接口等待出图，统计并打印生成阶段纯耗时（目标约 25~30 秒）。

【阶段四：图片回传与关机止损】
1. 出图后，把生成的图片通过本地命令拉取/下载到宿主机 `D:\flux-test\comfy_flux_girl.png`。
2. 确认图片完整落地后，自动执行 `colab stop comfy-run` 关机释放机器，避免空耗算力。
```

## 值得学的写法

- **坑前置成避坑指令**：Colab SSH 单连接排他（HTTP 429）这个坑不是留给自己再踩一遍，而是写成【关键避坑指令】——所有耗时命令必须 `nohup + </dev/null + 日志重定向`，AI 照抄就不会挂死连接（正是昨天实验里坑 5/6 的教训固化，两式共用）
- **阶段化 + 每阶段给验收标志**：机器通了看 SSH、模型下完核对 17.2GB、服务起了看端口监听、出图看 `/history`——每步都有可检查的完成定义，AI 没法含糊其辞地宣布「已完成」
- **命令给到可复制级**：ProxyCommand 完整写法、wget -c 落盘路径、`--fast fp8_matrix_mult` 参数值，全部写死。AI 的职责是执行和监控，不是发挥
- **两式的分野在「交付物 + 生命周期」**：
  - 交互版交付一条 trycloudflare.com 链接，「部署成功」= 浏览器打开能用；会话**保持常驻**，关机时机由人控制——适合要上手玩的场景
  - 无头版交付一张拉回本地的 png + 生成耗时数字；**确认图片落地后自动 stop**——把「跑完立即 stop」的省钱心法直接写进合同，AI 全程托管、零空耗
- **监听地址跟着暴露面走**：交互版 `--listen 0.0.0.0`（要给 cloudflared 转发留口子），无头版 `--listen 127.0.0.1`（只有本机脚本访问，不开公网）——不为了统一而统一
- **性能预算写进验收**：无头版直接给了「纯耗时目标约 25~30 秒」，这是昨天实测的 1.25 秒/步 × 20 步的数字——预算即回归测试，跑超了说明环境有问题
- **单文件 17.2GB 全家桶（模型+T5+VAE）+ 免门禁镜像 Comfy-Org**：对比实验里验证过的最快路径，提示词直接继承结论而不重新探索
