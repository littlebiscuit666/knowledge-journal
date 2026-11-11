---
title: "Spark 代码执行全流程详解"
date: 2026-09-17
category: 技术
tags: [spark, 执行原理, 大数据, 日记归档]
draft: false
---

> 用一个电商销售数据的例子，从代码到实际执行，串起 Application → Job → Stage → Task → Partition 全部概念

---

## 一、业务场景

统计电商销售数据，按城市汇总手机销售额，找出 Top 10 城市。

---

## 二、代码（PySpark）

```python
from pyspark import SparkContext

# ① 初始化
sc = SparkContext("yarn", "SalesAnalysis")

# ② 读数据
sales = sc.textFile("hdfs://node1:9000/data/sales.csv")

# ③ 筛选手机品类
phones = sales.filter(lambda line: "手机" in line.split(",")[3])

# ④ 提取 (城市, 金额)
city_amount = phones.map(lambda line: (line.split(",")[1], float(line.split(",")[2])))

# ⑤ 按城市汇总金额
city_total = city_amount.reduceByKey(lambda a, b: a + b)

# ⑥ 取 Top 10
top10 = city_total.takeOrdered(10, key=lambda x: -x[1])

# ⑦ 输出结果
for city, amount in top10:
    print(f"{city}: {amount}")

# ⑧ 保存到 HDFS
city_total.saveAsTextFile("hdfs://node1:9000/output/city_sales")
```

---

## 三、Transform vs Action

```
Transform（转换）= 只定义逻辑，不执行
  ② textFile       → 懒加载，不立刻读
  ③ filter         → 记下"要筛选手机"
  ④ map            → 记下"要提取城市和金额"
  ⑤ reduceByKey    → 记下"要按城市汇总"

Action（动作）= 触发真正的计算
  ⑥ takeOrdered    → 触发 Job 0
  ⑧ saveAsTextFile → 触发 Job 1
```

代码写完到 Action 之前，Driver 只是在画计算蓝图，集群上什么都没发生。

---

## 四、触发 takeOrdered 后的执行流程

### 第1步：Driver 分析代码，画出 DAG

```
Driver 分析 ②→③→④→⑤→⑥ 的依赖关系：

  textFile → filter → map → reduceByKey → takeOrdered
                               ↑
                           宽依赖（Shuffle）

画成 DAG：

  textFile ──→ filter ──→ map ──→ reduceByKey ──→ takeOrdered
                           ↑          ↑
                        窄依赖     宽依赖（Shuffle）
```

### 第2步：DAGScheduler 切 Stage

```
遇到宽依赖就切一刀：

  Stage 0: textFile → filter → map        ← 窄依赖，合并成一个 Stage
  ──── Shuffle 边界 ────
  Stage 1: reduceByKey → takeOrdered       ← Shuffle 之后
```

### 第3步：Stage 0 拆 Task

```
假设 sales.csv 在 HDFS 上被切成 4 个块：

  块0（128MB）在机器B
  块1（128MB）在机器C
  块2（128MB）在机器D
  块3（50MB）在机器B

Stage 0 产生 4 个 Task：

  Task 0: 读块0 → filter → map
  Task 1: 读块1 → filter → map
  Task 2: 读块2 → filter → map
  Task 3: 读块3 → filter → map
```

### 第4步：TaskScheduler 把 Task 分给 Executor

```
假设申请了 2 个 Executor，每个 2 核：

  Executor 1（机器C，2个slot）
    ┌─────────────────────────────────┐
    │ Slot 0: Task 0                  │
    │   读块0 的 10000 行数据          │
    │   filter: 筛出包含"手机"的行     │
    │   比如 10000 行里有 800 行是手机  │
    │   map: 提取 (城市, 金额)         │
    │   输出: (北京,5999)(上海,3999)    │
    │         (北京,2999)(广州,4999)... │
    │                                 │
    │ Slot 1: Task 1                  │
    │   读块1 的 10000 行数据          │
    │   filter → map                  │
    │   输出: (深圳,6999)(北京,3999)...│
    └─────────────────────────────────┘

  Executor 2（机器D，2个slot）
    ┌─────────────────────────────────┐
    │ Slot 0: Task 2                  │
    │   读块2 → filter → map          │
    │   输出: (上海,5999)(广州,2999)...│
    │                                 │
    │ Slot 1: Task 3                  │
    │   读块3 → filter → map          │
    │   输出: (成都,4999)(北京,1999)...│
    └─────────────────────────────────┘
```

### 第5步：Stage 0 的 4 个 Task 并行执行

```
时间线：

  t=0s   4 个 Task 同时开始
  ─────────────────────────────────────
  t=30s  Task 0 完成（块0 数据量最大）
  t=28s  Task 1 完成
  t=32s  Task 2 完成
  t=15s  Task 3 完成（块3 最小，最快完成）
  ─────────────────────────────────────
  t=32s  Stage 0 全部完成（等最慢的那个）

Stage 0 输出的数据在各 Executor 的内存里（RDD）
```

### 第6步：Shuffle — Stage 0 的结果按 key 重新分区

```
Stage 0 输出的 (城市, 金额) 散落在 4 个 Task 的内存里：

  Task 0 的结果: (北京,5999)(上海,3999)(北京,2999)(广州,4999)
  Task 1 的结果: (深圳,6999)(北京,3999)(上海,2999)
  Task 2 的结果: (上海,5999)(广州,2999)(深圳,1999)
  Task 3 的结果: (成都,4999)(北京,1999)(广州,3999)

reduceByKey 默认产生 200 个 Partition（这里为了演示假设设成 3）

按 key.hashCode() % 3 分区：

  key      hashCode    % 3    去哪个 Partition
  ──────────────────────────────────────────
  北京     xxxx        0      → Partition 0
  上海     xxxx        1      → Partition 1
  广州     xxxx        2      → Partition 2
  深圳     xxxx        0      → Partition 0
  成都     xxxx        1      → Partition 1

Shuffle 后每个 Partition 的数据：

  Partition 0: (北京,5999)(北京,2999)(北京,3999)(北京,1999)(深圳,6999)(深圳,1999)
  Partition 1: (上海,3999)(上海,2999)(上海,5999)(成都,4999)
  Partition 2: (广州,4999)(广州,2999)(广州,3999)

数据通过网络从各 Executor 之间交换
相同城市的金额都聚到了同一个 Partition 里
```

### 第7步：Stage 1 拆 Task

```
Stage 1 有 3 个 Partition → 3 个 Task：

  Task 4: 处理 Partition 0 → reduceByKey → 北京和深圳的汇总
  Task 5: 处理 Partition 1 → reduceByKey → 上海和成都的汇总
  Task 6: 处理 Partition 2 → reduceByKey → 广州的汇总
```

### 第8步：Stage 1 的 Task 执行 reduceByKey

```
Task 4（在某个 Executor 上）：
  北京: [5999, 2999, 3999, 1999] → 求和 → 14996
  深圳: [6999, 1999]             → 求和 → 8998

Task 5：
  上海: [3999, 2999, 5999] → 求和 → 12997
  成都: [4999]             → 求和 → 4999

Task 6：
  广州: [4999, 2999, 3999] → 求和 → 11997
```

### 第9步：takeOrdered 取 Top 10

```
Driver 从 3 个 Task 收集结果：
  北京: 14996
  上海: 12997
  广州: 11997
  深圳: 8998
  成都: 4999

按金额倒序排，取前 10：
  1. 北京: 14996
  2. 上海: 12997
  3. 广州: 11997
  4. 深圳: 8998
  5. 成都: 4999

打印到控制台
```

---

## 五、触发 saveAsTextFile 后

```
Job 1 触发

因为 city_total（reduceByKey 的结果）已经在 Job 0 里算过了
Spark 有缓存机制（如果调了 persist/cache）
  → 直接读缓存，不用重算
  → 如果没缓存，要从头重算一遍

把结果写入 HDFS：
  /output/city_sales/part-00000  → Partition 0 的结果
  /output/city_sales/part-00001  → Partition 1 的结果
  /output/city_sales/part-00002  → Partition 2 的结果
```

---

## 六、完整执行流程图

```
你写的代码（Transform，不执行）
│
│ ⑥ takeOrdered 触发 Job 0
│
├─ DAGScheduler 分析 DAG
│
├─ 切 Stage：
│   Stage 0: textFile → filter → map
│   ─── Shuffle ───
│   Stage 1: reduceByKey → takeOrdered
│
├─ Stage 0（4 个 Task 并行）：
│   Executor 1:
│     Task 0: 读块0 → filter筛手机 → map提(城市,金额)
│     Task 1: 读块1 → filter筛手机 → map提(城市,金额)
│   Executor 2:
│     Task 2: 读块2 → filter筛手机 → map提(城市,金额)
│     Task 3: 读块3 → filter筛手机 → map提(城市,金额)
│
├─ Shuffle：按城市 hash 重新分区，跨节点交换数据
│
├─ Stage 1（3 个 Task 并行）：
│   Task 4: reduceByKey → 北京+深圳 求和
│   Task 5: reduceByKey → 上海+成都 求和
│   Task 6: reduceByKey → 广州 求和
│
├─ takeOrdered(10)：Driver 收集结果，排序取 Top 10
│
│ ⑧ saveAsTextFile 触发 Job 1
│
└─ 写入 HDFS（或复用 Job 0 的缓存结果）
```

---

## 七、每个概念在这段代码里的对应

| 概念 | 这段代码里对应什么 |
|------|-------------------|
| Application | 整个 spark-submit 提交的程序 |
| Job 0 | takeOrdered 触发的计算 |
| Job 1 | saveAsTextFile 触发的计算 |
| Stage 0 | textFile → filter → map（Shuffle 之前） |
| Stage 1 | reduceByKey → takeOrdered（Shuffle 之后） |
| Task 0~3 | Stage 0 的 4 个 Task（对应 4 个 HDFS 块） |
| Task 4~6 | Stage 1 的 3 个 Task（对应 3 个 Partition） |
| Partition | Stage 0 由 HDFS 块数决定，Stage 1 由 key hash 决定 |
| DAG | textFile→filter→map→reduceByKey→takeOrdered 的依赖图 |
| 窄依赖 | textFile → filter → map（不需要跨节点） |
| 宽依赖 | map → reduceByKey（需要 Shuffle） |

---

## 八、Partition 的来源

```
                    Partition 怎么来的
─────────────────────────────────────────
读 HDFS 文件         文件被切成几块 → 几个 Partition
读本地文件           sc.textFile 指定的并行度
Shuffle 之后         key.hashCode() % 分区数
手动 repartition(n)  你指定 n 就是 n 个
```

只有 Shuffle 之后，Partition 才由 key 的 hash 决定。Shuffle 之前，Partition 由数据来源决定。

---

## 九、窄依赖 vs 宽依赖

```
窄依赖：一个 Partition 的数据只来自上一步的一个 Partition
  textFile → filter → map
  Partition 0 的数据处理完还是 Partition 0 的
  不需要跟别人交换数据

宽依赖：一个 Partition 的数据可能来自上一步的所有 Partition
  map → reduceByKey
  Partition 0 的结果里可能有 key "hello"
  但 key "hello" 可能在 Partition 1、Partition 2 里也有
  所以必须跨节点拉数据 → Shuffle
```

---

## 十、概念速查表

| 概念 | 是什么 | 数量由谁决定 |
|------|--------|-------------|
| Application | 一次 spark-submit | 你提交了几次 |
| Job | 一个 Action 触发 | 代码里有几个 Action |
| Stage | DAG 按 Shuffle 边界切分 | 代码里有几个 Shuffle |
| Task | 一个 Stage 里的最小执行单元 | Stage 里有多少个 Partition |
| Partition | 数据的一小块 | HDFS 块数 / repartition 设置 |
| DAG | 代码的执行计划图 | Driver 分析代码自动生成 |
| DAGScheduler | 把 DAG 切成 Stage | Driver 内部组件 |
| TaskScheduler | 把 Task 分给 Executor | Driver 内部组件 |
| Executor | 集群上干活的进程 | 你申请了多少资源 |
| Slot | Executor 里的坑位 | executor-cores 设置 |
