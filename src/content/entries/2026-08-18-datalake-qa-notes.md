---
title: "数据湖学习问答笔记"
date: 2026-08-18
category: 技术
tags: [数据湖, 笔记, 日记归档]
draft: false
---

> 日期：2026-08-18
> 背景：在 D:\Big-Data-OSS 搭了 MinIO 数据湖实验场后的一连串提问，按提问顺序整理，供复习。
> 配套实验文档：2026-08-18_数据湖入门-MinIO与DuckDB实践.md

---

## Q1. OSS/OBS 这种对象存储是什么？我能实践吗？

- **对象存储**：`bucket + key + 对象` 的 REST 存储形态，没有文件系统语义。S3（AWS）是鼻祖，API 成事实标准；阿里 OSS / 华为 OBS / 腾讯 COS 都提供 S3 兼容端点；**MinIO = 开源自建版**，本地学会 = 全部通用（换 endpoint 即上云）
- **数据湖**：架在对象存储上的架构——原始数据先原样落湖（schema-on-read），要用再解析；数仓相反（schema-on-write）
- 分层行规：`raw/`（原始层只进不改）→ `curated/`（加工层 Parquet 分区）

## Q2. MinIO 控制台怎么没有注册的地方？

- 凭据是 docker-compose 里 `MINIO_ROOT_USER/PASSWORD` **预置**的，不是注册来的
- 对象存储是**基础设施不是消费应用**：没有自助注册概念，凭据由管理员预置/签发
- 云上同理：控制台创建 **AK/SK 访问密钥**；MinIO 里 Identity→Users 签发子账号就是模拟这个

## Q3. 为什么 Docker 启动时不把 Python 环境加进去，而要本地建 venv？

- 容器 = **一个进程的包装**（一容器一事）。MinIO 镜像里连 Python 都没有，故意极简
- boto3 是**客户端**，MinIO 是**服务端**，之间只有 HTTP——客户端跑在哪无所谓（类比：MySQL 服务 + 本地 Python 连 3306；OpenD + futuapi）
- venv 和 Docker **无关**：是为了不污染共享的全局 Python（label-studio 一墙红的教训）
- Python 什么时候进容器：代码从"在写的"变成"**要交付的**"时（ETL 生产任务、Airflow worker 打镜像）

## Q4. 湖里储存的文件格式是什么？为什么 JSON 和 Parquet 并存？

- **raw 层 JSON**（文本·行式）：保真、schema-on-read、可重放
- **curated 层 Parquet**（二进制·列式）：分析查询只碰需要的列 + 同列数据压缩率高（字典/游程编码）+ 块级 min/max 统计可跳块（谓词下推）
- 实测：13KB JSON → 2KB Parquet
- 动物园：CSV/JSON（文本行式）、Avro（二进制行式，Kafka 生态）、ORC/Parquet（列式，**Parquet 是事实标准**）
- 口诀：**落湖行式保真，分析列式提速，格式无脑 Parquet**

## Q5. 为什么 data\lake\...\sensor_01.json\xl.meta 里不是 JSON？

- `data\` 是 MinIO **私有磁盘后端**，不是对象的文件夹视图。每个对象 = 一个同名**目录**：
  - `xl.meta`：引擎私有二进制格式（元数据：大小/ETag/校验/版本）+ **小对象数据内联**（<几KB时）
  - `part.1`：大对象的数据本体；**multipart 上传**时按 8MiB 分片多个 part（UUID 子目录 = 上传会话）
- **规则：对象只通过 API 访问**（控制台/boto3/presigned/mc），别手动动 data\ 目录
- 类比：MySQL 的 .ibd、ClickHouse 的 .bin——存储引擎的磁盘格式从来不给人类看

## Q6. 图片和视频也能存吗？【lab03】

- 能，对象存储本来就是干这个的（Plane 头像/附件就是 minio）
- 关键点：
  - **ContentType 元数据**（image/jpeg、video/mp4）决定浏览器"渲染"还是"下载"
  - presigned URL → 浏览器**直接播放**视频、拖进度条（底层 Range 请求）
  - 13MB 视频自动走 multipart（磁盘上 part.1=整 8MiB + part.2=余量），断点续传/并发的基石
- 本质三件套：**对象 + 元数据 + 签名 URL** = 图床/网盘/头像预览的共同底层

## Q7. S3 操作到底包括什么？就是增删改查吧？

- 对，核心是 CRUD：**PUT**（增/覆盖式改）、**GET/HEAD/ListObjectsV2**（查）、**DELETE**（删）
- 但和数据库 CRUD 三个不一样：
  1. **没有局部更新**——对象不可变，改一个字节 = 重传整个对象
  2. **没有条件查询**——只能按 key 直取 / 按前缀列举（每页≤1000），"查>30度的数据"是查询引擎加的
  3. **没有 rename/append/事务**——rename=Copy+Delete，append=读拼重传
- CRUD 外两圈：
  - 大文件圈：multipart 三件套、CopyObject（服务端复制）、RestoreObject（归档解冻）
  - 管理圈：Versioning（版本/删除标记）、Lifecycle（自动沉降/过期）、Policy/IAM、presigned URL、事件通知
- "改不动"→ 两条出路：重写整个分区（OVERWRITE）；**Iceberg/Delta 表格式**（追加文件+改指针=upsert/时间旅行）
- 心智模型：**S3=巨型键值仓库，DuckDB 给它加查询，Iceberg 给它加更新**

## Q8. DuckDB 是啥东西？

- **嵌入式分析型数据库（OLAP）= "SQLite 的分析版兄弟"**
- 四象限定位：
  | | 嵌入式 | 服务型 |
  |---|---|---|
  | 行式·点查(OLTP) | SQLite（label_studio.sqlite3） | MySQL/Postgres |
  | 列式·聚合(OLAP) | **DuckDB** | ClickHouse/Snowflake |
- 形态：pip 装的库，`import duckdb` 即用，无服务无端口（"单机版免部署 ClickHouse"）
- 杀手锏：**把外部世界当表**——`FROM 'x.csv'` / `read_parquet('s3://...')` / `read_json_auto()`；`con.register()` 让 Python Arrow 表零拷贝进 SQL
- 局限：不是 MySQL 替代品（无高并发服务）、单机量级（GB 级最舒服）
- 湖畔三件套：**boto3（存取）+ pyarrow（内存表格）+ duckdb（计算）**

## Q9. DuckDB 是怎么下载的？（两次下载、两条路）

- **第一次·引擎本体**：pip 装，预编译二进制轮子 `_duckdb.cp311-win_amd64.pyd`（37MB C++ 引擎，文件名=平台身份证，零编译）；第一次直连 PyPI 失败（时通时断的墙），清华镜像成功
- **第二次·扩展插件**：lab02 里 `INSTALL httpfs` 时 DuckDB 自己去官方扩展仓库下载（httpfs.duckdb_extension，~28MB），缓存于 `C:\Users\yaya\.duckdb\extensions\v1.5.5\windows_amd64\`（按用户+版本共享，带签名校验）
- 结构类比：**浏览器主程序（pip 装 venv）+ 浏览器扩展（运行时装用户目录）**，同 ComfyUI 主程序+custom_nodes
- 玄学备注：当天 pypi 时断，DuckDB 扩展仓库直连却畅通——不同域名墙的待遇不一样

## 题外一问：为什么 Claude 老 用 Git Bash 不用 cmd/PowerShell？

- 执行环境写死跑 Git Bash（POSIX sh），Unix 语法是训练语料最密集的 shell 语境，且与 Linux 服务器/容器通用
- 给用户的命令会按用户所在终端适配（PowerShell 里给 PowerShell 语法）
- Git Bash 的坑：会把 `/xxx` 路径翻译成 `C:/Program Files/Git/xxx`，带 Linux 路径参数的命令要 `MSYS_NO_PATHCONV=1`

---

## 复习建议路径

1. 先把 Q4/Q5/Q6 串起来看（**格式 → 磁盘真相 → 媒体实践**，一路掀盖）
2. 再啃 Q7（S3 全景，建 CRUD 之上两圈的心智图）
3. 最后 Q8/Q9（DuckDB 是什么 + 怎么来的）
4. 对照四个 lab 脚本跑一遍：01 存 → 02 算 → 03 存大文件 → 04 裸 API
