---
title: "招银网络后端一面 + 数据开发八股"
date: 2026-09-12
category: 面试
tags: [面试, 八股, 数据开发, 日记归档]
draft: false
---

## 一、招银网络后端一面（原题）

### 1. 自我介绍
→ 准备 1~2 分钟，突出项目经验和技术栈。

### 2. 上下文超长怎么解决，怎么处理压缩、工具返回结果？
→ 常见方案：截断、摘要压缩、滑动窗口保留最近内容、向量检索只取相关片段。

### 3. Redis的过期策略和淘汰策略

**过期策略（怎么删过期key）：**
- 惰性删除：访问时才发现过期了，删掉
- 定期删除：每隔一段时间随机抽查，删掉过期的

**淘汰策略（内存满了怎么办）：**
- `noeviction`：不淘汰，满了就报错
- `allkeys-lru`：所有key里淘汰最近最少使用的
- `volatile-lru`：只在有过期时间的key里淘汰最近最少用的
- `allkeys-random`：随机淘汰

### 4. Redis哪些命令会带来明显的性能问题
- `KEYS *`：全库扫描，数据量大时阻塞
- `HGETALL`：大hash一次全取
- `SMEMBERS`：大集合一次全取
- `DEL`大key：一次性释放大量内存，阻塞
- `SORT`：复杂排序

### 5. Big Key举个例子，一般存什么东西
- 比如一个hash存了100万个用户的session信息
- 或者一个list存了几十万条消息记录
- 一般存：用户行为日志、大JSON对象、大列表/集合

### 6. 缓存击穿和缓存穿透

**缓存穿透：** 查一个根本不存在的数据
- 缓存没有，数据库也没有，每次都打到数据库
- 解决：布隆过滤器 / 缓存空值

**缓存击穿：** 某个热点key突然过期
- 大量请求同时打到数据库
- 解决：加互斥锁 / 热点key永不过期

**缓存雪崩：** 大量key同时过期
- 解决：过期时间加随机值，避免同时失效

### 7. SpringBoot自动装配原理
- `@SpringBootApplication` 包含 `@EnableAutoConfiguration`
- 读 `META-INF/spring.factories` 文件
- 里面列了一堆自动配置类
- 根据 `@ConditionalOnClass` 等条件判断要不要生效
- 比如有 Redis 依赖就自动配好 `RedisTemplate`

### 8. Spring中通过注解实现异步多线程
- `@EnableAsync` + `@Async`
- 在配置类加 `@EnableAsync` 开启异步
- 在方法上加 `@Async` 就会用线程池异步执行

### 9. @Async有什么雷点
- 不能在本类内部调用（this调用不走代理，异步不生效）
- 默认用 `SimpleAsyncTaskExecutor`，每次新建线程，不推荐
- 要自定义线程池，否则高并发下线程爆炸
- 异步方法返回 void 时异常会被吞掉，要配异常处理器

### 10. 主键索引和唯一索引的区别
- **主键索引**：不能为NULL，每表只能一个，叶子节点存整行数据（聚簇索引）
- **唯一索引**：可以有一个NULL，可以有多个，叶子节点存主键值（二级索引）

### 11. 主键索引和唯一索引哪个查询更快
主键索引更快。查到就拿到整行数据了。唯一索引查到后还要**回表**（拿着主键再去主键索引里查一次）。

### 12. MySQL事务隔离级别，InnoDB默认哪种
| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|---------|------|-----------|------|
| READ UNCOMMITTED（读未提交） | 有 | 有 | 有 |
| READ COMMITTED（读已提交） | 无 | 有 | 有 |
| REPEATABLE READ（可重复读） | 无 | 无 | 有（InnoDB用MVCC+间隙锁基本解决） |
| SERIALIZABLE（串行化） | 无 | 无 | 无 |

**InnoDB默认：可重复读（REPEATABLE READ）**

### 13. 索引失效的场景
- 对索引列做函数或运算：`WHERE YEAR(create_time)=2024`
- 隐式类型转换：字符串列不加引号
- LIKE以%开头：`WHERE name LIKE '%三'`
- 联合索引没走最左前缀
- OR连接非索引列

### 14. 举一个数据类型转换失效的例子
```sql
-- phone 是 varchar 类型，建了索引
SELECT * FROM user WHERE phone = 13800000000;
-- 数字 vs 字符串比较，MySQL会把phone转成数字，全表扫描，索引失效 ✗

SELECT * FROM user WHERE phone = '13800000000';
-- 类型一致，走索引 ✓
```

### 15. Kafka怎么保证消息不被重复消费
Kafka本身不能100%防重复（at-least-once），靠消费端去重：
- **幂等性**：业务逻辑天然去重（如数据库唯一键）
- **消费记录表**：消费前查一下 `message_id` 是否已处理过

### 16. 场景题：快查询高可用强一致的银行余额系统怎么设计
- 读写分离 + 强一致读：主库写，从库读但必须读主库（或半同步复制）
- 缓存：余额变化时主动更新缓存，不用TTL被动过期
- 分布式锁/乐观锁：防止并发扣款超扣
- 数据库事务：扣款+记录必须一起成功
- 多机房部署 + 主从切换保证高可用
- 审计日志：每笔变动都记录

---

## 二、MySQL 进阶

### 1. 一条SQL查询的执行过程
```
客户端 → 连接器（验证身份）→ 查询缓存（8.0已移除）
→ 分析器（词法/语法分析）→ 优化器（选择索引/执行计划）
→ 执行器（调用存储引擎接口）→ 返回结果
```

### 2. InnoDB和MyISAM的区别
| 特性 | InnoDB | MyISAM |
|------|--------|--------|
| 事务 | 支持 | 不支持 |
| 锁 | 行级锁 | 表锁 |
| 外键 | 支持 | 不支持 |
| 崩溃恢复 | 强 | 弱 |
| MySQL版本 | 5.5起默认 | 5.5之前默认 |

### 3. B+树和B树的区别
- B+树：数据只在叶子节点，叶子节点用链表连接，适合范围查询
- B树：每个节点都存数据，不适合范围扫描
- **为什么MySQL用B+树**：叶子节点相连，范围查询只需遍历链表；非叶子节点不存数据，能放更多索引，树更矮，IO更少

### 4. 聚簇索引和非聚簇索引
- **聚簇索引**：叶子节点存整行数据，一张表只有一个（主键索引）
- **非聚簇索引（二级索引）**：叶子节点存主键值，查完需要**回表**

### 5. 联合索引和最左前缀
```sql
-- 联合索引 (a, b, c)
WHERE a=1 AND b=2 AND c=3  -- ✅ 全部命中
WHERE a=1 AND b=2          -- ✅ 命中 a,b
WHERE a=1                  -- ✅ 命中 a
WHERE b=2                  -- ✗ 跳过了a，索引失效
WHERE a=1 AND c=3          -- ⚠️ 只命中a，c不走索引
```

### 6. EXPLAIN怎么用
```sql
EXPLAIN SELECT * FROM user WHERE phone = '138';
-- 重点看：
-- type: ALL(全表扫描) < index < range < ref < const
-- key: 实际用了哪个索引
-- rows: 预估扫描行数
-- Extra: Using index(覆盖索引) / Using filesort(额外排序)
```

---

## 三、Kafka

### 1. Kafka架构
```
Producer → Broker集群 → Consumer Group
            ↓
         Topic（逻辑）
            ↓
         Partition（物理，分布在不同Broker）
            ↓
         每个Partition内消息有序，全局不保证有序
```

### 2. Kafka为什么快
- **顺序写磁盘**：追加写入，比随机写快几百倍
- **零拷贝**：数据直接从磁盘到网卡，不经过用户空间
- **批量发送**：攒一批再发，减少网络开销
- **分区并行**：多个Partition可以并行读写
- **页缓存**：利用OS的Page Cache

### 3. Kafka消息不丢失
**生产者端：**
- `acks=all`：所有副本都确认才认为发送成功
- `retries`：发送失败自动重试

**Broker端：**
- `min.insync.replicas=2`：至少2个副本同步成功
- 副本因子 >= 2

**消费者端：**
- 手动提交offset：处理完再提交，不要自动提交
- 消费者幂等：重复消费不产生副作用

### 4. Kafka的offset管理
- 每个消费者在每个Partition上维护一个offset
- offset记录消费到哪条消息了
- 存在 `__consumer_offsets` 这个内部Topic中
- 自动提交：定时提交，可能丢消息或重复消费
- 手动提交：处理完业务逻辑后才提交，更安全

### 5. Kafka和RabbitMQ的区别
| 特性 | Kafka | RabbitMQ |
|------|-------|----------|
| 模型 | 发布-订阅（拉模式） | 队列（推模式） |
| 吞吐量 | 百万级/秒 | 万级/秒 |
| 延迟 | 毫秒级 | 微秒级 |
| 消息顺序 | 分区内有序 | 队列内有序 |
| 使用场景 | 日志、大数据流、事件溯源 | 业务消息、任务队列 |

### 6. Kafka的消费者组
- 一个Topic可以有多个消费者组，互不影响
- 同一个组内，一个Partition只能被一个消费者消费
- 消费者数量 > Partition数量 → 有消费者闲置
- Partition数量 >= 消费者数量 才能充分利用

### 7. Kafka如何保证顺序消费
- 全局有序：Topic只设1个Partition（牺牲性能）
- 局部有序：相同key的消息发到同一个Partition（如同一用户的操作）

### 8. Kafka消息积压怎么处理
- 增加消费者数量（同时增加Partition数）
- 消费者批量拉取处理
- 临时把消息转发到更多Partition的临时Topic
- 如果消费逻辑太慢，优化消费端代码

---

## 四、Spark

### 1. Spark和MapReduce的区别
| 特性 | Spark | MapReduce |
|------|-------|-----------|
| 速度 | 快10~100倍（内存计算） | 慢（中间结果写磁盘） |
| 编程模型 | RDD/DataFrame/Dataset，API丰富 | Map和Reduce两个阶段 |
| 迭代计算 | 适合（MLlib机器学习） | 不适合（每轮都读写HDFS） |
| 实时处理 | Spark Streaming / Structured Streaming | 不支持 |

### 2. Spark核心概念
```
Application = Driver + Executors

Driver：运行main()的进程，负责调度
Executor：工作进程，在Worker节点上运行
Task：最小执行单元，一个Task处理一个Partition的一个阶段
Job：一个Action算子触发一个Job
Stage：一个Job被Shuffle切分成多个Stage
```

### 3. RDD、DataFrame、Dataset的区别
| | RDD | DataFrame | Dataset |
|--|-----|-----------|---------|
| 类型安全 | 有（编译时） | 无 | 有（编译时） |
| API风格 | 函数式 | SQL风格 | 两者都有 |
| 序列化 | Java/Kryo | Tungsten优化 | Tungsten优化 |
| 使用场景 | 底层控制 | SQL分析 | 结构化+类型安全 |

### 4. Spark Shuffle是什么
- 数据需要跨分区重新分配（如groupBy、join）
- 涉及大量磁盘IO和网络传输
- 是Spark性能瓶颈的主要来源
- **优化**：减少Shuffle（用map-side聚合）、用Broadcast Join

### 5. Spark内存管理
```
Executor内存分两块：
├── 执行内存（Execution）：Shuffle、Join、Sort、Aggregation
└── 存储内存（Storage）：Cache、Broadcast变量

统一内存管理：两块可以互相借用
```

### 6. Spark的宽依赖和窄依赖
- **窄依赖**：父RDD的每个Partition只被子RDD的一个Partition使用（map、filter）
- **宽依赖**：父RDD的Partition被子RDD的多个Partition使用（groupBy、reduceByKey）
- 宽依赖 → 产生Shuffle → 产生Stage边界

### 7. Spark Streaming和Structured Streaming
| | Spark Streaming | Structured Streaming |
|--|----------------|---------------------|
| API | DStream（RDD） | DataFrame/Dataset |
| 语义 | 微批处理 | 微批 + 持续处理 |
| 精确一次 | 需要额外处理 | 内置支持 |
| 推荐 | 老项目 | 新项目首选 |

### 8. Spark数据倾斜
**表现：** 大部分Task很快完成，个别Task特别慢
**原因：** 某个key的数据量远超其他key
**解决：**
- 加随机前缀打散大key → 聚合 → 去前缀再聚合
- Broadcast Join（小表广播，避免Shuffle）
- 自定义Partitioner均匀分布
- 增大Shuffle并行度 `spark.sql.shuffle.partitions`

---

## 五、Hadoop

### 1. Hadoop三大组件
```
HDFS：分布式文件存储（存数据）
MapReduce：分布式计算（算数据）
YARN：资源调度（管资源）
```

### 2. HDFS架构
```
NameNode（主节点）：
  - 存元数据（文件名、Block位置、副本信息）
  - 只有一个Active（HA模式有Standby）

DataNode（从节点）：
  - 存实际数据Block
  - 每个Block默认3个副本

读写流程：
  写：客户端 → NameNode获取DataNode列表 → 直接写DataNode → 副本复制
  读：客户端 → NameNode获取Block位置 → 直接读DataNode
```

### 3. HDFS的副本策略
- 默认3个副本
- 第1个：本地机架的某个节点
- 第2个：不同机架的某个节点（跨机架容灾）
- 第3个：和第2个同一机架的另一个节点

### 4. NameNode和SecondaryNameNode
- **NameNode**：管理元数据，存内存中（快）
- **SecondaryNameNode**：定期合并 fsimage 和 edits log，减轻NameNode负担
- SNN不是NN的备份！HA模式下有Standby NameNode做真正备份

### 5. YARN架构
```
ResourceManager（主）：
  - 管理整个集群资源
  - 调度Application

NodeManager（从）：
  - 管理单个节点的资源
  - 启动/监控Container

ApplicationMaster：
  - 每个应用一个
  - 向ResourceManager申请资源
  - 调度Task到Container执行
```

### 6. MapReduce执行流程
```
Input → Split → Map → Shuffle → Sort → Reduce → Output

Map阶段：读数据 → 处理 → 输出 <key, value> 对
Shuffle：相同key的数据分到同一个Reducer
Sort：对key排序
Reduce：聚合计算 → 输出结果
```

### 7. Hadoop小文件问题
- 每个小文件都对应一个Block和元数据记录
- NameNode内存被大量小文件占满
- **解决**：
  - HAR文件（Hadoop Archive）
  - CombineFileInputFormat（合并小文件输入）
  - 先合并再上传（业务层处理）

---

## 六、Hive

### 1. Hive是什么
- 基于HDFS的数据仓库工具
- 把SQL转成MapReduce/Spark/Tez任务执行
- 适合离线批处理分析，不适合实时查询

### 2. Hive内部表和外部表
| | 内部表（Managed Table） | 外部表（External Table） |
|--|------------------------|------------------------|
| 数据归属 | Hive管理 | 用户管理 |
| DROP表 | 删元数据+删数据 | 只删元数据，数据保留 |
| 使用场景 | 临时表、中间表 | 生产数据、共享数据 |

### 3. Hive分区和分桶
**分区（Partition）：**
```sql
CREATE TABLE logs (id INT, msg STRING)
PARTITIONED BY (dt STRING);  -- 按日期分区
-- 查询时 WHERE dt='2024-01-01' 只扫描该分区目录
```

**分桶（Bucket）：**
```sql
CREATE TABLE user (id INT, name STRING)
CLUSTERED BY (id) INTO 32 BUCKETS;
-- 按hash(id)分到32个文件，优化JOIN采样
```

### 4. Hive的存储格式
| 格式 | 特点 |
|------|------|
| TextFile | 默认，可读，不压缩 |
| ORC | 列式存储，压缩率高，支持索引，**生产首选** |
| Parquet | 列式存储，Spark生态首选 |
| SequenceFile | 二进制，Hadoop原生 |

### 5. Hive优化
- **分区裁剪**：查询时带上分区条件
- **列裁剪**：只查需要的列
- **Map Join**：小表广播，避免Reduce阶段Shuffle
- **数据倾斜处理**：加随机前缀、倾斜key单独处理
- **合理设置Reduce数量**

---

## 七、HBase

### 1. HBase是什么
- 基于HDFS的NoSQL数据库
- 列族存储，支持海量数据的**实时随机读写**
- 适合：宽表、稀疏数据、需要随机读写的场景

### 2. HBase架构
```
RegionServer（从）：
  - 管理多个Region（表的水平切分）
  - 每个Region包含多个Store（一个列族一个Store）
  - Store包含MemStore（内存）+ StoreFile/HFile（磁盘）

Master（主）：
  - 管理RegionServer
  - Region的分配和负载均衡
  - DDL操作（建表等）

ZooKeeper：
  - 存储元数据位置
  - Master选举
  - RegionServer存活监控
```

### 3. HBase的RowKey设计
- **原则**：散列 + 业务查询需要
- **避免热点**：不要用自增ID，加盐/反转/Hash
- **长度**：越短越好（每个KeyValue都存RowKey）
- **示例**：`reverse(timestamp) + userId` 让数据分散

### 4. HBase和MySQL的区别
| 特性 | HBase | MySQL |
|------|-------|-------|
| 数据模型 | 列族，宽表 | 关系型，行存储 |
| 事务 | 单行事务 | 完整事务 |
| 查询 | 只能按RowKey高效查询 | SQL灵活查询 |
| 数据量 | PB级 | GB~TB级 |
| 场景 | 海量实时读写 | 业务系统 |

---

## 八、Flink

### 1. Flink和Spark Streaming的区别
| 特性 | Flink | Spark Streaming |
|------|-------|----------------|
| 模型 | 真正的流处理 | 微批处理 |
| 延迟 | 毫秒级 | 秒级 |
| 状态管理 | 内置强大 | 较弱 |
| 窗口 | 丰富（时间/计数/会话） | 基本 |
| 精确一次 | 支持 | 支持 |
| 推荐 | 实时流处理首选 | 批处理为主 |

### 2. Flink核心概念
```
Stream：无界数据流
Operator：算子（map、filter、keyBy、window）
Window：窗口（将无界流切分为有限块处理）
  - 滚动窗口（Tumbling）：固定大小，不重叠
  - 滑动窗口（Sliding）：固定大小，有重叠
  - 会话窗口（Session）：按活动间隔划分
Watermark：水位线，处理乱序事件
State：状态（Keyed State / Operator State）
Checkpoint：检查点，故障恢复用
```

### 3. Flink的Checkpoint机制
- 周期性地对流处理状态做快照
- 基于Chandy-Lamport算法（分布式快照）
- Barrier对齐：所有输入流的Barrier都到齐才触发
- **精确一次语义**：Checkpoint成功 → Offset提交 → 失败时从Checkpoint恢复

### 4. Flink的时间语义
| 时间类型 | 含义 |
|---------|------|
| Event Time | 事件产生的时间（最常用） |
| Processing Time | 算子处理的时间 |
| Ingestion Time | 进入Flink的时间 |

乱序问题用 **Watermark + 允许延迟** 处理。

### 5. Flink的State
- **Keyed State**：每个key一个状态（如用户维度的聚合）
- **Operator State**：每个算子实例一个状态
- 存储后端：MemoryStateBackend / FsStateBackend / RocksDBStateBackend
- **RocksDB**：生产首选，支持超大状态

### 6. Flink Exactly-Once怎么实现
- **内部**：Checkpoint机制（状态快照+恢复）
- **外部Sink**：
  - 幂等写入（如数据库Upsert）
  - 两阶段提交（2PC）：预提交 → Checkpoint完成 → 正式提交

### 7. Flink CDC是什么
- Change Data Capture：捕获数据库变更
- 基于Debezium，监听MySQL Binlog
- 实时同步数据库变更到下游（数据湖/数据仓库）
- 全量 + 增量一体化同步

---

## 九、数据仓库

### 1. 数仓分层
```
ODS（操作数据层）：原始数据，原样存储
DWD（明细数据层）：清洗、标准化、维度退化
DWS（汇总数据层）：按主题聚合
ADS（应用数据层）：面向业务的指标表
DIM（维度表）：城市、商品、用户维度信息
```

### 2. 维度建模
- **星型模型**：事实表直接关联维度表（简单，查询快）
- **雪花模型**：维度表再拆分（规范化，节省空间但查询慢）
- **事实表**：记录业务事件（订单、点击、交易）
- **维度表**：描述业务对象的属性（时间、地点、商品）

### 3. 拉链表
- 记录数据的全生命周期变化
- 每条记录有 `start_date` 和 `end_date`
- 只保留最新有效记录，历史版本用拉链表追溯
- 适合：数据量大但变化不频繁的维度表

---

## 十、数据开发通用

### 1. 离线和实时的区别
| | 离线 | 实时 |
|--|------|------|
| 延迟 | 小时~天 | 秒~分钟 |
| 数据量 | 大 | 中 |
| 工具 | Hive/Spark | Flink/Kafka Streams |
| 场景 | 报表、分析 | 监控、推荐、风控 |

### 2. 数据倾斜怎么解决（通用思路）
```
1. 打散大key：加随机前缀 → 聚合 → 去前缀再聚合
2. 增加并行度：调大分区数
3. Map Join：小表广播避免Shuffle
4. 自定义分区器：均匀分配key
5. 倾斜key单独处理：单独拿出来处理后合并
```

### 3. ETL工具对比
| 工具 | 特点 |
|------|------|
| Sqoop | HDFS ↔ 关系数据库，批处理 |
| DataX | 阿里开源，多数据源，插件化 |
| Flink CDC | 实时同步，基于Binlog |
| Kettle | GUI拖拽，适合简单ETL |

### 4. 布隆过滤器
- 概率型数据结构，判断元素**是否可能存在**
- 说"不存在"一定不存在，说"存在"可能误判
- 不支持删除
- 用途：缓存穿透防护、爬虫URL去重、垃圾邮件过滤

---

*创建时间：2026-09-11*
*来源：招银网络后端一面原题 + 数据开发/大数据常见八股*
