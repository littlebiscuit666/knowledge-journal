---
title: "AutoDL 部署工作总结：ComfyUI + Qwen3-TTS + NotaGen 一天三连"
date: 2026-07-30
category: 技术
tags: [autodl, 部署, comfyui, tts, notagen, 日记归档]
draft: false
---

今天在 AutoDL GPU 服务器上一口气部署/跑通了三套东西：**ComfyUI（图像）→ Qwen3-TTS（语音）→ NotaGen（乐谱）**，外加用 NotaGen 微调了一个"fanyihong"钢琴风格模型并按指定参数推理。本文档记录全部命令、路径、参数和踩过的坑，方便复盘和复现。

---

## 一、服务器与环境

| 项 | 信息 |
|---|---|
| 连接 | `ssh -p 50262 root@connect.westc.seetacloud.com`（密码 `********`） |
| GPU | RTX 4080 SUPER（32 GB），驱动 595.71.05 |
| 系统 | AutoDL 容器，CUDA 可用 |
| base python | `/root/miniconda3/bin/python` |
| 数据盘 | `/root/autodl-tmp`（持久，模型/数据放这） |
| 系统盘 | `/root/miniconda3/envs/`（conda env 放这，宽裕） |

**本地 SSH helper**：`C:\Users\yaya\.claude\tmp\autodl_ssh.py "<远程命令>"`（paramiko，凭据已写死，单条命令执行）。注意它对含 `setsid &` 的后台复合命令会 exit 1 + 漏读 stdout（命令其实执行了），排查时把启动和验证分开调用。

**外网端口限制（重要）**：AutoDL 自定义服务**只代理 6006 和 6008** 两个端口到公网，6007 等其他端口外网打不开。今天的网页服务分配：
- **6006 → ComfyUI**
- **6008 → Qwen3-TTS**

---

## 二、ComfyUI（端口 6006）

之前已部署（`/root/ComfyUI`，复用 `lora_train/env` 的 torch）。今天补了两个便捷脚本：

### 启动脚本 `~/cfy.sh`
```bash
cd /root/ComfyUI && nohup ~/autodl-tmp/lora_train/env/bin/python main.py --listen 0.0.0.0 --port 6006 >~/autodl-tmp/c.log 2>&1 &
```
起服务：`bash ~/cfy.sh`；看日志：`tail -f ~/autodl-tmp/c.log`；入口：AutoDL 控制台「自定义服务」。

### 管理脚本 `~/c`（查/杀/日志）
```bash
#!/bin/bash
case "${1:-s}" in
  s|status) pgrep -af main.py || echo "ComfyUI 未运行" ;;
  k|kill|stop) pkill -f main.py && echo "已结束 ComfyUI" || echo "无 ComfyUI 进程" ;;
  l|log) tail -n 30 ~/autodl-tmp/c.log ;;
  *) echo "用法: ~/c [s|k|l]" ;;
esac
```
`~/c`（查进程，默认）/ `~/c k`（结束）/ `~/c l`（看日志）。

> AutoDL 容器**没有 `fuser` 命令**，按端口杀进程只能用 `pkill -f`。

---

## 三、Qwen3-TTS 语音合成（端口 6008）

### 1. 模型解压
用户上传的 `Qwen3-TTS-12Hz-1.7B-CustomVoice.zip` 是完整模型（model.safetensors 3.83G + speech_tokenizer 0.68G + 全部 config），但多打包了冗余 `.git/`。解压时排除 `.git/` 省 4.5G，**不需要 git-lfs**：
```bash
cd /root/autodl-tmp/models && unzip -o -q Qwen3-TTS-12Hz-1.7B-CustomVoice.zip \
  -x 'Qwen3-TTS-12Hz-1.7B-CustomVoice/.git/*'
```

### 2. 环境（复用 `lora_train/env`）
```bash
/root/autodl-tmp/lora_train/env/bin/python -m pip install qwen-tts soundfile \
  -i https://pypi.tuna.tsinghua.edu.cn/simple
```
transformers 4.54 → 4.57.3（不影响同 env 的 ComfyUI）。torchaudio/gradio 本来就有。

### 3. 命令行推理 `infer.py`
路径：`/root/autodl-tmp/qwen3-tts/infer.py`（CUDA 版，`device_map="cuda"` / `attn=sdpa` / `dtype=bf16`）。
```bash
/root/autodl-tmp/lora_train/env/bin/python /root/autodl-tmp/qwen3-tts/infer.py
```
实测：加载 3.2s，显存 3.89 GB，生成 17.1s 出 7.7s 音频，RTF=2.23。输出 `/root/autodl-tmp/qwen3-tts/output.wav`。

### 4. Gradio 网页 `app.py`（端口 6008）
路径：`/root/autodl-tmp/qwen3-tts/app.py`。控件：文本框 + 音色下拉 + 语言 + 情绪指令 + 生成按钮 + 在线播放。
启动脚本 `~/t.sh`：
```bash
cd /root/autodl-tmp/qwen3-tts && setsid nohup \
  /root/autodl-tmp/lora_train/env/bin/python app.py > /root/autodl-tmp/tts.log 2>&1 </dev/null &
```
起：`bash ~/t.sh`；日志：`tail -f ~/autodl-tmp/tts.log`；杀：`pkill -f app.py`；入口：AutoDL「自定义服务」6008。
生成的 wav 落在 `/root/autodl-tmp/qwen3-tts/outputs/out_<时间戳>.wav`。

### 5. 内置 9 个音色
| speaker | 性别 | 语言 |
|---|---|---|
| Vivian / Serena | 女 | 中文 |
| Uncle_Fu / Dylan(北京话) / Eric(四川话) | 男 | 中文 |
| Ryan / Aiden | 男 | 英文 |
| Ono_Anna | 女 | 日文 |
| Sohee | 女 | 韩文 |

用的时候 language 要和音色匹配（或设 `Auto`）。

### 6. Gradio 踩过的坑（重要）
- **gradio 4.44 两个致命 bug**：① `server_name="0.0.0.0"` 时 launch 自检访问 `http://0.0.0.0:port` 失败，报 "localhost not accessible"；② 处理请求时 `_json_schema_to_python_type` 对 bool schema 崩 `TypeError`。**升级到 gradio 6.x 两个 bug 都消失**。
- 但 gradio 6.x 会拉 `huggingface-hub>=1.16`，与 transformers 4.57(`<1.0`)冲突，qwen_tts import 崩。**再降 `pip install 'huggingface-hub>=0.34,<1.0'`**（gradio 本地模式不碰 hub 1.x 专有 API，实测能跑，pip 警告忽略）。
- app.py 顶部加了清代理 + monkeypatch：`import gradio.networking as _gn; _gn.url_ok=lambda url:True`（双保险跳过自检）。
- env 终态：gradio 6.21 + transformers 4.57.3 + hub 0.36.2。

---

## 四、NotaGen 古典乐谱生成

### 1. 仓库 + 环境
```bash
cd /root/autodl-tmp && GIT_LFS_SKIP_SMUDGE=1 git clone --depth 1 \
  https://github.com/ElectricAlexis/NotaGen.git
```
新建独立 env（NotaGen 要 transformers 4.40，和 qwen-tts/ComfyUI 冲突）：
```bash
/root/miniconda3/bin/conda create -n notagen python=3.10 -y
```
**torch 软链复用**（省 2GB 下载）：README 要 `pytorch==2.3 cu118`，但 pip 下会拖一堆 nvidia-* 大包（2GB+）清华源限速慢到卡死。改从 `lora_train/env` 软链 torch 2.13+cu130（同 python3.10）：
```python
# 把 torch*/triton*/cuda*/nvidia* 全软链到 notagen env，再 pip 装 torch 的纯python依赖
/root/miniconda3/envs/notagen/bin/pip install typing-extensions sympy networkx jinja2 filelock fsspec \
  -i https://pypi.tuna.tsinghua.edu.cn/simple
```
其余依赖：`pip install -r requirements.txt accelerate optimum`（清华源）。env 终态：torch 2.13 cu130 / transformers 4.40 / gradio 5.17 / numpy 1.26 / abctoolkit / samplings。

### 2. pretrain-small 推理
权重：`/root/autodl-tmp/models/weights_notagen_pretrain_p_size_16_p_length_2048_p_layers_12_c_layers_3_h_size_768_lr_0.0002_batch_8.pth`（110M）。

`inference/config.py` 必须按权重改成 small 配置：
```python
INFERENCE_WEIGHTS_PATH = "/root/autodl-tmp/models/weights_notagen_pretrain_...pth"
PATCH_LENGTH = 2048   # small 是 2048，不是默认 1024
CHAR_NUM_LAYERS = 3   # small 是 3，不是默认 6
PATCH_NUM_LAYERS = 12 # small 是 12，不是默认 20
HIDDEN_SIZE = 768     # small 是 768，不是默认 1280
NUM_SAMPLES = 1       # 默认 1000
```
跑：`cd /root/autodl-tmp/NotaGen/inference && /root/miniconda3/envs/notagen/bin/python inference.py`，~1m16s/首，输出 9 声部复调 abc 到 `../output/{original,interleaved}/<权重名>_k9_p0.9_temp1.2/`。

abc → MusicXML：
```bash
cd /root/autodl-tmp/NotaGen/gradio && /root/miniconda3/envs/notagen/bin/python abc2xml.py -o /root/autodl-tmp/NotaGen/output/xml <abc文件>
```
xml 在 `/root/autodl-tmp/NotaGen/output/xml/`，用 MuseScore 打开看谱+播放。

> pretrain 权重**只能无条件生成**（风格随机，9 声部），不能按"时期-作曲家-乐器"prompt 控制。要条件生成需 NotaGen-X 权重。

---

## 五、NotaGen fanyihong 风格微调

### 1. 数据包
用户传 `upload_fanyihong_finetune.zip`：9 首古典钢琴曲（Bach/Beethoven/Canon/Moonlight/Mariage d'Amour/Greensleeves/Happy Birthday/Hungarian Sonata/Bella Ciao）× 12 调移调增强 = 135 个 abc + train.jsonl + finetune/ 代码。数据是 **2-3 声部钢琴谱**（Canon `%%score { 1 | 2 }` V:1 treble + V:2 bass）。每个 abc 开头加了 `%fanyihong` 弱提示。

### 2. 训练（已自适应 CUDA，不用改代码）
`train-gen.py` 的 `select_device()` 已支持 auto/cuda/xpu，auto 模式无 xpu 自动选 cuda。zip 没打 pretrain 权重，软链之前的 small 权重过去：
```bash
ln -sf /root/autodl-tmp/models/weights_notagen_pretrain_...pth \
  /root/autodl-tmp/NotaGen/upload_fanyihong_finetune/
```
启动训练：
```bash
cd /root/autodl-tmp/NotaGen/upload_fanyihong_finetune/finetune && \
  NOTAGEN_DEVICE=cuda CUDA_VISIBLE_DEVICES=0 setsid bash -c \
  '/root/miniconda3/envs/notagen/bin/python train-gen.py > /root/autodl-tmp/notagen_train.log 2>&1' </dev/null >/dev/null 2>&1 &
```
config: 4 epoch / batch 1 / lr 1e-5 / small 配置。4080S 上 **~25s 跑完**，eval_loss 0.215 → 0.175。

**产出**：`/root/autodl-tmp/NotaGen/upload_fanyihong_finetune/finetune/weights_notagen_fanyihong_p_size_16_p_length_2048_p_layers_12_c_layers_3_h_size_768_lr_1e-05_batch_1.pth`（1.3 GB）。

### 3. 用微调权重推理（2 声部 / 高温 / 短）
改 `inference/config.py`：`INFERENCE_WEIGHTS_PATH` 指向微调权重，`TEMPERATURE = 1.8`（默认 1.2），保持 small 配置。

改 `inference/inference.py` 控制长度（原本 `>102400` 字符才截断且当 failure 丢弃）：
```python
# "> 102400:" → "> 3000:"        （超长阈值改小）
# "failure_flag = True" → "end_flag = True"  （超长正常保存截断，不丢弃）
```

写 `inference/inference_fy.py`（2 声部 prompt + 自动转 xml）：
```python
import inference, os, glob, subprocess
PROMPT_LINES = [
    "%fanyihong\n",
    "%%score { 1 | 2 }\n",   # 2 声部，照 Canon 格式
    "L:1/8\n", "Q:1/4=100\n", "M:4/4\n", "K:C\n",
    "V:1 treble nm=\"Piano\" snm=\"Pno.\"\n",
    "V:2 bass \n",
]
inference.inference_patch(prompt_lines=PROMPT_LINES, pieces=1)
# 末尾自动找最新 abc 调 abc2xml 转 xml
```
跑：`cd inference && /root/miniconda3/envs/notagen/bin/python inference_fy.py`，2 声部 ~24s/首。xml 在 `/root/autodl-tmp/NotaGen/output/xml/`。

**可调点**：温度（太乱→降 1.4-1.5，太死板→升 2.0）、长度（改 inference.py 的 `3000`）、声部数（prompt 的 `%%score` 和 V: 行）。要更像可加 epoch（8/16，小数据过拟合风险）。

---

## 六、踩坑总结（普适，下次避）

1. **AutoDL 自定义服务只代理 6006/6008**——6007 等外网打不开，多服务轮流用这俩端口。
2. **AutoDL 容器无 `fuser`**——按端口杀进程用 `pkill -f`，别用 `fuser -k`。
3. **`autodl_ssh.py` 对 `setsid &` 后台命令 exit 1 + 漏读 stdout**——启动和验证分两次调用。
4. **pip 装 torch cu 版慢到卡死**（拉一堆 nvidia-* 大包，2GB+）——同机已有 env 的话**软链复用 torch** 最快。
5. **gradio 4.44 + AutoDL**：`server_name=0.0.0.0` 自检失败 + bool schema bug——直接升级 gradio 6.x。
6. **huggingface-hub 1.x 与 transformers<1.0 冲突**——升 gradio 后记得降 hub<1.0。
7. **base64 传脚本到服务器**时，printf 单引号内的双引号写真双引号（别误转义成 `\"`）；脚本内不能用单引号。
8. **AutoDL 装包别开 `network_turbo`**——它只加速 github/hf，对 pypi 反而更慢。

---

## 七、当前服务 / 文件清单

### 运行中的服务（实例重启后需手动重启）
| 服务 | 端口 | 启动 | 状态查看 |
|---|---|---|---|
| ComfyUI | 6006 | `bash ~/cfy.sh` | `~/c` / `tail ~/autodl-tmp/c.log` |
| Qwen3-TTS | 6008 | `bash ~/t.sh` | `pgrep -af app.py` / `tail ~/autodl-tmp/tts.log` |

### 关键文件位置
- **Qwen3-TTS**：模型 `/root/autodl-tmp/models/Qwen3-TTS-12Hz-1.7B-CustomVoice/`；脚本 `/root/autodl-tmp/qwen3-tts/{infer.py,app.py}`；音频 `/root/autodl-tmp/qwen3-tts/outputs/`
- **NotaGen**：仓库 `/root/autodl-tmp/NotaGen`；env `notagen`；推理输出 `/root/autodl-tmp/NotaGen/output/xml/`
- **fanyihong 微调**：训练包 `/root/autodl-tmp/NotaGen/upload_fanyihong_finetune/`；微调权重 `finetune/weights_notagen_fanyihong_*.pth`；训练日志 `finetune/logs_notagen_fanyihong_*.txt` + `/root/autodl-tmp/notagen_train.log`

### conda env
- `lora_train/env`（`/root/autodl-tmp/lora_train/env`）：torch 2.13 cu130，ComfyUI + Qwen3-TTS 共用
- `notagen`（`/root/miniconda3/envs/notagen`）：torch 软链自 lora_train + transformers 4.40，NotaGen 专用

---

*文档生成于 2026-07-30，对应 AutoDL 实例 connect.westc.seetacloud.com:50262。*
