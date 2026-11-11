---
title: "Blender MCP 本地接入与 3D 建模准备"
date: 2026-08-14
category: 工具
tags: [mcp, blender, 3d, 日记归档]
draft: false
---

> 日期：2026-08-14
> 一句话：把 `blender-mcp`（ahujasid 版，社区最主流）在本机配通，让 Claude 通过 MCP 远程操控 Blender 5.0 做 3D 建模。截至今天：Blender 主程序确认在 `D:\blender`、Python 包 `blender-mcp 1.8.0` 已装、Blender 插件 `addon.py` 已更新到最新版、Claude Code 的 MCP 配置已写入。**差最后一步：Blender 里点 Connect + 重启 Claude Code 会话联调。**

---

## 0. 背景

继 Penpot MCP（设计→前端，见 `2026-08-09_Penpot-MCP接入与前端工作流.md`）之后，再接一条 **AI 操控 3D** 的链路。Blender 默认不开放外部控制端口，必须靠一个 MCP 桥接插件，Claude 才能往 Blender 发 Python 指令建几何体、调材质灯光、导出模型。

今天目标：跑通配置，验证链路，为后续"自然语言 → Blender 建模"打底。

---

## 1. 架构：同样是"两段式"（跟 Penpot 一样的心智模型）

```
我(Claude Code)
    │  stdio (cmd /c blender-mcp)
    ▼
blender-mcp server（uv tool 装的，Python 进程）
    │  socket (localhost:9876)   ◀── 默认端口
    ▼
Blender 内运行的 addon.py（插件本体，按 N 键侧栏启动）
    │  bpy Python API
    ▼
Blender 5.0 场景（D:\blender\blender.exe）
```

**关键认知**：
- `uv tool install blender-mcp` 装的只是 **server 半边 + 命令行入口**，**不包含 Blender 插件本体**。
- Blender 插件本体 `addon.py` 要**单独从 GitHub 仓库下载**，在 Blender 里 `Install from Disk` 安装。
- Claude 永远操作"**你 Blender 里当前打开 + 点了 Connect 的那个场景**"，跟 Penpot 一样——Connect 后 Blender 不能关。
- 默认通信端口 **9876**（server↔addon 的 socket）。

---

## 2. 安装过程（已完成的部分）

### 2.1 Blender 主程序定位
- 之前只在 C 盘找，**漏了**。实际在 **`D:\blender\blender.exe`**（Blender 5.0，2026-02-12 左右装的）。
- 教训：本机软件别只查 C 盘，D 盘也要扫。

### 2.2 Python 包安装（用户在终端跑）
```bash
uv tool install blender-mcp
```
- 装到 `C:\Users\yaya\AppData\Roaming\uv\tools\blender-mcp\`（隔离 venv）。
- 版本：**blender-mcp 1.8.0**（含 mcp 1.29.0、uvicorn、pydantic 等依赖）。
- 命令行入口：`C:\Users\yaya\.local\bin\blender-mcp.exe`。

> ⚠️ 踩坑点：`blender-mcp 1.8.0` 这个 pip 包**不带 addon.py**。site-packages 里只有 server 代码（`__init__.py`/`server.py`/`config.py`/`telemetry*.py`），没有 Blender 插件本体。旧版教程说"装包就有 addon"已过时。

### 2.3 Blender 插件 addon.py 获取
- 从官方仓库下载：`https://raw.githubusercontent.com/ahujasid/blender-mcp/main/addon.py`
- 下载到：**`C:\Users\yaya\Desktop\blender_mcp_addon.py`**（122,557 字节，md5 `3bb146ba...`）

### 2.4 重要发现：之前其实装过旧版
- Blender 已有的插件：`C:\Users\yaya\AppData\Roaming\Blender Foundation\Blender\5.0\scripts\addons\addon.py`
- 对比：**是同一个插件，但版本不同**（官方在 2 月之后又更新过）：

| | 旧版（已装，2-12） | 新版（今天下载） |
|---|---|---|
| 大小 | 111,925 字节 | 122,557 字节 |
| md5 | `86d1a696...` | `3bb146ba...` |
| `bl_info` 版本 | 都标 (1, 2) | 都标 (1, 2)（作者没改版本号） |

### 2.5 备份旧版 + 更新
```bash
# 旧版备份（留底，可回滚）
addon.py  →  addon.py.bak_20260814
# 新版覆盖（已核对 md5 = 3bb146ba...）
```
- 备份路径：`...\Blender\5.0\scripts\addons\addon.py.bak_20260814`
- 现行插件路径：`...\Blender\5.0\scripts\addons\addon.py`（已是最新版）

### 2.6 Claude Code MCP 配置
写入 `C:\Users\yaya\.claude.json` 的 `mcpServers`：
```json
"blender-mcp": {
  "command": "cmd",
  "args": ["/c", "blender-mcp"]
}
```
- 其它 7 个 MCP（penpot/chrome-devtools/MiniMax/comfy-cloud/godot-ai/ardot/playwright）均保留未动。

---

## 3. 待完成：联调（重启会话后做）

### 3.1 Blender 端（用户操作）
1. 启动 `D:\blender\blender.exe`（若之前开着，彻底关掉重开，加载新插件）
2. 按 `N` 打开右侧侧栏 → 找 **Blender MCP** 面板
3. 点 **"Connect to MCP server"** → 状态变 connected
4. **保持 Blender 开着**（关了链路就断）

### 3.2 Claude Code 端
- 配置改了 `.claude.json`，**必须重启会话**才能发现新的 `mcp__blender-mcp__*` 工具。
- 重开后先验证：能调到工具 → 在 Blender 建个红色立方体证明链路通。

---

## 4. 文件路径速查

| 项 | 路径 |
|---|---|
| Blender 主程序 | `D:\blender\blender.exe`（5.0） |
| uv tool 安装目录 | `C:\Users\yaya\AppData\Roaming\uv\tools\blender-mcp\` |
| blender-mcp 命令行入口 | `C:\Users\yaya\.local\bin\blender-mcp.exe` |
| 新版 addon.py（下载副本） | `C:\Users\yaya\Desktop\blender_mcp_addon.py` |
| Blender 插件（现行） | `C:\Users\yaya\AppData\Roaming\Blender Foundation\Blender\5.0\scripts\addons\addon.py` |
| Blender 插件（旧版备份） | `...\scripts\addons\addon.py.bak_20260814` |
| Claude Code MCP 配置 | `C:\Users\yaya\.claude.json`（`mcpServers.blender-mcp`） |
| 默认 socket 端口 | `localhost:9876` |

---

## 5. 下次怎么继续

1. 启动 Blender → `N` 侧栏 → Blender MCP 面板 → 点 **Connect**
2. 重启 Claude Code 会话（让新 MCP 配置生效）
3. 跟我说"好了"，我验证 `mcp__blender-mcp__*` 工具可用 → 建个红色立方体联调
4. 联调通过后，告诉我具体想建模什么（角色 / 场景 / 道具），直接开干

---

## 6. 备注

- 本次还顺带做了两件 Penpot 相关的事，简要记录在此（与 `2026-08-09` 那篇互补）：
  - **用 MCP 操作 Penpot 几乎复刻了一个 HTML 页面**：通过 `mcp__penpot__execute_code` 读取 Penpot 设计稿的结构/样式/布局/动效，照数值生成对应 HTML，1-2 轮对图迭代收敛到视觉一致。复刻成品在 `D:\penpot-workspace\`（详见 08-09 那篇的"实战 4"）。
  - 这条 Penpot→HTML 链路已稳定可用，与今天新搭的 Blender→3D 链路并列，形成"设计/3D 双 MCP 工作流"。
