---
title: "AudioGen 音效生成 XPU 部署"
date: 2026-11-09
category: 技术
tags: [audiogen, xpu, 音效, 日记归档]
draft: false
---

## 目标
Meta AudioGen（audiogen-medium，1.5B）在本地 Intel Arc 130T 核显上生成音效（宝剑出鞘、剑盾碰撞等）。
代码和产物统一放 `D:\Bigmodel\audiogen\`。

## 11-10 进展
- ✅ 断点续传验证通过（50MB → 110MB 无缝接上）
- ✅ **ModelScope 有官方镜像 `facebook/audiogen-medium`**，CDN 5.6MB/s 不掐线：
  state_dict.bin(3.5GB) + compression_state_dict.bin(225MB) 已 curl 全量下载，
  **sha256 双双匹配 HF etag**，直接放进 HF 缓存 blobs/ 目录冒充官方文件，hub 秒级命中
- ✅ t5-base 也从 `AI-ModelScope/t5-base` 下好放 `checkpoints/t5-base/`（gen_sfx.py 有类级
  from_pretrained 重定向补丁，checkpoints/<名字>/ 有 spiece.model 就走本地）
- ⚠️ **关键发现：audiogen-medium 用的 T5 是 t5-large 不是 t5-base**（py-spy 抓挂死堆栈发现，
  T5Conditioner 传给 from_pretrained 的名字来自 ckpt 内嵌 cfg）
- ⏳ t5-large（model.safetensors 2.95GB）ModelScope 无原版镜像（只有 flan/v1.1 变体，权重不同
  不可互换），走 HF 代理续传下载中
- ⚠️ 新坑：hub 0.16 的 http_get 无读超时，socket 停滞时进程挂死不报错（py-spy 定位 SSLSocket.read），
  续传循环对"断线"有效、对"停滞"无效，需人工 kill 重试

## 当前状态（明晚继续）
- ⏸ 权重下载到 52MB / 3.68GB 时停止（state_dict.bin），断点文件在
  `~/.cache/huggingface/hub/models--facebook--audiogen-medium/blobs/*.incomplete`
- ✅ 环境全通：`torch.xpu.is_available() = True`，`from audiocraft.models import AudioGen` 成功
- ⏭ 待做：续传完权重 → `python gen_sfx.py --smoke` → 测核显生成速度 → 正式出音效

## 环境布局
- 独立 venv：`D:\Bigmodel\audiogen\.venv`（Python 3.11.9，别污染 TTS venv）
- torch 2.15.0+xpu + torchaudio 2.11.1+xpu + audiocraft 1.3.0 + transformers 4.31.0 + numpy 1.26.4
- 生成脚本 `gen_sfx.py`（--smoke / --duration / --device / --proxy 参数），产物 `output/*.wav` 16kHz

## 踩坑记录（按排障顺序）

### 1. torch 2.15+xpu 的 WinError 127（最大的坑，3小时）
`c10_xpu.dll` 加载失败：**全局 Python311 的 `Library\bin` 里有旧版 Intel 运行时**
（mkl_sycl_*.6.dll / sycl9.dll 2026.0.0），torch 初始化时把 base 解释器的 Library\bin
也加入 DLL 搜索路径，新版符号（124个里差6个）被旧版抢先解析。
- 诊断套路：pefile 解析导入表 → 对比各处 DLL 导出覆盖 → 复刻 torch 加载流程定位
- 修复：venv 里写 `sitecustomize.py`，按依赖序全路径预载
  `libmmd → ur_win_proxy_loader → pti_view-1 → sycl9 → mkl_sycl_*`（LoadLibraryExW 0x1100）
- 教训：全路径 WinDLL 默认 flags=0 不含"目标 DLL 同目录"搜索，测试时要带 0x1100

### 2. pip `--no-deps` 作用于整条命令
`pip install audiocraft --no-deps einops transformers ...` 会把后面所有包都跳过依赖解析，
transformers 的 tokenizers/requests/safetensors 全没装上。要分开两条命令跑。
连环缺口补丁清单：tokenizers<0.14、safetensors、requests、regex、pyyaml、packaging、
protobuf、colorlog、lightning-utilities、julius、soundfile、numpy、treetable、submitit、retrying

### 3. audiocraft 三个 MusicGen 专属硬导入（已打 [XPU patch]）
- `modules/transformer.py:23` `from xformers import ops` → try/except + _OpsShim
  （unbind→torch.unbind，memory_efficient_attention→SDPA）
- `modules/transformer.py:239` `LowerTriangularMask` → 哨兵类（torch 后端只判 None 性）
- `modules/conditioners.py:21` `import spacy`、`modules/chroma.py` `from librosa import filters`
  → 都只服务 MusicGen，AudioGen 不需要，置 None 即可

### 4. huggingface_hub 0.16.4 默认不续传
代理长连接 ~13 分钟被掐一次，每次从零重下。已 monkeypatch `resume_download=True`
（写 `.incomplete` + Range 续传），两个调用方（audiocraft loaders / transformers）全覆盖，
因为补丁在 import 它们之前执行。**明天下载会自动从 52MB 断点继续。**

## 权重下载信息
- 走 Clash 7890 代理直连 huggingface.co（hf-mirror 已失效：308 跳回源站）
- facebook/audiogen-medium：state_dict.bin 3.68GB + compression_state_dict.bin
- 另需 t5-base（~0.9GB，T5 文本编码器）
- 节点速度波动大：5.5MB/s → 250KB/s 都出现过

## 参考预期
- audiogen-medium 一次生成上限 10 秒（训练就是 10s 片段），输出 16kHz mono
- 核显 fp32 跑 1.5B LM 速度未知，smoke test 会给出实测
