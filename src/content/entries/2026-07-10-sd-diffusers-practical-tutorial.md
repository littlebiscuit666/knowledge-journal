---
title: "Stable Diffusion 出图实战教程：从部署到实践"
date: 2026-07-10
category: 技术
tags: [sd, diffusers, autodl, lora, 日记归档]
draft: false
---

> 本教程记录了一次在 AutoDL/seetacloud GPU 服务器上，从零搭起 Stable Diffusion 出图环境、调参、换二次元模型、做图生图、尝试 LoRA 的完整过程。目标是**不依赖 AI**也能一步步复现。
>
> 所有命令、脚本、踩过的坑都来自真实操作。每一节都有"为什么这么做"的说明。

---

## 0. 全局认知（先读这个）

在开始之前，先建立 5 个关键认知，能少走 90% 的弯路：

1. **AutoDL 容器连不上 HuggingFace 和 Civitai**（国外站点），但 **ModelScope（魔搭）和 hf-mirror.com（HF 国内镜像）能连**。下模型、拉配置都走这两个。
2. **服务器上的 Python 不在默认 PATH 里**，要用 `/root/miniconda3/bin/python`，或先 `export PATH=/root/miniconda3/bin:$PATH`。直接敲 `python` 会"command not found"。
3. **`from_single_file()` 不是纯本地操作**——它吃你的权重文件，但还要联网下载 pipeline 的 config（结构定义 json）。所以必须配镜像环境变量，否则报 `Network is unreachable`。
4. **SD1.5 基础模型偏写实**，画二次元要换专门的二次元模型（如 Counterfeit）。提示词对 SD1.5 **基本只能用英文**（文本编码器 CLIP 是英文训练的）。
5. **LoRA 必须和底模架构匹配**——SD1.5 的 LoRA 只能挂 SD1.5 模型，不能挂到 FLUX/Qwen-Image 上（反之亦然）。这是最容易踩的坑。

---

## 1. 服务器连接

```bash
ssh -p 1xxxx root@connect.nmb1.seetacloud.com
# 密码：******
```

连上后是一台 AutoDL 容器（seetacloud 底层就是 AutoDL）。

### 1.1 确认硬件和软件环境

```bash
nvidia-smi --query-gpu=name,memory.total --format=csv
# 本次机器：NVIDIA GeForce RTX 4090, 24564 MiB（24GB）

/root/miniconda3/bin/python -c "import torch, diffusers; print('torch', torch.__version__, 'cuda', torch.cuda.is_available(), 'diffusers', diffusers.__version__)"
# 本次输出：torch 2.6.0+cu124  cuda True  diffusers 0.39.0
```

> **关键**：torch / diffusers / transformers 在这台机器上已经预装好了（AutoDL 的镜像带的）。你只需要会用，不用自己装。

### 1.2 测试网络连通性（决定后面从哪下东西）

```bash
curl -sI -m 10 https://www.modelscope.cn     | head -1   # HTTP/1.1 200 OK  → 通
curl -sI -m 10 https://hf-mirror.com         | head -1   # HTTP/2 200       → 通
curl -sI -m 10 https://huggingface.co        | head -1   # (空)            → 不通
curl -sI -m 10 https://civitai.com           | head -1   # (空)            → 不通
```

**结论**：模型从 **ModelScope** 下，diffusers 的 config / HF 上的 LoRA 从 **hf-mirror.com** 下。

---

## 2. 工作目录约定

```bash
mkdir -p /01-try                         # 脚本和练习文件放这里
mkdir -p /root/autodl-tmp/models         # 模型权重放这里（autodl-tmp 是数据盘，空间大）
```

> AutoDL 上 `/root` 是系统盘（小），`/root/autodl-tmp` 是数据盘（大）。**模型一定要放 autodl-tmp**，否则空间不够。

---

## 3. 获取模型

做 SD 出图，推荐用二次元模型 **Counterfeit-V2.5**（效果好看、用途广，后面的出图/图生图都基于它）。从 ModelScope 下它的 fp16 单文件（只有 2GB，省时间省显存）：

新建 `/01-try/dl_counterfeit.py`：

```python
from modelscope.hub.snapshot_download import snapshot_download

p = snapshot_download(
    'AI-ModelScope/Counterfeit-V2.5',
    cache_dir='/root/autodl-tmp/models/checkpoints/',
    allow_patterns=['Counterfeit-V2.5_fp16.safetensors'],   # 只下这一个文件，别下整个仓库
)
print("下载完成，文件在:", p)
```

运行（约 2 分钟，18MB/s）：

```bash
export PATH=/root/miniconda3/bin:$PATH
cd /01-try && python dl_counterfeit.py
```

下完后，权重路径是：
```
/root/autodl-tmp/models/checkpoints/models/AI-ModelScope--Counterfeit-V2.5/snapshots/master/Counterfeit-V2.5_fp16.safetensors
```

> **为什么用 `_fp16` 版本？** fp16 = 半精度，体积小一半（2GB vs 4GB+）、加载快、省显存，正好配 `torch_dtype=torch.float16`。文件 2GB 也正好印证它是 SD1.5（SDXL fp16 会是 6.5GB）。

### 3.1 如何自己找模型（ModelScope 搜索）

```bash
# 搜索 API（PUT 请求）
curl -s -X PUT "https://modelscope.cn/api/v1/dolphin/models" \
  -H "Content-Type: application/json" \
  -d '{"Name":"counterfeit","SortBy":"Default","PageSize":10,"PageNumber":1}' \
  | python -c "import sys,json; d=json.load(sys.stdin); [print(m['Path']+'/'+m['Name'], '下载',m.get('Downloads',0)) for m in d['Data']['Model']['Models']]"

# 查看某模型的文件列表和大小
curl -s "https://modelscope.cn/api/v1/models/AI-ModelScope/Counterfeit-V2.5/repo/files?Revision=master&Root=" \
  | python -c "import sys,json; d=json.load(sys.stdin); [print(f'{f[\"Size\"]/1e9:.2f}GB', f['Path']) for f in d['Data']['Files'] if (f.get('Size',0) or 0)>1e8]"

# 看 README（含 base_model、触发词等关键信息）
curl -s "https://modelscope.cn/api/v1/models/AI-ModelScope/Counterfeit-V2.5/repo?Revision=master&FilePath=README.md" | head -30
```

---

## 4. 第一次出图（文生图）

新建 `/01-try/gen_text2img.py`：

```python
import os
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"   # 【关键修复1】from_single_file 要联网拉 config，走镜像
import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler

MODEL = "/root/autodl-tmp/models/checkpoints/models/AI-ModelScope--Counterfeit-V2.5/snapshots/master/Counterfeit-V2.5_fp16.safetensors"

pipe = StableDiffusionPipeline.from_single_file(
    MODEL,
    torch_dtype=torch.float16,        # 半精度，省显存、更快
).to("cuda")                          # 搬到 GPU 上

pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)  # 换更快的采样器

image = pipe(
    "a futuristic RTX 4090 graphics card, cyberpunk neon, highly detailed",
    negative_prompt="lowres, blurry, text, watermark",
    num_inference_steps=25,           # 去噪步数
    guidance_scale=7.5,               # 提示词引导强度(CFG)
    width=512, height=512,            # 分辨率(必须是8的倍数，SD1.5原生512)
).images[0]

image.save("/01-try/output.png")      # 【关键修复2】一定要 save，否则图就丢了！
print("已保存: /01-try/output.png")
```

运行：

```bash
export PATH=/root/miniconda3/bin:$PATH
cd /01-try && python gen_text2img.py
```

### ⚠️ 两个最容易踩的坑（本教程核心）

| 坑 | 现象 | 原因 | 解决 |
|---|---|---|---|
| **联网失败** | `httpx.ConnectError: Network is unreachable` / `LocalEntryNotFoundError` | `from_single_file` 要去 HuggingFace 下 config json，AutoDL 连不上 | 脚本最前面（import diffusers 之前）加 `os.environ["HF_ENDPOINT"]="https://hf-mirror.com"` |
| **没存图** | 脚本跑完没报错，但磁盘上没有图 | 只 `pipe(...)` 取了图，没 `image.save()` | 加一行 `image.save("xxx.png")` |

---

## 5. 从部署到出图的完整流程（理解原理）

```
① 部署(环境)          ② 加载模型(load)               ③ 推理生成(generate)
─────────────        ─────────────────────          ────────────────────
AutoDL容器            from_single_file(权重)           pipe(prompt)
+ CUDA/torch          ├ 解析权重的 key 映射             ├ CLIP 把 prompt 编码成向量
+ diffusers           ├ 从镜像拉 config(结构定义)        ├ UNet 循环去噪 N 步
+ GPU                 └ 组装 pipeline                  ├ VAE 把潜空间解码成像素
.to("cuda")                                            └ 返回 PIL Image → save()
```

- **②加载**是一次性开销（几秒～十几秒）
- **③生成**每张约 1～2 秒
- `pipe` 对象加载一次后可以反复用，**不要每张图都重新加载模型**

---

## 6. 出图参数完全指南

### 6.1 控制"出什么图 / 能否复现"

| 参数 | 作用 | 建议 |
|---|---|---|
| `prompt` | 正向提示词，主体/风格 | 主体+风格+细节 |
| `negative_prompt` | 反向提示词，排除不想要的 | `lowres, blurry, deformed, text` |
| `guidance_scale` (CFG) | 提示词引导强度，默认7.5 | 高→更贴prompt易过饱和；低→更自由 |
| `num_inference_steps` | 去噪步数，默认50 | 20~50；太少糊，太多边际递减 |
| `width`/`height` | 分辨率，**必须8的倍数** | SD1.5原生512×512，别直接出1024 |
| `generator` | 随机种子 | **固定seed=每次出一样的图**，复现关键 |
| `num_images_per_prompt` | 一次出几张 | 多出几张挑最好的 |

> **复现的关键**：`generator = torch.Generator("cuda").manual_seed(42)`。固定种子后，只要 prompt 和参数不变，每次生成的图像素级一致。

### 6.2 优化速度/显存

| 手段 | 作用 |
|---|---|
| `torch_dtype=torch.float16` | 半精度，省一半显存、更快（已用） |
| `pipe.enable_attention_slicing()` | 分块算 attention，省显存（内置，免装） |
| `pipe.enable_xformers_memory_efficient_attention()` | 装了 xformers 才能用，又快又省 |

### 6.3 采样器（scheduler）

默认 PNDM（50步）。换成 DPM++ 可以**更少步数、同等质量**：
```python
from diffusers import DPMSolverMultistepScheduler
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
# 之后 20~25 步就能出不错的图
```

### 6.4 参数对比网格脚本（直观学参数）

把 `num_inference_steps`（行）和 `guidance_scale`（列）各取3档，出 3×3 = 9 张拼成一张大图，一眼看清两个参数的作用：

```python
# /01-try/compare_params.py
import os
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
import torch
from PIL import Image, ImageDraw, ImageFont
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler

MODEL = "/root/autodl-tmp/models/checkpoints/models/AI-ModelScope--Counterfeit-V2.5/snapshots/master/Counterfeit-V2.5_fp16.safetensors"
pipe = StableDiffusionPipeline.from_single_file(MODEL, torch_dtype=torch.float16).to("cuda")
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

PROMPT = "a futuristic RTX 4090 graphics card, cyberpunk neon, highly detailed"
NEG = "lowres, blurry, text, watermark"
SEED = 42
steps_list    = [15, 25, 40]      # 行
guidance_list = [3.0, 7.5, 12.0]  # 列
SZ, LABEL_H = 512, 28

try: font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
except: font = ImageFont.load_default()

def gen(steps, cfg):
    g = torch.Generator("cuda").manual_seed(SEED)
    return pipe(prompt=PROMPT, negative_prompt=NEG, num_inference_steps=steps,
                guidance_scale=cfg, width=SZ, height=SZ, generator=g).images[0]

cols, rows = len(guidance_list), len(steps_list)
grid = Image.new("RGB", (cols*SZ, rows*(SZ+LABEL_H)), "white")
draw = ImageDraw.Draw(grid)
for r, s in enumerate(steps_list):
    for c, cfg in enumerate(guidance_list):
        img = gen(s, cfg)
        x, y = c*SZ, r*(SZ+LABEL_H)
        grid.paste(img, (x, y+LABEL_H))
        draw.text((x+6, y+6), f"steps={s} cfg={cfg}", fill="black", font=font)
        print(f"done steps={s} cfg={cfg}")
grid.save("/01-try/params_grid.png")
print("OK: /01-try/params_grid.png")
```

**读图方法**：横着看 cfg↑（更贴词但易过饱和），竖着看 steps↑（更精细但边际递减）。

---

## 7. 图生图（img2img）——参考你的图生成新图

> "图生图"不是模型的功能开关，而是**换一种调用方式**（同一个权重，用 `StableDiffusionImg2ImgPipeline`）。零额外下载。

**核心参数 `strength`（0~1）**：
- 低（0.3~0.4）→ 几乎保留原图，只微微改风格
- 中（0.5~0.6）→ 保留构图，明显重绘（通常最想要的）
- 高（0.7~0.9）→ 大幅重画，原图只剩大致轮廓

```python
# /01-try/gen_img2img.py
import os
os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"
import torch
from PIL import Image, ImageDraw, ImageFont
from diffusers import StableDiffusionImg2ImgPipeline, DPMSolverMultistepScheduler

MODEL = "/root/autodl-tmp/models/checkpoints/models/AI-ModelScope--Counterfeit-V2.5/snapshots/master/Counterfeit-V2.5_fp16.safetensors"
pipe = StableDiffusionImg2ImgPipeline.from_single_file(MODEL, torch_dtype=torch.float16).to("cuda")
pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

# 1. 读输入图：透明背景合成到白底 + 缩到512（SD1.5最佳分辨率）
src = Image.open("/01-try/input.png").convert("RGBA")
init = Image.alpha_composite(Image.new("RGBA", src.size, (255,255,255,255)), src).convert("RGB")
init = init.resize((512, 512), Image.LANCZOS)

PROMPT = "...用英文描述你想要的内容..."
NEG = "lowres, blurry, text, watermark"

# 2. 用不同 strength 出对比
for strength in [0.4, 0.6, 0.8]:
    g = torch.Generator("cuda").manual_seed(42)
    img = pipe(prompt=PROMPT, negative_prompt=NEG, image=init,
               strength=strength, guidance_scale=7.0,
               num_inference_steps=30, generator=g).images[0]
    img.save(f"/01-try/img2img_s{int(strength*100)}.png")
    print(f"done strength={strength}")
```

**注意**：
- 输入图有透明背景时，要先合成到白底（SD 不吃 alpha 通道）
- 输入分辨率大（如1024）要缩到 512，SD1.5 在 512 出图最稳
- 最经典玩法：**照片转二次元**——换张真人照，prompt 写动漫描述，strength 0.5~0.6

---

## 8. 提示词（prompt）体系

### 8.1 只能用英文吗？

对 SD1.5/Counterfeit：**实际上只能英文**。原因：文本编码器是 CLIP，英文训练的，中文它"听不懂"（基本被无视）。反向提示词同理要英文。

想用中文的三条路：
1. **翻译后喂英文**（最省事，推荐）
2. **换中文模型** Taiyi 太乙（`AI-ModelScope/Taiyi-Stable-Diffusion-1B-Chinese-v0.1`，ModelScope 有，原生懂中文，但偏写实）
3. 更新的多语言模型（SDXL/FLUX，但要换大模型）

### 8.2 标签体系是什么？所有模型都有吗？

**不是所有模型都有**。取决于训练数据的标注方式：

| 模型类型 | 爱听什么 | 例子 |
|---|---|---|
| 二次元模型 | Danbooru **标签**（逗号分隔）`1girl, chibi, silver hair` | Counterfeit、AnythingV5 |
| 写实/通用模型 | **自然语言**句子 `a cat sitting on a table` | SD1.5基模、SDXL、FLUX |
| 中文模型 | 中文 | Taiyi |

但标签**不是固定菜单**——文本编码器本质是语言模型，输任何文本都能切词，只是模型只"学过"特定类型。所以是"软"的，用模型训练时的那种语言效果最好。

### 8.3 标签能提前知道吗？

能。Danbooru 标签是公开标准：
- **Danbooru 标签 Wiki**：`danbooru.donmai.us/wiki_pages/tag_groups`（数千个标准化标签，分门别类）
- **模型卡**：Civitai/ModelScope 页面会写推荐提示词和触发词
- **LoRA 必有触发词**：用某 LoRA 时 prompt 必须包含它规定的词
- 常用二次元标签：`masterpiece, best quality`（质量）/ `1girl, solo`（主体）/ `silver hair, long hair`（头发）/ `looking at viewer`（视角）

---

## 9. LoRA（进阶，含踩坑记录）

### 9.1 LoRA 是什么

LoRA = 一个几十~百 MB 的"风格小模型"，挂到大模型上微调风格。优点：不用换整个模型，灵活、可叠加、可调强度。

### 9.2 加载方法（机制）

```python
pipe.load_lora_weights("/path/to/xxx.safetensors")          # 挂载
image = pipe("...", cross_attention_kwargs={"scale": 0.8})  # scale 调强度 0~1
pipe.disable_lora()   # 临时关掉
pipe.enable_lora()    # 再打开
```

依赖：需要装 `peft` 库（`pip install peft -i https://pypi.tuna.tsinghua.edu.cn/simple`），否则报 `PEFT backend is required`。

### 9.3 ⚠️ 踩坑记录（重要！）

本次尝试 LoRA **最终没有完全跑通**，踩了一串坑，记录如下供避雷：

**坑1：架构不匹配（最高频）**
- 现象：`load_lora_weights` 不报错，但 `get_active_adapters()` 返回 `[]`，出图毫无变化
- 诊断：`No LoRA keys associated to UNet ... found with the prefix='unet'`
- 根因：LoRA 是为别的底模训练的。检查 LoRA 文件的 key：
  ```bash
  /root/miniconda3/bin/python -c "
  from safetensors.torch import load_file
  ks=list(load_file('xxx.safetensors').keys())
  print(ks[:5])
  "
  ```
  - SD1.5 的 LoRA：key 是 `lora_unet_down_blocks...` 或 `unet.down_blocks...`
  - FLUX/SD3 的 LoRA：key 是 `transformer.double_stream_modulation...`、`transformer.context_embedder...` ← **这种挂不到 SD1.5**
- **教训：LoRA 必须和底模同架构。** ModelScope/liblib 上现在很多风格 LoRA 已迁移到 FLUX/Qwen-Image，SD1.5 的反而少。

**坑2：吉伊卡哇 LoRA 也是 Qwen-Image / FLUX 的**（ModelScope 上那几个），挂不到 SD1.5 的 Counterfeit。

**坑3：Kohya 格式 SD1.5 LoRA 在 diffusers 0.39.0 有 bug**
- 现象：`IndexError: list index out of range`（在 `get_peft_kwargs` 解析 text encoder 的 rank 时）
- 根因：diffusers 0.39.0 加载 Kohya（A1111/Civitai 常见格式）LoRA 时的 rank 推断 bug
- **本次未解决就停手了**。可能的解法（下次继续试）：
  1. 找 **diffusers 原生格式**的 SD1.5 LoRA（key 是 `unet.xxx.lora_A.weight`，不是 kohya 的 `lora_unet_xxx_lora_up`）——这种能直接加载
  2. 手动把 LoRA 权重"烘焙"进 UNet（`W_new = W + (alpha/rank) * (lora_up @ lora_down)`），绕过 diffusers 加载器
  3. **用 ComfyUI**（服务器上 `/root/autodl-tmp/ComfyUI/` 已装）——ComfyUI 对 Civitai/Kohya LoRA 的兼容性远好于 diffusers，是玩 LoRA 的首选

---

## 10. 常见报错速查表

| 报错 | 原因 | 解决 |
|---|---|---|
| `python: command not found` | 非交互 shell 没加载 conda 的 PATH | 用 `/root/miniconda3/bin/python` 或 `export PATH=/root/miniconda3/bin:$PATH` |
| `Network is unreachable` / `LocalEntryNotFoundError` | from_single_file 联网拉 config 失败 | `os.environ["HF_ENDPOINT"]="https://hf-mirror.com"`（import diffusers 前） |
| 脚本跑完没图 | 漏了 save | 加 `image.save("x.png")` |
| `PEFT backend is required` | 没装 peft | `pip install peft -i https://pypi.tuna.tsinghua.edu.cn/simple` |
| `get_active_adapters()` 返回 `[]` / 出图无变化 | LoRA 架构不匹配 | 检查 LoRA key，换成同架构的 LoRA |
| `No LoRA keys ... found with prefix='unet'` | LoRA 不是该底模的 | 同上 |
| `IndexError ... get_peft_kwargs` | Kohya LoRA 在 diffusers 0.39 的 bug | 换 diffusers 原生格式 LoRA / 手动烘焙 / 用 ComfyUI |
| 模型文件 `.incomplete` | 下载被中断没下完 | 重新运行下载脚本，会断点续传 |

---

## 11. 附录：本次生成的脚本清单（都在 `/01-try/`）

| 文件 | 作用 | 状态 |
|---|---|---|
| `dl_counterfeit.py` | 从 ModelScope 下 Counterfeit 模型 | ✅ 可用 |
| `gen_text2img.py`（教程里的标准版） | 文生图出图 | ✅ 可用 |
| `compare_params.py` | steps×cfg 参数对比网格 | ✅ 可用 |
| `gen_img2img.py` | 图生图 strength 对比 | ✅ 可用 |
| `06-python-chiikawa-prompt.py` | 纯 prompt 近似吉伊卡哇风 | ✅ 可用（效果不神似） |
| `07-python-lora.py` | LoRA 加载演示 | ⚠️ 卡在 Kohya 格式 bug，未跑通 |

---

## 12. 一句话要点回顾

1. 服务器 Python 是 `/root/miniconda3/bin/python`，模型放 `/root/autodl-tmp/`
2. AutoDL 只通 ModelScope + hf-mirror，`HF_ENDPOINT` 必设
3. 出图 = `from_single_file` + `to("cuda")` + `pipe(prompt)` + **`image.save()`**
4. 调图：`guidance_scale`、`num_inference_steps`、固定 `seed`、换 `scheduler`
5. 图生图：换 `StableDiffusionImg2ImgPipeline`，调 `strength`
6. 提示词对 SD1.5 只能英文，二次元用 danbooru 标签
7. LoRA 必须同架构，且 diffusers 0.39 对 Kohya 格式有 bug——玩 LoRA 首选 ComfyUI

祝复现顺利！休息好下次继续。
