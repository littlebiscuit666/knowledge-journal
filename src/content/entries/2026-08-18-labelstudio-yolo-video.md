---
title: "Label Studio 视频标注与 YOLO 数据集转换总结"
date: 2026-08-18
category: 工具
tags: [label-studio, yolo, 标注, 日记归档]
draft: false
---

> 日期：2026-08-18
> 成果：Docker 部署 Label Studio 1.23.0（D 盘 compose 管理）→ 视频画框跟踪标注 → 导出 JSON 解析 → 写脚本转成 YOLO 训练数据集 → 附一次 pip 污染全局环境的事故与回滚

---

## 一、部署架构（最终形态）

```
D:\LableStudio-workspace\          ← 项目根目录（自包含，整盘拷走都能复活）
├── docker-compose.yml
├── data\                          ← 全部数据都在这，备份它 = 备份一切
│   ├── label_studio.sqlite3       ← 数据库（项目/任务/标注/账号）
│   ├── media\upload\<项目号>\     ← 上传的原始视频
│   ├── export\                    ← 网页导出的 JSON
│   └── .env                       ← 密钥配置
├── datasets\project-2-yolo\       ← 转换出的 YOLO 数据集
└── tools\ls_video_to_yolo.py      ← JSON→YOLO 转换脚本
```

**docker-compose.yml：**

```yaml
services:
  label-studio:
    image: heartexlabs/label-studio:latest
    container_name: label-studio
    ports:
      - "8080:8080"
    volumes:
      - ./data:/label-studio/data
    restart: unless-stopped
```

**日常使用（唯一入口，不要再用 pip 装）：**

```powershell
cd D:\LableStudio-workspace
docker compose up -d      # 启动（其实随 Docker Desktop 自启）
docker compose stop       # 停止
docker compose down       # 删容器（data\ 不受影响）
```

网页：http://localhost:8080（首次注册的账号存本地 SQLite）。

### 关键认知：Docker 的存储分层

| 东西 | 在哪 | 要不要管 |
|---|---|---|
| 镜像/容器 | Docker Desktop 的 WSL 虚拟磁盘（C 盘内部） | 不用管，坏了重 run |
| **你的项目数据** | `-v` 挂载的 `data\` 目录 | **唯一要备份的东西** |

## 二、视频标注怎么玩

三种模板（Labeling Setup 搜 video）：

| 模板 | 用途 |
|---|---|
| Video Classification | 整段打标签 |
| **Video Object Detection with Tracking** | 帧上画框跟踪（本次用的，`<VideoRectangle keyframes="true">`） |
| Video segmentation | 时间轴划片段标事件 |

**框跟踪的核心是关键帧插值**：暂停画框 → 播几秒 → 拖框修正 = 新关键帧，中间帧自动插值。空格播放/暂停，`,` `.` 逐帧步进。

**视频格式**：只认浏览器能播的 MP4(H.264)/WebM；MOV/AVI 要先 `ffmpeg -i x.mov x.mp4` 转码。

### 踩坑：导出栏 YOLO/VOC 是灰的

不是 bug——**YOLO 是纯图片格式**（每图一个 txt + 归一化框），没有"视频"概念，Label Studio 检测到任务是视频就禁用。两条出路：

1. 抽帧建图片项目（`ffmpeg -i v.mp4 -vf fps=2 -qscale:v 2 frames\%06d.jpg`）→ YOLO 直接可导
2. 视频继续标（吃插值的省力），导 JSON 自己转 ← 本次选的路线

## 三、导出 JSON 结构解析

导出的 JSON 是"审计记录"，不是训练格式：

- `task.data.video` = 容器内路径；真实文件在 `data\media\upload\<项目号>\`
- `result[]` 里每个 `videorectangle` 区域的精华在 `value.sequence`——**稀疏关键帧列表**
- 坐标是**百分比、左上角原点**（不是像素、不是中心点）
- `framesCount/duration` = fps（本次 750/30 = 25fps）
- `enabled: false` 的关键帧 = 停用状态（本次帧 116 就是，需留意）
- 只有 2 个关键帧 → 其余 42 帧全是播放器实时插值，导出文件里**没有**

## 四、JSON → YOLO 转换

**脚本**：`tools\ls_video_to_yolo.py`（纯标准库 + 系统 ffmpeg，零依赖）
**用法**：`python tools\ls_video_to_yolo.py [导出json] [输出目录]`（不带参数用默认路径）

**做的事**：找本地视频 → 关键帧线性插值补齐每帧框 → ffmpeg 只抽标注帧段 → 输出 ultralytics 标准布局 + train/val 自动划分（每第 5 张进 val）。

**生成格式**：每张图一个 txt，每个目标一行

```
0 0.651111 0.570000 0.512593 0.500000
│    │        │        │        └ 框高（画面占比）
│    │        │        └ 框宽
│    │        └ 框中心 y
│    └ 框中心 x
└ 类别号（0=Man，看 data.yaml）
```

**与 JSON 的本质区别**：JSON 存"谁何时标的关键帧"（稀疏+元数据），YOLO 存"哪张图哪里是什么"（稠密+纯监督信号）——dataloader 要的是后者。

**坐标换算公式**：`cx=(x+width/2)/100, cy=(y+height/2)/100, w=width/100, h=height/100`

**验证**：转换后跑 PIL 画框脚本生成 `preview_box.jpg` 肉眼检查；若框整体偏一帧，改脚本头部 `FRAME_OFFSET=-1` 重跑。

## 五、事故记录：pip 全局装 label-studio 污染环境

**经过**：`pip install -U label-studio` 装进全局 Python311，连带抬高了 numpy 2.4.6 / pandas 3.0.5 / Pillow 12.3 / protobuf 6.33 / opencv 4.14 / grpcio 1.83，把 numba/scipy/gradio/streamlit/marker-pdf/surya-ocr/wandb 全部弄到不兼容版本上（满屏红不等于装失败，但运行时地基被抽了）。

**回滚**：

```powershell
python -m pip uninstall -y label-studio label-studio-sdk
python -m pip install "numpy<2.3" "pandas<3" "Pillow<11" "protobuf<6" opencv-python-headless==4.11.0.86 grpcio==1.71.2 grpcio-status==1.71.2
python -m pip uninstall -y google-cloud-audit-log google-cloud-logging   # label-studio 残留孤儿包
```

**教训**：
- Label Studio 这类全家桶应用只走 Docker，pip 版还会和容器抢 8080
- 全局 Python 是共享地基，装任何大包前先想它会抬哪些公共依赖（numpy/pandas/pillow 是重灾区）
- 卸载 ≠ 恢复：pip 装时抬高的版本**不会**随卸载降回去

## 六、后续路线

1. **扩数据**：Label Studio 多传视频多标框（当前 1 视频 × 1 目标 × 1.7s = 44 帧，toy 级别；可用模型至少要几百上千实例）
2. **重跑管线**：重新导出 JSON → `python tools\ls_video_to_yolo.py 新.json datasets\新数据集`
3. **训练**：整个数据集文件夹传 AutoDL →
   ```python
   from ultralytics import YOLO
   YOLO("yolo11n.pt").train(data="data.yaml", epochs=50, imgsz=640)
   ```
