---
title: "飞影角色 LoRA 微调项目总结（求职项目）"
date: 2026-07-28
category: 技术
tags: [lora, kohya, autodl, 求职, 日记归档]
draft: false
---

> **SDXL 角色 LoRA 微调全流程实践 · 求职项目**
> 底模 Animagine XL 3.1 ｜ 训练框架 kohya-ss/sd-scripts ｜ 推理框架 diffusers
> 硬件 AutoDL · NVIDIA RTX 4080 SUPER 32GB ｜ 日期 2026-07-28
> 配套脚本本地:`C:\Users\yaya\feiying_lora\scripts\` ｜ 服务器:`/root/autodl-tmp/lora_train/`

---

## 一、项目概述

### 目标
仅用 **15 张**角色立绘,在 Stable Diffusion XL 上微调出一个 **228 MB** 的 LoRA 权重,使模型能在**任意 prompt** 下生成保持该角色固定外貌(发色、瞳色、服饰、脸型)的图像,且权重可即插即用、多角色可叠加。

### 为什么选 LoRA(而不是全量微调)
全量微调 SDXL(约 6.5B 参数)要更新所有权重,显存动辄 40G+、单卡不可行;**LoRA 只在注意力层旁挂一个低秩增量**,可训参数不到 1%,一张 24–32G 消费卡即可完成,且:
- 权重文件小(228MB)、易分发
- 推理时即插即用,不修改底模
- 多个角色 LoRA 可叠加 / 切换强度

### 成果(实测)
| 指标 | 数值 |
|---|---|
| 总训练步数 | **570 步**(15 图 × 10 repeats × 15 epoch) |
| 单步耗时 | **~4.35 s/it**(稳态) |
| 总耗时 | **~40 分钟**(含加载/存盘) |
| 显存占用 | **9.3 GB / 32 GB**(bf16 + grad checkpointing + AdamW8bit) |
| GPU 利用率 | ~83% |
| 产出 | 每 epoch 一个 checkpoint(228MB),**滚动保留最近 4 个**(epoch 12–15) |
| loss 走势 | 开局 ~0.095 → 中段 0.10–0.11(cosine restart 正常波动)→ 收敛,**无 NaN** |

> 最终 epoch 选优见[第八节](#八训练结果与-epoch-选优)。

---

## 二、技术栈

| 层 | 组件 | 版本 | 作用 |
|---|---|---|---|
| **底座模型** | Stable Diffusion XL (SDXL) | 1.0 | 1024 分辨率扩散模型 = UNet + 双 CLIP 文本编码器 + VAE |
| **风格底模** | Animagine XL 3.1 | 3.1 | 动画风 SDXL 社区微调,角色 LoRA 常用基底(比裸 SDXL 更适合二次元角色) |
| **微调方法** | LoRA (Low-Rank Adaptation) | — | 低秩适配,参数高效微调 |
| **训练框架** | kohya-ss / sd-scripts | latest | SD 社区主流训练实现,入口 `sdxl_train_network.py` |
| **推理框架** | 🤗 diffusers | 0.32.1 | `StableDiffusionXLPipeline` + `load_lora_weights` |
| **深度学习框架** | PyTorch | 2.13.0+**cu130** | CUDA 13 原生(匹配服务器驱动 595 / CUDA 13.2) |
| **分布式启动器** | accelerate | 1.6.0 | 管理混合精度 / 进程配置(预写 yaml 免交互向导) |
| **显存优化** | bitsandbytes | 0.50.0 | 提供 AdamW8bit 8bit 优化器,省优化器状态显存 |
| **LoRA 推理后端** | peft | 0.19.1 | diffusers 加载 LoRA 的底层依赖 |
| **文本编码器** | transformers | **4.54.1**(锁 <5) | CLIP 文本编码;5.x 会重命名模块导致 TE LoRA 注入失败 |
| **GPU 平台** | AutoDL | RTX 4080 SUPER 32GB | 按量租用,数据盘 `/root/autodl-tmp` 持久 |

**本地工具链**:Windows 11 + Git Bash + Python 3.11 + paramiko(SSH/SFTP 自动化)

---

## 三、LoRA 原理速览(面试可讲)

**全量微调**:对每个权重矩阵 `W ∈ ℝ^(d×k)`,学一个完整更新 `ΔW`,参数量 `d×k`。

**LoRA**:假设 `ΔW` 是**低秩**的,分解为 `ΔW = B·A`,其中 `B ∈ ℝ^(d×r)`、`A ∈ ℝ^(r×k)`、秩 `r ≪ min(d,k)`。

```
          ┌─────────── W (冻结) ───────────┐
   x ───▶ │                               │ ───▶ W·x
          └───────────────────────────────┘
                        │  +
          ┌─── A (r×k, 可训) ──┐  ← 初始 0,保证开始时 ΔW=0
          │                    │
          └─── B (d×r, 可训) ──┘       增量 = (α/r)·B·A·x
```

- 原参数量 `d×k` → LoRA 仅 `2·d·r`(`r=32` 时省两个数量级)
- 推理时 `W' = W + (α/r)·B·A`,`α/r` 即 **scale**
- 本项目 `dim = r = 32`、`alpha = α = 16` → 内置 `scale = α/r = 0.5`
- 注入位置:UNet 与两个 CLIP 文本编码器的所有 attention 的 Q/K/V/Output 投影
- **双训 UNet + TE**:文本编码器也训(用更小 lr),让模型同时学会"理解触发词"和"画出特征"

---

## 四、完整流程

```
┌─ 本地 Windows ─────────────┐        ┌─ AutoDL GPU 服务器 ────────────┐
│  立绘 15 张 + caption 15 个 │  SFTP  │  /root/autodl-tmp/lora_train/  │
│  脚本 (config/run/setup)    │ ─────▶ │   dataset/img/feiying/         │
│  upload.py (paramiko)       │        │   scripts/                     │
└─────────────────────────────┘        └────────────┬───────────────────┘
                                                    │ setsid 后台启动
                                                    ▼
                          ┌─ 训练 sdxl_train_network.py ──────────────┐
                          │  Animagine XL 3.1 (底模,冻结)             │
                          │   + LoRA(dim32/alpha16, 可训)             │
                          │  570 步 / 15 epoch / ~40min               │
                          └────────────┬─────────────────────────────┘
                                       │ output/feiying-v1-0000XX.safetensors
                                       ▼
                          ┌─ 推理选优 infer_feiying.py ───────────────┐
                          │  4 个 epoch × 4 场景 × 同 seed 拼网格      │
                          │  → 肉眼挑还原度最优的 epoch               │
                          └───────────────────────────────────────────┘
```

**五步**:
1. **环境搭建** — venv 建数据盘 → torch(cu130) → kohya sd-scripts + 依赖 → accelerate 预配置
2. **数据准备** — 15 张立绘 + 每张一个 `.txt` caption(触发词 `feiying_char` 在首位)
3. **上传** — paramiko SFTP 上传数据集 + 脚本
4. **训练** — `setsid nohup` 后台跑 `accelerate launch`,脱离 SSH 会话
5. **推理选优** — 同 prompt 同 seed 控变量,对 4 个 epoch 出图拼网格挑最优

---

## 五、核心代码

### 5.1 训练主配置 `config.toml`

```toml
# feiying LoRA 训练配置 (对齐 agelaiya 验证配方, 15图×10repeats×15epoch = 570步)
pretrained_model_name_or_path = "/root/autodl-tmp/models/animagine-xl-3.1"  # diffusers 目录版
output_dir  = "/root/autodl-tmp/lora_train/output"
output_name = "feiying-v1"

# --- LoRA ---
network_module = "networks.lora"
network_dim    = 32
network_alpha  = 16                      # scale = alpha/dim = 0.5; 出图强度 1.0 即等效 0.5

# --- 优化器 / LR ---
optimizer_type       = "AdamW8bit"       # 依赖 bitsandbytes
unet_lr              = 1e-4
text_encoder_lr      = 5e-5              # UNet+TE 双训, TE 用更小 lr
lr_scheduler         = "cosine_with_restarts"
lr_scheduler_num_cycles = 3
lr_warmup_ratio      = 0.05

# --- 训练量 ---
max_train_epochs            = 15
train_batch_size            = 1
gradient_accumulation_steps = 4          # 有效 batch 4
train_text_encoder          = true       # 训练 TE(双 TE)

# --- 精度 / 显存 ---
mixed_precision        = "bf16"
full_bf16              = true
gradient_checkpointing = true            # 用时间换显存(单步偏慢的主因)
cache_latents          = true            # VAE 冻结, 缓存 latent
sdpa                   = true            # PyTorch 原生 SDPA, 免 xformers

# --- 质量三件套 + clip_skip ---
noise_offset              = 0.05         # 改善亮度/对比学习
min_snr_gamma             = 5            # 稳定不同噪声步的梯度
multires_noise_iterations = 6            # 多尺度噪声加细节
multires_noise_discount   = 0.3
clip_skip                 = 2            # Animagine / NAI 系标配

# --- 保存 (滚动留最近 4 个 epoch) ---
save_every_n_epochs = 1
save_last_n_epochs  = 4
save_model_as       = "safetensors"

# --- 杂项 ---
seed = 42
persistent_data_loader_workers = true
max_data_loader_n_workers      = 8
```

### 5.2 数据集配置 `dataset.toml`

```toml
[general]
resolution        = 1024
shuffle_caption   = true              # caption 乱序增强泛化
keep_tokens       = 1                 # 锁定前 1 个 token(触发词 feiying_char)不参与乱序
enable_bucket     = true              # 桶分桶,不裁图
min_bucket_reso   = 768
max_bucket_reso   = 1280
bucket_no_upscale = true
caption_extension = ".txt"

[[datasets]]
resolution  = 1024
batch_size  = 1
num_repeats = 10                      # 每张图每 epoch 过 10 次

  [[datasets.subsets]]
  image_dir   = "/root/autodl-tmp/lora_train/dataset/img/feiying"
  num_repeats = 10
```

**步数算法**(换数据集照此调):
```
每 epoch 图数   = 图数 × num_repeats                      = 15 × 10 = 150
每 epoch 优化步 = ceil(每 epoch 图数 / (batch × grad_accum)) = ceil(150/4) = 38
总优化步        = 每 epoch 优化步 × epochs                 = 38 × 15 = 570
每张图被训练次数 = num_repeats × epochs = 10 × 15 = 150      (经验甜点 100–200)
```

### 5.3 训练启动脚本 `run_train.sh`

```bash
#!/bin/bash
set -euo pipefail
export PATH=/root/miniconda3/bin:$PATH
export HF_ENDPOINT=https://hf-mirror.com        # AutoDL 连不上 huggingface.co
export PYTHONUNBUFFERED=1                        # 实时 tail 日志(否则块缓冲)
source /root/autodl-tmp/lora_train/env/bin/activate
cd /root/autodl-tmp/lora_train/sd-scripts

accelerate launch --num_cpu_threads_per_process 8 \
  sdxl_train_network.py \
  --config_file /root/autodl-tmp/lora_train/scripts/config.toml \
  --dataset_config /root/autodl-tmp/lora_train/scripts/dataset.toml
```

### 5.4 环境搭建脚本 `setup_env.sh`(幂等,可重复运行)

```bash
#!/bin/bash
set -euo pipefail
export PATH=/root/miniconda3/bin:$PATH
source /etc/network_turbo 2>/dev/null || true   # AutoDL 学术加速 (github/pypi)
BASE=/root/autodl-tmp/lora_train

# [1/5] venv 建数据盘(系统盘小、换机会丢)
[ ! -d "$BASE/env" ] && python -m venv "$BASE/env"
source "$BASE/env/bin/activate"
pip install -U pip

# [2/5] torch (pypi 默认即 cu130, 原生匹配 CUDA 13.2 驱动)
pip install torch torchvision torchaudio
python -c "import torch; assert torch.cuda.is_available()" 2>/dev/null || \
  pip install --force-reinstall --index-url https://download.pytorch.org/whl/cu126 \
    torch torchvision torchaudio

# [3/5] kohya sd-scripts + 依赖 (requirements.txt 含 transformers 4.54.1 / diffusers 0.32.1)
[ ! -d "$BASE/sd-scripts/.git" ] && git clone https://github.com/kohya-ss/sd-scripts.git "$BASE/sd-scripts"
cd "$BASE/sd-scripts"
pip install -r requirements.txt

# [4/5] peft (diffusers 推理加载 LoRA 要; kohya 训练本身不用)
pip install peft

# [5/5] accelerate 非交互配置 (避免首次运行进交互向导演死)
mkdir -p ~/.cache/huggingface/accelerate
cat > ~/.cache/huggingface/accelerate/default_config.yaml <<'EOF'
compute_environment: LOCAL_MACHINE
distributed_type: 'NO'
mixed_precision: bf16
num_machines: 1
num_processes: 1
gpu_ids: all
use_cpu: false
EOF
```

### 5.5 推理 + 选优脚本 `infer_feiying.py`

```python
#!/usr/bin/env python
# 对最近 4 个 epoch 各出同 prompt 同 seed 图, 拼网格挑最优
import os
os.environ.setdefault("HF_ENDPOINT", "https://hf-mirror.com")
import glob, torch, argparse
from diffusers import StableDiffusionXLPipeline

BASE      = "/root/autodl-tmp/models/animagine-xl-3.1"
CKPT_GLOB = "/root/autodl-tmp/lora_train/output/feiying-v1-[0-9]*.safetensors"
OUT       = "/root/autodl-tmp/lora_train/output/compare"
SEED      = 42

PROMPTS = [
    "feiying_char, 1girl, solo, portrait, front view, bright room, masterpiece, best quality",
    "feiying_char, 1girl, solo, full body, side view, walking pose, studio background",
    "feiying_char, 1girl, solo, close-up, wink, cheerful expression, clubroom background",
    "feiying_char, 1girl, solo, waist-up, hand on hip, serious expression, outdoor",
]
NEG = "lowres, bad anatomy, bad hands, extra limbs, changed hair color, watermark, text"

def grid(imgs, cols=2):
    from PIL import Image
    w, h = imgs[0].size
    rows = (len(imgs) + cols - 1) // cols
    g = Image.new("RGB", (w * cols, h * rows))
    for i, im in enumerate(imgs):
        g.paste(im, ((i % cols) * w, (i // cols) * h))
    return g

def main(scale):
    os.makedirs(OUT, exist_ok=True)
    pipe = StableDiffusionXLPipeline.from_pretrained(BASE, torch_dtype=torch.bfloat16).to("cuda")
    # 按 epoch 数字升序: feiying-v1-000012.safetensors -> 12
    ckpts = sorted(glob.glob(CKPT_GLOB),
                   key=lambda p: int(os.path.basename(p).rsplit("-", 1)[-1].split(".")[0]))
    for ckpt in ckpts:
        name = os.path.splitext(os.path.basename(ckpt))[0]
        pipe.load_lora_weights(ckpt)                       # 替换 adapter, 无需 fuse
        imgs = []
        for p in PROMPTS:
            g = torch.Generator("cuda").manual_seed(SEED)  # 控变量: 同 seed
            im = pipe(p, negative_prompt=NEG, num_inference_steps=28,
                      guidance_scale=5.0, height=1024, width=1024, generator=g,
                      cross_attention_kwargs={"scale": scale}).images[0]
            imgs.append(im)
        grid(imgs).save(f"{OUT}/{name}_s{scale}.png")
    print("DONE ->", OUT)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    # scale=1.0 → diffusers 默认 adapter scale 0.5(alpha/dim) × 1.0 = 训练等效强度
    # 想要更强 (1.0×delta) 传 --scale 2.0
    ap.add_argument("--scale", type=float, default=1.0)
    main(ap.parse_args().scale)
```

### 5.6 本地→服务器上传脚本 `upload.py`(paramiko SFTP)

```python
#!/usr/bin/env python
# 用法: AUTODL_PASS='******' python upload.py
import os, posixpath, paramiko

HOST = os.environ.get("AUTODL_HOST", "connect.westc.seetacloud.com")
PORT = int(os.environ.get("AUTODL_PORT", "5xxxx"))
USER = os.environ.get("AUTODL_USER", "root")
PASS = os.environ["AUTODL_PASS"]

PAIRS = [
    (r"C:\Users\yaya\Pictures\lora_feiying_dataset\train",
     "/root/autodl-tmp/lora_train/dataset/img/feiying"),
    (r"C:\Users\yaya\feiying_lora\scripts",
     "/root/autodl-tmp/lora_train/scripts"),
]

def mkdir_p(sftp, path):           # SFTP 没有 mkdir -p, 手写递归建目录
    cur = ""
    for part in path.strip("/").split("/"):
        cur = cur + "/" + part
        try: sftp.stat(cur)
        except FileNotFoundError: sftp.mkdir(cur)

def put_dir(sftp, local, remote):
    mkdir_p(sftp, remote)
    for f in sorted(os.listdir(local)):
        lp = os.path.join(local, f)
        if os.path.isfile(lp):
            sftp.put(lp, posixpath.join(remote, f))

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30,
            allow_agent=False, look_for_keys=False)
sftp = ssh.open_sftp()
for local, remote in PAIRS:
    put_dir(sftp, local, remote)
sftp.close(); ssh.close()
```

---

## 六、Linux 命令速查(本项目实际用到)

### 6.1 远程执行 / 文件传输
```bash
# paramiko 单条命令执行 (exec timeout 180s, 长任务必须后台化)
AUTODL_HOST=connect.westc.seetacloud.com AUTODL_PORT=5xxxx \
  AUTODL_PASS='********' python autodl_ssh.py "nvidia-smi"

# SFTP 上传整个目录
AUTODL_PASS='********' python upload.py

# 服务器内下载大模型 (hf-mirror, 断点续传, 绕开 Xet 协议挂死)
wget -c --tries=10 --timeout=30 -O animagine-xl-3.1.safetensors \
  'https://hf-mirror.com/cagliostrolab/animagine-xl-3.1/resolve/main/animagine-xl-3.1.safetensors'
```

### 6.2 环境管理
```bash
export PATH=/root/miniconda3/bin:$PATH          # python 不在默认 PATH
python -m venv /root/autodl-tmp/lora_train/env  # venv 必须建在数据盘
source /root/autodl-tmp/lora_train/env/bin/activate
pip install -r requirements.txt
python -c "import torch; print(torch.__version__, torch.cuda.is_available())"
```

### 6.3 长任务后台化(关键:脱离 SSH 会话)
```bash
# setsid 让进程脱离 SSH 的 process group, 本地会话断了也不影响远程训练
cd /root/autodl-tmp/lora_train/scripts && \
  setsid nohup bash run_train.sh \
  > /root/autodl-tmp/lora_train/logs/train.log 2>&1 </dev/null & disown
```

### 6.4 训练监控(日志 + 进程 + GPU)
```bash
# 实时看进度 (tr 把 \r 转成 \n, 让 tqdm 进度条一行行铺开)
tail -f /root/autodl-tmp/lora_train/logs/train.log | tr '\r' '\n'

# 精确 grep 错误 (别用裸 'error', 会误报良性字样)
grep -E 'Traceback|CUDA out of memory|RuntimeError|AssertionError|loss is nan' train.log

# 看进程 + GPU
ps aux | grep sdxl_train_network | grep -v grep
nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total --format=csv,noheader

# 看已存 checkpoint
ls -lt /root/autodl-tmp/lora_train/output/

# 日志新鲜度校验 (防读到上一轮残留报错)
stat -c %Y train.log    # 对比 date +%s, age 太大 = 旧日志
```

### 6.5 进程管理(避坑)
```bash
# 按端口杀 (不要 pkill -f 'http.server 6008', 会误杀当前 shell)
fuser -k 6008/tcp

# 或字符类 trick
pkill -f '[h]ttp.server 6008'
```

---

## 七、踩坑与解决

### 7.1 网络类(AutoDL 容器特有)
| 坑 | 现象 | 解决 |
|---|---|---|
| huggingface.co / civitai 直连拒连 | 不是慢,是连不上 | 一律走 **hf-mirror.com**,`export HF_ENDPOINT=https://hf-mirror.com`(**必须 import diffusers/transformers 前设**) |
| `huggingface_hub` 静默挂死 | 进程活着、CPU 0%、缓存 0 字节、无报错 | 新版对 `xetHash` 走 Xet 协议,hf-mirror 不支持。**大文件一律 `wget` resolve URL** |
| AutoDL 学术加速 | github/pypi 慢 | `source /etc/network_turbo` |

### 7.2 环境类
| 坑 | 解决 |
|---|---|
| `python` not in PATH | 全路径 `/root/miniconda3/bin/python` 或 `export PATH` |
| venv 建系统盘换机会丢 | 必须建 `/root/autodl-tmp`(数据盘,持久) |
| accelerate 首次进交互向导卡死 | 预写 `~/.cache/huggingface/accelerate/default_config.yaml` |
| **transformers 5.x** 重命名 CLIPTextModel 模块 | **锁 `<5`**(本项目 4.54.1),否则 TE LoRA 注入报 `Target modules not found` → 触发词失效 |
| 推理缺 peft | kohya 训练 venv 不带 peft,`load_lora_weights` 需要 → `pip install peft` |
| **torch 要匹配驱动 CUDA 版本** | 服务器 CUDA 13.2 → pypi 默认 torch 即 cu130 原生,无需手动选 index |

### 7.3 训练 / 监控类
| 坑 | 解决 |
|---|---|
| **长任务被 SSH 断连带杀** | `setsid nohup ... </dev/null & disown` 脱离 process group(本次本地会话断过,远程毫发无伤) |
| tail 看不到实时进度 | `export PYTHONUNBUFFERED=1`(默认块缓冲) |
| grep 误报 ERROR | 用精确模式 `Traceback\|CUDA out of memory\|...` |
| ~4.35s/step 看着慢 | `gradient_checkpointing + grad_accum=4` 的代价,非卡住 |
| 轮询读到旧日志假报错 | 重跑前 `rm -f log` + 日志新鲜度校验 `stat -c %Y` |
| **kohya repo 改版** | 旧路径 `requirements/sdxl.txt` 已不存在,改用根目录 `requirements.txt` |

### 7.4 本项目相对上次的新增经验
1. **diffusers 目录版底模也可用** — kohya `--pretrained_model_name_or_path` 接单文件 `.safetensors` 或 diffusers 目录都行,本次用目录版(6 个组件:`text_encoder`/`text_encoder_2`/`unet`/`vae`/`tokenizer`×2),dry-run 确认 `Loading pipeline components 6/6` → `U-Net converted` → `Enable SDPA`,正常加载。
2. **本服务器 SFTP 可用** — 与旧服务器(connect.nmb1,只透传 SSH exec 不透传 SFTP)不同,connect.westc 的 SFTP 正常,可直接 `paramiko open_sftp().put()` 传文件,不再需要 base64-over-exec。
3. **CUDA 13.2 + torch 2.13 cu130 原生** — 不必走 cu124/cu126 fallback,pypi 默认 torch 即原生匹配。

---

## 八、训练结果与 epoch 选优

两角均已训练完成(2026-07-28,connect.westc / RTX 4080 SUPER 32G),实测:

| 角色 | 总步 | 耗时 | 单步 | 最终 avr_loss | 显存 | 产物(均 218M) |
|---|---|---|---|---|---|---|
| **feiying** | 570 | 41:05 | 4.33 s/it | **0.0948** | 9.3G/32G | ep11/12/13/14 + final |
| **ruanmei** | 570 | 40:42 | 4.28 s/it | **0.0874** | 9.3G/32G | ep11/12/13/14 + final |

两角 loss 均收敛至 ~0.09 量级(与历史 agelaiya ~0.095 一致),全程无 NaN/OOM;显存仅 9.3G,32G 卡极为宽松。产物通过 **6006 端口**(AutoDL「自定义服务」)下载。

> **本次按用户偏好直接使用权重,未跑对比网格选优。** 若需挑最优 epoch,用 `infer_feiying.py` 对 ep11–14 出同 seed(42)网格对比,选优结论见下方历史经验。

### epoch 选优方法(控变量法)
对最近 4 个 checkpoint,用**相同的 4 条 prompt + 相同 seed(42)** 各出一张图,拼成 2×2 网格。逐 epoch 对比:
- 触发词还原度(发色/瞳色/服饰是否对)
- 细节锐度
- 场景泛化(换个背景/姿势是否还像)
- 过拟合迹象(是否死板复现训练集道具)

**历史经验**(haiseyin/agelaiya 同配方):ep11 偏软 → ep12 过渡 → **ep14 甜点(特征锐利、脸自然、泛化好)** → ep15 与 ep14 接近但略有末段过拟合。

---

## 九、可复现性 & 迁移

### 换角色(迁移到新人物)
只需改 3 处,其余超参不动:
1. 数据集图片 + caption(每张 caption 首位换成新触发词,如 `tingyun_char`)
2. `dataset.toml` 的 `image_dir` 路径
3. `config.toml` 的 `output_name`

### 换数据集规模的调整
| 数据集 | 调法 |
|---|---|
| 图更少(5–8 张) | repeats 提到 15–20 或 epochs 提到 20,保持过图次数 ≈ 150 |
| 图更多(30+) | repeats 降到 3–5,避免步数爆炸 + 过拟合 |
| 显存爆 | 降 `max_bucket_reso` 到 1024,确认 `gradient_checkpointing=true` |
| 想快点看效果 | epochs 先减半出图看,欠拟合再加 |

### 一键复现顺序
```bash
# 1. 本地: 改 dataset 路径 + output_name + 触发词, 上传
AUTODL_PASS='********' python upload.py
# 2. 服务器: 建环境(幂等)
setsid nohup bash /root/autodl-tmp/lora_train/scripts/setup_env.sh > setup.log 2>&1 &
# 3. 服务器: 开训
setsid nohup bash /root/autodl-tmp/lora_train/scripts/run_train.sh > train.log 2>&1 &
# 4. 服务器: 推理出网格
python /root/autodl-tmp/lora_train/scripts/infer_feiying.py --scale 1.0
```

---

## 附:关键路径速查

```
/root/autodl-tmp/lora_train/
├── env/                          # venv (python / accelerate 全在这)
├── sd-scripts/                   # kohya 源码
├── dataset/img/feiying/          # 15 png + 15 txt caption
├── scripts/
│   ├── setup_env.sh              # 幂等环境搭建
│   ├── config.toml               # 训练主配置
│   ├── dataset.toml              # 数据集配置
│   ├── run_train.sh              # 训练启动
│   └── infer_feiying.py          # 推理 + 选优网格
├── logs/train.log                # 训练日志
└── output/                       # feiying-v1-0000XX.safetensors (滚动留最近 4)
      └── compare/                # epoch 对比网格 png

/root/autodl-tmp/models/animagine-xl-3.1/   # 底模 (diffusers 目录版)
```

---

*本项目完整复现了经过验证的 SDXL 角色 LoRA 配方(曾成功训练 haiseyin、agelaiya 等多个角色),并在新服务器上验证了 diffusers 目录版底模、CUDA 13 / torch 2.13 原生栈的兼容性。*
