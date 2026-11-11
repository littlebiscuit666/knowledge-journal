---
title: "数据库选型全景（按业务场景）"
date: 2026-08-20
category: 技术
tags: [数据库, 选型, 架构, 日记归档]
draft: false
---

> 日期：2026-08-20
> 标 ★ 的为本机已亲手用过/在学（MySQL/PG/Redis/ES/Mongo/ClickHouse/TDengine/MinIO/DuckDB/Neo4j）

## 一图总览：按场景选库

```
业务交易 ──→ 关系型 OLTP：MySQL / PostgreSQL / 分布式：TiDB / OceanBase
快读快写 ──→ 缓存：Redis(→Valkey)
灵活结构 ──→ 文档：MongoDB
搜内容  ──→ 搜索引擎：Elasticsearch
跑报表  ──→ OLAP：ClickHouse / Doris / StarRocks
传感器  ──→ 时序：TDengine / InfluxDB
走关系  ──→ 图：Neo4j / NebulaGraph ★在学
喂AI   ──→ 向量：Milvus / Qdrant / pgvector ★RAG在用
存文件  ──→ 对象存储：MinIO / S3
单机分析 ──→ 嵌入式分析：DuckDB
```

## 分场景细说

### 1. OLTP 业务交易（订单/用户/账务）

| 库 | 现状 |
|---|---|
| **MySQL** ★ | 国内绝对霸主，招聘 JD 常识。2024 后生态动荡（Oracle 收紧、云厂商各立山头：AWS Aurora/阿里 PolarDB/Percona 转向），新项目份额被 PG 系蚕食 |
| **PostgreSQL** ★（WeKnora 的 paradedb 就是 PG17） | 强上升期。扩展生态爆炸：pgvector（向量）/ TimescaleDB（时序）/ postgis（地理）/ Citus（分布式）。国外新创默认首选 |
| **TiDB** | 国产分布式开源代表，兼容 MySQL 协议，一键水平扩缩容 + HTAP。互联网中厂渗透率高 |
| **OceanBase** | 蚂蚁出品，金融级（扛过双十一账务），信创名单常客。银行/保险岗位常要求 |

**选型逻辑**：单机够用 MySQL/PG；数据量或并发撑不住要水平拆分 → TiDB/OB。

### 2. 缓存（会话/热数据/排行榜）

- **Redis** ★：事实标准。2024 改许可证后 Linux 基金会分叉出 **Valkey**（AWS/谷歌站台），可能复制"MySQL→MariaDB"剧本
- **Dragonfly**：新一代多线程兼容实现，云原生新项目在用

### 3. 文档/灵活 Schema（用户画像、商品、日志原始档）

- **MongoDB** ★：该场景默认选择，BSON 贴对象模型，国内使用率第二高的 NoSQL
- 趋势：PG 的 JSONB 越来越能打，"文档库能干的事 PG 也能干"争论常年不休

### 4. 搜索与日志

- **Elasticsearch** ★：全文搜索+可观测性双料王者（许可变更曾分叉出 OpenSearch）
- **Loki**：只索引标签不索引正文，配对象存储成本 1/10，云原生监控圈很热

### 5. OLAP 分析报表（BI、行为分析、大宽表）——国内最卷最热

| 库 | 特点 |
|---|---|
| **ClickHouse** ★ | 单表聚合性能之王，实时数仓标配。join 弱、更新别扭 |
| **Doris / StarRocks** | 国产双雄，兼容 MySQL 协议、join 强、运维简单，**国内实时数仓首选，招聘需求量大** |
| **DuckDB** ★ | 单机嵌入式 OLAP 现象级爆款，"分析界的 SQLite"，本地 CSV/Parquet 直接 SQL |

### 6. 时序（IoT、监控、行情）

- **TDengine** ★：国产，为物联网优化（设备多、写入猛、按时间聚合），压缩率夸张
- InfluxDB（3.0 转向 Arrow/Parquet 架构重写）、**Prometheus**（监控事实标准）

### 7. 图（关系挖掘）

- **Neo4j** ★：单机最强、生态最全（Cypher 事实标准/GDS 算法库/APOC）
- **NebulaGraph**：国产分布式，大厂社交/风控在用
- 应用侧趋势：**GraphRAG** 让图数据库在 AI 时代翻红

### 8. 向量/AI（2024-2026 最热赛道）

| 路线 | 代表 | 现状 |
|---|---|---|
| 专用向量库 | **Milvus**（国产 Zilliz 开源）、Qdrant、Weaviate | 起初火爆，2025 后降温 |
| 传统库加向量 | **pgvector**、Redis、ES 8、MongoDB | "向量检索被现有数据库吸收"成主流判断；WeKnora 默认方案就是 PG 向量 |
| 混合检索 | BM25+向量混合+重排 | RAG 工程实际标准做法 |

前沿：Agent 记忆存储、多模态检索、GPU 索引下沉。

### 9. 对象存储 / 底座

- **MinIO** ★：S3 兼容事实标准，湖仓时代的"磁盘"；自建重型看 Ceph
- 嵌入式：**SQLite**（本地优先应用复兴）、LMDB

## 三个行业趋势

1. **一库多能 vs 专用库拉锯**：PG 什么都插一脚，专用库靠极致性能守阵地。面试标准答案：没有银弹，按数据规模、查询模式、团队运维能力选型
2. **国产化+信创是确定性红利**：OB/TiDB/Doris/StarRocks/TDengine/Milvus/openGauss 全在吃这波，JD 高频出现
3. **AI 重塑数据库形态**：向量成标配、混合检索成标配、agent-native 存储是未来；RAG+图+向量路线正踩在这条线上

## 附：驱动与语言生态（"每种语言都有对应的包吗"）

### 基本规律：协议 → 驱动 → 包

每个（服务器型）数据库都有一套网络协议，某语言想操作它就得有人实现这套协议——这个实现就是装的那个包（驱动）：

```
数据库服务端（监听协议：MySQL wire / Bolt / Redis RESP / HTTP）
      ↑ 网络协议
某语言的驱动包（pymysql / neo4j-java-driver / redis-py ...）
      ↑ 函数调用
业务代码（+ 可选 ORM：MyBatis / SQLAlchemy / GORM）
      ↑
后端框架对外暴露 REST API（Spring / FastAPI / Gin）
```

**驱动只负责"和数据库说话"，API 是框架的事**——两层是拼起来的。

### 支持程度分三档

| 档位 | 特征 | 例子 |
|---|---|---|
| **全覆盖档** | 官方/社区驱动覆盖所有主流语言，连接池/异步/重试齐全 | MySQL、PostgreSQL、Redis、MongoDB、ES |
| **重点语言档** | 官方只维护 3-5 门语言，其余靠社区（质量参差） | Neo4j（官方：Java/JS/Python/Go/.NET）、ClickHouse、Cassandra |
| **协议兼容档** | 直接说别人的协议，零成本继承生态 | 见下 |

实操要点：**选型先查目标语言的驱动成熟度**——冷门库最容易栽在驱动缺异步/没连接池/大结果集内存爆炸。

### 生态 Hack 1：协议兼容——新数据库最快的捷径

| 数据库 | 兼容协议 | 效果 |
|---|---|---|
| TiDB / OceanBase / Doris / **StarRocks** / PolarDB | MySQL 协议 | mysql-connector 直接连，Navicat/DataX/BI 零改造接入 |
| Valkey / Dragonfly | Redis 协议（RESP） | redis-py / redis-cli 直接用 |
| FerretDB | MongoDB 协议 | 背后换成 PG |

国产 OLAP 清一色"兼容 MySQL 协议"是**生态策略**，不只是少学语法。

### 生态 Hack 2：语言内标准接口（万能转接头）

| 语言 | 标准 DB 接口 |
|---|---|
| Java | JDBC（+ JPA/MyBatis/Hibernate）——"支持 JDBC"≈进了 Java 企业市场 |
| Python | DB-API（PEP 249）+ asyncio 变体 |
| Go | `database/sql` |
| 跨语言老牌 | ODBC |

### 重要例外：嵌入式数据库没有"驱动"

- **服务器型**（MySQL/Neo4j/Redis）：驱动经网络协议连进程外的服务端
- **嵌入式**：没有网络层，引擎直接编进你的进程——SQLite（`import sqlite3`，数据库就是个文件）、DuckDB（Python 包里链接了整个 C++ 引擎）、RocksDB（TiDB/Flink 状态后端的地基，用户无感知）
- 这解释了 DuckDB 查本地 Parquet 又快又零配置：**没有网络往返，数据就在进程里**

### 小结

- 主流库都有包；冷门库重点语言有、小语言靠社区或只能 HTTP/REST 凑合
- 包只管连库，API 靠框架拼；图/搜索的看家查询（shortestPath/DSL）永远得写原生语法，ORM 覆盖不了

## 按求职画像的投入优先级

1. **深挖已有的**：MySQL 原理（索引/事务/锁，面试必考）+ Redis（缓存三件套问题）+ ClickHouse——JD 最高频
2. **补一个国产 OLAP**：StarRocks 或 Doris，把 IoT 项目数据导进去做实时报表，简历多一块
3. **保持 AI 线领先**：pgvector/Milvus + GraphRAG，把 WeKnora 调研消化成面试故事（"调研过生产级 GraphRAG 实现"）
