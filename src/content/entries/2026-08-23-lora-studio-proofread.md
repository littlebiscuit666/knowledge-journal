---
title: "lora-studio 校对台一条龙升级"
date: 2026-08-23
category: 技术
tags: [lora-studio, comfyui, 校对台, 日记归档]
draft: false
---

> 当天主线：校对台从「只出底图」升级为「出图 → 排版成稿 → AI 质检」一条龙；第二章封面收尾；第三章漫画开工（暂停在隧道断连）。

## 一、当天成果总览

| 事项 | 状态 |
|---|---|
| 第二章封面（1125×660 剪影版 + PIL 压字） | ✅ 已交付 |
| 校对台升级 Block 1（渲染+避脸+质检） | ✅ 全部完成 |
| 第6话成稿回归测试 | ✅ 30格与人工版**逐像素一致** |
| 第6话底图 mmx 批量质检 | ✅ 13/13 全 pass |
| 第三章拆话+分镜（第8-11话，4份JSON） | ✅ 已写好待用 |
| 第8话建格+生成 | ⏸ 6007隧道断连，12格提交失败待重跑 |

## 二、校对台升级了什么

### 1. 通用渲染器 `comic_render.py`
- 底图（校对台出的）+ 台本 `script.json` → `final/{pid}.png` 逐格成稿 + `strip.jpg` 条漫全览 + `slice_NN.jpg` 切片（上传用，1200≤h≤4200 贪心切+末片并回/垫白）+ `sheet.jpg` 4列预览总表
- 台本三种格子：
  - `img`：底图 + 可选 `bubble`（气泡，**cx/cy 省略则 YOLO 自动避脸**）+ 可选 `band`（底部渐变字幕）
  - `dark`：黑底对白流 `rows:[[人名,台词],[null,旁白]]`，可带 `title`
  - `text`：文本卡，`box`/`hlines`/`lines` 绝对定位（课程表、档案卡、尾卡都是它）
- 颜色支持命名色 gold/white/gray/light/dark/red 或 [r,g,b]

### 2. YOLO 自动避脸
- 方案：subprocess 调 ComfyUI 内嵌 Python（`D:\comfyui\ComfyUI_windows_portable\python_embeded\python.exe`，自带 ultralytics 8.4.108）+ `face_yolov8m.pt`（真人脸权重，对动漫脸检出良好）
- helper：`D:\lora-studio\yolo_face.py`，输出 `{"faces":[[x0,y0,x1,y1],...]}`，过滤 <32px 误检框
- `auto_bubble_pos`：6 个候选点里选离所有人脸框最远的；无脸默认顶部中央
- ★检测框是**原图坐标**，用到成稿上必须乘 `W/原图宽`

### 3. mmx 批量质检
- 前端「🎬 成稿」视图一键「🔍批量质检」，逐格 pass/fail 徽标，可强制重检
- 判定：`mmx vision describe --image <路径> --prompt <短问题>`
- **★prompt 必须短 + 「Answer YES or NO only.」**（长 prompt 会让模型输出推理半截文、没有结论）
- 状态机：`p["qc"]={"state","note"}`，重新生成图时自动清 qc + 标 final_stale；应用重启时残留 running 重置为 error

### 4. 新增接口
- `GET/POST /api/comic/script`（台本读写，?draft=1 拿草稿）
- `POST /api/comic/render`（后台渲染，逐格写 final）
- `POST /api/comic/qc`（force 可重检）

## 三、排掉的坑（按耗时排序）

1. **QC worker 幽灵死亡**（排查最久）：循环条件写成 `(p.get("qc") or {}).get("running")`——找的是 "running" 键，实际状态在 "state" 键下，恒为 None → 全部格子被 continue 跳过，done=0、无 traceback。前台探针复现才定位。
2. **mmx「无输出」**：mmx 输出的是**多行 pretty JSON**，逐行 `json.loads` 永远失败 → 改成先整体解析，失败再逐行，再退化纯文本。
3. **mmx 长输出=推理半截文**：见上，短 prompt 解决；rc=6 是网络偶发，subprocess 重试一次即可。
4. **元组赋值语法错**：`p["final"], p.pop(...) = fn, None` 不可给函数调用赋值，py_compile 抓出第二处。
5. **curl 中文 body 400**：Git Bash 里 `-d '中文'` 编码损坏 → `printf '\xe7\xac\xac6\xe8\xaf\x9d'` 写 UTF-8 字节到文件再 `--data-binary @file`。
6. **回归唯一差异**：原脚本课程表用 [20,20,20]，台本命名色 "dark"=(30,30,30) → 台本数据改回显式 RGB 后 30 格逐像素全对。

## 四、第三章开工进度

- 原文：`chapters/第三章_第一桶金的构想.md`，拆 **4 话**（沿用每话 12-13 张底图节奏）：
  - 第8话「夜市」— 操场夜市观察、摊位商业模式分析、树下记笔记、小鱼求助
  - 第9话「三个杀毒软件」— 进南区宿舍、苏晴登场、桌面惨状、四条诊断、灵魂三问
  - 第10话「第一个客户」— 清理操作、删文件之争、40秒开机、需求洞察
  - 第11话「IT服务社」— 宿舍立社、算账、韩雪松泼冷水、三样收获、「闪电清理」之名
- 分镜 JSON 已写好：`C:\Users\yaya\.claude\tmp\ep8~11_panels.json`（驱动器 `ep_build.py`）
- **第8话已建好 12 格**，但生成时 6007 隧道断连（SSH 被远端重置 10054），全部 error 待重跑
- **苏晴 LoRA 已在服务器上**：`suqing-v1.safetensors`，锚点 `suqing_char`（19岁黑长直开衫裙装；第三章提示词改写浅蓝卫衣+马尾即可覆盖服装）
- 现有锚点全集：luchen / zhaomingyuan / wanghaoran / suqing；韩雪松无 LoRA（仅1镜头，文字描述够用）

## 五、恢复作业的步骤

1. AutoDL 机器若关机先控制台开机，远端起 ComfyUI(6006)
2. `cd C:\Users\yaya\.claude\tmp && python autodl_forward.py`（后台常驻）→ 验证 `curl 127.0.0.1:6007/system_stats`
3. 校对台 8899 → 第8话 → 重新生成（12格 error 会全部重跑）
4. 依次 ep9/10/11 用 `ep_build.py` 建格 → 生成 → 质检 → 台本 → 渲染 → 切片交付
