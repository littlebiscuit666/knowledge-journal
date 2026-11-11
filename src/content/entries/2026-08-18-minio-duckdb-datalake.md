---
title: "数据湖入门实践：MinIO + boto3 + DuckDB"
date: 2026-08-18
category: 技术
tags: [数据湖, minio, duckdb, 日记归档]
draft: false
---

> 日期：2026-08-18
> 场景：学习对象存储/数据湖（OSS/OBS 的本地等价物），工作目录 `D:\Big-Data-OSS`
> 成果：完整 lakehouse 闭环跑通——JSON 落数据湖 → SQL 湖内转 Parquet → SQL 湖上聚合，全程数据不出湖

---

## 一、概念地图

- **对象存储**：`bucket + key + 对象` 的 REST 存储形态，无文件系统语义。S3 是鼻祖，API 成了事实标准；阿里 OSS / 华为 OBS / 腾讯 COS 都提供 S3 兼容端点；**MinIO = 开源自建版，学会即通用**
- **数据湖**：架在对象存储上的架构模式——原始数据先原样落湖（schema-on-read），要用再解析。数据仓库相反（schema-on-write）
- 分层：`raw/`（原始层，只进不改，可重放）→ `curated/`（加工层，Parquet 分区，可全量重算）

## 二、环境（Docker compose 模式）

```yaml
# D:\Big-Data-OSS\docker-compose.yml
services:
  minio:
    image: minio/minio
    container_name: minio-lab
    ports:
      - "9000:9000"   # S3 API (boto3/DuckDB 连这个)
      - "9002:9002"   # 网页控制台 (9001 被 Penpot 占用!)
    volumes: ["./data:/data"]
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    command: server /data --console-address ":9002"
    restart: unless-stopped
```

- 控制台 http://localhost:9002，账号密码 minioadmin（**对象存储没有"注册"**——凭据是环境变量预置的，云上是控制台签发 AK/SK，同哲学）
- venv：`D:\Big-Data-OSS\.venv`，装了 boto3 / duckdb / pyarrow（走清华镜像装的）
- 桶：`lake`

## 三、两个实验

**lab01_lake_ingest.py** —— 往湖里落数据
- boto3 client：`endpoint_url=http://localhost:9000`（换云只是换这个地址）
- 模拟 5 传感器读数 → 5 个 JSON → key 按 `raw/sensors/2026/08/18/sensor_XX.json` 分区摆放
- `list_objects_v2(Prefix=...)` = 按分区前缀列举（分区裁剪的雏形）
- `generate_presigned_url()` = 5 分钟临时签名外链（Plane 头像/网盘分享同机制）

**lab02_lake_query.py** —— 湖上查询闭环
```
raw/*.json --一条COPY SQL--> curated/sensors/dt=2026-08-18/*.parquet --一条SELECT--> 聚合表
```
- DuckDB httpfs 扩展原生读写 S3，**本地零落地**
- 关键设置：`SET s3_url_style='path'`（MinIO 必须路径风格）、s3_endpoint/use_ssl=false/AK/SK
- `COPY (...) TO 's3://...' (FORMAT parquet, PARTITION_BY (dt), OVERWRITE true)` —— Hive 分区 + 全量重算语义
- `read_parquet('s3://.../**/*.parquet', hive_partitioning=true)` —— dt 列从**目录名**读出来
- 顺带验证：13KB JSON → 2KB Parquet（列式压缩福利）

## 四、文件格式认知

- **行式**（JSON/CSV/Avro）：整条记录连续存，适合写/读整条 → 落湖保真用
- **列式**（Parquet/ORC）：同列数据连续存，分析查询只碰需要的列 → 分析提速用
- 列式三福利：少读 IO、同类数据压缩率高（字典/游程编码）、块级 min/max 统计支持谓词下推跳块
- 选型口诀：**落湖行式保真，分析列式提速，格式无脑 Parquet**

## 五、踩坑记录

1. **pip 直连 PyPI 时通时断**（boto3 赌赢、duckdb 赌输）→ 清华镜像 `-i https://pypi.tuna.tsinghua.edu.cn/simple`；可选 `pip config set global.index-url` 永久生效（注意周日想直连时要 `-i` 覆盖回来）
2. **`con.execute().df()` 需要 pandas/numpy** → 零依赖替代：`print(con.sql("..."))` 直接渲染结果表；`con.execute()` 返回连接对象不能直接 print
3. **重复跑 COPY 报 "Directory not empty"** → DuckDB 防误删，加 `OVERWRITE true` 变全量重算语义（正好是数据湖想要的幂等）
4. MinIO 控制台端口被占就换 `--console-address ":9002"`，API 口 9000 独立不受影响

## 六、下一步方向（L4/L5）

- **接进 IoT 管线**：D:\Big-Data 的 Kafka 消费者把传感器数据落到本湖（代替/并行于 lab01 的模拟数据）
- **表格式**：Iceberg / Delta Lake（给湖加 ACID、upsert、时间旅行），配 Spark/Trino
- **真云**：华为 OBS 建桶（账号现成），体验 AK/SK + 云端点，验证"换 endpoint 即上云"
