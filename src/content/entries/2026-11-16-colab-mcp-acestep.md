---
title: Colab Pro MCP 配置与 ACE-Step 1.5 唱歌模型测试
date: 2026-11-16
category: 技术
tags: [colab, mcp, AI音乐, gpu]
---

## 一、配置官方 Colab MCP (`googlecolab/colab-mcp`)

- 确认本机环境已就绪：`git 2.52.0`、`uv / uvx 0.12.5`、`Python 3.11.9`。
- 通过 `uvx git+https://github.com/googlecolab/colab-mcp` 预拉取并构建 `colab-mcp`。
- 将 `colab-mcp` 写入 Antigravity 全局 MCP 配置文件。
- 调用 `open_colab_browser_connection` 拉起系统默认浏览器，在浏览器弹出的本地网络/服务访问权限中点击**允许 (Allow)** 后成功连通，解锁了 `get_cells`、`add_code_cell`、`update_cell`、`run_code_cell` 等全部笔记本控制工具。

## 二、Colab Pro L4 GPU 部署与测试 ACE-Step 1.5

- **运行时环境**：Colab 切换为 **NVIDIA L4 GPU**（22.0 GB 可用显存，自动匹配 `tier6b` 档位，无需 CPU offload）。
- **环境隔离坑点与解决**：
  - `ACE-Step-1.5` 要求 `Python >=3.11,<3.13`，而 Colab 默认 Python 为 `3.13.16`。通过 `uv sync --python 3.12` 在 `/content/ACE-Step-1.5/.venv` 下快速建好 Python 3.12 + `torch==2.10.0+cu128` 隔离环境。
  - Colab 默认注入 `MPLBACKEND=module://matplotlib_inline.backend_inline`，会导致独立 `.venv` 中 `matplotlib` 报错；运行命令时加上 `MPLBACKEND=Agg` 即可解决。
- **推理测试**：
  - 先验证了中文版 Gradio Web UI（7860 端口）可正常启动并内嵌到 Colab 输出。
  - 随后改为更轻量的纯 Python 脚本调用 `acestep.inference.generate_music` 并用 `IPython.display.Audio` 直接在单元格输出播放器：
    - **测试 1（15 秒英文原声吉他流行女声）**：首次运行自动从 Hugging Face 下载 `ACE-Step/Ace-Step1.5` 模型权重并完成生成，全程约 **52 秒**。
    - **测试 2（20 秒中文流行抒情男声）**：权重已缓存，耗时 **23 秒**生成完毕。
- **收尾释放**：测试完成后在 Colab 中执行 `google.colab.runtime.unassign()` 主动断开并释放 L4 运行时，停止计费。

## 三、Colab Pro 计算单元与显卡成本备忘

- **套餐额度**：Colab Pro（$9.99/月）每月包含 **100 个计算单元**（折合约 ¥0.72/单元），绑定 Google 账号，新开对话或笔记本不会重置；用完后回退免费版限制，下个账单日自动刷新。
- **常见显卡显存与估算开销**：
  - **T4（15 GB）**：约 1.7–2.0 单元/小时（约 ¥1.2–1.5/小时），100 单元约 50 小时。
  - **L4（22.5 GB）**：低负载实测约 1.94 单元/小时，高负载约 4.5–5.0 单元/小时（约 ¥1.4–3.6/小时），性价比最高。
  - **A100（40 / 80 GB）**：约 13–15 单元/小时（约 ¥9.4–10.8/小时），100 单元约 6.5–7.5 小时。
  - **H100（80 GB）**：约 20+ 单元/小时（约 ¥14.4+/小时）。
- **省钱习惯**：实验结束务必断开连接并删除运行时，避免空挂扣费。

## 四、音乐大模型现状调研

- **闭源商业第一梯队**：**Suno**、**Udio**。Suno 为完全闭源商业模型（架构推测为 LLM/Transformer + 神经音频编解码器 + 解码器，参数量未公开，业界估算在数十亿到数百亿级）。
- **开源第一梯队**：**ACE-Step 1.5**（MIT 开源、推理速度极快）和 **YuE / YuE2**（7B 主干，长歌词对齐与乐感出色）。
