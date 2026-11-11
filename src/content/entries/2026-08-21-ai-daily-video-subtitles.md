---
title: "AI 日报视频 0820 期加字幕：项目总结"
date: 2026-08-21
category: 生活
tags: [ai日报, 视频, 字幕, 日记归档]
draft: false
---

日期：2026-08-21 · 项目目录：`C:\Users\yaya\videos\ai-briefing-0820`

## 一、交付物

| 文件 | 说明 |
|---|---|
| `C:\Users\yaya\Videos\ai-briefing-0820\renders\ai-briefing-2026-08-21_16-00-57.mp4` | **最终成片**：1920×1080 / 30fps / 2 分 9.4 秒 / 11.3 MB，含 37 条短语级内嵌字幕 + 女声（female-chengshu）配音 |
| `ai-briefing-2026-08-20.srt`（项目根目录） | 合并版外挂 SRT（37 条），可用于 B 站/视频号上传或 ffmpeg 烧录到其他版本 |
| `assets/audio/seg0..5.mp3 + .srt` | 六段配音及各自短语级 SRT（时间戳来源） |
| `compositions/captions.html` | 字幕子合成（37 个 clip，新闻字幕风深色胶囊） |
| `scripts/tts_sub.sh` / `scripts/build_captions.mjs` | 配音生成脚本 / SRT→字幕 clip 生成脚本 |

## 二、字幕方案（为什么不是"写个 SRT 再 ffmpeg 拼上去"）

- **时间戳精度**：SRT 若按文本估算，每条会漂移 0.3~1s，累计后口播和字幕明显错位。
  实测解法：`mmx speech synthesize --subtitles` 时，**`--text` 里每个换行 = 一条 cue 边界**，
  一次合成同时得到自然语速音频 + 短语级真实时间戳。
- **两个短段（<50 字）**换行/标点都会被合并成 1 条 cue → 改成逐句合成 + `ffmpeg concat`
  拼接，用逐段 ffprobe 时长做累加边界（seg0、seg5）。
- **字幕做进合成**（`captions.html` 子合成挂载在根轨道 2）而非后期烧录：
  Studio 预览可见、单次渲染出片、SRT 同时导出，且换音频重排时间轴后字幕跟着工程走。
- **TTS 不可复现**：同文本三次合成 28.98/28.80/28.73s → 重生成音频后旧时间全部作废，
  本轮按新 ffprobe 时长重算全片时序（总长 129.45s），并把 6 个场景的动画节拍逐一对齐到
  SRT 短语起点（含 f04 场景数据卡按实际口播顺序重排：4 款检查点 → Q4_0 → 97%）。
- 其余工程细节：gsap 从 jsdelivr CDN 改为本地 `assets/gsap.min.js`（工作日 CDN 不稳，
  两次 check 超时的根因）；长字幕胶囊与数据卡标签重叠 → 缩小胶囊（34px 字号）+ 数据卡
  上移收紧，最终 check 全绿（Layout 0/9、Motion 0、Contrast 52/52）。

## 三、token 主要耗费到哪里了（复盘）

按"量级从大到小"排，比例是估计值：

1. **上下文重复加载（约一半）**。每轮对话都要把整个会话历史重新发给模型计费。
   会话里装着：源 HTML 页面全文、8 个合成文件（约 2600 行）、几十次命令输出、
   3~4 次 check 的完整 JSON、若干截图。到后期上下文接近压缩阈值时，
   哪怕只跑一条 5 行的 ffprobe 也要背上十几万 token 的历史——**大头不是"思考"，
   是每轮重读自己的工作记忆**。这也是"感觉处理得很费力"的账单真相。
2. **截图视觉验证（约两成）**。每张 1920×1080 PNG 的读取/上链 + 视觉模型分析都不便宜；
   九宫格缩略图太小导致视觉模型两次误报"看不到字幕"，又多做了两次全分辨率单帧复核。
3. **check / lint 长输出（约一成）**。hyperframes check 输出很啰嗦，且其中两次因 CDN
   超时整轮作废——零进展但全额计费。
4. **试错循环（约一成）**。SRT 切分粒度试验（换行/双换行/句号 4~5 次合成对比）、
   cwd 漂移导致脚本报 MODULE_NOT_FOUND、重叠修复迭代读改 4 个文件、
   一次 Edit 猜错颜色重查重改。
5. **压缩后恢复（本轮开头）**。上下文耗尽自动压缩后，重新读取 4 个场景文件约 1400 行
   以恢复现场。

**教训**：这类"看起来一步"的需求（加字幕）实际是级联工程——重生成音频→全片时序重算→
所有动画节拍重对齐→字幕轨→防重叠→三重验证。下次可先问清"外挂 SRT 够不够"，
若只要外挂字幕，`mmx --subtitles` 出的 SRT 直接交付，成本不到本次的一成。

## 四、渲染时为什么一直弹窗

**弹窗 = hyperframes 的并行截帧 worker，每个 worker 是一个独立 Chrome 实例。**

本次渲染日志还原：
1. 首轮 3 个 worker（3 个无头 Chrome）走快速 drawElement 通道截帧；
2. 截到第 971 帧时**自校验失败**（31.2dB < 32dB 阈值，与真实截图对比）——
   半透明圆角字幕胶囊 + 投影在加速通道里渲染有细微差异，触发了保守判定；
3. 于是丢弃已截帧，**换 5 个截图模式 worker 从头重截**——又起 5 个 Chrome。

一次渲染共启动 3+5=8 个 Chrome 实例（Windows 下每个进程起来都会在任务栏闪窗），
所以看起来"一直在弹窗"。这是框架的容错设计而非故障，成片已通过校验。
另外日志提示：此安装的并行 drawElement 已自动关闭，**下次渲染会直接走截图通道，
不会再出现"起 3 个又推翻重来"的双倍弹窗**。想限制实例数可 `npm run render -- --workers 1`
（单浏览器，更慢更安静）。

## 五、复现链路（下次直接抄）

```bash
# 1. 配音+短语级SRT（每行一个短语；短段逐句合成再 concat）
mmx speech synthesize --voice female-chengshu --language zh \
  --subtitles --text "$(cat narration.txt)" --out seg1.mp3 --quiet
# 2. ffprobe 实际时长 → 排场景起点/时长 + 动画节拍对齐 SRT 起点
# 3. node scripts/build_captions.mjs   # SRT → 字幕 clip 子合成
# 4. npx hyperframes check             # 布局/运动/对比度全绿再继续
# 5. npm run render                    # 用户确认预览后才渲
```

## 六、日更流程优化（2026-08-21 追加）

以后每天出一个 HTML 做成同款视频，按收益排序的优化项：

1. **模板化（最大头）**：把本期工程抽成 `videos/ai-briefing-template`——根编排 + 6 个场景骨架
   + `build_captions.mjs` + `tts_sub.sh` 全部复用，每天只换文案/数字/日期。
   场景 CSS/动画不重写，token 省 7~8 成，日常只剩"填空 + 一次 check + 渲染"。
   模板内放一份 ~50 行 README，新会话开场只读它。
2. **每天开新会话**：本期 token 一半耗在"每轮重背历史"。模板就位后新会话零包袱启动。
3. **whisper-srt-local 补短板**（工具在 `D:\ai-tools\whisper-srt-local`，mp3→SRT）：
   流程改为 `mmx 合成整段 mp3 → whisper 出短语级 SRT`，扔掉 mmx `--subtitles` 的换行技巧
   和"短段逐句合成再 concat"补丁——时间戳从音频反推，TTS 随便重生成都不怕。
   注意：whisper 中文要断成短语级（一句 ≤15 字左右），否则字幕块太长。
4. **视觉验证降级**：模板首日已全分辨率验证过布局/重叠，日常只查当天新内容是否溢出
   （lint 报错才看帧），不再每次截图九宫格——省约两成。
5. **渲染固定 `--workers 1`**：单浏览器，安静，不再闪 8 个 Chrome 窗，速度差不了多少。
   > ⚠️ 此条当晚被证伪：`--workers 1` 仍起 5 个池进程且照样闪窗；根因是 Win11 Windows Terminal
   > 对 CREATE_NO_WINDOW 进程的闪窗 bug，解法见《2026-08-21_AI日报视频0821期自采管线总结.md》第五节。

## 七、Codex 追加：字幕时间轴拆分试验（2026-08-21）

> 以下内容由 **Codex（OpenAI）** 追加。

在不修改原始 0820/0821 工程的前提下，将 0821 期工程复制为独立试验项目：
`C:\Users\yaya\Documents\Codex-app-workspace\ai-briefing-template-trial`。

本次实际完成的优化：

1. **字幕按场景拆分**：原工程将 45 条字幕全部放在 `compositions/captions.html` 的同一轨道，
   HyperFrames 会报 `timeline_track_too_dense`。试验版改为六份字幕子合成：
   `captions-0.html` 至 `captions-5.html`，分别对应开场、四条新闻和收尾。
2. **字幕使用局部时间**：每份字幕子合成内部从 0 秒开始计时，由根合成负责设置场景的全局
   `data-start`。换配音或调整某个场景时，只需更新该场景，不必重算全部字幕的全局时间戳。
3. **生成脚本固化**：重写 `scripts/build_captions.mjs`，直接读取六份
   `assets/audio/segN.w.srt`，自动生成六个字幕子合成；同时补充 HTML 转义、稳定的 `id`、
   `data-hf-id` 和本地中文字体声明。
4. **保留原工程**：所有改动只发生在工作区试验副本中，
   `D:\AI日报视频\2026-08-21\video` 与 0820 工程均未被覆盖。

验证结果：HyperFrames 0.8.6 完整检查通过；Runtime 0 错误、Layout 0/9、Motion 0 错误、
Contrast 52/52。六个场景的中段快照均能正常显示画面与字幕，没有发现字幕遮挡或文本溢出。
目前只完成工程优化和关键帧预览，**尚未重新渲染优化版 MP4**；原 0821 成片仍位于
`D:\AI日报视频\2026-08-21\ai-briefing-2026-08-21.mp4`。

—— **Codex（OpenAI），追加于 2026-08-21**
