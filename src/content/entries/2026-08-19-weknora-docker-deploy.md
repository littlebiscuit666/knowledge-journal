---
title: "WeKnora 本地 Docker 部署踩坑记录"
date: 2026-08-19
category: 技术
tags: [weknora, docker, 镜像源, 日记归档]
draft: false
---

> 日期：2026-08-19
> 项目：[Tencent/WeKnora](https://github.com/Tencent/WeKnora) —— 腾讯开源的 RAG 知识库问答系统（Go 后端 + React 前端 + anydoc 文档解析）
> 状态：✅ 5 个镜像全部拉齐，待 `docker compose up -d` 启动验收

---

## 一、部署信息

| 项 | 值 |
|---|---|
| 部署目录 | `D:\WeKnora\WeKnora-0.7.2\WeKnora-0.7.2`（release v0.7.2 解压版） |
| 源码 clone | `C:\Users\yaya\WeKnora`（main 分支，比 v0.7.2 新 85 提交，193M） |
| 版本 | v0.7.2（`.env` 里 `WEKNORA_VERSION=v0.7.2`，注意 v 前缀！） |
| 端口 | 前端 80、后端 API 8080（起前确认没被 Label Studio 等占用） |
| 存储 | `STORAGE_TYPE=local` 本地盘，不需要 MinIO |
| 默认容器 | 只有 5 个：frontend / app / docreader / postgres(paradedb) / redis |
| 模型 | 启动后在设置页接厂商（DeepSeek / Qwen / 火山方舟 / Ollama 均可） |

重型组件（Milvus / Langfuse / Neo4j / Doris / ClickHouse / MinIO 等）全在可选 profile 里，默认不启动、不拉镜像、不占端口。

## 二、启动步骤（镜像已拉齐后）

```powershell
cd D:\WeKnora\WeKnora-0.7.2\WeKnora-0.7.2
docker compose up -d
```

1. 等约 30 秒（首次自动建库）
2. 浏览器开 **http://localhost**
3. **注册第一个账号**（自动成为系统管理员，没有内置默认账号）
4. 设置 → 模型管理，接入一个 LLM 后即可传文档问答

## 三、Release 版 vs git clone 的区别

| | git clone | Release 源码包 |
|---|---|---|
| 内容 | 代码 + 完整 git 历史 | 打 tag 时刻的代码快照 |
| 大小 | 193M（81M 代码 + 112M `.git`） | 约 30~80M |
| 能否更新 | `git pull` / 切分支 | 固定快照 |

- WeKnora 的 release 里**没有手动上传的二进制**（assets 为 0），只有 GitHub 自动生成的源码包，小的原因纯粹是砍掉了 `.git` 历史文件夹
- **两条路线部署时都要拉 Docker 镜像**；源码版的 `build:` 编译路线要先拉 golang/node 基础镜像 + 下 Go 模块 + npm 包，网络依赖一点没少，不建议为了绕网络问题走编译路线

## 四、踩坑全记录（按时间线）

### 坑 1：加速器"投毒"—— size validation 失败

**现象**：`docker compose pull` 卡住后报：

```
failed commit on ref "unknown-sha256:...": failed size validation: 1411 != 1225: failed precondition
```

**根因**：daemon.json 里配的 `docker.imgdb.de` 已经不是镜像站了——对任何 `/v2/...` 请求都返回 **HTTP 200 + 网页 HTML**，Docker 把 HTML 当镜像内容收下，commit 时尺寸校验爆炸。热门镜像（redis 等有缓存的）能正常拉，冷门仓库（`wechatopenai/weknora-*`）必炸。此前 8-18 部署 Plane 时的 `1396 != 1213` 就是同一个坑。

**安全方面**：毒内容当场被 containerd 拒收，没有落盘；镜像层不 run 不执行代码。Docker 的内容寻址校验（size + sha256 摘要）就是防这个的。

### 坑 2：公共加速器全军覆没

2026-08-19 实测 30+ 个公共镜像源，**没有一个**能匿名拉 weknora 镜像：

| 镜像源 | 状态 |
|---|---|
| docker.m.daocloud.io | 403（要登录） |
| docker.1ms.run | 冷门仓库 404 |
| docker.1panel.live / kejilion.pro | Cloudflare 1010 拦截 |
| hub.rat.dev | 拉取超时 |
| nju / iscas / cky / imgdb / hpcloud 等 | 已死 / 变网站 / 假货 |

**鉴别镜像源真伪的方法**：`GET https://<mirror>/v2/<repo>/manifests/<tag>`，走 token challenge 流程后看返回的是不是真 manifest JSON；返回 `text/html`、`application/problem+json` 的全是假货或死站。

### 坑 3：加速器和梯子不能共存

开了 Clash 后 pull 依然失败：错误全部指向 `docker.m.daocloud.io 403`。

**根因**：配置了 `registry-mirrors` 时引擎优先走加速器，且遇到加速器报错**直接失败、不回落官方源**——梯子虽然通了，请求根本没走到它。

**正确姿势**：用梯子拉镜像前，先清空加速器列表：

1. Docker Desktop → **Settings → Docker Engine**（⚠️ 必须 GUI 里改，直接改 `~/.docker/daemon.json` 会被 Docker Desktop 重启时盖回，实测过）
2. 删掉整个 `"registry-mirrors": [...]` 块 → **Apply & Restart**
3. `docker info | Select-String "Mirror"` 确认无输出
4. 重新 pull，直连 Docker Hub 官方源走 Clash

### 坑 4：官方镜像 tag 带 v 前缀

**现象**：报 `docker.io/wechatopenai/weknora-app:0.7.2: not found`（能到官方源了，但说不存在）。

**根因**：Docker Hub 上实际发布的 tag 是 **`v0.7.2`**（v 开头），而 README 升级示例里写的 "如 0.7.0" 是**错的**。

**修复**：`.env` 里改成 `WEKNORA_VERSION=v0.7.2`。

### 坑 5：Clash 节点中途掉线

某时刻走 7890 全部 HTTP 000（连 Google 都不通），docker 报 `EOF`——节点挂了/模式被切。换节点或重开模式即恢复。**判断技巧**：`curl -x http://127.0.0.1:7890 https://www.google.com -o /dev/null -w '%{http_code}'`，000 说明代理链路断了，别急着怪 Docker。

## 五、网络诊断方法论（沉淀）

拉镜像失败时按这个顺序排查，别瞎折腾：

1. **看错误类型**：
   - `size validation: X != Y` → 加速器投毒，删毒源
   - `403/404 from <mirror>` → 加速器拒绝，走梯子前先清空 mirrors
   - `not found`（来自官方源）→ tag 写错，去 Docker Hub 查真实 tag
   - `EOF / timeout` → 网络不通，查代理链路
2. **测代理是否活着**：curl -x 过 7890 访问 google
3. **查 Docker Hub tag**：`curl -x http://127.0.0.1:7890 "https://hub.docker.com/v2/repositories/<org>/<repo>/tags?page_size=100"`
4. **结论**：冷门镜像拉不动时别折腾公共加速器（2026 年基本全灭），直接开 Clash + 清空 mirrors 直连官方源

## 六、待办

- [ ] `docker compose up -d` 启动验收
- [ ] http://localhost 注册管理员账号
- [ ] 设置里接模型厂商（候选：DeepSeek / 火山方舟 / 本地 Ollama）
- [ ] 传文档测试 RAG 问答
- [ ] 周日过后如果平时要拉热门镜像，把 daocloud/1panel/1ms 加速器加回 GUI（imgdb.de 永久拉黑）

---

*相关备忘：Claude 记忆库里的 `docker-mirrors-status`（加速器现状）与 `weknora-deploy`（部署状态）两条记录与此文档同步。*
