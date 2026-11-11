---
title: "ComfyUI 闭眼局部重绘管线 + FaceDetailer 实战"
date: 2026-11-03
category: 技术
tags: [comfyui, facedetailer, 重绘, 日记归档]
draft: false
---

> 归档日期：2026-11-03
> 状态：✅ 全管线跑通并验收（闭眼 + FaceDetailer 精修两段式）
> 接续：[2026-11-02_ComfyUI本地启动与闭眼局部重绘方案.md](昨天的方案，今天的实践)

## 一、inpaint 节点安装（昨天的"备选方案"今天上线）

| 组件 | 大小 | 备注 |
|---|---|---|
| `comfyui-inpaint-nodes`（Acly）v1.4.4 | - | git clone 进 custom_nodes；唯一外部依赖 kornia 嵌入 Python 已有 0.8.3，**零 pip** |
| `fooocus_inpaint_head.pth` | 51KB | `models\inpaint\` |
| `inpaint_v26.fooocus.patch` | **1.23GB** | ⚠️ 我一开始记成 120MB，实际是官方 Content-Length 实测值 |

**下载坑**：hf-mirror.com 直连 SSL 握手失败（当天抽风），走 Clash 代理 `curl -x http://127.0.0.1:7890` 从 huggingface.co 官方拉成功。断点续传参数 `-C -` 备用。

**端口现状**：6005 被 Godot 编辑器（godot-ai 插件）占用，本机 ComfyUI 用默认 **8188**。

## 二、闭眼工作流：三轮调试全程复盘

工作流文件：`ComfyUI\user\default\workflows\closed-eyes-inpaint-Fooocus.json`（从节点包自带 `inpaint-simple.json` 定制：animagine 底模 / `closed eyes` 正向+`open eyes` 负向 / CFG 5 / 25 步 / mask 外扩 8px / SaveImage 到 `closed_eyes/`）。

★核心认识：**Fooocus 补丁法 denoise 保持 1.0**，补丁自己负责 mask 外内容一致性。昨天日记里写的 0.5~0.7 是"不用补丁的裸 Set Latent Noise Mask 法"的参数，方法换了参数跟着换。

| 轮次 | 症状 | 取证 | 根因 | 修复 |
|---|---|---|---|---|
| 1 | 出图和原图完全一样 | 执行记录里 LoadImage 引用的是原始文件而非 clipspace 副本；`clipspace\` 目录 0 个文件；输入图是 RGB 无 alpha | **mask 是空的**——MaskEditor 的 Save 从未成功，LoadImage 只能拿全零 mask | 教正确操作：右键 LoadImage→Open in MaskEditor→涂→点编辑器内 **Save**（成功标志=节点文件名变成 `clipspace/clipspace-mask-xxx.png [input]`） |
| 2 | 闭眼了但眼皮上方有旧睫毛线残影 | 带坐标网格的局部放大图比对：原 mask y[222~251] 只有 29px，而原眼上睫毛线在 y≈210-222 | **mask 太薄**，没盖住原眼窝上缘 | PIL 直接改写 LoadImage 引用的 clipspace 文件：RGB 用原图、只重写 alpha（mask 区透明），矩形 x[232,326] y[208,254] + 3px 高斯羽化。LoadImage 有 IS_CHANGED 文件哈希校验，覆盖同名文件缓存自动失效 |
| 3 | 闭眼形态歪斜不对称 | 看图 | 小区域直出重绘缺乏整脸上下文 | ↓ FaceDetailer 接力（第三节） |

**MaskEditor 行为要点**：每次保存都生成**新的** `clipspace-painted-masked-<时间戳>.png` 并改写 LoadImage 引用——涂一次文件名变一次，做自动化时要取最新文件。

## 三、FaceDetailer 两段式精修（Impact-Pack）

思路：局部重绘只管"闭眼"，眼睛好不好看交给 FaceDetailer——自动检测脸→裁出放大到 512px→整脸精修→贴回，mask 外像素不动。

已确认环境：Impact-Pack + Impact-Subpack 早已装好，`models\ultralytics\bbox\face_yolov8m.pt` 在位。

关键参数（从官方示例 `example_workflows/1-FaceDetailer.json` 原样抄 widget 数组，只改关键位）：
- `guide_size 512 / max_size 1024`、denoise **0.5**（脸变化幅度：0.4 更保守 / 0.6 更狠）
- 采样器与主图一致：dpmpp_2m_sde_gpu + karras、25 步、CFG 5
- seed randomize、force_inpaint true、cycle 1

**踩坑实录**：
1. ★ bbox 模型（face_yolov8m）的 **SEGM 输出是 NO_SEGM 空占位**，把它接进 FaceDetailer 的 `segm_detector_opt` 直接 `AttributeError: 'NO_SEGM_DETECTOR' object has no attribute 'detect'`。修复=只接 bbox_detector 线（官方默认接法）
2. ★ API 直调时：UltralyticsDetectorProvider 的输入名是 **`model_name`** 不是 `model`；FaceDetailer 的 **`wildcard` 是必填 string**（空串也行）
3. 验证方式：改完不靠肉眼，直接 POST `/prompt`（API 格式）排队测试图 + 轮询 `/history/{id}`，第一次 400 读 node_errors 精确定位，第二次成功

**验收结果**：FaceDetailer 前双眼弧线歪斜有涂抹感；精修后对称弯月形笑眼、睫毛干净、脸部光影连贯，发饰/服装/背景不变。测试图 `output\closed_eyes\fd_test_00001_.png`。

## 四、顺手排雷：Win+Shift+S 截图只转蓝圈

分层排查（应用层/策略层/钩子层）：
- `Get-AppxPackage Microsoft.ScreenSketch` → Status Ok（应用包健康≠运行时正常）
- 无 TabletPC 禁用策略；钩子程序在跑的有 ShareX/Espanso/QQ（本次都不是元凶）
- `explorer.exe ms-screenclip:` URI 直接触发 → 也转圈 → 锁定应用层
- 真凶：**10+ 个 SnippingTool.exe 僵尸进程**堆积，堵死单实例通道

**自救一条**：`taskkill /F /IM SnippingTool.exe`

## 五、当前状态与后续可做

- 管线状态：打开 Workflows→`closed-eyes-inpaint-Fooocus`→Queue 即可复现全套效果
- 可调：FaceDetailer denoise（脸变化幅度）、正向提示词加 `detailed eyes`
- 扩展玩法：同款管线可做张嘴/闭嘴、转头等微表情（换提示词+mask 区域）；hand_yolov8s.pt 已在位可加手部修复
- 备用底模：illustriousXL_v01、sdxl_lightning_8step（8 步快速迭代试试）

## 踩坑速查表（TL;DR）

| 坑 | 一句话解法 |
|---|---|
| 重绘没变化 | 先查 mask 是不是空的：LoadImage 引用里有没有 `clipspace` 前缀 |
| 重绘有残影 | mask 盖住整个原区域上下文，宁大勿小+羽化 |
| FaceDetailer 崩 NO_SEGM | bbox 模型别接 SEGM 线 |
| API 调 Impact 节点 400 | 读 node_errors，输入名以源码 INPUT_TYPES 为准 |
| Fooocus 补丁法 denoise | 保持 1.0，别降 |
| hf-mirror SSL 失败 | 走 7890 代理直连 huggingface.co |
| 截图转蓝圈 | taskkill /F /IM SnippingTool.exe |
