---
title: "Spark 基础与面试要点总结"
date: 2026-09-14
category: 面试
tags: [spark, 面试, 大数据, 日记归档]
draft: false
---

> 2026-09-14 · 虾皮大数据面试备考 · 由学习讨论整理
> 主线：从 SparkSession 入门 → RDD 算子打通（wordcount 实战）→ 面试速查清单

---

## 一、两套 API 与入口

```python
spark = SparkSession.builder().appName("wc").master("local[*]").getOrCreate()
sc = spark.sparkContext   # RDD 的入口从 spark 里拿
```

- **SparkSession**：新入口，对应 DataFrame/SQL 世界（有 schema、有列名）
- **SparkContext (sc)**：老入口，对应 RDD 世界（裸数据、无字段）
- 工业界 95% 用 DataFrame/SQL；RDD 只在不规则数据、需要精细控制分区时才用

## 二、Scala `_` 语法糖（看不懂 RDD 代码 90% 卡在这）

| Scala | 等价写法 | PySpark 必须 |
|---|---|---|
| `_ + _` | `(a, b) => a + b` | `lambda a, b: a + b` |
| `_.split(" ")` | `x => x.split(" ")` | `lambda line: line.split(" ")` |
| `(_._2)` | `t => t._2`（取元组第2位） | `lambda x: x[1]` |

`_` 就是"传进来的参数"的占位符。PySpark 没有糖，写显式 lambda 反而更能看懂。

## 三、Wordcount 逐行拆解（跟着数据走）

```python
sc.textFile("path") \
  .flatMap(lambda line: line.split(" ")) \
  .map(lambda w: (w, 1)) \
  .reduceByKey(lambda a, b: a + b) \
  .sortBy(lambda x: x[1], ascending=False)
```

输入文件两行：`hello world` / `hello spark`

| 步骤 | 算子 | 数据变化 | SQL 对应 |
|---|---|---|---|
| ① 读文件 | textFile | `["hello world", "hello spark"]` | FROM |
| ② 拆词+拍平 | flatMap | `["hello","world","hello","spark"]` | explode(split) |
| ③ 造 K-V 结构 | map((_,1)) | `[("hello",1),("world",1),("hello",1),("spark",1)]` | ——（定义"列"） |
| ④ 分组聚合 | reduceByKey(_+_) | `[("hello",2),("world",1),("spark",1)]` | GROUP BY + SUM |
| ⑤ 排序 | sortBy(_._2,false) | 按词频降序 | ORDER BY |

**易错**：map 不拍平，会得到 `RDD[Array[String]]`（数组的数组），后面没法数词 → 拆词用 flatMap。

**隐藏考点**：①-⑤ 全是 transformation（lazy），必须接 action 才执行：
- action：`collect()`（全量拉回 Driver，大数据 OOM，只适合测试）、`saveAsTextFile()`、`count()`、`first()`

## 四、为什么 RDD 必须自己造 (key, value)？

**RDD 元素是"裸数据"，Spark 对它一无所知。** `reduceByKey` 的契约写死：元组第 1 位是 key、第 2 位是 value。

所以 `map((_,1))` 不是多余步骤，**本质是 RDD 世界里的"定义列"**：

- DataFrame：表自带 schema → `groupBy("word")` 按名字引用列，不用造元组
- RDD：无 schema → 按元组**位置**（`_._1`/`_._2`）访问，必须先造结构

```python
# 同一个 wordcount 的 DataFrame 写法对比：
spark.read.text("path") \
  .select(explode(split("value", " ")).alias("word")) \
  .groupBy("word").count()          # 不用造 (key,1)，count() 自动生成计数值列
```

面试加分：RDD vs DataFrame 三大区别 —— ①有无 schema ②RDD 传 lambda 是黑盒，Catalyst 无法优化；DataFrame 表达式可做谓词下推/列裁剪 ③互转 `df.rdd` / `spark.createDataFrame(rdd, schema)`。

## 五、reduceByKey 深入：函数即参数 + 折叠机制

算子名 = 机制说明书：

```
reduce  +  ByKey
  ↑          ↑
你的函数    框架内置按key分组（不用你写）
管"怎么合"
```

- 传进去的**是函数，不是数据**。函数规则：吃两个同类型参数、返回一个同类型结果
- 组内**折叠是滚动的**：`[1,2,3]` → `f(f(1,2), 3)`
- **换函数就换行为**：

```python
rdd.reduceByKey(lambda a,b: a + b)        # 求和   [("a",4),("b",2)]
rdd.reduceByKey(lambda a,b: max(a, b))    # 最大值 [("a",3),("b",2)]
rdd.reduceByKey(lambda a,b: a * b)        # 连乘
rdd.reduceByKey(lambda a,b: a + "," + b)  # 拼字符串
```

原生 Python 里同款思想：`functools.reduce(lambda a,b: a+b, [1,2,3])` → 6

### 练习题踩过的坑（重要！）

1. **单值组不过 f**：组内只有 1 个值时，f 根本不被调用，值原样通过。`[("y","b")]` 折叠后是 `"b"` 不是 `"b-"`
2. **组间隔离**：a 组和 b 组各自折叠，永远不跨组
3. 心象：**ByKey = 发牌按花色分开；reduce = 每个花色内部排队过机器，出来只剩一个数**

## 六、reduceByKey vs groupByKey（必背对比）

输入 `[("a",1),("b",2),("a",3)]`：

| | reduceByKey(_+_) | groupByKey |
|---|---|---|
| 输出形态 | `[("a",4),("b",2)]` 值是**算好的数** | `[("a",[1,3]),("b",[2])]` 值是**列表** |
| 相当于 SQL | GROUP BY + SUM 完整 | 只写了 GROUP BY，没写聚合函数 |
| map 端预聚合 | ✅ 本地先合再 shuffle | ❌ 原始值全量传输 |
| 风险 | — | 热点 key 全部值涌向同一节点 → OOM（数据倾斜温床） |

结论：**能用 reduceByKey 就不用 groupByKey**；后者只在需要遍历组内原始元素时用（如组内 TopN）。

## 七、面试速查清单（其余讨论过的知识点浓缩）

### 架构与执行流程
- 层级：Application → Job（action 触发）→ Stage（**宽依赖处切刀**）→ Task（每分区一个）
- 宽依赖 = 子分区依赖多个父分区 = shuffle（groupByKey/join/reduceByKey）；窄依赖可 pipeline（map/filter/union）
- join 不一定宽依赖：两边同分区器（如都 reduceByKey 过）可免 shuffle
- RDD 五大特性：分区列表、血缘、函数、分区器（仅 K-V）、优先位置

### Shuffle 演进
Hash Shuffle（M×R 文件爆炸，废弃）→ Sort Shuffle（每 map task 1 数据文件+1 索引）→ bypass（分区数≤200 且无需 map 端聚合时跳过排序）
- 调优：`spark.sql.shuffle.partitions` 默认 200，小作业调小

### 数据倾斜（最高频场景题）
- 现象：个别 task 卡死/OOM，其余秒完；Spark UI 看 task 数据量分布
- 方案优先级：过滤脏 key → 两阶段聚合（加盐）→ 广播 join → 扩容+随机前缀 → 提并行度 → AQE 自动拆倾斜分区

### Spark SQL / 优化
- Catalyst：解析→逻辑计划→优化（**谓词下推、列裁剪**）→物理计划→代码生成
- AQE 三功能：合并小分区 / 动态切 broadcast / 自动处理倾斜
- Join 三策略：Broadcast Hash（<10MB）/ Sort Merge（大表默认）/ Shuffle Hash
- 比 MR 快：中间结果不落盘 pipeline、线程级 task、map 端聚合、算子丰富

### 对比题
- vs MapReduce：思想同源，但 MR 只有 map/reduce 两函数+每步落盘；Spark 把它泛化成任意算子 DAG
- vs Flink：Spark 微批秒级延迟批强；Flink 真流式毫秒级、事件时间+watermark、原生状态管理

### 缓存与容错
- cache（MEMORY_ONLY）/ persist（可选级别）/ checkpoint（落 HDFS、**截断血缘**）
- cache 后要接 action 才真正缓存；用完 unpersist

### 高频算子对比
- reduceByKey vs groupByKey（见上）
- map vs mapPartitions：后者按分区批量处理，省连接开销但易 OOM
- coalesce（默认不 shuffle，缩分区）vs repartition（=coalesce(true)，可增可减）
- 窗口三兄弟：row_number(1,2,3,4) / rank(1,1,3) / dense_rank(1,1,2)

### 手写题保底
- wordcount（30 秒版，见第三节）
- TopN：SQL 用 `row_number() OVER (PARTITION BY ... ORDER BY ... DESC) <= 3`
- 常练 SQL 题型：连续登录 N 天、累计销售额、lag/lead 同比环比
