---
title: "Qwen3-4B 护符设计 LoRA 微调 + 部署（AutoDL）"
date: 2026-08-02
category: 技术
tags: [autodl, lora, qwen3, 微调, 日记归档]
draft: false
---

> 把本地 Intel Arc（XPU）上跑的 Qwen2.5-0.5B 护符 LoRA 微调，迁移到 AutoDL 的 NVIDIA GPU 上，基座升级为 **Qwen3-4B**，从零跑通「训练 → 验证 → 网页部署」全流程。
>
> 日期：2026-08-02 ｜ 服务器：AutoDL `westc:50262`（RTX 4080 SUPER）

---

## 一、一句话结果

82 条艾尔登法环护符数据，在 Qwen3-4B 上 LoRA 微调 **3.5 分钟**跑完（loss 3.96 → 0.86），成功学到法环护符的 `【名】/效果/背景描述` 文体，并以 transformers 网页聊天页部署到 **6008 端口**。

---

## 二、环境信息

| 项 | 值 |
|----|----|
| GPU | NVIDIA RTX 4080 SUPER（报告 32760 MiB） |
| conda env | **`vllm`**（torch 2.11+cu130、**transformers 5.14.1**、peft 0.20、accelerate 1.14、gradio 6.22） |
| 基座模型 | `/root/autodl-tmp/models/Qwen3-4B`（服务器已有，未重新下载） |
| 磁盘 | `/root/autodl-tmp` 仅剩 4.2G，全程没清理也够用 |

> ⚠️ 服务器上还有个 `notagen` env，是给 NotaGen 用的，**transformers 4.40**——它不识别 qwen3 架构，**不能动**（升级会破坏 NotaGen）。

---

## 三、踩过的坑（按踩的顺序，每个都标注「现象→原因→解决」）

### 坑1 ⭐ qwen3 架构需要 transformers ≥ 4.51

- **现象**：用 notagen env 加载 Qwen3-4B，`AutoConfig.from_pretrained` 报 `model type 'qwen3' does not recognize`。
- **原因**：qwen3 是新架构，transformers 4.40 还没有对应的 model 类。
- **解决**：换用 **vllm env**（当初为装 vLLM 建的，顺带装了 transformers 5.14.1）。这就是「vllm env」≠「vLLM 引擎」——我只是借它的新 transformers，**全程用 transformers 推理，没碰 vLLM 引擎**。

### 坑2 ⭐ Qwen3 的模板会插空 think 块

- **现象**：照搬 Qwen2.5 的做法，手动把 prompt 拼到 `<|im_start|>assistant\n` 就停，模型格式错乱（一直 think 或乱码）。
- **原因**：Qwen3 即便 `enable_thinking=False`，`apply_chat_template` 也会在 assistant 开头插一个空块：
  ```
  <|im_start|>assistant\n<think>\n\n</think>\n\n
  ```
  模型就是这么训练的，少了这个前缀就跑偏。
- **解决**：训练样本和推理 prompt **都必须用 `tokenizer.apply_chat_template(..., enable_thinking=False)` 渲染**，不能手动拼。

### 坑3 peft 版本与 transformers 不匹配

- **现象A**（notagen env，transformers 4.40）：装最新 peft，`import peft` 报 `ImportError: cannot import name 'EncoderDecoderCache' from 'transformers'`。
- **原因**：最新 peft 要新版 transformers 的 `EncoderDecoderCache`，4.40 没有。
- **解决A**：降级 `pip install peft==0.10.0`（那个版本还不 import `EncoderDecoderCache`）。
- **现象B**（vllm env，transformers 5.14.1）：装 peft 0.20 一切正常。
- **教训**：peft 和 transformers 要配对，老 transformers 配老 peft，新 transformers 配新 peft。

### 坑4 ⭐ 后台启动必须 `conda activate`，绝对路径 python 不行

- **现象**：用 `setsid /root/miniconda3/envs/vllm/bin/python talisman_chat.py > log 2>&1 &` 后台启动，**连 log 文件都不生成**，进程根本没起来；但同一命令前台 `timeout 28 python ...` 却能正常打印「模型就绪」。
- **原因**：绝对路径 python 缺 conda activate 设置的 `LD_LIBRARY_PATH` 等环境变量，后台（环境更干净）启动失败；前台继承了 shell 环境凑合能跑。
- **解决**：完全复刻训练成功的写法——`source conda.sh && conda activate vllm && ... && (setsid python xxx.py > log 2>&1 < /dev/null &)`。**子 shell 括号 `( ... &)` + conda activate + 相对 python**，三者缺一不可。
- **附带**：`screen -dmS` / tmux 在 autodl_ssh 的 exec_command（不分配 tty）下完全不工作，别用。

### 坑5 greedy 解码下输出重复

- **现象**：微调后用 `do_sample=False`（greedy）验证，护符文本大量重复「能提升免疫力。在远古时代...能提升免疫力...」循环。
- **原因**：三重叠加——① 4B 学 82 条必然过拟合（loss 已降到 0.86）；② greedy 最容易陷重复环；③ 训练数据本身「效果」≈「背景描述」（法环原文就这样）。
- **解决**：网页部署时用 `do_sample=True` + `top_p=0.9` + `top_k=50` + `repetition_penalty=1.15`。想根治就降 epochs 到 3 或加 `LORA_DROPOUT=0.1` 重训。

---

## 四、代码改动（XPU Qwen2.5 版 → CUDA Qwen3 版）

四个文件，改动集中且克制：

| 文件 | 改动 |
|------|------|
| `config.py` | `BASE_MODEL` 指向本地 `/root/autodl-tmp/models/Qwen3-4B`；`DATA_DIR/OUTPUT_DIR` 改 Linux 路径；`OUTPUT_DIR` 用 `output_qwen3` 和旧实验分开 |
| `dataset.py` | **核心**：prompt 从手动拼 ChatML 改成 `tokenizer.apply_chat_template(..., add_generation_prompt=True, enable_thinking=False)`，自动带上 Qwen3 的空 think 块前缀。labels 仍是 prompt 段 -100 |
| `train.py` | `pick_device()` 改 CUDA 优先；加 `gradient_checkpointing=True` + `gradient_checkpointing_kwargs={"use_reentrant": False}` + `model.enable_input_require_grads()`（4B 省显存 + 配合 peft） |
| `infer.py` | device 默认 cuda；prompt 用 `apply_chat_template`；放开 `top_k=50`（XPU 上被迫设 0，CUDA 无此限制） |

新增 `smoke.py`（冒烟测显存/通路）、`verify.py`（基座 vs 微调对比）、`talisman_chat.py`（6008 网页部署）。

---

## 五、完整流程与命令（可复现）

### 1. 探环境
```bash
# 在本机用 autodl_ssh.py 跑远程命令
python autodl_ssh.py "nvidia-smi --query-gpu=name,memory.total --format=csv,noheader; \
  ls /root/miniconda3/envs/; \
  source /root/miniconda3/etc/profile.d/conda.sh && conda activate vllm && \
  python -c 'import torch,transformers;print(torch.__version__,transformers.__version__)'"
```

### 2. 装 / 确认依赖（vllm env）
```bash
pip install peft accelerate gradio    # transformers/torch 已在；datasets 不需要（原生 torch.Dataset）
```

### 3. 上传数据 + 代码（本机 → 服务器）
```bash
# autodl_upload_westc.py 走 base64-over-exec；注意 MSYS_NO_PATHCONV=1 防 git bash 路径转换
export MSYS_NO_PATHCONV=1
python autodl_upload_westc.py "C:/.../talisman_lora/config.py"   "/root/talisman_lora/config.py"
python autodl_upload_westc.py "C:/.../talisman_lora/train.py"    "/root/talisman_lora/train.py"
python autodl_upload_westc.py "C:/.../talisman_lora/dataset.py"  "/root/talisman_lora/dataset.py"
python autodl_upload_westc.py "D:/Claude_cursor/.../all_samples.jsonl" "/root/talisman_lora/data/all_samples.jsonl"
```
> ⚠️ git bash 下给 python.exe 传 `/c/Users/...` 会被转成 `C:\c\Users`，必须 `export MSYS_NO_PATHCONV=1` + Windows 风格路径。

### 4. 冒烟测试（验证显存 + 通路，不训练）
```bash
conda activate vllm && cd /root/talisman_lora && python smoke.py
# 关键输出：forward OK, loss=3.96 / backward OK / 峰值显存 11.44 GB（batch=2）
```

### 5. 正式训练（后台 + 日志）
```bash
cd /root/talisman_lora
source /root/miniconda3/etc/profile.d/conda.sh && conda activate vllm
(setsid python train.py > train.log 2>&1 < /dev/null &) && echo LAUNCHED
# 轮询：tail -f train.log ；55 步 × 4.1s ≈ 213s 跑完
```
训练配方：`bf16, r=8/alpha=16, target=7个线性层, trainable 0.41%(16.5M/4.04B), epochs=5, bs=1, grad_accum=8, lr=2e-4`。

### 6. 验证效果（基座 vs 微调对比）
```bash
python verify.py    # 3 个提示，greedy 确定性对比
```

### 7. 部署到 6008（transformers 加载，非 vLLM）
```bash
pkill -f 'talisman_chat' 2>/dev/null; sleep 2
source /root/miniconda3/etc/profile.d/conda.sh && conda activate vllm
cd /root/talisman_lora
(setsid python talisman_chat.py > talisman_chat.log 2>&1 < /dev/null &) && echo LAUNCHED
sleep 40 && tail talisman_chat.log      # 看到「微调模型就绪，开始监听 6008」即成功
curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:6008/   # 期望 200
```
访问：AutoDL 控制台 →「自定义服务」（6008 入口）。

---

## 六、训练结果

| 指标 | 值 |
|------|----|
| 总时长 | **213 秒（~3.5 分钟）** |
| 总步数 | 55（82/8 ≈ 10 步/epoch × 5） |
| loss | 初始 3.96 → 末段 0.86，平稳收敛无 NaN |
| 可训练参数 | 16.5M / 4.04B = **0.41%** |
| LoRA 权重 | `adapter_model.safetensors` **66 MB** |

---

## 七、效果验证（最关键）

同一提示「基于『健壮角饰品』设计一个数值更高且文本描述进阶的版本」：

- **原始基座 Qwen3-4B**：输出「天穹之骨·巨灵之冠」+ `+35 攻击力 / +40 防御力 / +250 HP...` 一堆数值表 —— 典型**现代 RPG 游戏设计稿**，完全跑偏。
- **微调后**：直接输出 `【健壮角饰品＋１】\n效果：...\n背景描述：...` —— **精准命中法环护符的「【名】+ 两段式 + +1 套路」**。

SFT 的核心目标（学会法环护符的格式、文风、命名套路）达成，基座原本的「现代设计稿」味被洗掉。✅

---

## 八、复盘要点

1. **换基座不是改个路径**：Qwen2.5 → Qwen3，架构变了（要新 transformers）、模板变了（think 块）、显存变了（4B 要 gradient checkpointing）。每个差异都是一个潜在坑。
2. **「env 名」会骗人**：`vllm` env 里跑的是 transformers，不是 vLLM 引擎。看到 env 名先确认它实际装的包。
3. **后台启动三件套**：`conda activate`（环境变量）+ `(setsid ... &)`（子 shell detach）+ 相对 python。缺一个都可能静默失败（连 log 都不生成）。
4. **小数据 + 大模型 = 必过拟合**：4B 学 82 条，loss 很快见底。要靠采样 + repetition_penalty 在推理时补救，或降 epochs。
5. **transformers 对单用户够省**：4B 推理 ~8GB 权重 + 少量 KV，远低于 vLLM 的预分配 KV pool。一个人用没必要上 vLLM。

---

## 九、文件清单

**本地**（`C:\Users\yaya\.claude\tmp\talisman_lora\`）：
`config.py` / `train.py` / `dataset.py` / `infer.py` / `smoke.py` / `verify.py` / `talisman_chat.py`

**服务器**：
- 代码 + 数据 + 输出：`/root/talisman_lora/`
- 基座：`/root/autodl-tmp/models/Qwen3-4B`
- LoRA 权重：`/root/talisman_lora/output_qwen3/lora_final/`（66 MB adapter）

**数据源**：`D:\Claude_cursor\eldenring_npc_scraper\output\talismans\training_data\all_samples.jsonl`（82 条，三类：forward_design / reverse_lore / balancing_tiers）

---

## 十、后续可做

- [ ] 降 epochs 到 3 + `LORA_DROPOUT=0.1` 重训一版，看重复能否根治
- [ ] 训练数据去重（效果 ≈ 背景描述的样本可清洗）
- [ ] 把 `~/s chat` 脚本改成指向护符版（目前 `~/s chat` 会拉起普通 Qwen3-4B 覆盖护符版）
- [ ] 试试 r=16/32 或加 system prompt 到训练数据，提升护符多样性

---

## 十一、今日后续（2026-08-02 晚）：animagine 角色 LoRA + 后台启动经验

> 护符文档写完后同一天又做的事。⚠️ 注意：下面是 **SDXL 角色 LoRA**（kohya + animagine-xl-3.1，出图），和上面的护符 **文本 LoRA**（transformers + Qwen3-4B，出文字）是完全不同的两条线，只是碰巧同一天在同一个 AutoDL 实例上做。

### 11.1 yeshunguang 角色 LoRA（训练中）

- **数据**：`C:\Users\yaya\Pictures\lora_yeshunguang_dataset.zip`，15 图 + 15 caption，触发词 `yeshunguang_char`
- **配方**：复用飞影验证过的 kohya SDXL 配方（dim32 / alpha16 / epoch15 / repeats10 / 质量三件套 / bf16 / AdamW8bit / clip_skip2），15图×10×15/4 ≈ **570 步**
- **环境**：`/root/autodl-tmp/lora_train/`（venv + sd-scripts），底模 animagine-xl-3.1 **diffusers 目录版**（`/root/autodl-tmp/models/animagine-xl-3.1`，单文件版本实例没有）
- **显存策略**：停 ComfyUI（释放 ~7G），让护符 chat（6008）+ 训练共存 = 21G / 32G，够用
- **实测**：6.1 s/it、~58 min、avr_loss ~0.10（健康，飞影 0.0948 同量级）；产出 `yeshunguang-v1` final + ep11-15 滚动存盘（各 218M）

### 11.2 heitiane / kafuka 数据集上传（待训练）

| 角色 | 图 | 触发词 | 服务器路径 | 备注 |
|------|----|--------|-----------|------|
| heitiane | 15 png | `heitiane_char` | `dataset/img/heitiane/` | 标准 |
| kafuka | 15（jpg/webp/png 混合）| `kafuka_char` | `dataset/img/kafuka/` | zip 多套一层 `lora_kafuka_dataset/` 目录；混合图格式 kohya 按文件名配 .txt 无碍 |

以后训这两个，复用同一套脚本，只改 `output_name` / `image_dir` / 触发词三处，配方不动。

### 11.3 ★ autodl_ssh 后台启动的隐蔽坑（今日最重要经验）

**现象**：后台 `setsid cmd &` 启动长任务，经常「`echo LAUNCHED` 照常打印、但 log 不生成、进程没起、GPU 显存没涨」；前台 `timeout N bash run.sh` 又完全正常 → 极易误判成"代码/配置问题"。

**根因**：`autodl_ssh.py`（paramiko `exec_command`）命令一返回就关 SSH channel。`&` 让进程进后台、shell 立即返回 → channel 立刻关 → sshd 给会话进程组发 SIGHUP → 此时 `setsid` 还没把进程搬进新会话/脱离 controlling tty → 进程被杀，log 都来不及写。

**解法**：`&` 之后必须带 `sleep N`（训练等重进程给 60-90s），让 channel 保持打开，setsid 跑完 detach：
```bash
# ✅ sleep 让 setsid 完成脱离会话，进程进新会话不受 SIGHUP
cd /path && (setsid nohup bash run.sh > log 2>&1 </dev/null &) ; sleep 75 ; tail log
# ❌ 无 sleep，channel 立即关，进程被杀（典型 GPU 只剩 1MiB）
(setsid nohup bash run.sh > log 2>&1 &) && echo LAUNCHED_OK
```

**两个变体**（症状都是 log 不生成，根因不同，别混淆）：
1. **channel 时序**（yeshunguang 训练）：加 `sleep`。
2. **环境变量缺失**（护符 chat 部署）：绝对路径 `/root/miniconda3/envs/X/bin/python` 缺 `conda activate` 设的 `LD_LIBRARY_PATH`，后台静默失败 → `source conda.sh && conda activate X && (setsid python ... &)`（venv 同理 `source env/bin/activate`）。**前台能跑 ≠ 后台能跑**。

**其他**：`screen -dmS` / tmux 因 exec_command 不分配 tty 而不通（`No Sockets found`）；带 `&` 的命令还会 `exit 1 + 吞 stdout`，要另开**纯查询命令**（无 `&`：tail/pgrep/curl/nvidia-smi）确认状态。

> 已存入记忆 `reference_autodl_ssh_background.md`，下次 AutoDL 长任务优先 recall。

### 11.4 训练完 6006 下发权重

```bash
# 幂等检测用 curl 不用 pgrep（pgrep -f http.server 会匹配当前 shell）
curl -sf http://127.0.0.1:6006/ >/dev/null || \
  (cd /root/autodl-tmp/lora_train/output && \
   setsid nohup /root/miniconda3/bin/python -m http.server 6006 >/tmp/h.log 2>&1 </dev/null &) ; \
  sleep 8 ; curl -sI http://127.0.0.1:6006/ | head -1
```
通过 AutoDL「自定义服务」6006 入口下载 `yeshunguang-v1` 的 final + ep11-15（各 218M）。
