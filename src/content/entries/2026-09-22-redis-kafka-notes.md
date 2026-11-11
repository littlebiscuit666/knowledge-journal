---
title: "Redis + Kafka 八股速记"
date: 2026-09-22
category: 面试
tags: [redis, kafka, 八股, 日记归档]
draft: false
---

> 用法：每题先看问题自己复述，再对照答案。重点背"回答模板"。

---

# 第一部分：Redis

## 1. Redis 为什么快？

1. 纯内存操作，无磁盘 IO（最根本）
2. 命令处理单线程：无线程上下文切换、无锁竞争
3. IO 多路复用（epoll）：一个线程同时处理大量连接
4. 数据结构专门优化：SDS、跳表、压缩列表
5. C 语言实现，离底层近

**回答模板**："基于内存；命令执行单线程避免切换和锁竞争；epoll 处理高并发连接；底层数据结构优化（SDS、跳表）。"

**追问：单线程为何还能高并发？** 瓶颈不在 CPU 而在网络和内存；epoll 让单线程盯大量连接，内存操作纳秒级。
注意：Redis 6.0 网络读写引入多线程，但**命令执行仍是单线程**；持久化 fork 子进程干。

---

## 2. 五大数据类型 + 场景

| 类型 | 场景 |
|------|------|
| String | 缓存对象JSON、计数器(incr)、验证码、分布式锁(setnx) |
| Hash | 存对象/商品/用户信息，可单字段更新(hmset/hset) |
| List | 消息队列(lpush+brpop)、最新列表 |
| Set | 去重(UV)、标签、共同好友(sinter)、抽奖 |
| ZSet | 排行榜、延时队列(时间戳做score)、范围查找 |

口诀：缓存计数 String，对象 Hash，队列 List，去重交并 Set，排行榜 ZSet。

**加分**：Bitmap（签到）、HyperLogLog（海量UV，省内存有误差）、Geo（附近的人）、Stream（带消费组的MQ）。

---

## 3. 穿透 / 击穿 / 雪崩

本质都是"缓存没挡住，流量打到数据库"，区别在多少数据、为什么没挡住。

- **穿透**：查的数据数据库里本就不存在
  解决：缓存空值（设短TTL）；布隆过滤器
- **击穿**：单个热点 key 过期瞬间，大量并发涌入
  解决：互斥锁（只让一个请求重建缓存）；逻辑过期/永不过期
- **雪崩**：大量 key 同时失效，或 Redis 整体宕机
  解决：过期时间加随机值；Redis 高可用(哨兵/Cluster)；预热 + 限流降级

---

## 4. 过期策略 + 内存淘汰策略

**过期策略（key 到期怎么删）**：
- 惰性删除：下次访问时才检查删除（省CPU，没人访问的删不掉）
- 定期删除：每秒10次随机抽查，过期比例高就继续抽

**内存淘汰（内存满了，maxmemory-policy）**：
- noeviction：默认，直接报错
- allkeys-lru：所有key里淘汰最久没用的（缓存场景最常用）
- volatile-lru：只在设了TTL的key里淘汰最久没用的
- allkeys-random / volatile-random：随机
- volatile-ttl：最快过期的先淘汰
- allkeys-lfu / volatile-lfu：按使用频率淘汰（4.0）

**LRU vs LFU**：LRU 看最近使用时间；LFU 看使用频率（一年没用刚碰一次的，LFU 仍淘汰它）。

注意：RDB/AOF 是**持久化**，不是淘汰。

---

## 5. RDB vs AOF

| | RDB | AOF |
|--|-----|-----|
| 形式 | 二进制快照(dump.rdb) | 写命令日志追加 |
| 体积 | 小 | 大（有rewrite重写压缩） |
| 恢复 | 快 | 慢 |
| 丢数据 | 多（分钟级） | 少 |
| 适合 | 备份、灾备 | 数据安全要求高 |

AOF 刷盘策略 appendfsync：
- always：每条都刷，最安全最慢
- everysec：每秒刷，默认，宕机最多丢1秒，最常用
- no：交给操作系统，最快可能丢很多

**生产**：RDB + AOF 混合持久化（4.0+ 默认推荐）：文件开头 RDB 二进制 + 后续 AOF 增量，兼具快恢复和少丢。重启优先用 AOF/混合文件。

---

## 6. 分布式锁

**为什么需要**：分布式部署多台服务器，单机锁(synchronized)只管自己 JVM，跨机器失效 → 需要 A、B 都能访问的第三方(Redis)。

**单机并发问题**：`count=count-1` 实际是 读→减→写回 三步，两个线程同时操作会超卖。synchronized 像厕所插销，同一时刻只准一个线程进入。

**标准命令**：
```
SET lock:业务key uuid NX EX 10
```
- NX：key 不存在才成功（抢坑）
- EX 10：10秒自动过期（防持锁者宕机死锁），必须和加锁一步完成
- value=UUID：删锁前确认"是我的锁"，防误删
- 释放锁用 **Lua 脚本**保证"判断+删除"原子性

**看门狗 watchdog**：后台线程自动续期，防业务没干完锁过期，由 **Redisson** 框架实现。

**追问**：主从切换锁可能丢失 → RedLock 红锁（向多个独立节点申请，多数成功才算）。

---

## 7. 主从复制

- 全量同步（首次）：从机发 PSYNC → 主机 bgsave 生成 RDB → **网络**发给从机（不是拷贝磁盘文件）
- 增量同步：之后每条写命令实时传播给从机；主机用 **repl_backlog**（复制积压缓冲区，默认1MB）缓存命令，断线重连补漏；补不了才重新全量
- 规则：复制单向，只能主→从；从机默认只读

**目的**：① 读写分离分担读压力 ② 数据冗余（高可用基础）
主机宕机自动切换需加**哨兵 Sentinel**（监控+选举+通知）；主从是地基，哨兵是值班员。

---

## 8. 缓存与数据库一致性（Cache Aside）

- 读：先缓存，未命中读库并回填
- 写：**先更新数据库，再删除缓存**

为什么删而不是更新：懒加载，避免无效计算和并发写冲突。
为什么先更库再删：反过来（先删缓存）会在删完、更库前被读请求把旧值写回缓存。

删缓存失败怎么办：MQ 重试（幂等）；或 Canal 订阅 MySQL binlog 异步删。缓存设 TTL 兜底。

---

## 9. 热 key / 大 key

**热 key**（访问量极大）：
- 危害：过期=击穿；不过期也会打满所在单节点（集群分片解决不了）
- 发现：redis-cli --hotkeys、客户端埋点
- 解决：本地缓存(Caffeine)；复制成 hotkey:1~N 随机读打散；永不过期/异步刷新

**大 key**（value巨大/集合元素几十万）：
- 危害：内存倾斜；del 阻塞单线程；网络阻塞；迁移/同步超时
- 发现：redis-cli --bigkeys、SLOWLOG
- 解决：拆成多个小key（取模）；压缩；删除用 unlink 异步

---

## 10. Redis 做 MQ（对比 Kafka）

三种：List(lpush/brpop，会丢)；Pub/Sub（不持久化）；Stream（5.0，持久化+消费组+ACK+回溯）。

选型：轻量低延迟、量不大、已有 Redis → Redis；高吞吐、要可靠、要回放、大数据链路 → Kafka。

---

# 第二部分：Kafka

## 1. 为什么用消息队列

1. 削峰填谷：高峰流量先排队，下游平稳消费（水库拦洪）
2. 解耦：上游不关心下游是谁，加消费者不改上游
3. 异步：非核心操作丢MQ异步处理，主流程快速返回
4. （加分）持久化可回放：按 offset 重消费，适合故障恢复/重算

---

## 2. 架构名词

- **Producer**：发消息
- **Broker**：一个 Kafka **进程**（通常一机器一个，近似一台机器）
- **Topic**：消息分类，逻辑概念
- **Partition**：topic 切成多个分区，放不同 broker，是水平扩展/并行的关键；分区内有序，分区间无序
- **Offset**：分区内消息唯一编号，消费者记录读到哪
- **Consumer / Consumer Group**：组内一个分区只能被一个消费者消费；消费者数超过分区数则多余的闲置；不同组各自消费全量（发布订阅）
- **Replica**：分区多副本，Leader 读写、Follower 同步，Leader 挂了从 ISR 选新的

---

## 3. 副本物理布局（重要认知）

- 存储目录：server.properties 的 `log.dirs`
- 一个分区 = 磁盘上一个文件夹 `topic名-分区号`，内含 `.log`(消息)、`.index`(偏移量索引)、`.timeindex`
- 同一分区的多个副本分散在**不同 broker 机器**上
- **Leader/Follower 是分区级别，不是机器级别**：每台 broker 对某些分区是 Leader、对另一些是 Follower，没有"主机器"
- broker 与 topic 是多对多：一个 broker 存多个 topic 的分区碎片，一个 topic 横跨多个 broker

命令：
```
# 看分区/副本/Leader/ISR
kafka-topics.sh --describe --topic order_topic --bootstrap-server hadoop102:9092
# 看.log里真实消息
kafka-dump-log.sh --files 00000000000000000000.log
```

---

## 4. ISR / OSR / AR

- **AR**(Assigned Replicas) = ISR + OSR，全部分区副本
- **ISR**(In-Sync Replicas)：跟得上 Leader 的副本
- **OSR**(Out-of-Sync Replicas)：掉队的副本

判定：`replica.lag.time.max.ms` 默认 **30秒**，Follower 30秒没拉取或追不上 → 踢出 ISR 进 OSR（**不是踢出分区**，副本仍在、继续拉），追平后自动回 ISR。Leader 只能从 ISR 选。

---

## 5. 消息可回放原理

- Kafka 消息消费后**不删除**，按保留时间（默认7天）清理
- 消费只是移动 offset 指针，数据不动
- 回放 = 重置 offset 或换新消费组重读：
```
kafka-consumer-groups.sh --reset-offsets --to-earliest --group 组名 --topic xxx --execute
```
- offset 存在内部 topic `__consumer_offsets`
- 区分：Kafka 层面只有 offset；**checkpoint 是 Spark 的机制**（存 Spark 读到的 offset + 聚合状态），想让 Spark 回放要删/换 checkpoint 目录

---

## 6. 消息不丢失（三端）

- **生产者**：`acks=all`（等 ISR 所有副本确认）+ `retries` 重试
- **Broker**：`replication.factor=3` + `min.insync.replicas=2`（至少两份写入）
- **消费者**：关闭自动提交，**处理完业务再手动提交 offset**（Spark 是批处理成功后才写 checkpoint）

**不重（精确一次）**：生产者开 `enable.idempotence` 幂等（PID+分区+序列号去重）；跨分区用 Kafka 事务；下游主键/唯一约束兜底。

区分：不丢 = acks=all+多副本+处理完再提交；不重 = 幂等+事务+主键去重。

---

## 7. 消息积压

定位：
```
kafka-consumer-groups.sh --bootstrap-server hadoop102:9092 --describe --all-groups
```
看 **LAG = LOG-END-OFFSET − CURRENT-OFFSET**；生产用 Grafana/Burrow 监控告警。
排查：生产暴增 or 消费变慢；消费者掉线/频繁 rebalance/GC/慢操作；是否单分区倾斜。

解决：
1. 消费者数 < 分区数 → 加消费者（上限=分区数）
2. 消费者已=分区数 → 扩分区+加消费者承接**新消息**（止血）
3. 老积压快速消化 → 临时程序把老消息读出、转发到**分区更多的新 topic**，挂大量消费者并行
4. 消费逻辑慢 → 批量/异步处理

**关键认知**：消息写入分区后**永久定居，新建分区不会让老积压搬家**。加分区只对新消息有效。

---

## 8. Kafka 为什么快

1. 磁盘顺序写：追加不寻道，顺序写接近内存随机写
2. Page Cache 页缓存：写先进内存、读尽量命中内存
3. Zero Copy 零拷贝(sendfile)：数据从页缓存直达网卡，不经应用程序
   （页缓存=不用读磁盘；零拷贝=少搬几次家，两回事）
4. 分区并行：多机水平扩展
5. 批量发送(linger.ms/batch.size) + 压缩(snappy/lz4)
6. 稀疏索引快速定位

---

## 9. Rebalance 重平衡

含义：消费者组成员或订阅分区变化时，重新分配"哪个消费者负责哪个分区"。**与消费速度不均无关**。

触发（三种）：
1. 组成员变化：新消费者加入、消费者退出/宕机、心跳超时(session.timeout)被判死
2. 订阅 topic 数变化（正则订阅）
3. topic 分区数变化

坏处：rebalance 期间整个组 **Stop The World，停止消费**；新消费者要重新预热状态；频繁 rebalance 导致消费断续、积压上涨。

避免：调大 session.timeout.ms / heartbeat 间隔；max.poll.interval.ms 内处理完一批；消费逻辑别卡死、GC 别太长；扩容选低峰。

分配策略：Range / RoundRobin / Sticky。

---

# 薄弱点回看清单

- [ ] 分布式锁：单机并发(读→减→写) + synchronized 厕所插销类比
- [ ] SET lock key uuid NX EX 每部分作用 + Lua + Redisson
- [ ] Rebalance 触发三条件（不是消费不均）
- [ ] 不丢失三端配置（acks=all / 3副本+min.insync=2 / 手动提交）
- [ ] 积压消息不能搬家，加分区只管新消息
- [ ] Leader 是分区级别，没有"主机器"
