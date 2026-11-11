---
title: "三个新数据集 + 评测速成材料 + 数据集上云 TOS"
date: 2026-09-17
category: 技术
tags: [数据集, 评测, tos, 日记归档]
draft: false
---

> 日期：2026-09-17 ｜ 执行：ZCode
> 即梦3.1 额度：**432/432 全部用完，零浪费**（416 数据集 + 16 人像）
> 结论：**4 个数据集共 864 张图全部质检通过并上云 TOS；评测面试材料包定稿** ✅

---

## 一、今日产出总览

| 产出 | 位置 | 状态 |
|---|---|---|
| 3 个新分类数据集（414 张） | `D:\zcode-workspace\syn-datasets\` | ✅ 质检 0 问题 |
| 6 大 Benchmark 真实样本+速记 | `D:\zcode-workspace\benchmark_samples\` | ✅ 含背诵版 md |
| 16 张时尚人像（4 风格×4） | `D:\zcode-workspace\images\2026-09-17\` | ✅ 一次全过 |
| 数据集上云（1743 对象/69.1MB） | 火山 TOS 桶 `dataset-picture`（北京） | ✅ 签名URL回读校验一致 |
| 简历评测项目文案 + Boss直聘自我介绍 | 对话内定稿 | ✅ 通用版+定向话术 |

## 二、syn-datasets：第二批合成数据集（414 张）

与 JimengSyn-10 同一套方法论（组合式 Prompt 固定种子 shuffle、manifest 溯源、质检、分层 8:2、SmallCNN 验证），工程化为**多数据集配置驱动**，新增**全局额度熔断**（`budget.json` 记账，到 428 自动停）。

| 数据集 | 类别（各 6×23=138 张） | LR基线 | CNN 25ep |
|---|---|---|---|
| weather_scenes | 晴/雨/雪/雾/黄昏/夜 | 73.3% | **93.3%** |
| vehicles_6 | 自行车/摩托/公交/卡车/火车/直升机 | 36.7% | **63.3%** |
| chinese_food | 饺子/包子/面条/火锅/烤鸭/月饼 | 33.3% | **63.3%** |

- 脚本: `gen_dataset.py`（并发 2 + 重试 + 熔断）、`verify_dataset.py`、`build_split.py`、`train_cnn.py`、`upload_to_tos.py`
- 验证故事线：颜色即信号的集基线就高（weather 73%）；靠形状的集必须 CNN（33%→63%），与 Syn-10 的 38.9%→77.8% 同构

## 三、Benchmark 速成材料包

用 hf-mirror 真实下载 6 个主流 benchmark 到本地（parquet/jsonl），配套三个工具：

- `browse.py`（终端翻样本）、`to_excel.py`（parquet→xlsx）、`六大Benchmark样本速记.md`（18 条真实样本+中文题意+判分方式+面试台词+数字卡）
- GSM8K 1319 / MMLU 57科1.4万 / HumanEval 164 / IFEval 541 / TruthfulQA 817 / SWE-bench Verified 500
- 覆盖的知识点：Kappa 公式（po/pe，实测 0.837）、五模态评测指标（FID/CLIP Score/FVD/WER/MOS/Pass@k/BFCL）、rubric、FID 公式与演示、JSONL vs Parquet 选型、对象存储→CDN→Redis 分层

## 四、TOS 上云实战（新技能）

桶 `dataset-picture`（cn-beijing），`upload_to_tos.py` 四个 SDK 接口完成全流程：

| 接口 | 入参要点 | 用途 |
|---|---|---|
| `TosClientV2(ak,sk,endpoint,region)` | 即梦 AK/SK 直接复用（有 TOS 权限） | 客户端 |
| `list_objects(bucket, marker)` | marker 翻页至 `is_truncated=False` | 增量比对（键名+大小） |
| `put_object_from_file(bucket,key,path,content_type)` | 键按 `数据集/划分/类别` 分层；MIME 按扩展名映射 | 并发 6 线程 22 秒传完 1743 个 |
| `pre_signed_url(Get,bucket,key,expires)` | 返回**对象**，取 `.signed_url` 字段 | 私有桶临时授权（1h），回读逐字节一致 |

架构结论：**元数据进 manifest/DB、二进制进对象存储、热点靠 CDN、高频计算靠 Redis**。

## 五、踩坑记录

1. **即梦额度**：冒烟 1 张因目录未建白费 1 次调用 → `run_task` 补 `mkdir(parents=True)`；冒烟图缺 manifest 溯源字段 → 删掉重生成补全（宁费 1 额度保账实一致）
2. **verify 脚本三连修**：ID 拼接重复（`foggy_foggy_000`）应直接用文件名；`all()` 短路导致后两个数据集没质检，改字典收集全跑；12KB 小文件阈值对雾景误报（8 张 9~11KB 雾景目视全部合格）→ 硬线降 5KB，5~12KB 降级为备注
3. **tos SDK**：`pre_signed_url` 返回对象不是字符串（`.signed_url`）；新 scipy `sqrtm` 返回值变多取 `[0]`
4. **scanned 文件即梦3.1 并发**：按用户实测上限锁定 workers=2，全程零 50430

## 六、账号状态与待办

- [x] 即梦3.1 额度 432/432 用尽（下次额度到账再续生成）
- [x] TOS 桶为私有读，分享用签名 URL（脚本现成）
- [ ] 可选：vehicles/food 用 ResNet18 迁移学习把 63% 往上拉
- [ ] 可选：知识库/FAQ 问答对质检小练习（补 AI评测工程师 JD 职责第 1 条）
- [ ] 可选：两个工程 git init（简历"熟悉 Git"立住）
- 简历定稿话术：评测项目段（「图像生成采集 → 标注规范 → 双盲标注 → 一致性质检 → 测试集构建 → 评测与归因」全链路，Kappa 0.837）+ 通用自我介绍，见今日对话
