---
title: "AutoDL westc 服务器文件路径地图"
date: 2026-08-09
category: 技术
tags: [autodl, 服务器, 速查, 日记归档]
draft: false
---

> **实例**: `connect.westc.seetacloud.com:5xxxx` · root · 密码 `********`
> **GPU**: RTX 4080 SUPER 32G · CUDA 13.2 · 系统盘 `/` + 数据盘 `/root/autodl-tmp`(50G, 持久)
> **更新**: 2026-08-03(原始); 2026-08-09 同步端口/节点/工作流变化 — 完整更新见《AutoDL-ComfyUI更新-2026-08-09.md》

---

## 0. 连接方式

```
ssh -p 5xxxx root@connect.westc.seetacloud.com     # 密码 ******
```
本机 paramiko 工具（推荐，免交互）：`C:\Users\yaya\autodl_ssh.py`
```
AUTODL_HOST=connect.westc.seetacloud.com AUTODL_PORT=5xxxx AUTODL_USER=root AUTODL_PASS='******' python ~/autodl_ssh.py '<远程命令>'
```
> ⚠️ Git Bash 下给 paramiko 脚本传 `/root/...` 路径参数要加 `MSYS_NO_PATHCONV=1`，否则路径被转成 `C:/Program Files/Git/root/...` 传到垃圾位置。

---

## 1. 模型文件

### 1.1 SDXL 底模（训练 + ComfyUI 共用，diffusers 目录版，6.5G）
`/root/autodl-tmp/models/animagine-xl-3.1/`
```
unet/diffusion_pytorch_model.safetensors      ← ComfyUI 软链为 animagine_unet
vae/diffusion_pytorch_model.safetensors       ← 软链为 animagine_vae
text_encoder/model.safetensors                ← 软链为 clip_l_animagine
text_encoder_2/model.safetensors              ← 软链为 clip_g_animagine
tokenizer/, tokenizer_2/, scheduler/, feature_extractor/  等
```

### 1.2 其他项目模型（同目录下）
`/root/autodl-tmp/models/`
- `Qwen3-4B/` — LLM，qwen3-chat 用
- `Qwen3-TTS-12Hz-1.7B-CustomVoice/` — TTS
- `weights_notagen_pretrain_*.pth` — NotaGen 古典乐谱生成

---

## 2. ComfyUI

### 2.1 程序目录（系统盘）
`/root/ComfyUI/`
- `main.py` — 入口
- `models/` — 模型加载根目录（各子目录见下）
- `custom_nodes/` — `ComfyUI-Manager/`、`ComfyUI-ComfyCouple/`(双人/情侣)、`ComfyUI-Impact-Pack/`、`ComfyUI-Impact-Subpack/`(8/9 新增,补齐 skimage → **Detailer 现已可用**)、`websocket_image_save.py`
- `output/` — **出图保存目录**
- `input/`、`user/`、`temp/`

### 2.2 底模软链（0 占空间，指向 §1.1）
| ComfyUI 路径 | → 指向 |
|---|---|
| `models/unet/animagine_unet.safetensors` | animagine `unet/` |
| `models/vae/animagine_vae.safetensors` | animagine `vae/` |
| `models/clip/clip_l_animagine.safetensors` | animagine `text_encoder/` |
| `models/clip/clip_g_animagine.safetensors` | animagine `text_encoder_2/` |

> 因为底模是组件软链（不是单文件 checkpoint），工作流要用 `UNETLoader + DualCLIPLoader(clip_l+clip_g, sdxl) + VAELoader`，不能用默认 `Load Checkpoint`。

### 2.3 LoRA 软链（指向 §4 的 output）
`/root/ComfyUI/models/loras/*.safetensors` — 共 52 个，含 12 角色各 `-v1` + `-v1-000014`，例如：
```
kafuka-v1.safetensors         → /root/autodl-tmp/lora_train/output/kafuka-v1.safetensors
heitiane-v1.safetensors       → .../heitiane-v1.safetensors
kafuka-v1-000014.safetensors  → ...（第 14 epoch 备选）
```

### 2.4 启动 / 部署脚本
| 路径 | 用途 |
|---|---|
| `/root/cfy.sh` | **启动 ComfyUI:6005**(8/9 起,原记 6006) `nohup .../env/bin/python main.py --listen 0.0.0.0 --port 6005` |
| `/root/autodl-tmp/c.log` | ComfyUI 运行日志 |
| `/root/deploy_comfyui.sh` | 一键部署（clone+软链+pip+启动） |
| `/root/setup_and_run_comfyui.sh` | 部署并运行 |
| `/root/comfy_api_test.py` | API 方式出图测试 |
| `/root/dl_model.sh` | hf-mirror 下载模型 |

> ⚠️ `cfy.sh` 内部 `nohup ... &` 没有 `</dev/null`。通过 `autodl_ssh.py` 启动时必须 `setsid bash /root/cfy.sh </dev/null`，否则 ComfyUI 持有 ssh channel 的 stdin，命令会卡死（远端服务其实已起来）。

---

## 3. LoRA 训练

### 3.1 根目录
`/root/autodl-tmp/lora_train/`
```
env/         Python 3.10.8 venv（torch 2.13 cu130，训练 + ComfyUI 共用）
sd-scripts/  kohya 训练代码（sdxl_train_network.py）
scripts/     配置 + 启动脚本（见 §3.2）
dataset/img/ 各角色数据集（见 §3.4）
logs/        训练日志 + run_all.status
output/      LoRA 产物（见 §3.3）
```

### 3.2 训练脚本（`scripts/`）
| 文件 | 用途 |
|---|---|
| `config.toml` / `dataset.toml` | 模板（yeshunguang 版，dim32/TE双训/质量三件套/15epoch=570步） |
| `config_<char>.toml` / `dataset_<char>.toml` | 各角色配置，由 `run_all*.sh` 用 sed 从模板派生 |
| `run_all.sh` | 批量训 7 角色（feicui/haiseyin/liuying/robin/tingyun/xiadie/xiaoba） |
| `run_all_kh.sh` | 批量训 kafuka + heitiane |
| `run_train.sh` | 单角色启动（yeshunguang） |
| `run_train_ruanmei.sh` / `run_webui.sh` / `webui.py` | 早期单角色 / 老 webui |
| `setup_env.sh` | 建 venv 环境 |
| `infer_feiying.py` | 推理对比网格（挑 epoch 甜点） |
| `upload_yeshunguang.py` | SFTP 上传数据集+脚本 |

### 3.3 已训练角色（`output/`，共 12 个）
每个角色产出 `<char>-v1.safetensors`（final，第 15 epoch）+ `<char>-v1-000014.safetensors`（备选），单文件 ~228MB / fp16：
```
agelaiya  ruanmei  feiying          （早期 3 个）
feicui  haiseyin  liuying  robin  tingyun  xiadie  xiaoba   （批量 7 个，2026-07-29）
yeshunguang  kafuka  heitiane       （最近 3 个，2026-08-02/03）
```
> 中间 epoch（11/12/13）已于 2026-08-03 清理，每角色只留 14 + final。

### 3.4 数据集（服务器）
`/root/autodl-tmp/lora_train/dataset/img/<char>/` — 12 角色，各 15 图（png/jpg/webp）+ 15 caption（`.txt`），caption 首位 token 为 `<char>_char`（dataset.toml `keep_tokens=1` 保护）。

### 3.5 训练日志
`/root/autodl-tmp/lora_train/logs/`
- `<char>.log` — 各角色训练日志（看 loss / 报错）
- `run_all.status` / `run_all_kh.status` — 批量训练进度（START/DONE/FAIL 时间戳）

---

## 4. 数据集（本机）

`C:\Users\yaya\Pictures\lora_<char>_dataset\` — 各角色源数据集，`train/` 下 15 图 + 15 txt：
```
agelaiya  feicui  feiying  hachiware  haiseyin  heitiane  kafuka  liuying  ...
```
> `hachiware` 本机有数据集但服务器未训练。

上传用副本：`C:\Users\yaya\.claude\tmp\<char>_peek\train\`（heitiane / kafuka / yeshunguang）

---

## 5. 本机工具脚本

### 5.1 连接 / 上传
| 路径 | 用途 |
|---|---|
| `C:\Users\yaya\autodl_ssh.py` | SSH 执行远程命令（paramiko，env 配 host/port/pass） |
| `~/.claude/tmp/autodl_ssh.py` | 同上副本 |
| `~/.claude/tmp/autodl_upload.py` | SFTP 上传整个目录 |
| `~/.claude/tmp/autodl_upload_westc.py` | base64-over-exec 上传单文件（用法：`python ... <local> <remote>`） |

### 5.2 训练 / 部署（与服务器同名脚本的本地源）
`C:\Users\yaya\.claude\tmp\`
- `deploy_comfyui.sh` — ComfyUI 一键部署
- `run_all.sh` / `run_all_kh.sh` / `run_train.sh` / `setup_env.sh` — 训练启动
- `upload_batch.py` — 批量上传数据集
- `hf_download.py` — hf-mirror 下载模型
- `prep_dataset.py` / `post_process_captions.py` — 数据预处理
- `run_tag.sh` / `test_lora.py` / `test_lora_agelaiya.py` — 打标签 / 测试
- `config.toml` / `dataset.toml` / `agelaiya_config.toml` / `agelaiya_dataset.toml` — 配置模板

### 5.3 角色专属目录
`C:\Users\yaya\.claude\tmp\<char>_lora\` — 含该角色的 `upload_<char>.py`：
- `yeshunguang_lora/`（config.toml + dataset.toml + run_train.sh + upload）
- `heitiane_lora/`、`kafuka_lora/`（仅 upload 脚本）
- `talisman_lora/`（⚠️ Qwen 文本 LoRA 护符项目，非 SDXL 角色）

### 5.4 其他
- `C:\Users\yaya\AutoDL-SSH-Tools\` — AutoDL 官方 Windows 客户端（AutoDL.exe 等）

---

## 6. 常用命令速查

```bash
# 连接（本机 git bash）
AUTODL_HOST=connect.westc.seetacloud.com AUTODL_PORT=5xxxx AUTODL_USER=root \
  AUTODL_PASS='******' python ~/autodl_ssh.py '<cmd>'

# 启动 ComfyUI（6005，需 ssh -L 隧道访问;原 6006 已弃）
setsid bash /root/cfy.sh </dev/null       # ⚠️ 6005 不走自定义服务!本地隧道访问: ssh -p 5xxxx -L 6005:localhost:6005 root@connect.westc.seetacloud.com → http://localhost:6005

# 启动下载服务（6006，需先停 ComfyUI：pkill -f 'env/bin/python main.py'）⚠️ 别用 pkill -f main.py(自杀)
cd /root/autodl-tmp/download && setsid nohup .../env/bin/python -m http.server 6006 </dev/null &

# 训练新角色：改 run_all_kh.sh 的 CHARS=<新角色名>，后台跑
setsid nohup bash scripts/run_all_kh.sh > logs/run.log 2>&1 </dev/null &
tail -f logs/run_all_kh.status       # 看进度

# 查训练日志 / GPU
tail -f logs/<char>.log
nvidia-smi
```

---

## 7. 端口占用

| 端口 | 服务 | 说明 |
|---|---|---|
| 6005 | **ComfyUI**（当前，8/9 起） | 走 ssh -L 隧道,不走 AutoDL 自定义服务 |
| 6006 | http.server 下载 / 旧 ComfyUI | AutoDL 代理到「自定义服务」（ComfyUI 已迁 6005） |
| 6008 | qwen3-chat（`/root/chat.sh`） | LLM 聊天页（另一项目） |

---

## 相关文档（桌面）
- `AutoDL角色LoRA训练踩坑记录.md` — 配方参数详解 + 全部踩坑
- `飞影角色LoRA微调项目总结.md` — 求职项目总结
