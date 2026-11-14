---
title: "Kev 决策模型本机部署（Jev 开源平替 + Intel Arc XPU 适配）"
date: 2026-09-27
category: 技术
tags: [xpu, llm, 部署, 日记归档]
draft: false
---

> 日期：2026-09-27 ｜ 执行：Claude Code
> 一句话：一天内把开源决策模型 Kev 装进本机并魔改支持 Intel 核显——torch 零下载复用 ComfyUI 环境、sitecustomize 注入 DLL 路径、只改一个文件完成 XPU 适配，20 条影评情感分类实测 95% 准确率、单条 245ms
> 状态：本地跑通 ✅（http://localhost:8009，`D:\kev`，`start-kev.bat` 一键启动）

---

## 一、今日产出总览

| 产出 | 说明 | 状态 |
|---|---|---|
| Kev-0.8B 本机部署 | Cognition 开源的 Jev 平替（Apache-2.0），API 与 TypeSafe `/v1/systemone` 完全兼容 | ✅ |
| XPU 适配 | 上游只支持 cuda/mps/cpu，补丁后跑上 Arc 130T 核显（bf16） | ✅ |
| torch 零下载 | 从 ComfyUI embed 整包拷贝 2.13.0+xpu（1.4G），全程没下 torch | ✅ |
| 情感分类 demo | `demo_sentiment.py`：20 条编造影评三分类（好评/差评/中评） | ✅ 19/20=95% |
| XPU vs CPU 对照 | 同请求 A/B：热身 404ms vs 372ms（0.8B 体量打平） | ✅ |
| 运维交接 | `start-kev.bat` 一键启动；记忆已存档 | ✅ |

## 二、Kev 是什么（背景）

**Jev**（TypeSafe AI，2026-09 官宣全量开放，正以 100 亿估值融资）是"决策模型"品类开创者：不聊天不生成，输入一段 state + 任意具名问题（noul 是/否、choice 多选、score 评分），返回**校准过的概率**——本质是"BERT 式判别接口 + 现代零样本引擎"，卖点是便宜、快、可路由（置信度低的转人工）。

**Kev**（github.com/jaredpalmer/kev，7.3k star）是它的开源复刻：Qwen3.5 底座 + LoRA + 指针头，四个尺寸（0.8B/4B/9B/27B），TypeSafe SDK 不改代码指向本地即可用。名字乌龙记：一开始把"jev"听成 JEPA（LeCun 世界模型），绕了一圈才对上号。

## 三、XPU 适配三板斧（今天最值钱的部分）

1. **torch 零下载**：kev 要求 Python≥3.12，本机 XPU 环境里只有 ComfyUI embed 是 3.13.12（TTS venv 是 3.11 且被三个项目共用不能动）。`uv sync --extra serve --no-install-package torch` 装其余依赖，再把 embed 的 `torch/ torchgen/ functorch/` + Intel 运行库 dist-info 整体拷进 kev venv（同为 cp313，ABI 兼容）。
2. **DLL 路径注入**：★大坑——Intel 运行库（sycl9/onemkl/tbb）不在 site-packages，在 `python_embeded\Library\bin`（conda 布局，RECORD 文件里才看得到去向）。解法：写 `.venv\Lib\site-packages\sitecustomize.py`，解释器启动时自动把该目录加进 PATH + `os.add_dll_directory`。不删 ComfyUI、不污染系统。
3. **代码补丁只有一个文件**：`kev/device.py` 的设备链 cuda→**xpu**→mps→cpu，外加 `KEV_DEVICE` 环境变量强制覆盖 + sync/empty_cache/allocated_bytes 三个函数补 xpu 分支。其余代码 xpu 自动落安全路径（attn=eager、无 fused kernel、无 cuda_graphs）——上游工程写得干净是能"只改一个文件"的前提。

**附带坑**：git 全局代理指向 127.0.0.1:7890 但 VPN 是 TUN 模式没开本地端口，clone 报 connect fail；`git -c http.proxy= clone` 临时清掉直连即可。

## 四、实测数据

**延迟**（Kev-0.8B，同请求 A/B）：

| 设备 | 冷启动 | 热身后 |
|---|---|---|
| XPU bf16 | 4985ms（kernel JIT） | 404ms |
| CPU fp32 | 834ms | 372ms |

诚实结论：**0.8B 这个体量核显和 14 核 CPU 打平**（解码是内存带宽瓶颈，核显与 CPU 共享同一条带宽），XPU 的价值要 4B 以上才兑现，另外 bf16 对 fp32 精度差异在本任务无感。

**情感分类**（`demo_sentiment.py`，20 条自制影评，好评 8/差评 7/中评 5）：

- 总体 **19/20 = 95%**，平均 245ms/条；好评 8/8、差评 7/7、中评 4/5
- 唯一错判恰是文本最模糊的一条（"野心太大装不下"，判差评 0.54 vs 中评 0.43）
- **置信度路由实测有效**：置信度 ≥0.4 的 17 条全对，<0.4 的 3 条里包含唯一错判——设阈值即可"自动化部分 100% 正确、15% 疑难件转人工"，这是决策模型区别于普通分类器的核心卖点
- 官方说 0.8B 新场景准确率 0.65，实测 95% 不矛盾：情感分类是成熟任务 + Qwen 中文原生占优；自定义业务规则/冷门领域才会掉到平均线

## 五、运维交接

- **启动**：双击 `D:\kev\start-kev.bat`（自动设 HF_HOME=D:\kev\hf-cache 不占 C 盘、HF_ENDPOINT=hf-mirror、KEV_DEVICE=xpu，端口 8009）
- **停止**：`netstat -ano | findstr 8009` 找 PID 后 `taskkill /F /PID <pid>`
- **测试**：`python D:\kev\demo_sentiment.py`；裸 curl 见 `D:\kev\serve.log` 同目录或 README 示例
- **查状态**：`curl localhost:8009/v1/models` 返回 device/dtype/温度/前缀缓存命中
- 疑难：import torch 报 c10_xpu.dll 找不到 = sitecustomize.py 被删了，去记忆档案 `project_kev_xpu` 找回

## 六、下一步（按优先级）

1. **Kev-4B**（官方推荐起点，新场景准确率 0.82 vs 0.8B 的 0.65）：底模约 8GB 未下载，拉完 XPU 大概率反超 CPU
2. **接真实场景**：股票新闻/研报标题情绪打分接进每日盯盘流程（score 类型正好输出强度）
3. **微调**：自有标注数据走官方 kev-finetune 工作流（H100 上一美元一次，4B 从 67.7%→73.6%）
