---
title: "Hunyuan3D-2mini AutoDL 部署完成"
date: 2026-08-16
category: 技术
tags: [autodl, hunyuan3d, 3d, 日记归档]
draft: false
---

> 日期：2026-08-16 ｜ 状态：**✅ 部署完成，真机验收通过**
> 效果：图片 → 3D 网格（GLB），网页可交互旋转+下载，30步采样约10秒出模（RTX 4080S）

## 一、最终架构

```
/root/autodl-tmp/hunyuan3d-mini/
├── Hunyuan3D-2-main/                  # 官方代码（GitHub zip 解压）
│   ├── hy3dgen/                       #   核心包
│   ├── gradio_app.py / minimal_demo.py
├── infer.py                           # ★自写推理脚本（CLI + Gradio 双模式）
├── hunyuan3d-dit-v2-mini-turbo/       # 形状主模型 3.82G + config
└── hunyuan3d-vae-v2-mini-turbo/       # VAE 407M + config

conda env: /root/autodl-tmp/envs/hy3d (python3.10, 软链lora_train的torch 2.13+cu130)
服务: gradio 监听 0.0.0.0:6008, AutoDL自定义服务代理访问
日志: /root/hy3d_web.log
```

**启动命令**（重启实例后要重跑）：
```bash
cd /root/autodl-tmp/hunyuan3d-mini && setsid nohup \
  /root/autodl-tmp/envs/hy3d/bin/python infer.py --web \
  > /root/hy3d_web.log 2>&1 < /dev/null &
```

CLI 模式：`/root/autodl-tmp/envs/hy3d/bin/python infer.py <图片> <输出.glb>`

## 二、使用经验（验收得出）

- **输入图必须带角度**：正面平拍/图标/logo → 生成薄片（z/x 比 2%）；45° 视角实物照 → 立体饱满。单图生3D靠透视线索猜深度，没线索就压扁
- 参数默认值就很好：steps 30（turbo 20~30）、guidance 5、octree 256
- 白模无贴图（灰色），交互旋转用 `gr.Model3D`（Three.js WebGL），可下载 glb 进 Blender
- 验证 glb 是否立体：`trimesh.load()` 后看三轴 extent，薄厚比 <0.1 就是片
- 显存占用 ~4.2G（32G 卡富余，可与 ComfyUI 共存）

## 三、踩坑记录

### 1. 本地上传龟速 → 服务器直连 hf-mirror
- SFTP 只有 360KB/s（AutoDL SSH 通道限速），3.8G 要 3 小时
- 服务器 `curl` 直连 hf-mirror 2.7~4.7MB/s，`nohup curl -sL -C - -o ... &` 后台 + 断点续传，~15分钟搞定
- ModelScope 无此仓库（404）
- **`-C -` 断点续传保命**：中途磁盘满 curl 被杀，扩容后接着传不作废

### 2. 数据盘撑爆（100%）连锁反应
- curl 被杀 / pip 报 No space left / unzip 卡死，三者同时出现 = 先查磁盘
- 清理：`/root/.cache/pip`（9.1G！）、lora 对比图、根目录散图
- 扩容 +15G 后 GPU 掉卡（nvidia-smi 空输出）——重启后需控制台确认非无卡模式开机

### 3. 环境复用：软链 torch + 补小依赖
- 新建 env 后软链 lora_train 的 torch 全家（省 7G）
- **软链后必须补装**：typing_extensions filelock sympy networkx jinja2 fsspec（否则 import torch 报错）
- pip 一律 `--no-cache-dir` 防撑爆

### 4. gradio 4.44 + 新 huggingface_hub 冲突（老朋友）
- `cannot import name 'HfFolder'` → 直接升 gradio 6.x（6.24.0 过）

### 5. 官方 API 的三个坑
- mini **无独立代码仓库**，代码就是 `Tencent/Hunyuan3D-2` 主仓库
- `from_single_file` 真实签名是 `ckpt_path, config_path, use_safetensors=True`（不是 dit_config/model_path 那套）
- `enable_flashvdm()` 依赖 `from_pretrained_kwargs`（HF 在线下载路径），本地权重会 KeyError——32G 显存直接不用它
- onnxruntime-gpu 报 `libcublasLt.so.12` 缺失（rembg 降级 CPU 跑）不影响结果，只是抠图慢一点

### 6. 下载只挑 turbo 变体
- HF 整仓 25.26G 是假象（3变体×2格式重复），实际 4.3G 够用

## 四、mini 能力边界（验收得出）

- ❌ 文生 3D：conditioner 是 SingleImageEncoder(DINOv2)，无文本通道；HF 标签 text-to-3d 是系列共用的，别信
- ❌ 纹理/贴图：白模而已；要贴图需另装 hy3dpaint（Hunyuan3D-2 仓库 ~10G）
- ✅ **两段式文生3D 已跑通**（见下节）：Animagine 出图 → mini 转 3D

## 五、两段式文生3D（text2mesh.py，✅已验收）

**用法**（服务器上）：
```bash
cd /root/autodl-tmp/hunyuan3d-mini
setsid nohup /root/autodl-tmp/envs/hy3d/bin/python text2mesh.py \
  'a ceramic coffee mug with handle, simple elegant design' cup_v1 \
  > /root/t2m.log 2>&1 < /dev/null &
```
产出：`text2mesh/<前缀>.png`（SD参考图）+ `<前缀>.glb`（3D网格）

**流程**：Animagine SDXL 出 1024×1024 白底45°图（5秒）→ 释放显存 → mini 转3D（20秒），全程约2分钟。

**实测**：杯子 prompt → 164,716顶点/329,456面，三轴 1.99/0.92/1.78 饱满立体，watertight。

**prompt 要点**（脚本里已内置，自己改时注意保留）：
- 正向附加：`solo, single object only, centered, 45 degree angle view, white background, product photography`——**45° 角是 3D 立体度的关键**
- 负向：`humans, hands, text, watermark, multiple objects, busy background, flat front view, side view`

**踩坑**：Animagine 本地目录文件是标准命名，`from_pretrained` **不能带 `variant="fp16"`**（报 no such modeling files）。

## 六、后续可选

- [ ] 纹理模块 hy3dpaint（~10G，磁盘需再扩）
- [ ] glb 后处理进 Blender MCP 流程（本地已有）
- [ ] 删 Hunyuan3D-2-main.zip（省 80MB）

---
本地辅助脚本：`.claude/tmp/autodl_ssh.py`（远程命令）、`autodl_upload_resume.py`（SFTP断点续传）、`hy3d_infer.py`（图生3D源码）、`hy3d_text2mesh.py`（文生3D源码）
服务器成品示例：`text2mesh/cup_v1.glb/png`（已拷贝到桌面）
