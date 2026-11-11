---
title: "AutoDL 服务器资产盘点"
date: 2026-11-09
category: 技术
tags: [autodl, 资产盘点, 日记归档]
draft: false
---

> 连接方式：`ssh -p 5xxxx root@connect.westc.seetacloud.com`（密码 ******）
> 本地快速操控脚本：`C:\Users\yaya\.claude\tmp\autodl_ssh.py "远程命令"`（paramiko 免交互）
> 盘点当日机器处于**无卡模式**（无 GPU，只能跑 CPU 任务，省钱状态）。

---

## 一、机器概况

| 项目 | 状态 |
|---|---|
| 系统 | Ubuntu 22.04.1 LTS，内核 5.15.0，Docker 容器 |
| CPU / 内存 | 128 核 / 503G |
| GPU | 平时为 RTX 4080S（16G），2026-11-09 盘点时无卡开机未挂载 |
| 系统盘 `/` | 30G，已用 12G，可用 19G |
| 数据盘 | `/root/autodl-tmp` 共 52G |
| 公共数据盘 | `/autodl-pub` 14T（只读共享镜像区，`/autodl-pub/data` 另有 20T） |

---

## 二、系统盘 `/` 内容（重点路径）

| 路径 | 大小 | 说明 |
|---|---|---|
| `/usr` | 9.7G | 系统本体 + CUDA 相关 |
| `/root/ComfyUI` | 4.8G | ComfyUI 部署（端口 6006 网页代理），模型多为软链指向数据盘 |
| `/tmp` | 3.7G | **临时垃圾，可清** |
| `/root/miniconda3` | 1.5G | Python 主环境；conda envs 仅 `notagen` 一个 |
| `/root/talisman_lora` | 454M | 艾尔登法环护符 LoRA 微调项目（Qwen2.5-0.5B） |
| `/var` | 258M | 系统日志等 |

**`/root` 根下散落的产线脚本（漫画第2~6话生成历史）：**

- ComfyUI 工作流模板：`/root/_wf_greet.json`、`/root/_wf_garden.json`、`/root/_wf_cafe_wide.json`、`/root/_wf_fd.json`
- 分集生成脚本：`/root/gen_ep2.py` ~ `/root/gen_ep6.py`（每集带 `_fix` / `_fix2` / `_fix3` 等迭代版）
- 专项脚本：`/root/gen_cafe_wide.py`（宽幅）、`/root/gen_ep2_cover.py`（封面）、`/root/gen_greet.py`、`/root/gen_garden.py`
- 调试脚本：`/root/couple_inpaint.py`、`/root/couple_inpaint_fd.py`、`/root/couple_test.py`（双人图局部重绘试验）
- 诊断脚本：`/root/diagnose_comfy.py`、`/root/comfy_api_test.py`、`/root/test_api.py`、`/root/diffusers_test.py`

**ComfyUI 已挂模型（软链/直存）：**

- 底模：`/root/ComfyUI/models/checkpoints/animagine-xl-3.1.safetensors`
- 直存 LoRA：`/root/ComfyUI/models/loras/agelaiya_char_lora.safetensors`
- 软链 LoRA（指向 `/root/autodl-tmp/lora_train/output/`）：feicui-v1、feiying-v1、haiseyin-v1 等

---

## 三、数据盘 `/root/autodl-tmp` 内容（52G）

### `/root/autodl-tmp/models/` — 20G，模型权重

| 路径 | 大小 | 用途 |
|---|---|---|
| `/root/autodl-tmp/models/Qwen3-4B` | 7.6G | LLM 聊天/微调底座（6008 聊天页） |
| `/root/autodl-tmp/models/animagine-xl-3.1` | 6.5G | 动漫风 SDXL 出图底模（漫画产线用） |
| `/root/autodl-tmp/models/Qwen3-TTS-12Hz-1.7B-CustomVoice` | 4.3G | 语音合成（CustomVoice 定制音色） |
| `/root/autodl-tmp/models/weights_notagen_pretrain_....pth` | 1.3G | NotaGen 古典乐谱生成预训练权重 |

### `/root/autodl-tmp/lora_train/` — 17G，kohya LoRA 训练全环境

| 路径 | 大小 | 说明 |
|---|---|---|
| `/root/autodl-tmp/lora_train/output/` | 9.4G | **训练成品**：feicui / feiying / haiseyin / heitiane / kafuka 等角色 LoRA（每角色 v1 + v1-000014 两个版本，safetensors） |
| `/root/autodl-tmp/lora_train/env/` | 7.2G | 训练用 Python 环境（含可复用 torch） |
| `/root/autodl-tmp/lora_train/dataset/` | 409M | 训练图集 |
| `/root/autodl-tmp/lora_train/sd-scripts/` | 50M | kohya sd-scripts 训练框架 |
| `/root/autodl-tmp/lora_train/logs/` | 6.5M | 训练日志 |

### 其余项目目录

| 路径 | 大小 | 说明 |
|---|---|---|
| `/root/autodl-tmp/envs/hy3d` | 5.6G | Hunyuan3D 专用 Python 环境 |
| `/root/autodl-tmp/hunyuan3d-mini` | 4.2G | Hunyuan3D-mini 图生3D（infer.py + 6008 Gradio） |
| `/root/autodl-tmp/output/` | 2.8G | 李白诗风 LoRA 成品：`libai-lora`（2.2G）+ `libai-lora-v2`（639M） |
| `/root/autodl-tmp/zcodeworkspace/` | 1014M | **ZCode AI 视频工作区**（详见下） |
| `/root/autodl-tmp/NotaGen/` | 1.3G | NotaGen 乐谱生成仓库 |
| `/root/autodl-tmp/comic_ep1/` ~ `comic_ep6/` | 19~61M/话 | 漫画第1~6话成品 PNG（`ep6_01.png` 等命名） |
| `/root/autodl-tmp/qwen3-tts/` | 3.9M | TTS 推理脚本（infer.py / app.py Gradio） |
| `/root/autodl-tmp/libai/` | 140K | 李白 LoRA 训练配置 |
| `/root/autodl-tmp/data/` | 4.7M | 杂项数据 |
| `/root/autodl-tmp/verify/` | 14M | 验收输出 |
| `/root/autodl-tmp/gen_ep1.py` 等 | <12K | 数据盘侧的分集脚本副本 |

### `/root/autodl-tmp/zcodeworkspace/` — AI 视频制作区

| 路径 | 说明 |
|---|---|
| `/root/autodl-tmp/zcodeworkspace/OpenMontage/` | AI 视频制作系统仓库（已 make setup，含 CLAUDE.md/AGENT_GUIDE.md） |
| `/root/autodl-tmp/zcodeworkspace/scripts/` | 全部出片脚本：`run_pipeline`（一键编排）/ `tts_qwen` / `gen_stills` / `build_video_cine`（电影感）/ `make_layers`（2.5D）/ `autodl_art`（云视频API） |
| `/root/autodl-tmp/zcodeworkspace/models/piper/` | Piper 中文音色（63MB，**无卡模式备胎**） |
| `/root/autodl-tmp/zcodeworkspace/video_projects/bianlidian01/` | 《凌晨两点的便利店》：`final.mp4` / `final_v2.mp4`（电影感35s）/ `bullettime_test.mp4`（2.5D试验6.5s）/ `art_out/`（云生成子弹时间5s） |
| `/root/autodl-tmp/zcodeworkspace/video_projects/demo01/` | 流水线验证片（占位画面版） |
| `/root/autodl-tmp/zcodeworkspace/.art_token` | AutoDL.Art API 密钥（600 权限，过期需重建） |
| `/root/autodl-tmp/zcodeworkspace/SERVER_MAP.md` | 服务器地图（含 §10 AI 视频制作全记录） |

---

## 四、常驻服务（盘点时在跑）

| 进程 | 说明 |
|---|---|
| `tensorboard` | 训练监控面板 |
| `autopanel serve`（工作目录 `/root/autodl-tmp`） | AutoDL 自带文件面板 |
| `jupyter-lab` | Jupyter 网页 |
| `proxy` + `supervisord` | AutoDL 基础设施 |

---

## 五、这台机器能干什么（按当前状态）

**无卡模式（零 GPU 费）现在就能跑：**

1. AI 视频流水线 — `zcodeworkspace/scripts/run_pipeline` + Piper TTS（本来就是无卡备胎设计）
2. 数据整理 / 打标 / 上传 / 清 `/tmp`（3.7G）
3. NotaGen 乐谱生成（CPU 推理慢但能跑）

**切 GPU 模式后，六条产线全部现成：**

1. ComfyUI 出图 → 6006 代理网页（animagine-xl-3.1 + 角色 LoRA 全就绪）
2. 角色 LoRA 训练 — kohya 环境，4080S 约 40min/个
3. Qwen3-4B 聊天页 → 6008
4. Qwen3-TTS 语音合成
5. Hunyuan3D 图生3D
6. 漫画续更 — 抄 `/root/gen_ep6.py` 模板写 `gen_ep7.py` 即可

---

## 六、同步回本地的命令（备忘）

```bash
mkdir -p /c/Users/yaya/zcodeworkspace
scp -P 5xxxx root@connect.westc.seetacloud.com:/root/autodl-tmp/zcodeworkspace/'*' /c/Users/yaya/zcodeworkspace/
```
