---
title: "MuseScore 桥接批量写入与踩坑（插件 v0.9）"
date: 2026-10-29
category: 工具
tags: [musescore, 乐谱, 插件, 日记归档]
draft: false
---

## 今天做了什么

给自建的 MuseScore↔AI 桥接（agent_bridge.qml + 8766 helper）做了两件事：**插件升级 v0.8→v0.9（批量写入）**，并用它写入了第一首四声部编曲《深渊苏醒》前 8 小节。

### 1. 编曲需求与实现

用户给了极低音主题动机（沉重、铜管与大提琴齐奏）：

```
m1: C(Do)      m2: D♭(b2 翻身)    m3: C
m4: G♭(b5 三全音威压)   m5: F→E♭(b3)   m6: C(收缩回根音, 混响尾音)
```

按此扩成 8 小节、四个声部（声部1=低音主题, 2=圆号, 3=钢琴, 4=小提琴）：

| 小节 | 声部1 低音主题 | 声部2 圆号 | 声部3 钢琴 | 声部4 小提琴 |
|---|---|---|---|---|
| 1 | C2 全音符 | C3 | C1+C2 八度 | 休止(潜伏) |
| 2 | D♭2 | A♭2 | D♭1+D♭2 | D♭5 高音睁眼进入 |
| 3 | C2 | C3 | C1+C2 | C5 |
| 4 | G♭2 三全音 | **C3 对峙=纯三全音** | G♭ 八度双砸(定音鼓感) | G♭4 |
| 5 | F2→E♭2 | A♭2→G♭2 平行下行 | F→E♭ 八度 | A♭4→G4 |
| 6 | C2 回根音 | C3 | C1+C2 | C4 沉底 |
| 7 | C2 尾音 | C3 | C2 变薄 | C5 高音回响 |
| 8 | C2 渐隐 | 休止 | 休止 | 休止(只剩共鸣) |

### 2. 插件升级 v0.9：批量写入

原来 `applyJsonText` 只认单条命令对象，4 个声部要来回投递 4 轮。改动（约 30 行）：

- 拆出 `applyOne(command)`：单条应用，成功返回 true，失败回滚（`endCmd(true)`）返回 false
- `applyJsonText` 加数组分支：`Array.isArray(parsed)` 时循环 `applyOne`，状态栏报 `Batch applied N/M commands`
- 单条路径行为不变，向后兼容

备份：`agent_bridge.qml.bak-0.8`（同目录）

### 3. 生成与投递

```bash
# 每个声部一条命令（--events 里 | 分小节，空格分事件，音符:时值）
python -X utf8 .../build_command.py --staff 1 --start 1 --measures 8 \
  --events "C2:w | Db2:w | C2:w | Gb2:w | F2:h Eb2:h | C2:w | C2:w | C2:w" \
  --summary "低音齐奏主题" --out cmd_s1.json
# 4 条各自生成后，合并成 JSON 数组写入 latest_command.json
```

用户点一次 "Load Latest + Apply" → `Batch applied 4/4` ✅

## 踩坑记录

1. **helper 默认没跑**：curl 8766 报 exit 7（连接拒绝），此时点 "Read Current Score" 是静默失败的——POST 发不出去，文本框有回显但磁盘没存。磁盘上 `current_score_snapshot.json` 还是 7 月 6 日的旧谱，差点拿旧快照当现状。→ 开工先起 helper：
   `python -X utf8 C:/Users/yaya/.codex/skills/musescore-json-plugin/scripts/serve_queue.py --port 8766`（后台）

2. **"Apply failed: Unknown action: undefined"** = 插件窗口还在跑旧版代码。**编辑 .qml 后必须完全关闭插件窗口、从 Plugins 菜单重新打开**才生效（QML 是每次启动插件时才从磁盘加载，不是 MuseScore 启动时缓存）。批量数组进了旧代码 → 被当成单条命令 → `action` 为 undefined。

3. **快照是"手动快照"**：只有点 "Read Current Score" 才 POST 更新磁盘文件；apply 命令之后快照不会自动刷新。核对写入结果要在应用后再点一次 Read。

4. **快照没有乐器名**（MuseScore API 限制），声部→乐器映射只能问用户。且**钢琴是大谱表、占两行 staff**——按"一个乐器一行"去猜 staff 编号会写错行，改映射只需改 `--staff` 数字重发，音符不用动。

## 速查：完整工作流

```bash
# ① 起 helper（默认没跑，后台）
python -X utf8 C:/Users/yaya/.codex/skills/musescore-json-plugin/scripts/serve_queue.py --port 8766 &
# ② 读当前谱：插件点 "Read Current Score"，然后 AI 端
curl http://127.0.0.1:8766/snapshot
# ③ 生成命令（单条 --send 直写队列；多条 --out 存文件后合并成数组）
python -X utf8 C:/Users/yaya/.codex/skills/musescore-json-plugin/scripts/build_command.py \
  --staff N --voice 1 --start 1 --measures 8 --events "..." --summary "..." --send
# ④ 插件点一次 "Load Latest + Apply"（v0.9+ 数组一次全应用）
```

**事件语法**：科学音高 C4=中央C（`C2` 低音Do），升 `#` 降 `b`（`Db2`/`Gb4`）；和弦逗号分隔 `C1,C2:w`；休止 `r:w`；时值 `w/h/q/e/s` + `d` 前缀附点（`dh`=附点二分）。每小节必须凑满 4 拍（4/4），插件有前置校验。

**已知边界**：`replace_measures` 只能覆盖已有小节不能追加；写之前确保空小节够。
