---
title: "Spark 数据倾斜 & Spark UI 实操手册"
date: 2026-09-22
category: 技术
tags: [spark, 数据倾斜, sparkui, 面试, 日记归档]
draft: false
---

> 日期：2026-09-22
> 性质：学习记录 + 面试手册（理论 + 本机实操环境复用指南）
> 关联文档：《无尽冬日游戏全解析-用户研究面试准备.md》（同日）、沙箱原理为口头讲解未存档

---

## 一、本次会话做了什么（Session Log）

1. **理论**：数据倾斜的诊断方法与 5 大场景解法（含可运行 PySpark 代码）
2. **理论**：Spark UI 各页面读法、诊断路径、关键参数速查
3. **实操**：用本机 Docker 镜像 `apache/spark:4.0.4` 搭了演示环境 `spark-ui-demo` 容器，跑了一个**故意构造数据倾斜**的循环作业，浏览器访问 `http://localhost:4040` 观察真实 UI
4. **实操**：对照 UI 截图（Job 691 的 DAG）逐词讲解了 Stage / skipped / WholeStageCodegen / Exchange / Union / AQEShuffleRead 等节点
5. **实操**：用 `explain(mode="formatted")` 验证了 DAG 节点的来源（用户代码 vs 优化器插入 vs 运行时插入）
6. **收尾**：停掉演示作业（容器保留，可一键重启）

---

## 二、演示环境复用指南（重点收藏）

### 现状
- 容器 `spark-ui-demo`：**保留中**（空闲 `sleep infinity`，不占资源）
- 演示脚本（容器内）：`/tmp/skew_demo.py`；本地源文件：`C:\Users\yaya\.claude\tmp\skew_demo.py`
- explain 验证脚本：本地 `C:\Users\yaya\.claude\tmp\explain_demo.py`
- 作业日志（容器内）：`/tmp/skew.log`；event log：`/tmp/spark-events`

### 常用命令
```powershell
# 重启倾斜演示作业（跑起来后开 http://localhost:4040）
docker exec -d spark-ui-demo bash -c "/opt/spark/bin/spark-submit --driver-memory 2g /tmp/skew_demo.py > /tmp/skew.log 2>&1"

# 看作业日志
docker exec spark-ui-demo tail -f /tmp/skew.log

# 停作业（保留容器）
docker exec spark-ui-demo bash -c "pkill -f skew_demo"

# 彻底清理
docker rm -f spark-ui-demo

# 容器没了想重建
docker run -d --name spark-ui-demo -p 4040:4040 --entrypoint bash apache/spark:4.0.4 -c "mkdir -p /tmp/spark-events && sleep infinity"
docker cp C:\Users\yaya\.claude\tmp\skew_demo.py spark-ui-demo:/tmp/skew_demo.py
```

### 待做的对比实验（AQE 效果演示）
把 `skew_demo.py` 里 `spark.sql.adaptive.skewJoin.enabled` 从 `false` 改成 `true`，重跑后到 UI 的 SQL 页看执行计划出现 `SkewJoin` 拆分节点、倾斜 task 消失 —— 一次实验看懂 AQE 原理。

### 演示作业设计（为什么能看到倾斜）
- 1000 万行，**50% 集中在热点 key `hot_user`**，其余均摊 1 万个普通 key
- 交替跑：倾斜 groupBy 聚合 + 倾斜 join（大表 join 1 万行维表）
- 故意关闭广播（`autoBroadcastJoinThreshold=-1`）和 AQE skewJoin，保留倾斜现象
- `shuffle.partitions=16`，每 20 秒一轮循环，UI 随时有活数据

---

## 三、数据倾斜：诊断与解法

### 诊断
- Spark UI → Stages → Tasks 表：按 **Shuffle Read Size / Duration 排序**，max ≫ median（5-10 倍+）即倾斜
- 定位热点 key：`df.groupBy("key").count().orderBy(desc("count")).show(10)`
- 伴随症状：单 task Spill(disk)、GC 高、OOM（exit 137）

### 解法速查表
| 场景 | 首选方案 | 一句话原理 |
|---|---|---|
| Spark 3.0+ 通用 | **AQE skewJoin**（配置开关） | 运行时统计真实分区大小，自动拆倾斜分区 |
| 大 join 小 | **Broadcast Join** | 广播小表，消灭 shuffle |
| 大 join 大、热点已知 | **加盐 join**（热点单独处理后 union） | key 加随机后缀打散 N 份，对侧膨胀 N 份 |
| groupBy 聚合倾斜 | **两阶段聚合** | 加盐局部聚合 → 去盐全局聚合（仅可分解聚合：sum/count/max） |
| count(distinct) 倾斜 | 改 groupBy 去重再 count / approx_count_distinct | distinct 不可局部聚合 |
| null/脏数据倾斜 | **过滤或分流** | 别让无效 key 进 shuffle |
| 兜底 | 调大 `spark.sql.shuffle.partitions` | 只缓解轻微倾斜 |

### 加盐 join 核心代码
```python
N = 10
skew_side = big_df.withColumn("salted_key",
    concat_ws("_", col("user_id"), floor(rand()*N).cast("int").cast("string")))
other_side = other_df.withColumn("salted_key",
    explode(array(*[concat_ws("_", col("user_id"), lit(str(i))) for i in range(N)])))
result = skew_side.join(other_side, "salted_key").drop("salted_key")
```

### 两阶段聚合核心代码
```python
partial = df.withColumn("salt", floor(rand()*N).cast("int")) \
            .groupBy("user_id","salt").agg(sum("amount").alias("s"))
final   = partial.groupBy("user_id").agg(sum("s").alias("total"))
```

---

## 四、Spark UI 读法

### 页面主线
`Application → Job(action触发) → Stage(shuffle切分) → Task(每分区一个)`
看问题顺序：**Jobs 找慢 job → Stages 找慢 stage → Tasks 看分布定倾斜 → Executors 看资源/GC → SQL 页看计划**

### 各页要点
- **Stages 页**：Shuffle Read/Write 量、Spill、GC Time、Duration 的 min/median/max 分布
- **Tasks 表**：按 Shuffle Read Size 排序找倾斜 task；Errors 列看 OOM 堆栈
- **Executors 页**：Event Timeline 看"一片快 + 一根长尾"的倾斜图形；GC/Task 时间比 >10% 警惕；Failed tasks 集中在个别节点 = 机器倾斜
- **SQL 页**：确认 BroadcastHashJoin 是否生效（没生效会是 SortMergeJoin）、Filter 是否下推、Exchange 位置、各节点 output rows；AQE 生效痕迹（SkewJoin 节点）
- **Environment 页**：确认配置真的生效

### 关键参数
```properties
spark.sql.shuffle.partitions=200            # 最常调, 数据大调1000~4000
spark.executor.memory / memoryOverhead      # OOM/exit137 调后者
spark.sql.autoBroadcastJoinThreshold        # 默认10MB
spark.sql.adaptive.enabled=true
spark.sql.adaptive.skewJoin.enabled=true
spark.eventLog.enabled=true                 # History Server 必备
```

---

## 五、DAG 逐词解释（对照 2026-09-22 的 Job 691 截图）

| 截图里的词 | 是什么 | 谁放进去的 | 用户代码对应 |
|---|---|---|---|
| Stage 框 | 无 shuffle 的连续 task 集合；Exchange 处切分 | 规划器 | — |
| (skipped) | 该 stage 的 shuffle 输出已被之前的 job 算好，直接复用 | 引擎复用机制 | — |
| WholeStageCodegen (N) | 全阶段代码生成：把框内算子链编译成一个 Java 函数；圆点=被融合的算子（可点开） | 代码生成规则 | 无 |
| Exchange | =shuffle，按 hash(key) 重分区；stage 边界 | **优化器插入**（explain 里标 `ENSURE_REQUIREMENTS`） | 无直接 API；join/groupBy/repartition 间接产生 |
| Union | 两个 DataFrame 纵向拼行 | 用户代码 | `unionByName()` / `UNION ALL` |
| SortMergeJoin | join 的物理实现策略之一 | **优化器按表大小/统计信息选** | 用户只写 `join()` |
| AQEShuffleRead | AQE 运行时包装的 shuffle 读端（可合并小分区/拆倾斜分区） | **运行时插入** | 无；开 AQE 就有 |
| Sort | 为 SortMergeJoin 补的排序 | 优化器插入 | 无 |
| Filter isnotnull | join 前自动过滤 null key | 优化器插入 | 无 |

### Job 691 的故事（本次演示）
- Stage 1478 (skipped) = 大表 df 的 shuffle 写侧（1000 万行、热点 hot_user）
- Stage 1479 (skipped) = 维表 dim 的 shuffle 写侧（两路 Range 经 Union 拼接后打散）
- Stage 1480 (executed) = 两路 AQEShuffleRead → WholeStageCodegen(6) 内做 SortMergeJoin → 局部 count → 底部 Exchange 交最终汇总
- 倾斜观察点：Stage 1480 的 Tasks 表里，接 hot_user 分区的 task 读 ~500 万行，长尾即它

### explain vs UI 的区别（重要认知）
- `explain()` = **计划时**物理计划：有 Exchange/SortMergeJoin/Union，**没有** AQEShuffleRead、WholeStageCodegen
- UI 的 DAG = **运行时**实际执行计划：多出 AQE 注入与代码生成的节点（根节点 `AdaptiveSparkPlan` 是 AQE 占位符）
- 验证方式：`df.explain(mode="formatted")`（本机已跑过，输出见会话记录）

---

## 六、本次踩坑记录

1. **Docker Desktop 没启动**：`docker` 命令报 npipe 连接失败 → 先 `Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"` 并轮询 `docker info` 等就绪
2. **unionByName 列数不匹配**（NUM_COLUMNS_MISMATCH）：`spark.range(1).withColumn(...)` 保留了 `id` 列 → 补 `.select("user_id","city")` 对齐列
3. **PowerShell 双引号会展开 `$p`**：`docker exec ... bash -c "...sed -n '/xx/,$p'"` 里 `$p` 被 PowerShell 吃成空串导致 sed 报错 → bash -c 内容改用单引号包裹或避开 `$`
4. **explain 不触发计算**：只想看计划时放心 explain，懒加载不会真跑 1000 万行

---

## 七、面试速答骨架

- **"怎么定位倾斜"**：UI Stages/Tasks 的 max vs median + Shuffle Read 排序 → 采样定位热点 key → 区分数据倾斜/资源不足/计划错误
- **"怎么解决"**：先 AQE（3.x 默认思路）→ 小表广播 → 热点加盐/两阶段聚合 → null 分流 → 上游建模治理（最彻底）
- **"DAG 里 Exchange 是什么"**：shuffle 边界；优化器为满足下游算子的分布要求自动插入（ENSURE_REQUIREMENTS）
- **"skipped stage 是什么"**：shuffle 输出复用，不重算
- **加分项**：用 explain 对比开关 broadcast/AQE 前后计划变化；Event Timeline 长尾图举证倾斜
