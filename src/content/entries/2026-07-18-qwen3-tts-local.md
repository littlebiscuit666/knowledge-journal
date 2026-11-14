---
title: "Qwen3-TTS 本地推理方案（备忘）"
date: 2026-07-18
category: 技术
tags: [tts, qwen, 本地部署, 日记归档]
draft: false
---

> 建立时间：2026-07-18
> 文件位置：`C:\Users\yaya\Downloads\model.safetensors`
> 目标：把阿里 Qwen3-TTS-12Hz 模型在本地跑起来，能出语音。

---

## 0. 一句话现状

手上的 `model.safetensors`（3.6G）**是完整、有效的 Qwen3-TTS 主权重**，但**单独这一个文件无法推理**——还要配套「Tokenizer-12Hz 声码器」和「模型代码」才能出声音。

---

## 1. 文件诊断结论（已用脚本验证）

用 `C:\Users\yaya\Downloads\_inspect_safetensors.py` 读取文件头，结果：

| 检查项 | 结果 | 含义 |
|---|---|---|
| 格式 | `format: pt` | 标准 PyTorch safetensors ✅ |
| 顶层模块 | `talker` | Qwen3-TTS 的核心"说话头"模块 ✅ |
| codec_embedding | 16 个（`0`~`15`），每个 [2048,2048] | 对应 **Tokenizer-12Hz 的 16 codebook** ✅ |
| 参数量 | 1.917 B | ≈ 官方标的 1.7B backbone |
| dtype | 404 个张量**全是 BF16** ✅ | 是 bf16 权重 |
| 完整性 | header 正常解析、无损坏 | 文件没坏，放心 |

**文件本身没问题，不用再下。**

---

## 2. 核心认知：为什么单文件不能跑

Qwen3-TTS 出语音的链路是：

```
文字 → [主模型 LM：你的 model.safetensors] → 离散 token → [Tokenizer-12Hz 声码器] → wav 音频
```

所以除了你这个 `model.safetensors`，**还必须**有：

1. **`Qwen3-TTS-Tokenizer-12Hz`（声码器）** —— 把 token 还原成波形，没它就出不了声音。**必须单独下载。**
2. **该变体的 `config.json` + 模型代码** —— 封装在官方 `qwen-tts` 这个 pip 包里，`from_pretrained(模型名)` 会自动拉。

---

## 3. ⚠️ 待确认：你这文件到底是哪个变体？

1.7B / 12Hz 有 **3 个变体**，权重结构几乎一模一样，**无法从文件本身区分**，区别只在训练数据和调用函数：

| 变体 | 功能 | 调用函数 | 要不要参考音频 |
|---|---|---|---|
| `Qwen3-TTS-12Hz-1.7B-CustomVoice` | 9 个内置音色念字 + 情绪指令 | `generate_custom_voice` | **不用**（最省事） |
| `Qwen3-TTS-12Hz-1.7B-Base` | 声音克隆（模仿你给的音色） | `generate_voice_clone` | 要一段参考音频+文字 |
| `Qwen3-TTS-12Hz-1.7B-VoiceDesign` | 用文字描述「想要什么声音」生成 | `generate_voice_design` | 不用 |

**用错 generate 函数会报错或效果全乱。** 最准的判断办法：回想这个文件当初从哪个仓库下的（看下载链接里的 `-Base` / `-CustomVoice` / `-VoiceDesign`）。

---

## 4. 硬件结论：你这台机器

- **CPU**：Intel Core Ultra 5 225H（Arrow Lake-H）
- **核显**：Intel Arc 130T —— **是集成显卡，不是独显**，和系统内存共享，性能弱
- **内存**：32 GB（空闲约 11 GB）—— 够用
- **已有**：Python 3.11.9 + torch 2.13.0+cpu

⚠️ **Arc 130T 核显跑 1.9B 模型会很慢**（一句话几十秒起步）。而且 `qwen-tts` 官方只测过 CUDA，Intel XPU 要装 IPEX、改 `device="xpu"`、把 `flash_attention_2` 换成 `sdpa`，兼容性未知，可能要改源码。

**所以推荐分两步**：
1. 先用 **CPU** 把流程跑通（零额外环境配置，最不容易踩坑），确认能加载、能出声、是哪个变体。
2. 嫌慢再上 **XPU** 或 **AutoDL 4090**（4090 上几秒一句）。

---

## 5. 推荐方案：CPU 先跑通（以最省事的 CustomVoice 为例）

### 5.1 建干净虚拟环境（别和现有 torch 2.13 打架）

```bash
python -m venv C:\Users\yaya\qwen3-tts-env
source C:/Users/yaya/qwen3-tts-env/Scripts/activate     # git bash 激活
# PowerShell 激活: C:\Users\yaya\qwen3-tts-env\Scripts\Activate.ps1
```

### 5.2 装官方包

```bash
pip install -U qwen-tts soundfile modelscope
```

### 5.3 下载完整模型（含 config + tokenizer，光有权重不够）

```bash
modelscope download --model Qwen/Qwen3-TTS-Tokenizer-12Hz        --local_dir C:/Users/yaya/Downloads/Qwen3-TTS-Tokenizer-12Hz
modelscope download --model Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice --local_dir C:/Users/yaya/Downloads/Qwen3-TTS-12Hz-1.7B-CustomVoice
```

> 💡 如果你那 3.6G 的 `model.safetensors` **确认就是 CustomVoice**，可以把它复制进上面的目录覆盖同名 `model.safetensors`，省一次下载。不确定就别覆盖，用官方下载的。

### 5.4 CPU 推理代码（device=cpu，attn 用 sdpa，**不能用 flash_attention_2**）

```python
import torch, soundfile as sf
from qwen_tts import Qwen3TTSModel

model = Qwen3TTSModel.from_pretrained(
    "C:/Users/yaya/Downloads/Qwen3-TTS-12Hz-1.7B-CustomVoice",
    device_map="cpu",
    dtype=torch.bfloat16,
    attn_implementation="sdpa",
)

wavs, sr = model.generate_custom_voice(
    text="你好，这是一段测试语音。",
    language="Chinese",
    speaker="Vivian",      # 可选: Vivian / Serena / Uncle_Fu / Dylan / Eric / Ryan / Aiden / Ono_Anna / Sohee
    # instruct="用特别愤怒的语气说",   # 可选: 情绪指令
)
sf.write("output.wav", wavs[0], sr)
print("已保存 output.wav，采样率", sr)
```

---

## 6. 其他两个变体的代码片段（确认是哪个变体后替换 5.4）

### 6.1 Base（声音克隆）—— `generate_voice_clone`

```python
import torch, soundfile as sf
from qwen_tts import Qwen3TTSModel

model = Qwen3TTSModel.from_pretrained(
    "C:/Users/yaya/Downloads/Qwen3-TTS-12Hz-1.7B-Base",
    device_map="cpu", dtype=torch.bfloat16, attn_implementation="sdpa",
)

wavs, sr = model.generate_voice_clone(
    text="I am solving the equation: x = [-b ± √(b²-4ac)] / 2a.",
    language="English",
    ref_audio="你的参考音频.wav",          # 本地路径 / URL / base64 / (numpy, sr)
    ref_text="参考音频对应的文字内容",       # 参考音频里说的是什么
)
sf.write("output_clone.wav", wavs[0], sr)
```

### 6.2 VoiceDesign（描述生成音色）—— `generate_voice_design`

```python
import torch, soundfile as sf
from qwen_tts import Qwen3TTSModel

model = Qwen3TTSModel.from_pretrained(
    "C:/Users/yaya/Downloads/Qwen3-TTS-12Hz-1.7B-VoiceDesign",
    device_map="cpu", dtype=torch.bfloat16, attn_implementation="sdpa",
)

wavs, sr = model.generate_voice_design(
    text="哥哥，你回来啦，人家等了你好久好久了！",
    language="Chinese",
    instruct="体现撒娇稚嫩的萝莉女声，音调偏高且起伏明显。",
)
sf.write("output_design.wav", wavs[0], sr)
```

---

## 7. 进阶：想要更快

- **XPU（用你这块 Arc 130T）**：装 Intel IPEX（`intel-extension-for-pytorch`）+ oneAPI 运行时，`device_map="xpu"`，attn 仍用 `sdpa`。能比 CPU 快一些，但配置折腾、兼容性未知，不保证一次成。
- **AutoDL 4090（推荐，最快出效果）**：租一张 4090，几秒钟一句。环境用 ModelScope 镜像，模型放 `autodl-tmp`，命令几乎不用改（把 `device_map` 换回 `"cuda:0"`、attn 换回 `"flash_attention_2"` 即可）。

---

## 8. 👉 下次回来，先确认这两点

1. **这个 `model.safetensors` 当初从哪个仓库下的？**（`-Base` / `-CustomVoice` / `-VoiceDesign`？）—— 决定用哪个 generate 函数、要不要覆盖下载的权重。
2. **要不要直接在这台机器上装上跑通第一句？** 还是自己在 AutoDL 上跑？

---

## 9. 相关链接

- 官方包用法（含三种 generate 完整示例）：https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-Base
- CustomVoice（ModelScope，国内下载快）：https://modelscope.cn/models/Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice
- 在线试听 Demo：https://huggingface.co/spaces/Qwen/Qwen3-TTS
- Intel Arc 130T 规格（核显，无独立显存）：https://www.techpowerup.com/gpu-specs/arc-130t-mobile.c4269
- Intel GPU 加速 LLM（IPEX-LLM）：https://github.com/intel/ipex-llm

---

## 附：文件检查脚本（已保存在 `C:\Users\yaya\Downloads\_inspect_safetensors.py`）

以后查任何 safetensors 文件都能复用，读取文件头判断结构 / 参数量 / dtype / 完整性：

```python
import json, struct
from collections import Counter

path = r"C:\Users\yaya\Downloads\model.safetensors"

with open(path, "rb") as f:
    n = struct.unpack("<Q", f.read(8))[0]
    header = json.loads(f.read(n))

meta = header.get("__metadata__", {}) or {}
keys = [k for k in header.keys() if k != "__metadata__"]

print("=== metadata ===")
for k, v in meta.items():
    print(f"  {k}: {v}")

print("\n=== structure ===")
print("  tensor count:", len(keys))
prefixes = sorted(set(k.split(".")[0] for k in keys))
print("  top-level modules:", prefixes)

embs = [k for k in keys if "embed" in k.lower()]
print("  embed tensors:", embs[:10])
for e in embs[:6]:
    print(f"     {e}: shape={header[e].get('shape')} dtype={header[e].get('dtype')}")

total = 0
for k in keys:
    shp = header[k].get("shape", [])
    p = 1
    for d in shp:
        p *= d
    total += p
print(f"\n  approx params: {total/1e9:.3f} B")

dtypes = Counter(header[k].get("dtype") for k in keys)
print("  dtype distribution:", dict(dtypes))

for kw in ["lm_head", "spk", "speaker", "x_vector", "audio", "codebook", "instruct", "design"]:
    hits = [k for k in keys if kw in k.lower()]
    if hits:
        print(f"  contains '{kw}': {len(hits)} tensor(s), e.g. {hits[0]}")
```
