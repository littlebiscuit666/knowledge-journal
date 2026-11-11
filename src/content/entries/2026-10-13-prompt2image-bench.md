---
title: "Prompt2Image-Bench 天池提交与比赛包整理"
date: 2026-10-13
category: 技术
tags: [天池, 评测, 比赛, 日记归档]
draft: false
---

## 今日概况

今天最重要的事情，是把 **Prompt2Image-Bench——文生图模型语义一致性与美学质量评测挑战赛** 从一个研究想法，真正整理成了一套能够在天池上传、下载、提交和自动评分的比赛材料。

前面一直困扰我们的核心问题是：文生图质量往往依赖人工主观打分，很难给出唯一答案，也难以在天池容器里稳定自动评分。今天最终把比赛收敛成了两个非常清楚的客观任务：

1. **任务一：看图找提示词。**
   每道题提供同一提示词经过三个模型生成的三张图片，并给出十个高度相似的候选提示词。选手需要根据数量、位置、文字、动作和光影等细节，找出真正的原始提示词。

2. **任务二：看图识模型。**
   只给匿名图片，不提供测试提示词，让选手判断图片来自 `qwen-image-3.0`、`wan2.7-image` 还是 `z-image-turbo`。

两个任务都有唯一标准答案，评测阶段不需要人工裁判，也不需要调用外部付费 API。

---

## 今天完成的主要工作

### 1. 完成完整比赛包

建立了完整比赛目录：

```text
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1
```

目录中已经区分：

- 参赛者公开包；
- 主办方私有答案与审计资料；
- 天池离线评测程序；
- 基线和提交示例；
- 赛题说明、数据说明与正式发布清单；
- 发布压缩包；
- 天池上传专用文件。

### 2. 整理任务一数据

任务一当前包含：

- 10 道题；
- 每题 3 张跨模型图片，共 30 张图片；
- 每题 10 个候选提示词，共 100 个候选项。

公开数据中的关键文件：

```text
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\01_参赛者公开包\task1\questions.csv
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\01_参赛者公开包\task1\options.csv
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\01_参赛者公开包\task1\images
```

其中 `questions.csv` 负责记录每道题对应的三张图片路径，`options.csv` 负责记录每道题的十个候选提示词。公开文件中不包含正确选项。

### 3. 整理任务二数据

任务二当前包含：

- 90 张有标签训练图片，三个模型各 30 张；
- 30 张无标签测试图片；
- 测试提示词组与训练提示词组分离；
- 图片统一为 RGB、1024×1024 PNG；
- 已清除图片元数据；
- 训练集与测试集文件哈希无重复。

关键文件：

```text
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\01_参赛者公开包\task2\train.csv
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\01_参赛者公开包\task2\test.csv
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\01_参赛者公开包\task2\train_images
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\01_参赛者公开包\task2\test_images
```

### 4. 确定统一提交和评分规则

选手只需要提交一个 UTF-8 CSV：

```csv
task,item_id,prediction
task1,q001,opt03
task2,test_001,qwen-image-3.0
```

提交文件一共 40 行：

- 任务一 10 行；
- 任务二 30 行。

评分规则确定为：

```text
Task1 = Accuracy × 100
Task2 = Macro-F1 × 100
Final = 0.5 × Task1 + 0.5 × Task2
```

任务二不要求提交置信度。

### 5. 完成天池离线评测程序

评分程序路径：

```text
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\03_天池评测程序\evaluate.py
```

今天修复和验证了以下问题：

- 改为兼容天池 Python 3.9.12；
- 评测程序只依赖 Python 标准库，`requirements` 可以留空；
- 清除了 ZIP 中错误出现的 `__pycache__`；
- 增加评测程序 `README.md`；
- 能识别缺失行、重复 ID、非法类别和格式错误；
- 满分提交测试返回 100 分；
- 天池 JSON 入参模式测试成功；
- 固定参考输入测试得到预期分数 `13.333333`。

### 6. 完成天池上传专用文件

所有需要上传的文件集中在：

```text
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\07_天池上传就绪
```

平台字段与文件的对应关系：

| 天池页面 | 文件 |
|---|---|
| 数据集管理 → 公开数据集 | `public_dataset_upload.zip` |
| 评测配置 → 评测程序 | `evaluator_upload.zip` |
| 评测配置 → 参考输入 | `reference_input.csv` |
| 评测配置 → 标准答案 | `standard_answer.csv` |
| 评测配置 → requirements | 留空 |

具体路径：

```text
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\07_天池上传就绪\public_dataset_upload.zip
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\07_天池上传就绪\evaluator_upload.zip
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\07_天池上传就绪\reference_input.csv
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\07_天池上传就绪\standard_answer.csv
```

公开数据包约 199 MB。重新检查后确认公开 ZIP：

- 包含 30 张任务一图片；
- 包含 90 张任务二训练图；
- 包含 30 张任务二测试图；
- 包含提交样例、README 和公开赛题规则；
- 不包含标准答案；
- 不包含 `ground_truth`；
- 不包含 `audit` 或主办方私有文件。

### 7. 修复公开 README

发现最初公开 README 错误引用了压缩包外部的 `05_赛题文档/赛题说明.md`，选手下载公开 ZIP 后无法看到。

今天已经将 README 改为自包含版本，并在公开包根目录增加：

```text
COMPETITION_RULES.md
```

现在参赛者只下载公开 ZIP，就可以看到：

- 两项任务的完整定义；
- 数据目录说明；
- 提交格式；
- 合法类别；
- 评分公式；
- 竞赛约束。

公开 README 路径：

```text
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\01_参赛者公开包\README.md
```

### 8. 完成天池页面文案

今天还完成了以下宣传和说明文字：

- 大赛介绍；
- 中文活动亮点；
- 英文活动亮点；
- 赛制介绍；
- 精简版赛题与数据描述；
- 推荐的大赛标签。

核心宣传表达已经确定为：

> 看图猜提示词，看图识生成模型！

### 9. 完成大赛封面

生成了一张蓝紫色科技风横版封面，画面从左到右表现：

```text
提示词输入 → 多种生成图像 → 模型指纹识别
```

封面主标题：

```text
Prompt2Image-Bench
```

封面副标题：

```text
文生图模型语义一致性与美学质量评测挑战赛
```

推荐上传的封面：

```text
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\07_天池上传就绪\Prompt2Image-Bench_cover_1920x1080.jpg
```

高清 PNG 原图：

```text
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\07_天池上传就绪\Prompt2Image-Bench_cover.png
```

---

## 今天的阶段性成果

今天不只是“写了一份方案”，而是把比赛真正推进到了可以提交和展示的状态：

- 有清楚的双任务定义；
- 有真实图片数据；
- 有公开训练数据和隐藏标准答案；
- 有统一提交格式；
- 有离线自动评分程序；
- 有通过测试的天池上传文件；
- 有参赛者说明和完整赛题规则；
- 有平台介绍文案；
- 有正式比赛封面。

这意味着 Prompt2Image-Bench 已经从“一个比赛构想”，变成了一套能够被参赛者实际下载、开发、提交和评分的完整原型。

---

## 明日计划：PPT 与 PDF 介绍文档

明天的重点不是继续改数据，而是把今天完成的内容包装成一套清晰、有说服力的展示材料。

### 1. 制作答辩 PPT

计划结构：

1. 初赛评审提出了什么问题；
2. 为什么传统主观评分难以自动评测；
3. 我们如何将问题离散化；
4. 任务一“看图找提示词”的机制；
5. 任务二“看图识模型”的机制；
6. 数据集是如何生成和匿名化的；
7. 离线评分程序与客观标准答案；
8. DINOv2 与高频残差双流基线；
9. 当前实验结果与可行性证明；
10. 天池端到端提交演示；
11. 工业价值与后续扩容计划；
12. 总结。

PPT要尽量多使用图片、流程图和真实测试结果，少堆文字。封面可以直接使用今天生成的比赛封面。

### 2. 编写 PDF 介绍文档

PDF计划包含：

- 赛题背景；
- 初赛问题与解决思路；
- 双任务正式定义；
- 数据生成与划分方式；
- 参赛者提交格式；
- 天池离线评分流程；
- 基线算法与实验结果；
- 防泄漏与公平性设计；
- 当前局限；
- 正式赛扩容方案；
- 文件目录和使用说明。

PDF应当比 PPT 更完整，既能给评委阅读，也可以作为项目长期说明文档保存。

---

## 明天开始工作时先打开

```text
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\README.md
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\05_赛题文档\赛题说明.md
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\05_赛题文档\数据集说明.md
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\05_赛题文档\正式发布清单.md
D:\Python_workspace_311\阿里云天池\自己设计一个比赛\Prompt2Image-Bench_完整比赛包_v1\07_天池上传就绪\Prompt2Image-Bench_cover_1920x1080.jpg
```

今天完成了最难、也最关键的一步：**让比赛真正能够运行起来。**

