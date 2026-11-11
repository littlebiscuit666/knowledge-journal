---
title: "STORM 自动综述工具部署与试例"
date: 2026-10-04
category: 工具
tags: [storm, 综述, deepseek, 日记归档]
draft: false
---

## 今天做了什么

给写论文搭了个新工具：**STORM**（斯坦福开源的自动综述系统，stanford-oval/storm）。给个题目 → 自动多角度提问 → 联网检索 → 生成带引用的维基式综述文章。定位是**related work 骨架 + 文献素材收集**，不是代写。

## 基本信息

- 位置：`D:\github-download\STORM`，独立 venv（knowledge-storm 1.1.1，不污染全局 Python）
- LLM：DeepSeek（key 在 `secrets.toml`）；检索：DuckDuckGo（走 7890 代理）
- 一键运行：
  ```bat
  D:\github-download\STORM\storm.bat --topic "Your Topic" --do-research --do-generate-outline --do-generate-article --do-polish-article
  ```
- 产出在 `output\<topic>\`：`storm_gen_article_polished.txt`（成稿）、`url_to_info.json`（引用编号↔来源映射）

## 试例结果（topic = Retrieval-Augmented Generation）

- 全流程 25 分钟：研究 108s + 大纲 8s + **文章生成 14.5min** + 润色 4s
- 消耗 DeepSeek ~8 万 token，几分钱；DDG 检索 36 次
- 成稿 7388 词，维基式完整结构，63 个真实引用来源
- 中文翻译版：同目录 `storm_gen_article_中文版.txt`

## 三个 Windows 坑（都已修进脚本，重装必踩）

1. **`duckduckgo_search` 包已改名 `ddgs`**：STORM 代码还在 `from duckduckgo_search import DDGS`，而该包名只剩弃用的过渡壳（8.1.1，默认走 bing 后端还会 302 失败）。
   → 修法：装 `ddgs`，运行前 `sys.modules["duckduckgo_search"] = ddgs` 注入别名；后端从已废弃的 `"api"` 改成 `"auto"`。

2. **检索一出错就二次崩溃**：STORM 给检索挂的 backoff `giveup_hdlr`（从 dspy/dsp 借来的）假定异常对象有 `.message` 属性，ddgs 9.x 的 `DDGSException` 没有 → AttributeError 炸掉整篇。
   → 修法：`run_topic.py` 里 `patch_request()` 实例级覆盖 `rm.request`，自带 4 次退避重试，失败降级为空列表（单条检索失败不该杀掉全篇）。并发开 `--max-thread-num 2` 减少 DDG 限流。

3. **产出文件 GBK 乱码**：STORM 写文件用裸 `open()`，Windows 默认编码落成 GBK。
   → 修法：用 `storm.bat`（内含 `python -X utf8`）启动。已产出的 GBK 文件可用 gbk 解码后重存为 UTF-8 抢救。

## 引用可信度实锤教训

事实层面基本对，但**引用常"张冠李戴"**：正文说 RAG 源自 Lewis et al. 2020 NeurIPS 挂引用 [3]，实际 [3] 是 Comet 的博客；真正的 arXiv 2005.11401 在来源池里但编号是 [18]。另外成稿**没有文末 References 节**，要拿 `url_to_info.json` 自己拼。

→ 结论：骨架和素材可用，**每条引用必须人工核对换成原始论文**才能进论文。

## 待办

- [ ] 我的英文论文还没做语言审查 + AI 味检查（Writefull/PaperPal 网页版要粘贴文本；或直接把 PDF/LaTeX 路径发给 Claude 查，能同时盯 AI 味）
- [ ] 下次写论文 related work 时用 STORM 出骨架，引用逐条人工换原始文献

---

# 附：AI 游戏素材调研（同日下午）

背景：想实现"PS 自由 + 漫画/游戏素材自制"。序列帧方案被否（O(帧数×像素) 太吃内存），定下**骨骼动画**路线。AI 圈背景：9 月底 10 天内连发 5 个前沿模型（Gemini 4 Argon、GPT-6.1 Sol、Claude Fable 5.1 等），开源圈 DeepSeek-V4.1-Flash（原生视觉+1M 上下文）、Kimi K3（2.8T 全开源）。

## 1. see-through —— 单图拆层（今天最重要的发现）

- 仓库：<https://github.com/shitagaki-lab/see-through>（4322★，SIGGRAPH 2026 论文，arXiv 2602.03749）
- 功能：一张动漫角色图 → **最多 23 层语义图层**（前后发/脸/眼左右/衣服/饰品），每层 inpainting 补全遮挡，带绘制顺序+深度，直接导出**分层 PSD**，官方定位就是 Live2D/2.5D 工作流
- 在线白嫖：魔搭 <https://modelscope.cn/studios/ljsabc/See-Through>（国内直连免费，分辨率比 HF 版高）；HF Space 注册后每天 1-2 次
- ComfyUI 插件：<https://github.com/jtydhr88/ComfyUI-See-through>（816★，模型自动下载，浏览器端导 PSD，自带低显存优化）
- **配置要求（推理）**：仅 NVIDIA CUDA 或 AMD ROCm（**无 Intel XPU**）；1280 分辨率 bf16 需 12-16G 显存；12G 卡 `--group_offload` 降到 ~10G（慢 1.5x）；8G 卡用 NF4 量化版 ~8G（质量几乎无损，PSNR~30dB）。速度 ~2-3 分钟/张
- 环境：conda python 3.12 + torch 2.8.0+cu128；主脚本 `inference/scripts/inference_psd.py`，`--srcp` 直接给文件夹可批量
- 结论：本地 Arc 130T 核显 ❌，**用 AutoDL 4080S（16G）跑默认管线**，一张不到一毛钱

## 2. 2D 骨骼动画 AI 现状（拆层之后的最后一公里）

- [GodModeAI Spine Animation](https://www.godmodeai.co/ai-spine-animation)：传一张角色图直接生成 Spine 骨骼动画（Show HN 2025-10，成熟度一般待验证）
- [Meta AnimatedDrawings](https://github.com/meta/AnimatedDrawings)：开源，简笔画/Q版自动识别人形→绑骨→套动作库，可自部署
- Spine/Live2D 官方都不做 AI 绑骨，切网格/K帧仍是手艺活
- ★ 关键洞察：**骨骼动画文件本质是结构化数据**（Spine .json / Godot Skeleton2D 场景文本 / glTF）——AI 可以直接写骨架和 K 帧，绕开编辑器手 K
- 规划管线：`see-through 拆层出 PSD → 写脚本解析图层 → 自动生成 Godot Skeleton2D 骨架（前后发/躯干/四肢层级）→ 预置待机/奔跑/攻击模板动画 → 引擎直接跑`

## 3. 3D 角色一条龙（已全自动化）

- Meshy / Tripo：图/文字→3D→自动绑骨（人形+四足）→动作库/文字驱动动画
- 免费路线：Mixamo（自动绑骨+海量动作库）、AccuRIG 桌面版
- 真人视频→动作数据：Rokoko Vision（免费）、DeepMotion Animate 3D
- Cascadeur：AI 辅助物理 K 帧
- 已有资产：Hunyuan3D 白模管线（8/17 验收）→ 接 Mixamo 即闭环

## 4. Higgsfield Games 2.0（看看就好，可复刻）

- Higgsfield 平台 2026-09-07 发布 Games 2.0：一句 prompt → 写游戏逻辑+生成全套素材（sprite sheet/贴图/绑骨 3D/音乐音效）→ 可玩浏览器游戏（宣称 GPT-6 Astra 驱动，支持多人）
- "higgsfield-game-generation" = 该功能的 Claude Code 技能包，经技能市场分发，**GitHub 无官方同名仓库**；本体 = 编排提示词 + 调 Higgsfield 云 API（付费境外服务）
- 结论：本质 = LLM 写游戏代码 + 云端模型产料，无 magic。本地平替全套已有：Claude Code 写逻辑 + 即梦 API/ComfyUI 出图 + Hunyuan3D 出 3D + audiocraft 出音效 → 自建"素材→游戏"管线，风格还能锁自己的 LoRA

## 待办（游戏素材线）

- [ ] 魔搭 demo 扔一张定妆图验拆层质量
- [ ] AutoDL 4080S 装 see-through，批量拆层测试
- [ ] 搭 PSD → Godot Skeleton2D 自动绑骨脚本
- [ ] （可选）试 GodModeAI spine AI 和 Meta AnimatedDrawings 效果
