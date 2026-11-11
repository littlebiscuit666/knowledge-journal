---
title: "第 22 章（96-100 话）渲染收尾实战"
date: 2026-08-25
category: 生活
tags: [漫画, 渲染, 批量出图, 日记归档]
draft: false
---

> **性质**:接力文档。下次agent读到本文 = 知道项目进度到22章已交付,所有脚本/路径/坑位/参数都备齐。
> 配套手册:`2026-08-25_漫画后期合成速查手册.md`(字段规范/API/字体)
> 配套踩坑:`2026-08-25_重生之巅峰时代批量出图踩坑总结.md`(出图链路坑)

---

## 0. 当前进度(2026-08-25 16:xx 收尾时)

| 章 | 话 | 状态 |
|---|---|---|
| 第1-12章 | 第1-50话 | ✅ 已交付(2026-08-24前) |
| 第13章 | 第51-55话 | ✅ 已交付(2026-08-25) |
| 第14-21章 | 第56-95话 | ✅ 已交付(本日批渲染) |
| **第22章** | **第96-100话** | **✅ 今日收尾(本实战)** |
| 第23-30章 | 第101-150话 | ⏳ 底图已出,待写台本+渲染 |
| 第31-33章 | 第151-165话 | ⏳ 底图未生成(底图停在147话,后续还没跑) |

---

## 1. 本次实战流程(2026-08-25 一次过)

### 1.1 链路在跑

- lora-studio `http://localhost:8899` (FastAPI)
- ComfyUI 隧道 `localhost:6007` → AutoDL:6006 (paramiko SSH 长连接,PID 45108 LISTENING)
- final/ → 渲染管线(本机Windows PIL)

### 1.2 步骤清单

| # | 操作 | 命令/脚本 | 结果 |
|---|---|---|---|
| 1 | 探查 | `ls D:\lora-studio\work\comic\第{97..100}话/` | 底图+script.json全有 |
| 2 | precheck | `python precheck.py 97 98 99 100` | ❌ 第97话L42 + 第98话L25 JSON坏 |
| 3 | 修JSON | Edit 把 `"X"` 改成 `「X」` | ✅ 4话全过 |
| 4 | 渲染 | `python batch_render_22_text.py` (后台) | ✅ 96=12/12 97=11/11 98=12/12 99=12/12 100=12/12 |
| 5 | 复制 | 直接调 shutil 复制 final/ → 交付目录 | ✅ 5话交付齐 |

### 1.3 坑 1:JSON 嵌套双引号(本实战首次踩)

- 症状:precheck / API POST 都报 `JSONDecodeError: Expecting ',' delimiter`
- 根因:对话文本里的 `"李总"` `"方向对，时机不对"` 用了英文双引号,在JSON字符串里嵌套,提前截断
- 解法:统一改用中文角引号「」 或 转义 `\\"`
- 教训:写对话文字直接用「」中文角引号,别用英文""

### 1.4 坑 2:batch_render 复制时序错位

- 症状:渲染 state 报 12/12 ok,但 final/ 还在写盘,复制时只拷到一半
- 根因:poll_state 判断 `panels.status==ok` 但 worker 异步写盘未结束
- 解法:本实战发现后,**改为手动调 shutil 复制**(final/已稳定后再拷),绕开 batch_render 的复制函数

### 1.5 坑 3:batch_render_22_text.py 末尾 GBK 编码崩溃

- 症状:脚本最后 `print(f"  ✓ ...")` 时报 `UnicodeEncodeError: 'gbk' codec can't encode character '\u2713'`
- 根因:Windows 默认 stdout GBK,不能用 ✓ ✗ 字符
- 解法:`set PYTHONIOENCODING=utf-8` 或脚本里 replace 字符;**下次跑前一定带环境变量**

---

## 2. 路径/脚本/参数 速查表

### 2.1 工作区路径

| 用途 | 路径 |
|---|---|
| **底图 + 渲染中间产物** | `D:\lora-studio\work\comic\第N话\` |
|  └ 底图 | `D:\lora-studio\work\comic\第N话\{pid}_1.png` |
|  └ 渲染后成品 | `D:\lora-studio\work\comic\第N话\final\{pid}.png` |
|  └ 条漫全览 | `D:\lora-studio\work\comic\第N话\final\strip.jpg` |
|  └ 平台切片 | `D:\lora-studio\work\comic\第N话\final\slice_NN.jpg` |
|  └ 预览总表 | `D:\lora-studio\work\comic\第N话\final\sheet.jpg` |
| **交付目录** | `D:\Qoder-workspace\重生之巅峰时代\第N章\漫画第M话\` |
|  └ 裸底图 | `panels/{01.png, 02.png, ...}` |
|  └ 加字成品 | `panels_text/{01.png, 02.png, ...}` |
|  └ 全览 | `strip.jpg` |
|  └ 预览总表 | `sheet.jpg` |
|  └ 平台切片 | `上传切片/slice_NN.jpg + sheet.jpg` |
| **章节梗概(参考对话)** | `D:\Qoder-workspace\重生之巅峰时代\分镜预产\第N章_梗概.md` |
| **分镜预产JSON** | `C:\Users\yaya\.claude\tmp\ep{N}_panels.json`(到ep50;ep51+未生成,但底图由 batch_generate 直出) |

### 2.2 脚本位置

| 脚本 | 路径 | 作用 |
|---|---|---|
| **渲染核心** | `D:\lora-studio\comic_render.py` | PIL 加字+气泡+切片+预览,3种panel(img/dark/text) |
| **FastAPI 服务** | `D:\lora-studio\app.py` (端口 8899) | `/api/comic/{script,render,state}` |
| **YOLO 避脸** | `D:\lora-studio\yolo_face.py` | 气泡自动避脸(ComfyUI python_embed) |
| **批出图(底图)** | `C:\Users\yaya\.claude\tmp\batch_generate.py` | 调 ComfyUI 批量生底图 |
| **批渲染22章** | `C:\Users\yaya\.claude\tmp\batch_render_22_text.py` | 22章(96-100)批量渲染(末尾GBK坑,需env) |
| **precheck** | `C:\Users\yaya\.claude\tmp\precheck.py` | 验证script.json的img型pid对应底图 |
| **autodl SSH helper** | `C:\Users\yaya\.claude\tmp\autodl_ssh.py` | 远程命令 paramiko |
| **autodl 隧道** | `C:\Users\yaya\.claude\tmp\autodl_forward.py` | 本机 6007 → 远端 6006 |
| **批渲染13-21章** | `C:\Users\yaya\.claude\tmp\batch_render_{13..21}.py` | 历史章的批渲染脚本 |

### 2.3 API 协议

| 方法 | 路径 | Body | 返回 |
|---|---|---|---|
| `POST` | `/api/comic/script` | `{"eid":"第97话","text":"<script.json内容>"}` | `{"ok":true}` |
| `POST` | `/api/comic/render` | `{"eid":"第97话"}` | `{"ok":true}` |
| `GET` | `/api/comic/state?eid=第97话` | - | `{"panels":[{"pid":"01","status":"ok",...},...], "render":{...}}` |
| `GET` | `/api/comic/episodes` | - | `{"eids":[...]}` |

### 2.4 关键参数

- **成稿宽**:`width=1200`(script.json 顶层)
- **格间白条**:`gap=19`
- **气泡字号**:`size` 36-52(短<10字48-52 / 中10-15字42-46 / 长50+字36-40)
- **底栏字幕字号**:46(默认,在 draw_band 里)
- **字体**:`C:\Windows\Fonts\msyh.ttc` (常规), `msyhbd.ttc` (加粗)
- **YOLO 权重**:`D:\comfyui\ComfyUI_windows_portable\ComfyUI\models\ultralytics\bbox\face_yolov8m.pt`
- **YOLO Python**:`D:\comfyui\ComfyUI_windows_portable\python_embeded\python.exe`

### 2.5 命令速查

```bash
# 探 lora-studio / 隧道 / ComfyUI
curl -s --max-time 3 http://localhost:8899/api/comic/episodes | head -c 200
netstat -ano | grep ":8899\|:6007"

# precheck (避免哑巴错位)
"C:/Users/yaya/AppData/Local/Programs/Python/Python311/python.exe" "C:\Users\yaya\.claude\tmp\precheck.py" 97 98 99 100

# 批渲染(末尾GBK坑,必须UTF-8)
set PYTHONIOENCODING=utf-8
"C:/Users/yaya/AppData/Local/Programs/Python/Python311/python.exe" "C:\Users\yaya\.claude\tmp\batch_render_22_text.py"

# 手动复制 final → 交付(本实战用过,绕开batch_render复制时序坑)
"C:/Users/yaya/AppData/Local/Programs/Python/Python311/python.exe" -c "
import shutil
from pathlib import Path
WORK = Path(r'D:\lora-studio\work\comic')
DELIVER = Path(r'D:\Qoder-workspace\重生之巅峰时代\第二十二章')
for ep in [96,97,98,99,100]:
    final_dir = WORK / f'第{ep}话' / 'final'
    deliver_ep = DELIVER / f'漫画第{ep}话'
    for sub in ['panels','panels_text']:
        (deliver_ep/sub).mkdir(parents=True, exist_ok=True)
    for f in final_dir.glob('*.png'):
        if f.stem.isdigit() and len(f.stem)<=2:
            shutil.copy2(f, deliver_ep/'panels'/f.name)
            shutil.copy2(f, deliver_ep/'panels_text'/f.name)
    for extra in ['strip.jpg','sheet.jpg']:
        if (final_dir/extra).exists():
            shutil.copy2(final_dir/extra, deliver_ep/extra)
    up = deliver_ep/'上传切片'; up.mkdir(exist_ok=True)
    for s in final_dir.glob('slice_*.jpg'):
        shutil.copy2(s, up/s.name)
    if (final_dir/'sheet.jpg').exists():
        shutil.copy2(final_dir/'sheet.jpg', up/'sheet.jpg')
"

# 章节图(每章一张,即梦4.0→裁1125×660→PIL压字)
"mmx" 生成 1536×896 → PIL 裁 1125×660 → PIL 压字 → 交付目录/第N章封面.jpg
```

---

## 3. 下一步推进(下次开工从这里开始)

**目标**:第23章起(101话+)底图已出,要写对话台本 + 渲染 + 交付。

### 3.1 顺序

1. **写对话台本** — 23章(101-105话) → 24章(106-110) → ... 每章读 `第N章_梗概.md` 写 `第M话/script.json`
2. **precheck** — 每章写完跑一次,确认 pid 对齐底图
3. **批渲染** — 写或复用 `batch_render_{23..35}.py` 渲染(绕开 GBK 问题)
4. **复制交付** — 推荐手动复制(避开 batch_render 复制时序坑)
5. **底图补出** — 第148-165话还没底图,需跑 `batch_generate.py 148 165`

### 3.2 对话台本写作规范(沉淀)

- **对话文字统一用「」中文角引号**,绝不嵌套英文双引号
- 短<10字 size 48-52 / 中 10-15 字 42-46 / 长 50+ 字 36-40(用户8-24反馈)
- 每写完一话台本,**先打开 episode.json 的底图清单,逐格对画面与文字**
- precheck 自动验证 img 型 pid 都在底图清单(避免哑巴错位)

### 3.3 沉淀的复用模板

- `batch_render_22_text.py` 已包含:wait_idle / poll_state / 复制逻辑 → **直接改名做 batch_render_23.py 等**
- 但 copy_panels 要改成读 `final/` 而非顶层 glob(`comic_render.py` 输出在 final/ 下)

---

## 4. 一句话接力

**22章已交付。下次开工先 `cat "D:\Qoder-workspace\重生之巅峰时代\分镜预产\第23章_梗概.md"` → 按格写 `第101话/script.json` → precheck → 渲染(带 UTF-8 env)→ 手动复制交付。底图停在147话,后续148-165要先跑 batch_generate.py。**

---

*文档生成于 2026-08-25,第22章4话(97-100)补完交付后总结。*
