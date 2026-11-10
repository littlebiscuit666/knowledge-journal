---
title: "Penpot MCP 本地接入与设计转前端工作流"
date: 2026-08-09
category: 工具
tags: [mcp, penpot, 前端, 日记归档]
draft: false
---

> 日期：2026-08-09
> 一句话：把官方 `@penpot/mcp` 在本机跑通，连上 Penpot 网页端，验证"在 Penpot 里设计 → AI 直接读设计出前端代码"的链路，并产出第一个真实可填写的登录页 `D:\penpot-workspace\penpot-login.html`。

---

## 0. 背景

想找一个"画图 → 自动出前端"的流程。Penpot（开源 Figma 平替）官方出了 MCP server，AI 可以通过它直接读写 Penpot 设计稿。今天目标是跑通它，并搞清楚能做什么、不能做什么。

---

## 1. 架构：必须理解的"两段式"

Penpot MCP 是 **server + 浏览器插件** 两段，缺一不可：

```
我(Claude Code)
    │  HTTP  (localhost:4401/mcp)
    ▼
本机 MCP server  ◀── 这个是"本地"的（npx 起的进程，占 4400/4401/4402/4403）
    │  WebSocket (localhost:4402)
    ▼
浏览器里的 Penpot 插件  ◀── 插件跑在网页端
    │
    ▼
你打开的那个 Penpot 设计文件  ◀── 稿子在网页端/云端(design.penpot.app)
```

**关键认知**：
- "本地"的只是那个 **MCP server 桥梁程序**，不是设计稿。
- **Penpot 本身只有网页版**，没有"本地 Penpot"。稿子在云端，用浏览器打开。
- AI 永远操作"**你浏览器里当前打开 + 点了 Connect 的那个文件**"，换文件就要重连。

端口分工：
| 端口 | 用途 |
|---|---|
| 4400 | 给 Penpot 加载的插件文件（`manifest.json`） |
| 4401 | 给 MCP 客户端（AI）连的 HTTP 端点 `/mcp` |
| 4402 | 插件回连的 WebSocket |

---

## 2. 踩坑：`npx -y @penpot/mcp@stable` 一直报错

### 现象
反复运行都失败，报 `ELIFECYCLE Command failed with exit code 1`。

### 根因（systematic-debugging 定位）
真实错误藏在中间：
```
Error: listen EADDRINUSE: address already in use 127.0.0.1:4400
```
这个包启动时**同时**拉起 plugin（绑 4400）+ MCP server（绑 4402）。**它只允许跑一个实例** —— 上一次成功启动的实例还活着、占着 4400，第二次必然 `EADDRINUSE` → plugin 崩 → 整体 exit 1。

注意：报错时 MCP server 那半边（4402）其实已经正常启动并注册了 5 个工具，只是 plugin 半边崩了导致整体非零退出。**所以"报错"≠"没跑起来"**，很可能它一直在好好运行。

### 排查命令
```bash
# 看谁占了 4400/4402
netstat -ano | grep -E ':4400|:4402'
# 拿到 PID 后看是不是 node
tasklist //FI "PID eq <PID>"
# 确认命令行（是不是 @penpot/mcp）
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"ProcessId=<PID>\" | Select ProcessId,CommandLine | Format-List"
```

### 解决
- **如果只是想用它**：别再敲 npx，旧实例还活着就是好的。
- **如果要重启**：先杀再起
  ```bash
  taskkill //PID <4400的PID> //F && taskkill //PID <4402的PID> //F
  npx -y @penpot/mcp@stable
  ```

> ⚠️ 这个包的 npx 入口每次都 `pnpm install && build && start`（10秒+，绑死固定端口），**不适合被 MCP 客户端当 stdio 子进程反复拉起**。手动开一个常驻即可。Claude Code 连它用的是 **http transport**（4401/mcp），不是 stdio spawn。

---

## 3. 连接插件（浏览器侧，最后一步）

服务端起来后，还要在 Penpot 网页里把插件连上：

1. 打开 [design.penpot.app](https://design.penpot.app)，进一个设计文件（没有就注册+新建）
2. 左侧工具栏点 **插件图标** → **添加插件 / 开发模式**
3. 粘贴插件 URL：
   ```
   http://localhost:4400/manifest.json
   ```
4. 运行插件 → 弹出插件 UI
5. 点 **"Connect to MCP server"**，状态变 `Connected to MCP server` ✅
6. **别关插件 UI 窗口**（一关连接就断）

**浏览器坑**：从 `design.penpot.app`（外网）连本机 `localhost`，Chromium 142+ 会弹"是否允许访问本地网络"→ 点允许；Brave 要关 Shield；Firefox 无此限制。

版本匹配：装的 `@penpot/mcp@stable`（2.15.4）对应 design.penpot.app 当前 release，不会版本警告。

---

## 4. 验证 & 实战

### 验证连接
```
execute_code: return penpotUtils.getPages();
```
能返回页面列表 = 全通。报 `No Penpot plugin instances are currently connected` = 插件没连。

### 实战 1：画一张登录卡片（flex 布局）
用 `penpot.createBoard()` 建卡片，`addFlexLayout()` 做列布局自动撑高，子元素：标题/副标题/邮箱框/密码框/登录按钮/页脚。

**API 小坑（记下省得再踩）**：
- `penpot.createText()` ❌ → 必须传文本：`penpot.createText("欢迎回来")` ✅
- **默认字体不支持 600 字重**，用 400/700；否则报 `Font weight '600' not supported`
- `shape.layoutChild` 在元素**加入布局之前是 null**，要先 `parent.appendChild(child)` 再设 `child.layoutChild.horizontalSizing = "fill"`
- flex 容器自动撑高（verticalSizing "auto"）**有延迟**，读 bounds 要等一拍（下一次调用读才准）
- 失败的脚本会在画布留半成品，重跑前先 `penpotUtils.findShapes(s => s.name === "xxx", root).forEach(s => s.remove())` 清理

### 实战 2：导入本地图片
用 `import_image` 工具，传本地路径 + 位置 + 宽度，高度按原图比例自适应：
```
import_image(filePath="C:\\...\\xxx.png", x=700, y=180, width=320)
```
会在画布生成一个以图片为 fill 的 Rectangle。

### 实战 3：原型动效（转场）
Penpot 的"动效"= **原型转场**（slide/dissolve/push），不是 CSS 那种属性动画，**只在预览模式播放**。

```js
btn.addInteraction("click", {
  type: "navigate-to",
  destination: welcomeBoard,
  animation: { type: "slide", way: "in", direction: "left", duration: 300, easing: "ease-out" }
});
```
- 触发：`click` / `mouse-enter` / `mouse-leave` / `after-delay`
- 动作：`navigate-to` / `open-overlay` / `toggle-overlay` / `close-overlay` / `push` / `previous-screen`
- 看动效：选中起始 board → 右上角 ▶ Play → 点按钮

### 实战 4：可填写的表单（关键认知）
> **Penpot 原型预览不支持真正打字填表**（已知限制，跟基础版 Figma 一样）。输入框只能"假填"。
> 追踪：[GitHub #1098](https://github.com/penpot/penpot/issues/1098) / [社区 #476](https://community.penpot.app/t/create-a-text-field-tool/476)

所以要"真能填邮箱密码" → 必须做成**真实 HTML 表单**。AI 照着 Penpot 设计的数值（`#2563EB`/16px 圆角/700 字重/灰边输入框）写出 `penpot-login.html`：真 `<input type="email/password">` + 校验 + 点登录左滑切到"登录成功"（把 Penpot 那个动效也复刻了）。

---

## 5. 工作流总结：Penpot → 前端

```
你在 Penpot 设计  →  AI 用 MCP 读设计  →  生成前端代码到 D:\penpot-workspace\
```

**AI 能从 Penpot 读到**：
- 结构 & 布局（shape 树、flex/grid、父子关系）
- 精确样式（颜色/圆角/阴影/字号/字重/间距）
- 一键导出 HTML/CSS：`penpot.generateMarkup` / `penpot.generateStyle`
- 图片/图标：`export_shape` 导出 PNG/SVG
- 原型转场 → 翻成 CSS 动画 / JS 路由

**3 个实话实说**：
1. **Penpot 没真输入框** → 图层命名是关键：命名成 `email input` / `submit button`，AI 才能准确把方框→真 `<input>`/`<button>`。
2. **设计越干净代码越准**：flex 布局 + 语义化命名 + 组件化 → 代码干净；全绝对定位 + 默认名 → 能做但多清理。
3. **不是一键完美，是"快稿 + 对图迭代"**：AI 会导出渲染图回比对，1-2 轮收敛到视觉一致。

**目标栈可选**：纯 HTML/CSS/JS（单文件双击跑）/ React / Vue / Tailwind。

---

## 6. 速查表

```bash
# 启动（已是常驻就别再跑）
npx -y @penpot/mcp@stable

# 排查端口占用
netstat -ano | grep -E ':4400|:4402'

# 重启
taskkill //PID <PID_4400> //F && taskkill //PID <PID_4402> //F && npx -y @penpot/mcp@stable
```

| MCP 工具 | 用途 |
|---|---|
| `high_level_overview` | 读总览文档（静态，不需要插件连） |
| `execute_code` | 跑 JS 操作设计稿（需要插件已连） |
| `penpot_api_info` | 查 API 类型/字段（写代码前先查，避免瞎猜） |
| `export_shape` | 导出 shape 为 PNG/SVG（偶尔 http 报错，重试） |
| `import_image` | 本地图片导入画布 |

包路径（README 是权威文档）：
`C:\Users\yaya\AppData\Local\npm-cache\_npx\3c82a6444c262e31\node_modules\@penpot\mcp\`

---

## 7. 产出文件

- `D:\penpot-workspace\penpot-login.html` —— 登录页（真实可填表单 + slide 成功转场，样式与 Penpot 稿一致）

---

## 8. 下次怎么继续

1. 打开 Penpot，进设计文件，插件点 Connect
2. （Claude Code 侧已配置好 http MCP，工具自动可用）
3. 在 Penpot 里画新页面，**用 flex + 语义化命名**（尤其输入框/按钮）
4. 告诉 AI 目标栈（HTML / React / Vue / Tailwind）
5. AI 读设计 → 出码到 `D:\penpot-workspace\` → 对图迭代

---

## 9. 本机其他 Docker 服务（今日顺带排查）

### Penpot 应用本身（私有部署 design 端）

之前问的 "docker 启动命令" 其实是 **Penpot 自建**（不是把 MCP 容器化 —— `@penpot/mcp` 官方没有 docker 镜像）。官方自建命令（`-p penpot` 是 compose 项目名）：

```bash
cd /d/penpot
docker compose -p penpot -f docker-compose.yaml up -d
```

现在已在跑（7 个容器：frontend / backend / postgres / redis 等）。compose 文件在 `D:\penpot\docker-compose.yaml`。

> 跟 MCP 的关系：自建 Penpot 网页端打开后，照样装 MCP 插件、用 `http://localhost:4400/manifest.json` 连。因为自建端是 **http**，反而没有云端版那个 Chromium 本地网络(PNA)弹窗的麻烦。

### Dify（LLM 应用平台）

克隆在 `D:\Dify\dify\`，docker 目录 `D:\Dify\dify\docker\`，`.env` 已配、镜像 1.13.3 已就位。

```bash
cd /d/Dify/dify/docker
docker compose up -d          # 起
docker compose ps             # 看状态（全 healthy 再开网页）
docker compose logs -f api    # 排错
docker compose down           # 停（数据保留在 volumes/）
```

- 对外端口：**80**（`.env` 里 `EXPOSE_NGINX_PORT=80`）→ 访问 **http://localhost**，首次跳 `/install` 建管理员账号。
- 端口被占就改 `.env` 的 `EXPOSE_NGINX_PORT`（如 `8080`）再 up。
- 数据在 `D:\Dify\dify\docker\volumes\`，`down` 不删。

### 本机 compose 项目速查（`docker compose ls`）

| 项目 | 路径 | 端口/说明 |
|---|---|---|
| `penpot` | `D:\penpot\docker-compose.yaml` | Penpot 自建网页端 |
| `first-docker-web` | `D:\Codex_workspace\远程\docker-compose.yml` | 另一个 web 服务 |
| Dify（未起） | `D:\Dify\dify\docker\docker-compose.yaml` | 80 |
| Penpot MCP | npx 常驻（非 compose） | 4400 / 4401 / 4402 |
