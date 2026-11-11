---
title: "AI 日报视频 0821 期：自采新闻全流程项目总结"
date: 2026-08-21
category: 生活
tags: [ai日报, 视频, hyperframes, 日记归档]
draft: false
---

日期：2026-08-21 晚 · 项目目录：`D:\AI日报视频\2026-08-21\`
（上一篇：《2026-08-21_AI日报视频加字幕总结.md》，讲 0820 期加字幕，本文承接）

## 一、交付物

| 文件 | 说明 |
|---|---|
| `D:\AI日报视频\2026-08-21\ai-briefing-2026-08-21.mp4` | **最终成片**：1920×1080 / 2 分 23.3 秒 / 12.4 MB，45 条短语级内嵌字幕 + female-chengshu 配音（ffprobe 验收 h264+aac ✓） |
| `ai-briefing-2026-08-21.srt` | 合并版外挂 SRT（45 条，从 captions.log 生成） |
| `口播稿-2026-08-21期.md` | 自采自写的口播稿：每条新闻含卡面标题/数据卡字段/take 文案 + 备选新闻表 |
| `video\` | 本期 hyperframes 工程（含固化脚本，见第五节） |
| 记忆库 | `project_ai_daily_briefing_video.md` 已更新：工作目录、自采约定、whisper 管线、弹窗根治 |

## 二、本期内容（mmx search 自采 4 条）

1. **行业动态**：Anthropic 年化营收破 650 亿美元，冲刺史上最大 IPO（ARR/增速 115%/14 倍/10 月，take：目标超越 SpaceX 750 亿募资纪录）
2. **产品发布**：GPT-5.6 Sol「Ultrafast」750 tok/s、提速 14 倍（44GB 权重进片上 SRAM，take：Cerebras 晶圆级引擎绕开显存带宽）
3. **模型发布**：智谱 GLM-5.3 安全基准首次反超海外旗舰（CyberGym 84.5% / 269 个真实项目 / 2436 个漏洞，take：港股 AI 板块拉升）
4. **论文研究**：Google DiffusionGemma 扩散式生成文本 1500 tok/s（256 token 并行块 / 10% 训练预算，take：从 Gemma 4 微调，能力全保留）

场景结构沿用六场景：开场 + 4 新闻（amber/indigo/red/green 四色系）+ 收尾；场景时长 = 配音实测时长 + 0.82s 尾巴，首尾相接。

## 三、流程升级：从"用户给稿"到"全自采"

- **输入端不再依赖用户**：`mmx search query --q "..." --output json --quiet` 中英文源一次捞齐 → 选 5~6 条 → 写口播稿 md（卡面字段直接预填进稿子，后面改 HTML 时照抄）→ **用户过目后才进产线**。
- **别用 MiniMax web_search MCP**（API key 失效报 2049），搜索一律走 mmx CLI。
- 备选新闻写进稿子末尾表格，临时换条目不用重新搜索。

## 四、whisper 对齐字幕（本期最大工艺升级）

替代 0820 期的 `mmx --subtitles` 换行技巧（其 SRT 有 ASR 错字，如"本季度"识别成"本基督"；seg0 全合并成 1 条；seg3 SRT 干脆缺失）。

**原理：文本取口播稿原文（零错字），时间取 whisper small 的 word_timestamps，两边对齐：**

- whisper 转写得到词级时间戳 → 按口播稿的短语切分点归组 → 每个短语 cue 的起止 = 组内首末词时间；
- 对齐用 `difflib.SequenceMatcher`：等值块做锚点，块内线性插值；**数字/中文数字段两侧都折叠成 `#` 再匹配**（"650 亿美元"vs"six hundred fifty 亿"这类差异就靠它吃掉）；
- 后处理：时间戳单调化 + cue 间去重叠 + 每条 ≥0.5s；
- QA：逐段打印对齐率，本期平均 **95.7%**，45 条 cue。

**坑**：openai-whisper 的词字典键名是 `word` 不是 `text`（KeyError 半天才找到）。

**固化脚本**（都在 `2026-08-21\video\scripts\`，下期直接改参数复用）：
- `tts_0821.sh` — 六段 mmx 配音（Windows 坑：`--out` 先存相对路径再 mv）；
- `align_captions.py` — mp3 + 口播稿 → `assets/audio/segN.w.srt`；
- `build_captions.mjs` — 读 `.w.srt` 生成字幕 clip 块；换期只需改 `STARTS`/`AUDIO`/`SUFFIX` 三个常量。

## 五、弹窗根治（修正上一篇第四节的结论）

0820 总结以为弹窗 = "并行 worker 起了 8 个 Chrome"。**今晚证伪**：`--workers 1` 仍然起 5 个（浏览器池）且照样闪窗。真正根因三层：

1. `chrome-headless-shell.exe` 是 **console 子系统**程序（PE subsystem=3 实测）；
2. hyperframes→puppeteer→`@puppeteer/browsers` 的 spawn **本来就带着 `windowsHide: true`**（CREATE_NO_WINDOW）——代码层无锅、打补丁无效；
3. 但 **Win11"默认终端 = Windows Terminal"时，微软 conpty 的 bug 会让 CREATE_NO_WINDOW 进程照样闪出终端窗**。实证方法：PowerShell 每 150ms 轮询窗口标题，headless-shell 启动 → 抓到 1 次闪窗（宿主正是 WindowsTerminal）。

**解法（一次设置，永久生效）**：用户级环境变量指向系统 Chrome——

```
setx HYPERFRAMES_BROWSER_PATH "C:\Program Files\Google\Chrome\Application\chrome.exe"
```

系统 Chrome 是 GUI 子系统，**没有控制台可弹**，实测启动 0 闪窗，headless 渲染正常（Chrome/151）。这是 hyperframes 官方支持的变量，渲染/检查全走它，npx 缓存刷新也不受影响。已设置并验证。

## 六、复现链路（下次直接抄）

```bash
# 0. mmx search query 自采新闻 → 写口播稿 md（含卡面字段）→ 用户过目
# 1. bash video/scripts/tts_0821.sh          # 六段配音 seg0..5.mp3
# 2. python video/scripts/align_captions.py  # whisper 对齐 → segN.w.srt
# 3. ffprobe 六段实测时长 → index.html 场景 start/duration + frames/*.html 动画节拍
# 4. node video/scripts/build_captions.mjs   # 字幕 clip（改 STARTS/AUDIO/SUFFIX）
# 5. npx hyperframes check                    # 全绿再渲
# 6. npm run render -- --workers 1            # 成片归档 D:\AI日报视频\<日期>\
```

## 七、下一步（老问题 + 新教训）

1. **模板化仍是最优先**（0820 总结第六节第 1 条至今未做）：本期没有模板，6 个场景内容全手改 + 动画节拍逐条对 whisper cue，token 大头还是耗在这里。做模板时把"口播稿 md 的小节结构"写成模板 README。
2. **排查方法论**：纸上 grep spawn 调用点排查了半小时没结论，10 行 PowerShell 轮询窗口 + 两次对照启动 5 分钟定位。环境类问题先想"怎么观测"，再谈分析。
3. 渲染 5m38s/4300 帧，`--workers 1` 下时长可接受，保持。
