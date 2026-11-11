---
title: "漫画后期合成速查手册"
date: 2026-08-25
category: 生活
tags: [漫画, 后期, 手册, 日记归档]
draft: false
---

> 《重生之巅峰时代》AI 漫画后期:底图 + 台本 → 加字成品 + 切片 + 预览全览
> 更新:2026-08-25(第13章批量跑通后整理)

---

## 0. 整体流水线

```
[小说原文 + 画面梗概]
       ↓ (手写)
   script.json   ← 台本(对话/旁白/气泡)
       ↓
   POST /api/comic/script (保存台本)
       ↓
   POST /api/comic/render (触发渲染)
       ↓
[lora-studio 内部 worker]
       ↓
final/01-12.png       (12 张加字成品)
final/strip.jpg       (全话条漫)
final/sheet.jpg       (9 宫格预览总表)
final/slice_01-05.jpg (5 张平台切片)
       ↓
   batch_render_13.py 一键复制
       ↓
[D:\Qoder-workspace\重生之巅峰时代\第N章\漫画第M话\]
   panels/  panels_text/  上传切片/  第N话-条漫.png  预览总表_N话_成稿.jpg
```

---

## 1. 渲染核心: `comic_render.py`

**位置**:`D:\lora-studio\comic_render.py`(lora-studio 项目内置,不依赖外部)

**调用入口**:通过 `lora-studio` 的 FastAPI HTTP API,不要直接调 Python

### 1.1 字体

| 元素 | 字体路径 | 加粗 |
|---|---|---|
| 常规 | `C:\Windows\Fonts\msyh.ttc` | 否 |
| 加粗 | `C:\Windows\Fonts\msyhbd.ttc` | 是 |

PIL `ImageFont.truetype(path, size)` 加载,代码里封装在 `font(bold, size)` 函数。

### 1.2 字号

| 元素 | 字号 | 来源 |
|---|---|---|
| **气泡字对话** | 36-52(用户标准,我用 32-36)| script.bubble.size |
| **底栏字幕**(旁白)| **46**(默认)| `draw_band` 内定 |
| **黑底卡标题**(闪回/数据卡)| **32** | `make_dark` 内定 |
| **黑底卡正文** | **38 / 46** | `make_dark` 内定 |
| **文字卡正文** | **40** 默认 | `make_text` 内定 |

**铁律**:气泡字 36-52 区间,长台词压小到 32-34,避免撞脸。

### 1.3 样式

| 元素 | 样式 |
|---|---|
| **气泡** | 白底 + 黑色描边(3px) + 圆角(0.9 × size) + 三角指向(40px 长)|
| **底栏字幕** | 半透明黑底渐变(8→240) + 白字(#f5f5f5) + 居中 |
| **黑底卡** | RGB(10,10,13) + 金字标题(0xf3cd7d) + 灰白正文(0x96969e / 0xeeeee0)|
| **文字卡** | 自定义 bg + 金色边框(3px) + 自定义字号 |
| **三角指向** | 气泡底部尖角,默认指向正下方(可 cx/cy 调)|

### 1.4 颜色预设(NAMED dict)

```
gold    = (243, 205, 125)
white   = (238, 238, 240)
gray    = (150, 150, 160)
light   = (180, 180, 185)
dark    = (30, 30, 30)
red     = (200, 60, 60)
```

---

## 2. script.json 完整字段规范

### 2.1 顶层

```json
{
  "width": 1200,    // 成稿宽度(高=底图按比例缩放)
  "gap": 19,        // 格间白条
  "panels": [ ... ] // 每格
}
```

### 2.2 三种 panel 类型

#### 类型 A:`img`(底图 + 气泡/字幕)

```json
{"pid":"01", "type":"img",
 "band":["旁白行1","旁白行2"],          // 底栏字幕(可选)
 "bubble":{"text":"台词","size":36}}     // 气泡(可选)
```

- `band`:list[str],2-3 行最舒服,默认字号 46
- `bubble.text`:str,对话内容
- `bubble.size`:int(可选,默认 40)
- `bubble.cx` / `bubble.cy`:可选,像素坐标,省略 → **YOLO 自动避脸定位**
- YOLO 未配置 → 默认位置(W/2, 150)顶部居中(可能撞脸)

#### 类型 B:`dark`(黑底文字卡,纯文字无底图)

```json
{"pid":"07", "type":"dark",
 "height":620,                          // 高度 px
 "title":"※ 前世·闪回",                  // 金字标题
 "rows":[
   ["陆辰","「稳定就好」"],              // 金名 + 白台词
   [null,"旁白描述..."]                   // 灰字无主语
 ]}
```

适合:前世/回忆/数据卡/章节卡/纯文字过渡

#### 类型 C:`text`(完全自定义)

```json
{"pid":"16", "type":"text",
 "bg":[10,10,13],                       // 背景色 RGB
 "height":900,
 "box":{"x0":140,"y0":80,"x1":1060,"y1":780,"color":"gold","width":3},
 "hlines":[{"y":240,"x0":300,"x1":900,"color":"gold","width":2}],
 "lines":[{"y":280,"text":"..","size":44,"bold":false,"color":"gray"}]}
```

适合:章节卡 / 结尾卡 / 终幕

---

## 3. lora-studio API

### 3.1 端点

| 方法 | 路径 | 用途 |
|---|---|---|
| `POST` | `/api/comic/script` | 保存台本(body: `{eid, text}`)|
| `GET` | `/api/comic/script?eid=XX&draft=1` | 读台本(draft=1 强制返回未保存草稿)|
| `POST` | `/api/comic/render` | 启动渲染(body: `{eid}`)|
| `GET` | `/api/comic/state?eid=XX` | 读状态(包含 `render` 字段)|

### 3.2 render 状态

```json
"render": {
  "running": true/false,
  "error": "",
  "done": 5, "total": 12,
  "strip": "final/strip.jpg",
  "slices": ["final/slice_01.jpg", ...],
  "sheet": "final/sheet.jpg",
  "notes": ["05 气泡@(900,1493) 默认(未检出人脸)"]
}
```

轮询直到 `running == false` 且 `done == total` 即完成。

### 3.3 完整调用示例

```python
import urllib.request, json, time

API = "http://localhost:8899"

def http(method, url, body=None):
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method,
                                 headers={"Content-Type":"application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read())

eid = "第51话"
text = open(f'D:/lora-studio/work/comic/{eid}/script.json', encoding='utf-8').read()

# 1. 保存台本
http("POST", f"{API}/api/comic/script", {"eid": eid, "text": text})

# 2. 启动渲染
http("POST", f"{API}/api/comic/render", {"eid": eid})

# 3. 等完成
while True:
    st = http("GET", f"{API}/api/comic/state?eid={urllib.request.quote(eid)}")
    r = st.get("render", {})
    if not r.get("running"): break
    time.sleep(4)
print("done:", r.get("done"), "/", r.get("total"))
```

---

## 4. 脚本工具

### 4.1 `batch_render_13.py` ⭐ 当前主力

- 路径:`C:\Users\yaya\.claude\tmp\batch_render_13.py`
- 用途:**批量渲染 + 复制到交付目录**
- 用法:
  - `python batch_render_13.py` 默认跑 51-55(第十三章)
  - `python batch_render_13.py 56 60` 自定义范围
- 每话自动流程:
  1. POST /api/comic/script
  2. POST /api/comic/render
  3. 轮询到 done==total
  4. 复制 final/ → 交付目录

### 4.2 `batch_generate.py`

- 路径:`C:\Users\yaya\.claude\tmp\batch_generate.py`
- 用途:**批量出底图**(调用 ComfyUI)
- 用法:
  - `python batch_generate.py` 51-165 全量
  - `python batch_generate.py 51 55` 指定范围
  - `python batch_generate.py 51 165 --retry` error 重提

### 4.3 lora-studio 内部

- `D:\lora-studio\app.py`:FastAPI 主程序(端口 8899)
- `D:\lora-studio\comfy.py`:ComfyUI HTTP 客户端
- `D:\lora-studio\comic_render.py`:渲染核心(本文档主角)
- `D:\lora-studio\yolo_face.py`:气泡避脸(YOLO 检测)

### 4.4 隧道 / 远程

- `C:\Users\yaya\.claude\tmp\autodl_forward.py`:SSH 隧道 6007→6006
- `C:\Users\yaya\.claude\tmp\autodl_ssh.py`:远程命令 paramiko helper

---

## 5. 交付目录结构

### 5.1 单话结构(沿用第1-12章老规矩)

```
D:\Qoder-workspace\重生之巅峰时代\第N章\漫画第M话\
├── panels\                    ← 裸底图
│   ├── ep{N}_01.png          (注意命名: ep + 章号 + pid)
│   ├── ep{N}_02.png
│   └── ... ep{N}_12.png
├── panels_text\              ← 加字成品
│   ├── 01.png
│   ├── 02.png
│   └── ... 12.png
├── 上传切片\
│   ├── slice_01.jpg ~ slice_05.jpg
│   └── sheet.jpg
├── 第M话-条漫.png           ← 全话条漫长图(jpg 改 png 后缀)
└── 预览总表_第M话_成稿.jpg  ← 9 宫格预览
```

### 5.2 章结构

```
D:\Qoder-workspace\重生之巅峰时代\第N章\
├── 漫画第X话\                ← 5 话(每章固定 5 话)
├── 漫画第X+1话\
├── ...
├── 漫画第X+4话\
└── 第N章封面_XXX.jpg         ← ★每章一张,即梦 4.0 出图
```

### 5.3 命名映射表

| final/(本机工作区) | 交付目录 |
|---|---|
| `final/01-12.png` | `panels_text/01-12.png` |
| `final/strip.jpg` | `第N话-条漫.png`(改后缀)|
| `final/sheet.jpg` | `预览总表_第N话_成稿.jpg` + `上传切片/sheet.jpg` |
| `final/slice_01-05.jpg` | `上传切片/slice_01-05.jpg` |
| `01_1.png` (底图) | `panels/ep{N}_01.png`(改名)|

---

## 6. 风格对齐(以前项目惯例)

### 6.1 字号节奏

- **短台词**(< 10 字):size 36-40
- **中等台词**(10-15 字):size 34-36
- **长台词**(> 15 字):size 32-34(可能仍撞脸,需要 cx/cy 手填)

### 6.2 旁白节奏

- **场景格**:1-2 行,简洁有力
- **呼吸格**:1 行短句,留白给画面
- **数据卡**:用 `type:dark`,信息密度高
- **闪回**:用 `type:dark` + "※ 前世·闪回" 标题

### 6.3 气泡避脸

- 默认 YOLO 自动定位,W=1200 / H=底图比例
- YOLO 未配置 → 默认顶部居中(W/2, 150)
- **遇到撞脸时手填 cx/cy**

### 6.4 章节卡标准(每章末尾或开头)

```json
{"pid":"16", "type":"text",
 "bg":[10,10,13], "height":620,
 "lines":[
   {"y":120, "text":"第十三章", "size":56, "color":"gold"},
   {"y":240, "text":"微信前夜", "size":48, "color":"white"},
   {"y":380, "text":"2012·春节", "size":36, "color":"gray"},
   {"y":480, "text":"—— 星辰OS 立项前夜 ——", "size":28, "color":"gray"}
 ]}
```

---

## 7. 异常处理

| 现象 | 原因 | 处理 |
|---|---|---|
| 气泡撞脸 | YOLO 未配置 / 长台词 | 手填 cx/cy 改位置 |
| 字体显示豆腐块 | 字体路径错 | 检查 `C:\Windows\Fonts\msyh.ttc` 存在 |
| 字幕挡图 | band 行太多 | 砍到 1-2 行,或拆出来 |
| 第7格闪回太突兀 | 用图版不用 dark | 改 `type:"img"` + 灰度滤镜 prompt |
| 9 宫格比例怪 | 切片数不对 | 默认 1200 宽 + gap 19,5 张切片 |
| 提交 400 "正在生成中" | batch_generate 占着 | 等 worker 释放 `_comic_running` |

---

## 8. 一句话总结

**台本手写 → POST API 渲染 → final/ 自动产出 → batch_render_13.py 一键复制到交付区**。每章 5 话 × ~12 格 × ~2 分钟渲染 ≈ 10 分钟一章节,5 章批量 ~50 分钟。

---

*文档生成于 2026-08-25,第13章批量跑通后总结。后续 14-35 章(22 章 × 5 话 = 110 话)按相同流程。*
