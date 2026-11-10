---
title: "AutoDL 部署总结：vLLM 弯路与 transformers 聊天页"
date: 2026-08-02
category: 技术
tags: [autodl, vllm, transformers, 日记归档]
draft: false
---

今天在 AutoDL GPU 服务器（westc:50262）上完成了：连接服务器并拉起 ComfyUI + Qwen3-TTS → 装 vLLM 加速 Qwen3-4B 推理（走了一段弯路）→ 评估后停掉 vLLM，改用 transformers 轻量聊天页挂在 6008，并与 TTS 做成可切换。本文档记录全过程、命令清单和踩坑经验，方便复盘。

---

## 一、服务器与连接

| 项 | 信息 |
|---|---|
| 连接 | `ssh -p 50262 root@connect.westc.seetacloud.com`（密码 `********`） |
| GPU | RTX 4080 SUPER（32 GB），驱动 595.71.05 |
| base python | `/root/miniconda3/bin/python` |
| 数据盘 | `/root/autodl-tmp`（持久，模型/数据放这，今天剩 ~4G） |
| 系统盘 | `/root/miniconda3/envs/`（conda env 放这） |

**两个本地 helper（已写死凭据）**：
- `C:\Users\yaya\.claude\tmp\autodl_ssh.py "<远程命令>"` —— paramiko 跑远程命令
- `C:\Users\yaya\.claude\tmp\autodl_upload_westc.py <本地> <远程>` —— base64-over-exec 上传小文件

> ⚠️ 在本机 Git Bash 调这俩 helper 时，远程路径 `/root/...` 会被 MSYS 转成 `C:/Program Files/Git/root/...`，**必须加 `MSYS_NO_PATHCONV=1`**（见第五节坑4）。

**AutoDL 端口限制**：自定义服务**只代理 6006 和 6008** 两个端口到公网。

---

## 二、最终状态（今天结束时的样子）

| 端口 | 服务 | 显存 |
|---|---|---|
| 6006 | ComfyUI（出图，未动） | ~7 G |
| **6008** | **Qwen3-4B 聊天页（当前默认）↔ TTS 可切换** | chat ~8 G / tts ~4.3 G |
| 8000 | vLLM（已停，env 保留备用） | — |

显存合计 ~15 G / 32 G，余量充足。

---

## 三、本次做了什么（时间线）

1. **连接 + 探查**：helper 连上，确认 GPU/磁盘/conda env；发现 6006/6008 当前无服务。
2. **拉起 ComfyUI + TTS**：用现成脚本 `~/cfy.sh`（6006）、`~/t.sh`（6008）后台启动，curl 确认 HTTP 200。坑：容器里 `ss` 看不到监听端口（不准），改用 `curl /proc/net/tcp` 验证。
3. **装 vLLM 加速推理（弯路）**：
   - 用户想"加速推理"，澄清 vLLM 只加速**文本 LLM**（对 ComfyUI/TTS 无效），选了 Qwen3-4B。
   - 新建独立 conda env `vllm`（隔离，不破坏 ComfyUI/TTS 的 `lora_train/env`），后台装 vLLM 0.26 + modelscope。
   - ModelScope 拉 Qwen3-4B（bf16，~8G，可微调）。
   - **踩坑**：vLLM 启动失败，flashinfer 采样算子 JIT 编译报 "CUDA versions below 12 not supported"。根因：系统 `/usr/local/cuda → cuda-11.8`，而 vLLM/torch 是 cu130。**解法：`export VLLM_USE_FLASHINFER_SAMPLER=0`** 关掉 flashinfer 采样器。
   - vLLM 跑通，33 tokens/0.46s（~71 tok/s）。
4. **评估：单人不划算**：vLLM 占 16G 显存（半是预占 KV cache），但其"10-20×加速"是**并发吞吐**优势，单人一次一条用不上；单 token 仅快 ~1.2-1.5×。显存要和 ComfyUI/TTS 抢。结论：停 vLLM，改 transformers。
5. **transformers 聊天页（6008）+ 切换器**：
   - 写 `chat.py`（Gradio ChatInterface + transformers 流式，复用 `lora_train/env`），只占 ~8G。
   - 踩坑：gradio 6.21 的 `ChatInterface` 和 `Chatbot` **都删了 `type=` 参数**，messages 已是默认。
   - 写切换脚本 `~/s chat|tts|status`，6008 同端口 Chat↔TTS 互切。
   - Gradio API 流式对话测试通过，双向切换验证通过。

---

## 四、关键命令清单

### 4.1 连接 & 探查
```bash
# 本机 → 远程跑命令
python C:/Users/yaya/.claude/tmp/autodl_ssh.py "<远程命令>"
python C:/Users/yaya/.claude/tmp/autodl_ssh.py                 # 默认探针(whoami/nvidia-smi/python/磁盘)

# 上传文件（务必加 MSYS_NO_PATHCONV=1）
MSYS_NO_PATHCONV=1 python C:/Users/yaya/.claude/tmp/autodl_upload_westc.py <本地> <远程>
```

### 4.2 ComfyUI(6006) + Qwen3-TTS(6008)
```bash
bash ~/cfy.sh          # 起 ComfyUI (6006)
bash ~/t.sh            # 起 TTS (6008)
~/c                    # ComfyUI 状态（~/c k 杀 / ~/c l 日志）
pkill -f app.py        # 停 TTS
tail -f ~/autodl-tmp/c.log ~/autodl-tmp/tts.log   # 看日志
```

### 4.3 vLLM（已停，备用）
```bash
# 环境与安装（独立 env）
conda create -n vllm python=3.10 -y
pip install vllm modelscope -i https://pypi.tuna.tsinghua.edu.cn/simple

# 下载模型
modelscope download --model Qwen/Qwen3-4B --local_dir /root/autodl-tmp/models/Qwen3-4B

# 启动（脚本 ~/serve_vllm.sh，关键：先关 flashinfer 采样器）
export VLLM_USE_FLASHINFER_SAMPLER=0
vllm serve /root/autodl-tmp/models/Qwen3-4B \
  --host 0.0.0.0 --port 8000 --served-model-name Qwen3-4B \
  --gpu-memory-utilization 0.5 --max-model-len 8192

# 测试（OpenAI 兼容）
curl http://127.0.0.1:8000/v1/models
curl http://127.0.0.1:8000/v1/chat/completions -H 'Content-Type: application/json' \
  -d '{"model":"Qwen3-4B","messages":[{"role":"user","content":"你好"}],"max_tokens":64,"chat_template_kwargs":{"enable_thinking":false}}'

# 停（注意自匹配，用括号正则）
pkill -f '[v]llm serve'
```
> 端口 8000 AutoDL 不代理，本地用 SSH 隧道：`ssh -L 8000:localhost:8000 -p 50262 root@connect.westc.seetacloud.com`

### 4.4 transformers 聊天页 + 切换（当前在用）
```bash
~/s chat       # 切到聊天页（停 TTS，起 chat，~15s 加载）
~/s tts        # 切到 TTS（停 chat，起 TTS）
~/s status     # 看 6008 当前服务
pkill -f chat.py              # 直接停聊天页
tail -f /root/autodl-tmp/chat.log     # 聊天页日志
```

---

## 五、踩坑经验（重点）

**坑1 — vLLM 单人用不划算**
vLLM 的 10-20× 是**并发吞吐**（PagedAttention+连续批处理），单人一次一条吃不到；单 token 仅快 ~1.2-1.5×。代价是显存翻倍（权重 8G + 预占 KV cache 7G ≈ 16G）。**单人/交互场景用 transformers 就够，vLLM 留给批量或 API 多用户**。

**坑2 — flashinfer 采样 JIT 失败（vLLM 启动报 CUDA<12）**
该 AutoDL 镜像系统级 `/usr/local/cuda → cuda-11.8`（老），但 vLLM/torch 是 cu130（pip 轮子）。flashinfer 采样算子 JIT 硬编码调 `/usr/local/cuda/bin/nvcc`，用 11.8 编译时 CCCL 报 `#error "CUDA versions below 12 are not supported"`。
**解法**：`vllm serve` 前 `export VLLM_USE_FLASHINFER_SAMPLER=0`（改原生 top-k/top-p 采样，单用户零性能损失）。不要去补 CUDA 工具链，费时费磁盘。

**坑3 — gradio 6.21 删了 `type=` 参数**
`gr.ChatInterface(type="messages")` 和 `gr.Chatbot(type="messages")` 都会报 `unexpected keyword argument 'type'`。6.21 里 messages 已是默认格式，直接去掉 `type=` 即可；为兼容起见，`respond` 函数里把 history 同时按 dict 和 `[user,bot]` tuple 两种格式做归一化。

**坑4 — Git Bash MSYS 路径转换**
本机 Git Bash 把传给 python.exe 的 `/root/...` 参数自动转成 `C:/Program Files/Git/root/...`，导致远程文件写到垃圾路径。**解法**：命令前加 `MSYS_NO_PATHCONV=1`；本地脚本/文件用 `C:/...` Windows 风格路径。

**坑5 — pkill/pgrep -f 自匹配**
`pkill -f 'vllm serve'` 会匹配到包含该字符串的**当前 shell 自身**并自杀，命令中途 abort；`pgrep -f 'chat.py'` 会匹配到检查命令本身 → 误判"还在跑"。
**解法**：用括号正则 `pkill -f '[v]llm serve'` / `pgrep -f 'cha[t].py'`（正则匹配目标，但字面串不含自身）。

**坑6 — autodl_ssh.py 的两个脾气**
① 后台 `setsid nohup ... &` 命令本地会 `exit 1` 误报（命令其实在远程跑了）；② 单命令硬超时 300s，长任务（装 vLLM、下模型）必须 `setsid` 后台 + 轮询日志。

**坑7 — `ss` 在该容器里看不到监听端口**
验证服务有没有起来别信 `ss -ltn`，用 `curl http://127.0.0.1:<port>/` 直接打。

---

## 六、文件清单

**远程（/root）**：
- `serve_vllm.sh` —— vLLM 启动脚本（含 `VLLM_USE_FLASHINFER_SAMPLER=0`）
- `chat.sh` —— 聊天页启动脚本
- `s` —— 6008 切换器（chat|tts|status）
- `cfy.sh` / `t.sh` / `c` —— ComfyUI/TTS 启动与管理（之前已有）
- `autodl-tmp/qwen3-chat/chat.py` —— transformers 聊天页主程序
- `autodl-tmp/models/Qwen3-4B/` —— Qwen3-4B bf16 权重（~8G，可微调）
- `autodl-tmp/qwen3-tts/app.py` —— Qwen3-TTS Gradio
- 日志：`autodl-tmp/{c,tts,chat,serve_vllm,install_vllm,dl_model}.log`

**本机**：
- `.claude/tmp/autodl_ssh.py`、`autodl_upload_westc.py` —— westc 连接/上传 helper
- `.claude/tmp/qwen3-chat/{chat.py,chat.sh,s,test_api.py}` —— 本地源稿

**conda env**：
- `lora_train/env` —— ComfyUI + TTS + 聊天页共用（gradio 6.21 / transformers 4.57.3 / torch 2.13+cu130）
- `vllm` —— vLLM 专用（vLLM 0.26 / torch 2.11+cu130 / transformers 5.14.1），隔离防冲突
- `notagen` —— NotaGen（之前已有）

---

## 七、后续可做

- 给聊天页加：清空按钮、上下文长度/系统提示词设置、对话导出
- Qwen3-4B 的 LoRA 微调（bf16 可微调；数据盘只剩 ~4G，LoRA adapter 几百 MB 够用，full 微调的 8G checkpoint 放不下，微调前可清 `output/`）
- 真要并发/API 场景再起 vLLM（`~/serve_vllm.sh`，注意会和 6008 服务抢显存）
