---
title: "AutoDL 角色 LoRA 训练踩坑记录（kohya SDXL 配方）"
date: 2026-07-26
category: 技术
tags: [lora, kohya, autodl, 踩坑, 日记归档]
draft: false
---

> 项目：SDXL 角色 LoRA（`char_v1` / 触发词 `haiseyin`，13 图 × 10 repeats × 15 epochs = 495 步）
> 环境：AutoDL RTX 4090 24GB 单卡 · kohya sd-scripts · 基底 Animagine XL 3.1
> 日期：2026-07-26
> 配套脚本在服务器 `/root/autodl-tmp/lora_train/scripts/`

---

## 一、网络坑（重灾区）

### 1. huggingface.co / civitai.com 直连不通
AutoDL 容器里这两个域名**直接拒连**（不是慢，是连不上）。能用的是：

| 站点 | 状态 | 用途 |
|---|---|---|
| huggingface.co | ❌ 不通 | — |
| civitai.com | ❌ 不通 | — |
| **hf-mirror.com** | ✅ 通 | HF 镜像，下模型/tokenizer |
| **modelscope.cn** | ✅ 通 | 魔搭，`modelscope.hub.snapshot_download` |
| pypi.org / download.pytorch.org | ✅ 通（AutoDL 有学术加速） | 装包、torch wheel |

**通用解法**：所有用到 huggingface_hub / diffusers / transformers 联网的脚本，**在 import 之前**设：

```python
import os
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"   # 必须在 import diffusers/transformers 之前！
```

shell 里同理：

```bash
export HF_ENDPOINT=https://hf-mirror.com
```

`run_train.sh` 里就留了这句和注释：「AutoDL 连 huggingface.co 会被拒绝；训练时要去拉 tokenizer」。忘了设的表现是训练启动时卡死在网络重试上。

### 2. hf-mirror 上 huggingface_hub 会"静默挂死"（最阴的坑）
新版 `huggingface_hub` 对带 `xetHash` 的文件走 **Xet 协议**，hf-mirror 不支持 →
进程看着活着、CPU 0%、缓存 0 字节、日志一片空白，**没有任何报错**。`huggingface-cli` 也已经废弃，同样不可靠。

**结论：大文件一律 wget resolve URL**：

```bash
wget -c --tries=10 --timeout=30 -O animagine-xl-3.1.safetensors \
  'https://hf-mirror.com/cagliostrolab/animagine-xl-3.1/resolve/main/animagine-xl-3.1.safetensors'
```

实测 13~17 MB/s，`-c` 断点续传。本次 6.9G 的 Animagine 底模就是这么下来的。
（`hf_download.py` 里留了 `hf_hub_download` 写法作参考，但实际不可靠，别依赖。）

### 3. WD14 打标签器的 onnx 模型也走 HF → 同样挂死
`finetune/tag_images_by_wd14_tagger.py` 首次运行会自动从 HF 下 onnx 模型，
即使设了 HF_ENDPOINT 也会撞 Xet 坑。**解法**：先手动 wget 把 onnx 模型下下来，
然后用 `--onnx_path` 指定本地路径（见 `run_tag.sh` 头部注释）。

### 4. tokenizer 的 chat template 问题
`run_train.sh` 注释记录：拉 tokenizer 时新版 transformers 会校验 chat_template，
SDXL 的 CLIP tokenizer 相关文件在镜像上可能不全/格式不合，需要处理掉 chat template
才能正常加载。现象是模型加载阶段报错或卡住，不是训练本身的问题。

### 5. 大文件别从本地上传
AutoDL 的 connect 代理**只透传 SSH exec，不透传 SFTP**——`paramiko.open_sftp().put()` 会报
`FileNotFoundError`。原则：

- 模型/大文件 → **服务器内直接下载**（wget hf-mirror / ModelScope）
- 小文件（脚本、配置）→ base64 走 exec 通道：
  `printf '%s' '<base64>' | base64 -d > '<远程路径>'`

---

## 二、环境坑

### 1. `python` 不在 PATH
容器里 Python 在 `/root/miniconda3/bin/python`（conda base，3.10）。
非交互 shell（脚本、远程命令）里直接敲 `python` 会 not found。
**所有脚本一律用全路径**，或开头 `export PATH=/root/miniconda3/bin:$PATH`。

### 2. venv 必须建在 autodl-tmp 上
`/root` 是系统盘（小，且实例重装/换机会丢），`/root/autodl-tmp` 是数据盘（大、持久）。
本次 venv 建在 `/root/autodl-tmp/lora_train/env`，关机再开机环境还在，不用重装。
同理：**模型权重、数据集、输出全放 autodl-tmp**。

### 3. accelerate 首次运行会进交互向导
`accelerate launch` 第一次跑会弹出分布式配置的交互式提问，在 nohup/远程场景直接卡死。
**解法**（已做进 `setup_env.sh`）：预先写好 `~/.cache/huggingface/accelerate/default_config.yaml`：

```yaml
compute_environment: LOCAL_MACHINE
distributed_type: 'NO'
mixed_precision: bf16
num_machines: 1
num_processes: 1
gpu_ids: all
use_cpu: false
```

### 4. torch wheel 要按驱动 CUDA 版本选
`setup_env.sh` 里自动探测 `nvidia-smi` 的 CUDA Version 映射 index：
12.4+ → `cu124`，12.1~12.3 → `cu121`，11.x → `cu118`，从
`https://download.pytorch.org/whl/<IDX>` 装。装错 index 的表现是 `torch.cuda.is_available() = False`。

### 5. AdamW8bit 依赖 bitsandbytes
config 里 `optimizer_type = "AdamW8bit"` 需要 bitsandbytes 已装好，否则 ImportError。
装 kohya requirements 时一般已带上，跑之前 `pip show bitsandbytes` 确认一下。

### 6. 无卡模式（开机做文件整理时）有 2GB 内存墙
无 GPU 实例的容器 cgroup 内存上限只有 **2GB**。加载/转换大模型到 UNet 那一刻
会被 **SIGKILL**——**没有 Python traceback，faulthandler 也抓不到**，进程瞬间消失。
诊断：`cat /sys/fs/cgroup/memory.events` 看 `max` 计数。
解法：`from_single_file(..., low_cpu_mem_usage=True, torch_dtype=torch.float16)`，
峰值从 ~4G 降到 ~700MB。**无卡模式只适合下模型/装包/转格式，别跑 pipeline。**

---

## 三、训练 & 监控坑

### 1. 长任务必须 setsid 脱离 SSH 会话（本次验证，救命的一条）
`nohup ... &` + `disown` 在 paramiko/SSH wrapper 里**仍可能被连带杀掉**，
必须 `setsid` 让进程脱离 SSH 的 process group：

```bash
cd /root/autodl-tmp/lora_train/scripts && \
setsid nohup bash run_train.sh > /root/autodl-tmp/lora_train/logs/train.log 2>&1 </dev/null & disown
```

**本次实战验证**：训练跑到一半，本地 Claude 会话撞了 API 429 限额直接断掉，
监控全停——但远程训练**毫发无伤继续跑**，重连后 step 正常推进。长任务与本地会话解耦是底线。

### 2. 日志要加 PYTHONUNBUFFERED=1
Python 输出重定向到文件时默认按块缓冲，`tail -f` 看不到实时进度。
`run_train.sh` 里已 `export PYTHONUNBUFFERED=1`。

### 3. grep 监控日志会误报"ERROR"
第一版监控脚本 `grep -iE 'error|...'` 把日志里某处良性 "error" 字样匹配了，
虚惊一场。**精确模式**才可靠：

```bash
grep -E 'Traceback|CUDA out of memory|RuntimeError|AssertionError|loss is nan' train.log
```

### 4. ~4.1s/step 不是异常
`gradient_checkpointing = true`（省显存）+ `gradient_accumulation_steps = 4`（等效 batch 4）
的代价就是单步慢。495 步 ≈ 35 分钟，GPU 89%、显存 13.3G/24G，loss 稳在 ~0.10，都正常。
别看到"慢"就以为卡了。

### 5. checkpoint 滚动删除
`save_every_n_epochs = 1` + `save_last_n_epochs = 4`：每 epoch 存一次（228MB/个），
但**只保留最近 4 个**，老的自动删。想要中间某个 epoch 的产物记得提前拷走。

### 6. trigger word 要锁在 caption 最前面
`dataset.toml` 里 `keep_tokens = 1`：shuffle_caption 开启时，**前 1 个 token（`haiseyin`）不参与乱序**，
保证触发词永远在句首。角色 LoRA 的 caption 格式：`触发词, 标签1, 标签2, ...`

### 7. WD14 原始标签要后处理
tagger 出的原始 caption 有噪声（颜色类垃圾标签、顺序问题），
`post_process_captions.py` 做了清理和重排。打完标签一定要跑后处理再看 .txt 抽检。

### 8. `pkill -f` 会把自己所在的 shell 一起杀
想「杀掉旧的 http.server 再起新的」时，`pkill -f 'http.server 6008'` 会把**正在执行这条命令的 shell**
也匹配 kill——因为 shell 自己的命令行里就含这串字（尤其同一条命令后面还要
`python -m http.server 6008` 重启，裸串又出现一次）→ 命令半路断、新服务没起成。
- 解法一（推荐）：按**端口**杀，不碰命令行 → `fuser -k 6008/tcp`（shell 不监听该端口，不误伤）。
- 解法二：字符类 trick `pkill -f '[h]ttp.server 6008'`，**且整条命令别处不能再出现裸 `http.server 6008`**，
  否则仍会从别处自匹配。
- 验证切换成功：curl 一个**新目录独有的文件名**——200 = 切对了，404 = 还指着旧目录。

---

## 四、本地连接层坑（Windows → AutoDL）

1. **Git Bash 的 MSYS 路径改写**：作为独立参数的 `/root/...` 会被改成 `C:/Program Files/Git/root/...`。
   命令前加 `MSYS_NO_PATHCONV=1`，或把路径嵌在带其他内容的引号字符串里。
2. **paramiko 读长任务输出会假死**：`stdout.read()` 阻塞到通道 EOF，而远程后台进程占着流，
   EOF 永远不来 → 本地死等。要用 `open_session()` + 轮询 `recv_ready()/exit_status_ready()`
   （带超时），exit_status 一就绪就 drain 返回。现成轮子在 `C:\Users\yaya\.claude\tmp\autodl_ssh.py`。
3. **实例 host/port/密码会变**：换机器/重启后去 AutoDL 控制台重新抄 SSH 登录信息。

---

## 五、下一步（生成测试）的预警 ⚠️

**transformers 5.13 重构了 CLIPTextModel 模块名**（`encoder.layers.X`，没了 `text_model.` 容器），
diffusers 0.39 按老名字注入 text encoder 的 LoRA 会报 `Target modules not found`
→ **触发词失效、角色一致性崩**。之前 SD1.5 项目验证过的完整 workaround：

```python
# 跳过默认 te 注入（UNet 部分不受影响，照常加载）
pipe.load_lora_into_text_encoder = lambda *a, **k: None
# 然后手工注入 te 的 LoRA：去掉 "text_encoder." 前缀，按 encoder.layers.X.self_attn.Y_proj
# 逐级 getattr 找到 Linear，up/down 凑齐一对后 weight += up @ down * scale
```

彻底解是降级 transformers 到 4.x（如 4.46）。本次在服务器上做生成测试前先确认环境里的版本，
kohya 的 venv（`lora_train/env`）里的 transformers 版本未必和之前 `/01-try` 那次一样。

---

## 六、关键路径速查

```
/root/autodl-tmp/lora_train/
├── env/                      # venv（python/accelerate 全在这里）
├── sd-scripts/               # kohya 源码
├── models/animagine-xl-3.1.safetensors   # 底模 6.9G（wget hf-mirror 下的）
├── dataset/img/haiseyin/     # 13 张 png + 同名 txt caption
├── scripts/
│   ├── setup_env.sh          # 装环境（venv/torch/requirements/accelerate 配置）
│   ├── hf_download.py        # 镜像下载参考（实际用 wget 更稳）
│   ├── run_tag.sh            # WD14 打标签 + caption 后处理
│   ├── post_process_captions.py
│   ├── config.toml           # 训练主配置
│   └── dataset.toml          # 数据集配置
├── logs/train.log            # 训练日志（tensorboard 也在 logs/）
└── output/                   # char_v1-XXXXXX.safetensors（滚动留最近 4 个）
```

**训练核心参数**（config.toml）：dim 32 / alpha 16，UNet+TE 双训，
lr 1e-4（TE 5e-5），cosine_with_restarts ×3，bf16，batch 1 × grad_accum 4，
noise_offset 0.05 + min_snr_gamma 5 + multires noise，clip_skip 2，seed 42。

---

## 七、生成测试阶段补记（2026-07-26 晚）

### 1. diffusers 加载 kohya LoRA 报 "PEFT backend is required"
kohya 的训练 venv 里**不装 peft**（训练用不到），但 diffusers 的 `load_lora_weights`
把 peft 当后端，缺了直接 `ValueError: PEFT backend is required for this method`。
`pip install peft` 即解（本次装到 0.19.1，配 transformers 4.54.1 仍带 `text_model` 容器，
TE 注入正常，没撞第五节那个 5.13 的 bug）。
→ 教训：**训练 venv ≠ 推理 venv 的依赖集**，加载 LoRA 前先 `pip show peft` 确认。

### 2. 轮询监控读到"旧日志"假报错
把 `pip install && 启动训练` 串在同一条后台命令里时，安装还没跑完，轮询就先 grep 到
上一轮残留的 Traceback → 秒判 ERRORED，其实新一轮根本没开始。
→ 教训：重跑前 `rm -f log`，轮询里带**日志新鲜度校验**——`stat -c %Y log` 对比 `date +%s`，
age 太大就当旧日志忽略（本次用 `age<400` 才算真错）。后台启动用 `(setsid nohup ... &)`
子 shell 包裹，确保 `rm` 与启动的先后顺序不被 `&` 优先级坑到。

### 3. epoch 选优观察（4 个存盘点 × 人像+场景，seed42 控变量）
触发词 `haiseyin` 还原度从早期就很高，差异在细节锁定程度：
**ep11 偏软/泛化、发饰瞳色略飘 → ep12 过渡、脸偏硬 → ep14 甜点（特征锐利、脸自然、场景泛化好）
→ final/ep15 与 ep14 几乎一样，略有最末过拟合迹象**（训练集道具复现更死板）。
推荐 **ep14**；想要最高还原度可上 final，但留一份 ep14 当灵活性备选。

### 4. 228MB 权重别走 base64 通道
base64-over-exec 会把 ~300MB 文本灌进对话上下文，撑爆且慢。大文件让用户走：
**AutoDL 网页文件浏览器** 直接下载，或 `cd output && python -m http.server 6008` 后用控制台
「自定义服务」链接下。**只有小预览图（<30KB）才适合** `tar cz | base64` 拉回本地肉眼看。

---

## 八、训练参数与耗时估算（含 agelaiya 实测，2026-07-26）

> 同一套配方先后训了 haiseyin（13 图）和 agelaiya（15 图），下面用这两组实测把
> 「步数 / 耗时 / 显存」的算法讲透，换数据集时照着算即可。

### 1. 步数怎么算

```
每 epoch 图数      = 图数 × num_repeats
每 epoch 优化步    = ceil(每 epoch 图数 / (train_batch_size × gradient_accumulation_steps))
总优化步           = 每 epoch 优化步 × max_train_epochs
每张图被训练次数    = num_repeats × max_train_epochs      （经验甜点：100~200）
```

本配方 `batch=1, grad_accum=4` → 除数固定为 4：

| 数据集 | 图数 | repeats | 图/epoch | 步/epoch=ceil(/4) | epochs | **总步** | 过图次数 |
|---|---|---|---|---|---|---|---|
| haiseyin | 13 | 10 | 130 | 33 | 15 | **495** | 150 |
| agelaiya | 15 | 10 | 150 | 38 | 15 | **570** | 150 |

（日志开头的 `total optimization steps` 就是这个总步，对得上才说明配置没算错。）

### 2. 耗时怎么估

```
循环时长 ≈ 总步 × 单步耗时
整轮 wall ≈ 循环时长 + 模型加载(~30-60s) + 存盘(每 epoch 几秒 × epochs)
```

- **单步耗时看 50 步之后的均值**，别信第 1 步——首步含 inductor 编译 + 首次显存分配，
  实测 agelaiya 首步 6.78s/it、tqdm 外推 ETA 直接报 1 小时，纯吓唬人；稳态回落 ~4.0s/it。
- 实测单步：haiseyin **~4.13 s/it**，agelaiya **~4.0 s/it**。
- 代入：haiseyin 495×4.13 ≈ 34min（实测 wall ~35min）；
  agelaiya 570×4.0 ≈ 38min + 加载/存盘 → **wall ~40-42min**，约 19:20 完成。
- **显存**（bf16 + grad checkpointing + AdamW8bit，4090 24G）：haiseyin **13.3G**，
  agelaiya **15.3G**。差异来自分辨率桶——agelaiya 原图更大 → 桶更大 → 更吃显存，但仍富余。
- **loss 走势参考**：开局 0.13~0.22 → 中段 ~0.10 → 收尾 ~0.093~0.097；
  若 loss 不降或 NaN = 出事，若一路降到 0.02 以下 = 过拟合警报。

### 3. 关键参数为什么这么填

| 参数 | 取值 | 理由 |
|---|---|---|
| network_dim / alpha | 32 / 16 | 角色 LoRA 常用 dim 16-64；alpha 取 dim 一半 → 内置 scale=0.5，出图强度 1.0 即等效 0.5，留调节余量。dim 太小欠拟合、太大易过拟合且文件大 |
| unet_lr / text_encoder_lr | 1e-4 / 5e-5 | LoRA 标准量级；TE 用更小 lr 防文本编码器过拟合、保场景泛化 |
| lr_scheduler | cosine_with_restarts ×3 + warmup 0.05 | 周期重启帮跳出局部最优，对小数据集 + 多 epoch 友好 |
| grad_accum 4 + grad_checkpointing | 4 / true | batch=1 省显存，accum 把有效 batch 提到 4 让梯度更稳；checkpointing 用时间换显存——**也是单步偏慢的主因，别误以为卡了** |
| optimizer_type | AdamW8bit | 优化器状态 fp32→8bit，省一大块显存，24G 跑 SDXL LoRA 的实用选择 |
| noise_offset 0.05 | | 改善整体亮度/对比的学习 |
| min_snr_gamma 5 | | 加权稳定不同噪声步的梯度 |
| multires_noise 6 / 0.3 | | 多尺度噪声加细节 |
| enable_bucket 768-1280 | | 不裁图、按原比例进桶，1280 封顶控显存 |
| clip_skip 2 | | Animagine / NAI 系标配 |
| save_every_n_epochs 1 + save_last_n_epochs 4 | | 每 epoch 存一次方便挑最优，但只留最近 4 个省盘（要中间产物提前拷走） |

> noise_offset + min_snr_gamma + multires_noise 是 SDXL LoRA 的「质量三件套」，照抄即可。

### 4. 换数据集时怎么调（速查）

- **图更少（5-8 张）**：repeats 提到 15-20 或 epochs 提到 20，保持「过图次数 ≈ 150」；
  同时一定跑场景泛化测试盯过拟合。
- **图更多（30+）**：repeats 降到 3-5，避免步数爆炸 + 过拟合；总步上千也正常。
- **想快点看效果**：epochs 先减半出图看，欠拟合再加。
- **显存爆**：降 `max_bucket_reso` 到 1024，或确认 `gradient_checkpointing=true`。
- **单步异常慢**：先排除首步编译；50 步后仍慢 → 分辨率桶太大，降 `max_bucket_reso`。
- **触发词**：写进每张 caption 的第一个 token + `keep_tokens=1` 锁住；
  换角色就换这个词，其余超参基本不用动。


