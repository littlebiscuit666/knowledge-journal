---
title: "章节封面批量交付实战（第 13-35 章）"
date: 2026-08-25
category: 生活
tags: [漫画, 封面, 批量交付, 日记归档]
draft: false
---

> **性质**:接力文档。下次agent读到本文 = 知道章节封面已批量完成,脚本/prompt库/参数都备齐。
> 配套手册:`火山引擎即梦绘图API手册.md`(同目录,API详细)
> 漫画管线参考:`2026-08-25_22章97-100收尾实战记录.md`(内画交付节奏)

---

## 0. 任务概述

**目标**:为第13章《微信前夜》~第35章《星辰大海》(共23章)各做一张章节封面(横版,含章节名)。

**完成状态**:✅ 23张全部交付到 `D:\Qoder-workspace\重生之巅峰时代\第N章\第N章_封面.jpg`

**交付时间**:2026-08-25 下午启动 ~ 17:52 全部跑完

---

## 1. 章节封面规格

| 项 | 规格 |
|---|---|
| 底图尺寸 | 即梦4.0生成 1536×896 (2.39:1 宽幅) |
| 成稿尺寸 | PIL居中裁1125×660 (跟之前第2话章节图J1/J2一致) |
| 字体 | 顶「——第N章——」msyh.ttc 38pt 白字 / 主标 msyhbd.ttc 110pt 黄金字黑描边 / 底「《重生之巅峰时代》」msyh.ttc 26pt 白字 |
| 压字蒙层 | 顶部半透黑(α130) + 底部半透黑(α150);主标描边8向各偏3px再覆盖正色 |
| 锐化 | `ImageFilter.UnsharpMask(radius=2, percent=55, threshold=2)` |
| 保存质量 | JPG quality=92 |

**与既有章节图规范一致**(见 memory `project_comic_dianfeng_shidai.md` 中"★章节图规格"一条)。

---

## 2. 工作流程

### 2.1 单张章节封面

```
volc_j40.py (即梦4.0) --prompt "..." --width 1536 --height 896 --out chN_raw.jpg
         ↓
chapter_cover.py <raw> <N> "<章节名>" <out_jpg>
         (裁1125×660 + 压顶/中/底三段字 + 锐化 + JPG)
         ↓
D:\Qoder-workspace\重生之巅峰时代\第N章\第N章_封面.jpg
```

### 2.2 批量调用

```bash
# 默认跑14-35(22张)
python C:\Users\yaya\.claude\tmp\batch_ch_covers.py
# 跑指定章号
python C:\Users\yaya\.claude\tmp\batch_ch_covers.py 13 25 30
```

---

## 3. 路径/脚本/Prompt 速查表

### 3.1 脚本位置

| 脚本 | 路径 | 作用 |
|---|---|---|
| 即梦4.0 出底图 | `C:\Users\yaya\volc_i2i\volc_j40.py` | 1536×896 单图 prompt |
| 即梦3.1 兜底 | `C:\Users\yaya\volc_i2i\volc_t2i.py` | 50429/50430限流时降级 |
| 裁+压字 | `C:\Users\yaya\.claude\tmp\chapter_cover.py` | PIL三段压字成1125×660 |
| 批处理 | `C:\Users\yaya\.claude\tmp\batch_ch_covers.py` | 22章顺序调上面三个 |
| Prompt库 | `C:\Users\yaya\.claude\tmp\ch_prompts.py` | 14-35每章一句英文场景prompt + 中文标题 |
| 老章节图脚本 | `C:\Users\yaya\.claude\tmp\cover_j.py` | 历史上第2话J1/J2章节图(参考) |

### 3.2 关键prompt心法

- **绝不放** "封面/海报/poster/title/word"等诱导词(feedback确认)
- **不放中文**:即梦画中文会出乱码/拼音伪字;章节名一律后期PIL压
- **不放种子/loRA**:章节封面独立风格,不强求与内画陆辰长相一致
- **结构**: 主体(陆辰22→35岁+年龄递进) + 场景(对应章节首三格) + 风格(anime illustration + cinematic 2.39:1)
- **尺寸**:宽1536高896(2K级,符合4.0面积下限,避免字脸崩)

### 3.3 限流降级逻辑

`batch_ch_covers.py` 内已写:即梦4.0报 50429(QPS)/50430(并发) → 自动切3.1(1664×936 1K标清)。本次22章全程4.0单链路跑通,未触发。

---

## 4. 踩坑记录

### 4.1 子进程GBK解码崩溃

- **症状**: `subprocess.run(capture_output=True)` 拿 stdout/stderr 返回 None;后台线程报 `UnicodeDecodeError: 'gbk' codec can't decode byte 0xad`
- **根因**:Windows默认GBK;子进程Python用了requests/urllib时若输出含utf-8字符(≥0x80),capture线程崩溃,主线程的stdout变量变None
- **解法**: subprocess.run 加 `env=os.environ.copy()` 并设置 `PYTHONIOENCODING=utf-8` + `PYTHONUTF8=1`,且 `decode('utf-8', errors='replace')` 兜底
- **位置**: `batch_ch_covers.py` 内 `_run()` 函数

### 4.2 即梦在背景画"伪中文"

- **症状**: 即梦4.0生成图时,白板/横幅/屏幕区域会画"看起来像中文"的字符("2012 Jing BaoYong"等拼音,或"雷台冷论"类乱码)
- **根因**: 4.0默认开启 `use_pre_llm` 扩写,会"贴心地"把场景配套文字画上;模型无中文训练数据,出伪字
- **影响**:中央主标「章节名」黑描边压住关键区,背景屏框的伪字基本看不到;少数章(如14章横幅)有轻微伪字,接受度可
- **缓解(若以后想更纯净)**: prompt 显式写 `no text, no letters, no words, no writing on screens`;`scale` 调高到0.6让prompt话语权更大

### 4.3 主标挡脸问题(13章首版)

- **症状**: 13章首版中央主标「微信前夜」正好叠在陆辰脸部
- **现状**: 用户没让改,先按B位置(中部偏下,cy=H//2+50)出了;13章原版保留;14-35章统一沿用此位置
- **后续若要修**: 改 `chapter_cover.py` 内 `cy = H // 2 + 50` → `H * 3 // 4`(主标下移到腹部,脸完整露出);或 → `H // 3`(上移到上1/3黑顶下)

---

## 5. 交付清单(23张)

| 章 | 标题 | 文件大小 |
|---|---|---|
| 13 | 微信前夜 | 173 KB |
| 14 | 雷军的小米 | 197 KB |
| 15 | 星辰OS的突围 | 165 KB |
| 16 | O2O大战与外卖江湖 | 195 KB |
| 17 | 滴滴快的补贴大战 | 180 KB |
| 18 | 星辰支付的野心 | 229 KB |
| 19 | 字节跳动的启示 | 176 KB |
| 20 | 共享单车的泡沫 | 214 KB |
| 21 | 内容帝国的雏形 | 230 KB |
| 22 | 合并与抉择 | 197 KB |
| 23 | 下半场 | 179 KB |
| 24 | 下沉 | 151 KB |
| 25 | 取舍 | 211 KB |
| 26 | 至暗时刻 | 156 KB |
| 27 | 风口 | 166 KB |
| 28 | 危与机 | 176 KB |
| 29 | 重塑 | 159 KB |
| 30 | 奇点 | 203 KB |
| 31 | 远征 | 192 KB |
| 32 | 老友重聚 | 179 KB |
| 33 | 上市钟声 | 188 KB |
| 34 | 回到原点 | 188 KB |
| 35 | 星辰大海 | 233 KB |

---

## 6. 后续可推进(下次开工从这里开始)

### 6.1 历史章节(1-12章)补同款封面

- 旧1-12章没有章节封面;若想全套35章封面统一,补12张
- 章节标题已有:`分镜预产\第N章_梗概.md` 第一行就是「第N章《XX》」
- 复用 `chapter_cover.py` + `volc_j40.py`,prompt要新写(老章节画风更青涩)

### 6.2 全套封面预览总表

- 35张缩到统一尺寸拼一总表 `封面总览.jpg`(类似 `预览总表_第56话_成稿.jpg` 那种)
- 顺序:13章→35章,左→右上→下

### 6.3 主标位置微调

- 若用户后续反馈"主标挡脸",改 `chapter_cover.py` 内 `cy = H // 2 + 50`:
  - 下移到 `H * 3 // 4`:主标在人物腹部,脸完整
  - 上移到 `H // 3`:主标在上1/3,与黑顶衔接
- 重跑:`for ch in 13..35; do python chapter_cover.py ch{N}_raw.jpg {N} "..." 第N章_封面.jpg`

---

## 7. 一句话接力

**13-35章共23张章节封面已交付,管线脚本在 `C:\Users\yaya\.claude\tmp\chapter_cover.py` + `batch_ch_covers.py` + `ch_prompts.py` + 即梦4.0 `volc_j40.py`。下次若要补1-12章或出平台主图,直接复用。**

---

*文档生成于 2026-08-25,章节封面批量跑通后总结。*
