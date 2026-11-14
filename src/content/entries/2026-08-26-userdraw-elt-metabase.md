---
title: "userdraw 数仓 ELT 流水线 + Metabase 看板"
date: 2026-08-26
category: 技术
tags: [dbt, metabase, elt, 日记归档]
draft: false
---

> 2026-08-26 下午 | 从"dbt还能干嘛"到一条完整数据平台链路
> 前传：同日上午 DataFlow 部署、中午 dbt-jaffle_shop 入门（另两份文档）

---

## 一、今天下午搭成的完整链路

```
腾讯云MySQL (gz-cdb-xxxxx.sql.tencentcdb.com:2xxxx, userdraw库, MySQL5.7)
    │
    │  pull_from_mysql.py（同步层：一键拉5表到本地）
    ▼
D:\dbt-learn\userdraw\userdraw.duckdb · raw层（本地数仓，云端零压力）
    │
    │  dbt run / test（转换层：staging清洗 → mart业务表 + 9个质量测试）
    ▼
mart_churn_alert（流失预警200人） + mart_channel_quality（渠道质量5渠道）
    │
    ├──► export_bi.py ──► bi\*.parquet（给Power BI等桌面BI用）
    └──► bi\metabase.duckdb（只读副本，给Metabase网页看板用）──► Metabase(3030端口)
```

## 二、文件位置清单（核心）

| 东西 | 位置 |
|---|---|
| **userdraw dbt 项目** | `D:\dbt-learn\userdraw\` |
| 同步脚本（云端→本地） | `D:\dbt-learn\userdraw\pull_from_mysql.py`（内含连接串） |
| dbt 模型 | `models\staging\`（3个视图）+ `models\marts\`（2张表）+ `sources.yml` + `schema.yml` |
| 数仓文件 | `userdraw.duckdb`（删掉重跑①②即重建） |
| BI 导出物 | `bi\mart_churn_alert.parquet`、`bi\mart_channel_quality.parquet`、`bi\metabase.duckdb` |
| 直连分析脚本（不经dbt随手查） | `D:\dbt-learn\cloud_query.py`、`cloud_analyze.py` |
| **Metabase** | `D:\metabase\`（compose+data+plugins） |
| jaffle_shop 教学项目（保留） | `D:\dbt-learn\jaffle_shop\`（docs 8085） |
| 本文档 | 桌面\日记\ |

## 三、使用的环境

- **Python/venv**：全部复用 `D:\dbt-learn\.venv`（Python 3.11，dbt-core 1.12.3 + dbt-duckdb 1.11.0 + duckdb）。没装新环境，没碰全局
- **DuckDB mysql 扩展**：`INSTALL mysql; LOAD mysql;` 首次自动下载，实测兼容 MySQL 5.7
- **Metabase**：Docker 容器（daocloud 加速镜像 `docker.m.daocloud.io/metabase/metabase`），端口 **3030**（3000被Big-Data占、3001被Dify占）
- 凭据：云库 root 密码 `********`，**URL连接串里必须转义成 `%40******`**

## 四、日常命令（cmd，四步流水线）

```cmd
cd D:\dbt-learn\userdraw

:: ① 刷新云端数据 → 本地raw
D:\dbt-learn\.venv\Scripts\python.exe pull_from_mysql.py

:: ② dbt建模+测试（改了models里的SQL后跑）
D:\dbt-learn\.venv\Scripts\dbt.exe run --profiles-dir .
D:\dbt-learn\.venv\Scripts\dbt.exe test --profiles-dir .

:: ③ 导出BI用的Parquet + Metabase用的duckdb副本
D:\dbt-learn\.venv\Scripts\python.exe export_bi.py

:: ④ dbt血缘图（8086；Metabase看板直接开 http://localhost:3030）
D:\dbt-learn\.venv\Scripts\dbt.exe docs serve --profiles-dir . --port 8086
```

Metabase 容器管理：

```cmd
cd D:\metabase
docker compose up -d      # 起
docker compose ps         # 看状态
docker compose down       # 停（数据在D:\metabase\data，不会丢）
```

## 五、关键认知（为什么这么搭）

1. **云MySQL=数据的家（写入），本地DuckDB=研究工作台（分析）**——分析负载不打云端，零风险零费用
2. **EL 与 T 分离**：拉数据（pull脚本）和转换（dbt）各干各的，这就是 ELT；DataX/Flink CDC 是"拉"这层的自动化加强版
3. **DuckDB 是引擎不是同步工具**：同步（COPY/pull）只是它顺手干的活
4. **BI 选型**：Power BI Desktop（Windows免费、读Parquet、个人研究）vs Metabase（Docker网页、多人看板）——本机选了 Metabase，两条路都铺好了
5. **DuckDB 文件有锁**：dbt run 写入时看板连不上 → 解法=export_bi.py 自动复制只读副本 `metabase.duckdb` 给看板

## 六、踩坑记录

- ★ 密码含 `@`：URL 连接串必须 `%40`，否则解析错位
- ★ `gh-proxy.com` 下 GitHub `releases/latest/download/...` 会 302 到 404（下回 9 字节 "Not Found" 假 jar）——**必须先查到具体版本号拼 `releases/download/vX.Y.Z/文件名` 再下**
- ★ api.github.com 平日直连不稳定，查版本号需开 7890 代理
- ★ docker 里 Metabase 驱动日志：`docker logs metabase | grep -i duckdb`（"zip END header not found"=jar是坏的）
- MySQL 5.7 没有窗口函数——在 DuckDB 侧做分析的理由之一

## 七、最终成果（当晚完成）

- ✅ **Metabase 直连云MySQL**（放弃DuckDB驱动路线）：数据源名 `userdraw-cloud`（id=2），25张表已同步
- ✅ **Metabase MCP 接入 Claude Code**（重大）：
  - 新版Metabase内置MCP服务器 `/api/metabase-mcp`，**OAuth 2.0认证**（无API key入口，Admin→AI→MCP→Authorizations只是审计日志）
  - ★Docker必设 `MB_SITE_URL: http://localhost:3030`，否则OAuth握手用容器内部主机名→Failed to connect
  - 注册：`claude mcp add -s user --transport http metabase http://localhost:3030/api/metabase-mcp`（注意 -s user，默认local只对当前目录生效）
  - 认证：`/mcp` → metabase → Authenticate → 浏览器登录批准
  - 接入后我有12个工具：execute_sql/query/search/create_question/create_dashboard/update_dashboard等（读+写）
- ✅ **看板已建**：`http://localhost:3030/dashboard/2` 用户流失预警看板（流失预警榜table + 渠道有效LTV柱状图，收藏在"userdraw 分析"集合，question id=40/41）——全程通过MCP工具直接创建，没碰UI

## 八、可选的后续

- [ ] DuckDB 驱动装上后，可把数据源再指向本地 `bi\metabase.duckdb`（走dbt加工后的mart，正式口径）
- [ ] 看板加筛选器（按alert_level/VIP过滤）、加趋势图（event_login按天）
- [ ] Metabase 界面切中文：个人设置 → Localization
- [ ] gh-proxy 下 GitHub release 的坑：必须先查具体 tag 走 `releases/download/vX.Y.Z/文件名`，`latest/download` 会404
