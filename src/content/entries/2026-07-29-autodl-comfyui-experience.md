---
title: "AutoDL 部署 ComfyUI 经验总结（底模零下载复用）"
date: 2026-07-29
category: 技术
tags: [comfyui, autodl, 部署, 日记归档]
draft: false
---

> 在 AutoDL GPU 服务器上部署 ComfyUI，通过「自定义服务」(6006) 网页访问
> 核心：**复用已有的 diffusers 底模，0 下载 0 转换**
> 硬件：connect.westc · RTX 4080 SUPER 32G · CUDA 13.2 · 2026-07-29

---

## 一、背景与目标

刚批量训完 9 个角色 LoRA（feiying/ruanmei + feicui/haiseyin/liuying/robin/tingyun/xiadie/xiaoba），想用 **ComfyUI 节点式界面**出图验证还原度、玩不同 prompt。

AutoDL 的网页入口「自定义服务」固定代理 **6006 端口**，所以让 ComfyUI 监听 6006 即可。

服务器现状：
- 没有 ComfyUI（只有昨天搭的一个 Gradio 简易 webui）
- `/root/autodl-tmp`（数据盘 50G）**只剩 5.5G**，但系统盘 `/` 还有 27G
- 已有 `lora_train/env`（torch 2.13+cu130）、animagine-xl-3.1 底模（**diffusers 目录版**）、45 个 LoRA 权重

---

## 二、核心决策：为什么能复用 diffusers 底模（省 6.5G 下载）

### 一开始的弯路
最初打算下载 animagine 的**单文件 checkpoint**（6.5G，ComfyUI 最标准的用法）。理由是：ComfyUI 默认的 `CheckpointLoader` 只认单文件，而微调用的是 diffusers **目录**版（unet/clip/vae 拆成多个文件），「不能直接当 checkpoint 加载」。

### 关键质疑
**「为什么不能用我们刚才微调的底模？」** —— 这个问题点醒了：既然 diffusers 底模就在盘上，为什么要重下？

### 验证后的真相
查 ComfyUI 源码（`comfy/sd.py`）发现：
- ComfyUI 新版**弃用了 `DiffusersLoader` 节点**（一键加载整个 diffusers 目录）—— 所以「当一个 checkpoint 直接加载」确实不行
- 但 `UNETLoader` 里有 `model_config_from_diffusers_unet` —— **能自动识别并转换 diffusers 格式的 UNet**
- `DualCLIPLoader` 能加载 diffusers 的 CLIP

也就是说：把 diffusers 的 4 个组件**软链**到 ComfyUI 对应目录，用**组件工作流**（UNETLoader + DualCLIPLoader + VAELoader）加载即可。**0 下载、0 转换、0 额外磁盘**。最担心的 CLIP 实测也能加载出图。

> ✅ 收益：省了 6.5G 下载 + 系统盘空间，还省了 ~12 分钟下载时间。

---

## 三、技术原理（面试可讲）

| 概念 | 说明 |
|---|---|
| **单文件 checkpoint** | unet + 两个 CLIP + VAE 合并在一个 `.safetensors`，ComfyUI `CheckpointLoader` 直接读 |
| **diffusers 目录** | 拆成 `unet/` `text_encoder/`(CLIP-L) `text_encoder_2/`(CLIP-G) `vae/` 等子目录，每个一个 `*.safetensors`，训练用这个格式 |
| **组件加载** | ComfyUI 分别用 UNETLoader 加载 unet、DualCLIPLoader 加载 clip_l+clip_g、VAELoader 加载 vae，拼出完整 SDXL |
| **格式自动转换** | ComfyUI 加载 diffusers 的 unet/clip 时会自动做 key 重映射（diffusers ↔ ComfyUI 命名不同），无需手动转 |

---

## 四、完整部署步骤

### 1. clone ComfyUI 到系统盘（数据盘满了）
```bash
git clone --depth 1 https://github.com/comfyanonymous/ComfyUI.git /root/ComfyUI
```
> 数据盘只剩 5.5G，系统盘 `/` 有 27G，所以放系统盘。代价：AutoDL 换实例要重建（clone + 装依赖约 5 分钟）。

### 2. 软链 diffusers 底模组件（0 占用）
```bash
A=/root/autodl-tmp/models/animagine-xl-3.1
C=/root/ComfyUI/models
mkdir -p $C/unet $C/vae $C/clip
ln -sf $A/unet/diffusion_pytorch_model.safetensors  $C/unet/animagine_unet.safetensors
ln -sf $A/vae/diffusion_pytorch_model.safetensors   $C/vae/animagine_vae.safetensors
ln -sf $A/text_encoder/model.safetensors            $C/clip/clip_l_animagine.safetensors   # CLIP-L
ln -sf $A/text_encoder_2/model.safetensors          $C/clip/clip_g_animagine.safetensors   # CLIP-G
```

### 3. 软链所有 LoRA
```bash
ln -sf /root/autodl-tmp/lora_train/output/*.safetensors /root/ComfyUI/models/loras/
# → 45 个 LoRA（9 角色 × {final + ep11-14}）全部进 ComfyUI
```

### 4. 装依赖（复用 lora_train/env，不重装 torch）
```bash
/root/autodl-tmp/lora_train/env/bin/pip install -r /root/ComfyUI/requirements.txt
```
> ComfyUI 新版（0.29）依赖很重：`comfyui-frontend-package`、`SQLAlchemy`+`alembic`（资产数据库）、`av`（视频）、`comfy-kitchen`/`comfy-aimdo`（新后端）等。`requirements.txt` 里 `torch` 无版本约束，pip 不会降级现有的 torch 2.13。

### 5. 启动 ComfyUI（后台，监听 6006）
```bash
cd /root/ComfyUI
setsid nohup /root/autodl-tmp/lora_train/env/bin/python main.py \
  --listen 0.0.0.0 --port 6006 > /root/autodl-tmp/comfyui.log 2>&1 </dev/null & disown
```
日志出现 `To see the GUI go to: http://0.0.0.0:6006` 即成功。AutoDL 控制台点「自定义服务」打开就是界面。

### 6. API 验证出图（确认组件真能用）
构造一个最小 SDXL 工作流，POST `/prompt` + 轮询 `/history/{id}`，实测 `status: success`，生成 `comfy_test_00001_.png`。证明 unet/vae/clip_l/clip_g 全链路 OK。

---

## 五、踩坑与解决（这次最折腾的部分）

| 坑 | 现象 | 解决 |
|---|---|---|
| **① AutoDL 容器没有 `fuser` 命令** | 想用 `fuser -k 6006/tcp` 杀掉旧的权重下载服务，结果 `fuser: command not found`，**根本没杀掉**，旧服务一直占着 6006 | 按端口杀改用 `pkill -f '[h]ttp.server 6006'` 或 `ss -tlnp` 找 PID + `kill` |
| **② ComfyUI 端口被占，日志却报别的错** | 6006 被旧 http.server 占着，ComfyUI 绑端口失败（Address already in use），但日志显示的是更早的 `sqlalchemy` 报错（pip 装之前的崩溃残留），**严重误判** | 判断报错前先 `rm` 旧日志重跑 + `stat -c %Y` 校验日志新鲜度，别轻信已有日志 |
| **③ autodl_ssh.py 对后台命令「exit 1 且无输出」** | 用 paramiko 脚本跑 `setsid nohup ... &` 这种后台命令时，返回 exit 1 且 stdout 全空，**但远程命令其实执行了** | 命令末尾加 `; echo MARKER_END` 强制 flush 输出 + 用它判断是否执行；纯查询命令分开跑 |
| **④ paramiko 阻塞读卡死** | 最早用 `stdout.read()` 读后台启动命令的输出，因远程 setsid 进程 hold 住 SSH channel 不返回 EOF，**本地直接卡死** | 改用 autodl_ssh.py 的 **polling 轮询**模式（轮询 exit_status + drain，不阻塞 EOF） |
| **⑤ 新版 ComfyUI 缺 sqlalchemy** | 首次启动报 `ModuleNotFoundError: No module named 'sqlalchemy'`（新版带了资产数据库功能） | `pip install -r requirements.txt` 一次性补齐（SQLAlchemy/alembic/frontend-package/av 等） |
| **⑥ 6006 一山不容二虎** | 权重下载的 `http.server 6006` 和 ComfyUI 都要 6006 | 同一端口只能一个服务，开 ComfyUI 前先停 http.server |

> 最迷惑的是 ②③ 叠加：后台启动命令 exit 1 无输出（看似没执行）+ 旧日志残留（看似 sqlalchemy 没装），双重误导。最后靠**前台限时跑** `timeout 25 python main.py` 才看到真相——ComfyUI 其实早就装好能启动了，全程卡在端口被占。

---

## 六、怎么用（ComfyUI 出图）

### 访问
AutoDL 控制台 →「自定义服务」（6006）→ ComfyUI 界面。

### 出图三步
1. 左侧 **Workflows** 面板加载 `sdxl_char_lora`（已放好的现成工作流，路径 `/root/ComfyUI/user/default/workflows/sdxl_char_lora.json`）
2. **LoraLoader** 节点把 `lora_name` 换成想出的角色（如 `xiadie-v1.safetensors`）
3. **CLIPTextEncode（正面）** 粘贴桌面手册《角色LoRA出图提示词手册》里该角色的 prompt → **Queue**

### 组件工作流结构（区别于默认 txt2img）
因为底模是组件而非单文件，工作流不是默认的 `CheckpointLoader`，而是：
```
UNETLoader(animagine_unet) ──┐
DualCLIPLoader(clip_l, clip_g, type=sdxl) ──┐
                                      LoraLoader ──→ CLIPTextEncode(正/负) ──→ KSampler ──→ VAEDecode ──→ SaveImage
VAELoader(animagine_vae) ────────────────────────────────────────────────────────↑
EmptyLatentImage(1024×1024) ────────────────────────────────────────────────────→ KSampler
```
LoRA 强度在 LoraLoader 的 `strength_model`（默认 1.0，想更强 1.2）。

---

## 七、关键路径速查

```
/root/ComfyUI/                              # ComfyUI 本体（系统盘，换机会丢）
├── models/
│   ├── unet/animagine_unet.safetensors     # → 软链 diffusers unet
│   ├── vae/animagine_vae.safetensors       # → 软链 diffusers vae
│   ├── clip/clip_l_animagine.safetensors   # → 软链 text_encoder (CLIP-L)
│   ├── clip/clip_g_animagine.safetensors   # → 软链 text_encoder_2 (CLIP-G)
│   └── loras/*.safetensors                 # → 软链 45 个角色 LoRA
├── user/default/workflows/sdxl_char_lora.json   # 现成 SDXL+LoRA 工作流
├── output/                                  # 出图保存这里
└── comfyui.log / comfyui_detail.log         # 启动日志

/root/autodl-tmp/lora_train/env/             # 复用的 python 环境（torch 2.13+cu130）
/root/autodl-tmp/comfyui.log                 # 启动日志
```

**常用命令**：
```bash
# 启动 ComfyUI
cd /root/ComfyUI && setsid nohup /root/autodl-tmp/lora_train/env/bin/python \
  main.py --listen 0.0.0.0 --port 6006 > /root/autodl-tmp/comfyui.log 2>&1 </dev/null & disown

# 查是否在跑
pgrep -af '[m]ain.py' ; curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:6006/

# 停 ComfyUI
pkill -f '[m]ain.py'

# 查 6006 被谁占（无 fuser！）
ss -tlnp | grep 6006
```

---

## 八、可复现性 & 迁移

换 AutoDL 实例后（系统盘清空）：
1. `git clone` ComfyUI（30 秒）
2. `pip install -r requirements.txt`（复用 env，3-5 分钟）
3. 软链底模组件 + LoRA（数据盘 autodl-tmp 持久，模型还在；秒级）
4. 启动

底模仍用 diffusers 目录版（数据盘持久），**永远不需要下单文件 checkpoint**。

---

## 九、经验提炼

1. **别急着下载**：盘上已有的模型，先想能不能复用。ComfyUI 对 diffusers 组件的原生支持（UNETLoader 自动转换）让 diffusers 底模直接可用。
2. **端口冲突排查**：服务起不来先查端口占用，别只盯启动日志（日志可能是旧的）。
3. **AutoDL 容器的工具残缺**：没有 `fuser`，端口操作用 `ss`/`pkill`。
4. **后台命令的 SSH 陷阱**：paramiko 阻塞读会卡死，用 polling；命令末尾加 echo 标记确认执行。
5. **新版软件依赖膨胀**：ComfyUI 0.29 带了一堆 comfy-* 包和数据库，复用旧 env 要 `pip install -r requirements.txt` 补齐。

---

*本次部署最大收获：用户的「为什么不能用现有底模」一问，避免了 6.5G 无谓下载，也验证了 ComfyUI 对 diffusers 组件的加载能力——比想象中强。*
