---
title: "AE MCP 环境搭建 + 科技片头动画"
date: 2026-11-04
category: 技术
tags: [aftereffects, mcp, 片头, 日记归档]
draft: false
---

> 今天完成：5图合并PDF → CC2018残留清理 → PS COM操控验证 → **AE MCP安装跑通** → AE科技片头动画全流程验收

---

## 一、Adobe 软件环境（重点记录）

### 安装路径（都在 D 盘非标准位置，MCP 默认找不到，必须手动指路）

| 软件 | 版本 | 完整路径 |
|---|---|---|
| After Effects | 2026 (27.5.0 → 后升级) | `D:\AE-effect\Adobe After Effects 2026\Support Files\AfterFX.exe` |
| Photoshop | 2026 | `D:\Phtotshop\Adobe Photoshop 2026\` |
| ~~Photoshop CC 2018~~ | 已清理 | 原在 `C:\ps\`（只剩空壳+死链，已全部删除） |

### 今天清理的 CC2018 残留（全部完成）

1. `C:\ps\` 空文件夹 → 已删
2. 注册表 `HKCU\Software\Adobe\Photoshop\120.0` → 已删
3. 注册表 `HKLM\SOFTWARE\Adobe\Photoshop\120.0` → 已删（走 UAC 提权）
4. 开始菜单失效快捷方式 `C:\ProgramData\Microsoft\Windows\Start Menu\Programs\Adobe Photoshop CC 2018.lnk` → 已删（走 UAC 提权）
5. 保留：`...Photoshop\200.0`（PS 2026 在用，勿删）

---

## 二、AE MCP 安装记录（核心）

### 安装命令（最终生效版）

```bash
# Git Bash 下必须加 MSYS_NO_PATHCONV=1，否则 /c 被转成 C:/
MSYS_NO_PATHCONV=1 claude mcp add-json -s user aftereffects '{"command":"cmd","args":["/c","npx","-y","@kumoproductions/mcp-aftereffects"],"env":{"AE_MCP_EXE":"D:/AE-effect/Adobe After Effects 2026/Support Files/AfterFX.exe"}}'
```

配置写入 `C:\Users\yaya\.claude.json`（user 级，任何目录可用）。

### 关键环境变量

| 变量 | 值 | 作用 |
|---|---|---|
| `AE_MCP_EXE` | `D:/AE-effect/Adobe After Effects 2026/Support Files/AfterFX.exe` | AE装在非标路径时，MCP 靠它找到可执行文件（默认只搜 C:\Program Files） |
| `AE_MCP_READONLY` | `1`（可选） | 只读模式，只检查不修改 |
| `AE_MCP_ENABLE_EVAL` | `1`（可选，默认关） | 允许任意 ExtendScript 执行 |
| `AE_MCP_INSTANCE` | 实例名（可选） | 多开 AE 时指定目标实例 |

### 前置条件

- **Node.js ≥ 24**：本机 v24.12.0 ✅
- **AE 偏好设置**：`编辑 → 首选项 → 脚本和表达式 → 勾选"允许脚本写入文件和访问网络"`（不勾则 MCP 全部操作失败）
- 装完 MCP 要**重启 Claude Code 会话**工具才挂载（改 env 后要再重启一次）

### 今天踩的坑

1. **`claude mcp add -e "KEY=带空格的值"`** → CLI 解析失败报 "Invalid environment variable format"，改用 `claude mcp add-json` 写 JSON 解决
2. **Git Bash 路径转换** → `cmd /c` 的 `/c` 被转成 `C:/`，加 `MSYS_NO_PATHCONV=1`
3. **AE 非标安装路径** → 服务启动成功但连不上 AE（AE_NOT_FOUND），靠 `AE_MCP_EXE` 解决

---

## 三、中文版 AE 的属性名大坑（重要！）

MCP 操作里所有 effect 属性路径要用**当前语言版的显示名**（不是英文），matchName 永远是英文：

| 英文名 | 中文版显示名 | matchName |
|---|---|---|
| Glow（发光） | 发光 | `ADBE Glo2`（⚠️ 不是 ADBE Glo！） |
| Gaussian Blur | 高斯模糊 / 模糊度 | `ADBE Gaussian Blur 2` |
| Fractal Noise | 分形杂色 | `ADBE Fractal Noise` |
| Contrast / Brightness | 对比度 / 亮度 | -0004 / -0005 |
| Evolution | **演化**（不是"演变"） | -0023 |
| Scale（分形杂色内） | 缩放 | -0010 |

**查属性名的正确姿势**：不要猜！用 `project.list_effects` 查全库 matchName，用 `effect.list_on_layer` 查某层效果的实际属性名列表。

---

## 四、科技片头动画（合成"MCP测试"，1920×1080 / 30fps / 5s）

### 图层结构（从上到下）

1. **标题文字** —— "AI 成功操控 After Effects！"，90px 金黄色 #FFD94D
   - 入场 0.25→0.95s：缩放 350%→100% + 模糊度 60→0 + 位置 y 565→540
   - 效果：高斯模糊 + 发光（半径30 强度1.2）
2. **副标题** —— "MODEL CONTEXT PROTOCOL"，28px 淡青白，字距300，1.0→1.6s 淡入到80%
3. **扫描光带** —— 10×300 白色竖条，1.15→1.75s 从 x520 扫到 x1400，发光（半径60 强度2）
4. **光线1/2/3** —— 1600×2.5 青色横线，分别在 0.35/0.65/1.0s 从左飞到右，透明度 0→100→0，发光
5. **星1~星5** —— 3~5px 白点，不透明度加 `wiggle()` 表达式闪烁
6. **星云** —— 纯色层 + 分形杂色（对比度110/亮度-70/缩放260/演化表达式 `time*40`），图层不透明度12%，混合模式"添加"

### 制作流程经验

- 全程用 `batch.run`（参数名是 `ops` 不是 commands），一次一个撤销组，失败自动回滚
- 改完用 `ae_render_frame` 渲关键帧拼 contact sheet 自己看效果 → 发现星云太亮 → 调参 → 重渲，**闭环调参 2 轮到位**
- 工程未保存（故意不存盘），想保留就 Ctrl+S 存成 .aep

---

## 五、PS 操控备选方案：COM 自动化（零依赖）

不用装任何东西，`cscript` + VBS 直接操控 Photoshop：

```vbs
Set app = CreateObject("Photoshop.Application")
WScript.Echo app.Version          ' 27.5.0
WScript.Echo app.Documents.Count  ' 正在打开的文档数
```

测试脚本在 `C:\Users\yaya\.claude\tmp\`：`ps_com_test.vbs`、`ps_doc_check.vbs`
AE 也有 COM 但 MCP 方案更全（渲染回看/撤销组/弹窗处理），优先 MCP。

---

## 六、今天下载/安装的清单

| 项目 | 版本 | 用途 | 状态 |
|---|---|---|---|
| `@kumoproductions/mcp-aftereffects` | 0.3.2 (npx) | AI 操控 AE | ✅ 已验收 |
| After Effects 2026 | 27.5+ | 视频特效 | ✅ 今天新装 |
| Photoshop 2026 | 27.5.0 | 图像处理 | ✅ |
| ~~Photoshop CC 2018 残留~~ | - | - | 🗑️ 已清除 |

### 相关产物路径

- 演示渲染图：`C:\Users\yaya\.claude\tmp\ae_scifi_final_sheet.png`
- 首版演示帧：`C:\Users\yaya\.claude\tmp\ae_demo_frame.png`
- PDF成品：`C:\Users\yaya\Downloads\微信图片合并_20261104.pdf`（5页，顺序 713→717）
- MCP 配置：`C:\Users\yaya\.claude.json` → `mcpServers.aftereffects`
