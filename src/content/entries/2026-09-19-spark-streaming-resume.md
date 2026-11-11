---
title: "Spark 流计算简历话术 → 代码逐句对照"
date: 2026-09-19
category: 面试
tags: [spark, 流计算, 简历, 日记归档]
draft: false
---

> 简历原句：流计算作业基于 PySpark 开发，落地事件时间语义与水位线机制处理乱序/迟到数据，采用 30s 微批触发，checkpoint（消费偏移量与窗口聚合状态）托管至 OSS（S3 协议）实现故障自动恢复与断点续跑，结合 Kafka 可重放与下游幂等写入保障端到端 exactly-once；另以 Spark 离线批处理对 OSS 归档的原始数据做 T+1 回填与历史重聚合。

## 一、完整流作业代码

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, window, avg
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType

spark = SparkSession.builder.appName("device-temp").getOrCreate()

# ① Kafka 源
raw = spark.readStream.format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:9092") \
    .option("subscribe", "device-data") \
    .option("startingOffsets", "latest") \
    .option("maxOffsetsPerTrigger", "50000") \
    .load()

# ② 解析消息体（Kafka 的 value 是 binary，先转字符串再按 schema 解析）
schema = StructType([
    StructField("device_id", StringType()),
    StructField("temp", DoubleType()),
    StructField("event_time", TimestampType()),   # ③ 事件时间字段（消息自带）
])

parsed = raw.select(
    from_json(col("value").cast("string"), schema).alias("d")
).select("d.*")

# ③④ 事件时间窗口 + watermark（允许迟到 1 分钟）
agg = parsed \
    .withWatermark("event_time", "1 minute") \
    .groupBy(
        window(col("event_time"), "1 minute"),   # 1 分钟滚动窗口
        col("device_id")
    ) \
    .agg(avg("temp").alias("avg_temp"))

# ④⑤⑥⑦ 输出：30s 微批 + checkpoint 到 OSS + 写下游
query = agg.writeStream \
    .format("parquet") \
    .option("path", "s3a://lake/device-temp/") \
    .option("checkpointLocation", "s3a://ckpt/device-temp/") \
    .outputMode("append") \
    .trigger(processingTime="30 seconds") \
    .start()

query.awaitTermination()
```

## 二、话术 → 代码对照表

| 简历里的词 | 对应代码 | 作用 |
|---|---|---|
| 基于 PySpark 开发 | `pyspark` 整套 | —— |
| **事件时间**语义 | `groupBy(window(col("event_time"), ...))` | 用消息自带时间，不是处理时间 |
| **水位线**机制处理乱序/迟到 | `.withWatermark("event_time", "1 minute")` | 最多等 1 分钟迟到数据，过期窗口关门并清理状态 |
| 30s **微批触发** | `.trigger(processingTime="30 seconds")` | 每 30s 切一个微批 |
| **checkpoint** | `.option("checkpointLocation", "s3a://ckpt/...")` | offset + 窗口聚合状态自动写这里 |
| 托管至 **OSS（S3 协议）** | 路径前缀 `s3a://` | OSS 兼容 S3，挂 s3a 驱动即可 |
| 故障自动恢复、**断点续跑** | 重启后用同一 checkpoint 路径 | 自动从上次 offset 和状态接着算 |
| **Kafka 可重放** | Kafka 按 offset 重读（源头特性，无代码） | 失败的微批可重新拉数据 |
| 下游**幂等写入** | 见第三节 upsert 示例 | 同一批重复写结果不变 |
| 端到端 **exactly-once** | Kafka 重放 + checkpoint + 幂等 sink 三者组合 | 不丢不重 |
| **T+1 回填**、历史重聚合 | 另一个批作业（read，不是 readStream） | 见第四节 |

## 三、幂等写入（exactly-once 的最后一环）

文件 sink（parquet/Iceberg）由 checkpoint + 原子提交天然保证幂等；写 MySQL 这种外部库要自己保证，常见写法是按业务主键 upsert：

```python
def upsert(batch_df, batch_id):
    batch_df.write.format("jdbc") \
        .mode("append") \
        .option("url", "jdbc:mysql://...") \
        .option("dbtable", "device_temp_min") \
        .save()
    # 表里对 (window_start, device_id) 建唯一键，SQL 用：
    # INSERT ... ON DUPLICATE KEY UPDATE avg_temp=VALUES(avg_temp)
    # 微批重跑时同主键覆盖 → 幂等

agg.writeStream.foreachBatch(upsert) \
    .option("checkpointLocation", "s3a://ckpt/...") \
    .trigger(processingTime="30 seconds").start()
```

## 四、T+1 离线回填（独立批作业脚本）

```python
# 每天跑一次：读 OSS 上归档的原始数据，重新算昨天的，覆盖结果
df = spark.read.parquet("s3a://lake/raw-data/dt=2026-09-18/")

result = df.groupBy(
    window(col("event_time"), "1 minute"),
    col("device_id")
).agg(avg("temp").alias("avg_temp"))

result.write.mode("overwrite") \
    .partitionBy("dt") \
    .parquet("s3a://lake/device-temp-rt/dt=2026-09-18/")
```

注意：批处理用 `spark.read`，流处理用 `spark.readStream`，别混。

## 五、面试高频追问

1. **watermark 1 minute 怎么理解**
   event_time 超过"当前见过的最大事件时间 − 1 分钟"的旧数据被丢弃，窗口输出最终结果并释放状态。它是等待迟到数据的阈值，不是批次延迟。

2. **exactly-once 为什么要三者配合**
   Kafka 重放保证数据还能拉到；checkpoint 保证批次边界和状态一致；下游幂等保证重放那批不会写重复。缺任一环都只是 at-least-once。

3. **T+1 重聚合为什么不和实时结果冲突**
   离线按分区覆盖写（`mode=overwrite` 指定分区 / Iceberg 的 `REPLACE WHERE`），用更完整的数据（迟到的、修复的）替换实时结果，即 Lambda 架构的批流两路。

## 六、一句话记忆

withWatermark 管乱序，trigger 管节奏，checkpointLocation 管续命，Kafka offset + 幂等 sink 管不重不丢，批作业 read（不是 readStream）管 T+1。

---

# 附：完整项目代码逐行注释版

```python
# ===== 导入区：告诉 Python 这段代码要用哪些 Spark 组件 =====

from pyspark.sql import SparkSession
# SparkSession：Spark 2.x 后的统一入口，读数据、写 SQL、开流式作业都靠它

from pyspark.sql.functions import (
    col,        # col("x")：按列名取一列，等价于 $"x" / df["x"]
    from_json,  # 把 JSON 字符串列按 schema 解析成结构体列
    to_json,    # 反向操作：把一列/struct 打包成 JSON 字符串（写 Kafka 时用）
    struct,     # 把多列包成一个 struct（结构体），配合 to_json 整行转 JSON
    window,     # 时间窗口函数：滚动/滑动窗口靠它
    avg,        # 聚合函数：平均值
    max as max_,  # 最大值；起别名 max_ 是避免和 Python 内置 max 撞名
    count       # 计数：count("*") 统计行数
)
from pyspark.sql.types import StructType, StringType, DoubleType, TimestampType
# StructType：自定义 schema（字段结构）
# StringType/DoubleType/TimestampType：字符串 / 双精度浮点 / 时间戳 三种字段类型

# ===== 创建 SparkSession：整个作业的入口和全局配置 =====

spark = (
    SparkSession.builder
    .appName("iot-stream-agg")
    # 作业名，在 Spark UI / YARN 资源页面上显示成这个名字，方便找任务

    # 以下 config 也可以写在 spark-defaults.conf / spark-submit 参数里，三者等价
    .config("spark.sql.shuffle.partitions", "6")
    # groupBy 聚合时会产生 shuffle（数据按 device_id 重分区）
    # 默认 200 个分区对小数据量会产生大量空任务/小文件，这里对齐 Kafka 分区数调成 6

    .config("spark.sql.streaming.stateStore.providerClass",
            "org.apache.spark.sql.execution.streaming.state.RocksDBStateStoreProvider")
    # 流计算的中间状态（每个窗口的累加值）默认存在 JVM 堆内存里，状态多了容易 OOM
    # 换成 RocksDB 状态后端：状态写在本地磁盘 + 内存索引，能扛更大的状态量

    # —— OSS（阿里云对象存储）访问配置，checkpoint 要写到 OSS，必须先让 Spark 能连上 ——
    # OSS 兼容 S3 协议，所以用 s3a 文件系统驱动；本地 docker-compose 练习时换成 MinIO 地址 http://minio:9000
    .config("spark.hadoop.fs.s3a.endpoint", "http://oss-cn-hangzhou.aliyuncs.com")
    # OSS 的接入端点：杭州区域。路径里写 s3a://iot-bucket/... 时就走这个地址

    .config("spark.hadoop.fs.s3a.access.key", "xxx")
    # 访问 OSS 的账号 AK（AccessKey Id），生产中一般用环境变量注入，不硬编码

    .config("spark.hadoop.fs.s3a.secret.key", "xxx")
    # 与 AK 配对的密钥 SK，两者相当于访问对象存储的"用户名+密码"

    .config("spark.hadoop.fs.s3a.path.style.access", "true")
    # 路径风格寻址：用 endpoint/bucket 形式访问。MinIO 等自建 S3 必须开，OSS 也兼容

    .config("spark.hadoop.fs.s3a.connection.ssl.enabled", "true")
    # 开启 HTTPS 加密传输（端点写 http 时此项实际不生效，云上正式用 https 端点）

    .getOrCreate()
    # 真正创建 SparkSession；如果当前进程已有一个就复用，没有就新建
)

# ---------- 1. Kafka 源：从 Kafka 实时读原始消息 ----------
raw = (
    spark.readStream.format("kafka")
    # readStream = 流式读取（read 是批读取）；format 指定数据源是 Kafka

    .option("kafka.bootstrap.servers", "kafka:9092")
    # Kafka 集群地址，给一个 broker 就能由它发现集群其他节点

    .option("subscribe", "device-data")
    # 订阅的 topic 名：桥接服务（设备网关）把原始传感器数据写进这个 topic

    .option("startingOffsets", "latest")
    # 首次启动从最新位点开始读（只要启动后新来的数据）
    # 注意：作业从 checkpoint 恢复后此参数失效，位点以 checkpoint 记录为准

    .option("maxOffsetsPerTrigger", "50000")
    # 每个微批最多拉 50000 条：积压恢复期限流，防止一个批次拉几百万条把内存/下游撑爆

    .load()
    # 创建出流式 DataFrame；此时还没真正读数据，只是声明了输入源（懒执行）
    # raw 的默认列：key(binary), value(binary), topic, partition, offset, timestamp ...
)

# ---------- 2. 解析 JSON + 事件时间 + 水位线 ----------
schema = (StructType()
    # 手工定义 JSON 消息的结构，from_json 必须知道 schema 才能拆列

    .add("device_id", StringType())
    # 设备编号，字符串，如 "d-001"；后面按它分组（每个设备各自统计）

    .add("temperature", DoubleType())
    # 温度读数，浮点型

    .add("humidity", DoubleType())
    # 湿度读数，浮点型（本例没参与聚合，但先解析留着）

    .add("event_time", TimestampType()))
    # 事件时间：设备/网关打在消息里的真实产生时间（不是 Spark 处理它的时间）
    # 后面 watermark 和窗口都基于这一列

parsed = (
    raw.selectExpr("CAST(value AS STRING) AS json_str")
    # Kafka 的 value 是 binary 字节，第一步先转成 UTF-8 字符串，列名 json_str

       .select(from_json("json_str", schema).alias("d")).select("d.*")
    # from_json：按上面定义的 schema 把 JSON 字符串解析成一个 struct 列 d
    # select("d.*")：把 struct 拍平，得到 device_id/temperature/humidity/event_time 四列

       .withWatermark("event_time", "10 seconds")
    # 水位线：以"目前见过的最大 event_time - 10 秒"为界
    # 含义：最多容忍迟到 10 秒；比水位线还旧的数据直接丢弃
    # 同时旧窗口超过 10s 没新数据就闭合，输出最终结果并释放状态，防止状态无限膨胀
)

# ---------- 3. 1 分钟滚动窗口聚合：每个设备每分钟一组指标 ----------
agg = (
    parsed.groupBy(window("event_time", "1 minute").alias("win"), "device_id")
    # 分组键有两个：
    #   window(event_time, "1 minute")：按事件时间切 1 分钟的不重叠滚动窗口
    #                                    [10:00:00,10:01:00)、[10:01:00,10:02:00)...
    #   device_id：窗口内再按设备分
    # alias("win")：把窗口结构体列（含 start/end 两个字段）命名为 win

    .agg(
    # agg：对每个 (窗口, 设备) 分组计算多个聚合值

        avg("temperature").alias("temp_avg"),
        # 该设备这一分钟内温度的平均值 → temp_avg

        max_("temperature").alias("temp_max"),
        # 该设备这一分钟内温度的最大值 → temp_max（用于超温告警判断）

        count("*").alias("msg_cnt"),
        # 该设备这一分钟内收到的消息条数 → msg_cnt（可用于监控设备是否掉线）
    )

    .select(
    # 聚合完做一次列整理：把窗口 struct 拆成两个独立时间列，输出更友好

        col("win.start").alias("window_start"),
        # 窗口开始时间

        col("win.end").alias("window_end"),
        # 窗口结束时间（左闭右开，这条数据本身不属于该窗口）

        "device_id", "temp_avg", "temp_max", "msg_cnt",
        # 其余四列原样保留，最终 agg 共 6 列
    )
)

# ---------- 4. 落地：每个微批把聚合结果写回两个 Kafka topic ----------
def write_batch(df, batch_id):
    # foreachBatch 的回调函数：每 30s 触发一次微批，Spark 把这一批结果 DataFrame 传进来
    # df = 本批有变化的聚合行；batch_id = 微批编号（可用于去重/日志）
    # 这是"微批的批内自由发挥区"：df 是普通批 DataFrame，可以任意写多个目的地

    out = df.selectExpr("CAST(device_id AS STRING) AS key", "to_json(struct(*)) AS value")
    # Kafka sink 只认 key、value 两列（string 或 binary），其他列忽略
    # key = 设备 id 字符串：相同设备进同一分区，保证同设备分区有序
    # value = to_json(struct(*))：把这一行所有列打包成一个 JSON 字符串作为消息体

    (out.write.format("kafka")
    # 批方式写入 Kafka（在 foreachBatch 内部用 write，不是 writeStream）

        .option("kafka.bootstrap.servers", "kafka:9092")
        # Kafka 地址（也可以在 SparkSession 全局配一次，这里就近写更直观）

        .option("topic", "device-agg-1min").save())
    # 写入聚合结果 topic：下游（看板、数据服务）各自用自己的消费组订阅

    (out.filter("temp_max > 80")
    # 从同一份结果里筛出"本批最高温超过 80 度"的行 —— 告警逻辑

        .write.format("kafka")
        .option("kafka.bootstrap.servers", "kafka:9092")
        .option("topic", "device-alerts").save())
    # 只把超温的行写进告警 topic，由告警服务（发短信/钉钉）单独消费
    # 一个微批同时扇出到两个 topic，互不影响，这就是 foreachBatch 的价值

query = (
    agg.writeStream
    # 对聚合结果开启流式输出

    .outputMode("update")
    # update 模式：每个微批只输出"本批有变化的窗口行"
    # 窗口没闭合时温度均值会随新数据不断更新，更新一次就往下游发一次
    # 好处：告警不用等窗口闭合（append 模式要等 watermark 闭合才输出，告警会延迟 10s+）

    .foreachBatch(write_batch)
    # 注册上面的函数：每微批用批 API 自定义写出（这里一份结果扇出写两个 Kafka topic）

    .option("checkpointLocation", "s3a://iot-bucket/checkpoints/iot-agg")
    # checkpoint 目录放 OSS：里面存 Kafka offset、窗口聚合状态、已提交批次号
    # 作业挂了重启用同一个目录即可断点续跑；改业务逻辑后需换新目录

    .trigger(processingTime="30 seconds")
    # 微批触发间隔：每 30 秒切一个批次处理一次（不是每条数据都触发）

    .start()
    # 启动流作业，返回一个 StreamingQuery 句柄；代码执行到这里作业才真正跑起来
)

query.awaitTermination()
# 阻塞当前主线程，让常驻作业一直运行，直到作业报错或被手动 stop
# 没这行的话脚本会立刻退出，流式作业跟着结束
```

## 补充：为什么这里用 update 而不是 append

- 聚合 + watermark 时，`append` 只在窗口被 watermark 关闭后才输出**最终一行**（安全、不重复，但告警有延迟）
- `update` 每来一批就输出**有变化的窗口行**，配合写 Kafka 做实时告警更合适
- 代价：同一个窗口的结果会被发多次（均值不断修正），下游要自己按 (window_start, device_id) 去重/取最新，这也是 Kafka 可重放 + 下游幂等语义的一部分

---

# 附2：四库扇出架构（Redis / ClickHouse / TDengine / MySQL）

## 原则

一个数据库对应一种查询场景，不为凑技术栈硬塞。IoT 传感器项目天然能放这 4 个，各有正当理由。Spark 只负责算，不同存储由独立消费者/连接器各写各的（Kafka 扇出）。

## 架构图

```
device-data(Kafka 原始 topic)
   ├─ Spark 实时窗口聚合 → device-agg-1min(Kafka 结果 topic)
   │                          ├→ ClickHouse（分钟级指标，大屏趋势/OLAP 分析）
   │                          └→ Redis（设备最新状态，接口毫秒级查询）
   ├─ 原始数据 → OSS/Parquet 归档（长期留存，T+1 回填重算）
   ├─ 原始数据 → TDengine（时序曲线、降采样，Kafka 连接器自动入）
   └─ 告警服务 → device-alerts topic → MySQL（告警记录持久化）
```

## 四库分工

| 数据库 | 类型 | 存什么 | 业务场景 |
|---|---|---|---|
| Redis | KV 缓存 | 每个设备最新一条状态 | 大屏首屏/接口毫秒级查"设备当前温度"，key 如 `device:{id}:latest` |
| ClickHouse | OLAP 分析库 | 1 分钟聚合结果 | 大屏趋势图、多维分析、报表（Kafka 引擎表自动消费落表） |
| TDengine（或 InfluxDB） | 时序数据库 | 原始温度时间序列 | 设备温度曲线、自动降采样、保留策略——IoT 场景最顺理成章 |
| MySQL | 业务库 | 告警记录、设备台账、阈值配置 | 告警列表、设备管理（业务数据，不是指标） |

## 不放进简历的库

- Elasticsearch：需要全文检索/日志排查场景才加，本项目没有
- HBase：需要按 rowkey 海量明细点查才加，硬凑会被问穿

## 幂等要点（各库不同）

- Redis：SET 天然覆盖，key 相同即幂等
- ClickHouse：ReplacingMergeTree + ORDER BY (window_start, device_id)，后台合并去重，查询可加 FINAL
- MySQL：INSERT ... ON DUPLICATE KEY UPDATE，唯一键 (window_start, device_id)
- TDengine：同时间戳同标签写同值即覆盖（按其数据模型天然幂等）

## 简历话术

> 实时聚合结果写回 Kafka 后扇出：ClickHouse 存储分钟级指标支撑大屏 OLAP 分析，Redis 缓存设备最新状态供接口毫秒级查询；原始时序数据入 TDengine 支持设备温度曲线与降采样，告警记录持久化至 MySQL；原始报文同步归档 OSS（Parquet）供 T+1 重算。

## 注意

- 不要写成"一个 Spark 作业直连四五个库"——真实架构是 Kafka 扇出，CK 用 Kafka 引擎表、TDengine 用连接器、Redis 由接口/告警服务写
- 每写一个组件，准备好"为什么用它而不是别的库"的追问


