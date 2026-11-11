---
title: "Kafka 面试高频问题与答案"
date: 2026-09-14
category: 面试
tags: [kafka, 面试题, 日记归档]
draft: false
---

> 2026-09-14 · 虾皮大数据面试备考 · 配套实操文档：同目录 2026-09-14_Kafka实操命令与输出记录.md
> 答案按"面试口述版"写：先给结论，再给展开点，★ 标必背

---

## 一、基础概念

**Q1: Kafka 是什么？和普通消息队列（RabbitMQ）的区别？**
分布式流处理平台，三大能力：消息队列 + 存储系统（可回放）+ 流处理。
对比 RabbitMQ：Kafka 吞吐高一个量级（百万/s）、消息读后不删可重放、天然分布式分区扩容、生态偏数据管道；RabbitMQ 延迟低、路由灵活、适合业务消息。

**Q2: 为什么要用 Kafka（架构角色）？** ★
三大价值：**解耦**（生产消费互不依赖，新增下游不用改上游）、**削峰**（突发流量先落 Kafka，下游按能力消费）、**可重放**（下游故障/逻辑变更，重置 offset 重新消费）。
结合项目说：「我做的 IoT 管道里，设备消息经 MQTT 收进来进 Kafka，Flink 消费计算后写多个库，Kafka 是中间的数据总线。」

**Q3: 核心术语一句话版** ★
- Producer/Consumer/Broker：写/读/Kafka 服务器节点
- Topic：消息分类频道
- Partition：物理分片，**并行度单位，分区内有序**
- Offset：消息在分区内的单调递增序号 = 消费者的书签
- Consumer Group：组内分摊（每分区只被组内1人消费），组间广播互不影响
- Replica/ISR：副本 / 与 leader 保持同步的副本集合

**Q4: 分区和消费者组的关系？** ★
一个分区同一时刻**只能被组内一个消费者**消费。消费者数 > 分区数 → 多余的闲置；想提高并行度 → 加分区。分区数决定消费并行上限。

## 二、顺序与可靠性（重灾区）

**Q5: Kafka 怎么保证消息顺序？** ★
只保证**单分区内有序**。需要某个 key 全局有序 → 让同 key 消息进同一分区（producer 按 key hash 路由，或自定义 Partitioner）。注意：分区数变了 key 路由会乱，扩分区前想清楚。

**Q6: 怎么保证消息不丢？（生产/存储/消费三段答）** ★
- 生产端：`acks=all`（所有 ISR 副本确认才算成功）+ `retries` 重试
- 存储端：副本机制（replication-factor≥2，min.insync.replicas≥2）+ 落盘持久化
- 消费端：**手动提交 offset**（先处理完业务再 commit），关闭自动提交 `enable.auto.commit=false`

**Q7: 消息会重复吗？怎么解决？**
会（消费端宕机在"处理完但没提交offset"之间重启 → 重消费）。
- Kafka 侧：幂等 producer（`enable.idempotence=true`，broker 按 <PID,分区,序列号> 去重，只保单分区）；事务（跨分区原子写 + consume-transform-produce 场景）
- **下游幂等**是生产常用解：唯一键去重 / upsert 写库 / Redis setnx

**Q8: exactly-once 怎么实现？**
三层拼图：幂等 producer（单分区不重）+ 事务（跨分区原子）+ 消费端把 offset 提交和业务处理放进同一事务。现实中下游业务幂等 + at-least-once 更常见。

**Q9: 什么是 Rebalance？什么时候触发？** ★
消费组内**分区所有权重新分配**。触发条件：① 组内成员变化（新增/宕机/心跳超时）② 订阅的 topic 数变化 ③ 分区数变化。
代价：rebalance 期间整组停止消费（STW）。优化：静态成员 `group.instance.id`、调 session.timeout、用 CooperativeStickyAssignor 增量 rebalance。

**Q10: 消息积压怎么处理？**
紧急：加消费者（前提分区数够）/ 加分区 + 加消费者 / 消费逻辑降级（先落地后补算）。
根治：查消费逻辑瓶颈（慢SQL/外部调用）、提高单消费者并发、评估分区数是否太小。

## 三、性能与原理

**Q11: Kafka 为什么快？** ★
① **顺序写磁盘**（追加 log，磁盘顺序写 ≈ 内存随机写速度）
② **零拷贝**（sendfile：页缓存直接到网卡，绕过用户态）
③ 批量发送 + 压缩（producer 攒 batch，网络/存储都省）
④ 分区并行 + 页缓存读（热数据基本不碰磁盘）

**Q12: 消息存哪？什么时候删？**
每个分区 = 一个只追加的 log 文件（segment 分段）。**删除只看时间/大小保留策略**（默认 retention 7 天 / 1G），与消费进度无关——消费慢不影响删除，读 offset 超过保留期会丢。

**Q13: ZooKeeper 干嘛的？KRaft 是什么？**
旧架构：ZK 管 broker 注册、controller 选举、元数据。Kafka 2.8+ 的 **KRaft 模式**用内部 Raft 协议自己管元数据，去 ZK 化（运维简化、故障恢复更快、分区数上限提升）。CP 7.5 仍支持 ZK，新部署推荐 KRaft。

**Q14:HW（高水位）和 LEO 是什么？**
LEO = 日志末端位移（下一条待写位置）；HW = 所有 ISR 副本中最小的 LEO。**消费者只能读到 HW 之前的消息**——保证读到的一定是已被 ISR 多数持有的，不会读到随后 leader 切换就"反悔"的数据。

## 四、实战与场景题

**Q15: 生产者发送一条消息的完整流程？**
main 线程 → ProducerRecord → 拦截器 → 序列化器 → 分区器（指定分区>key hash>轮询/粘性）→ **RecordAccumulator 缓冲区**按 topic-partition 攒 batch → Sender 线程按 broker 批量发出 → 等待 ack（acks 配置）→ 重试或回调。

**Q16: 消费者位移提交的细节？**
自动提交（默认5s，可能丢/重）vs 手动 `commitSync`（可靠，重）/`commitAsync`（快，可能丢）。生产常用 **组合拳**：处理循环里 async，finally 里 sync 兜底。

**Q17: 怎么查看消费有没有积压？（实操题）**
`kafka-consumer-groups --describe --group g1`，看 LAG 列 = 分区末尾 offset − 组已提交 offset。kcat 也能看：`kc -L`。

**Q18: 怎么设计 topic 的分区数？**
吞吐倒推：目标吞吐 T，压测单分区能力 p、单消费者能力 c → 分区数 ≥ max(T/p, T/c)，留 2~3 倍余量；分区不是越多越好（文件句柄、rebalance 时间、端到端延迟都涨）。

**Q19: Kafka 和 Spark/Flink 怎么配合？（大数据岗必问）**
Flink/Spark Structured Streaming 用 KafkaSource 消费，**offset 由流引擎 checkpoint 管理**而不是提交回 Kafka，实现 exactly-once。背压：消费速度自动适配。数据倾斜/HWM 等同流处理通用问题。
加分句：「我在 IoT 项目里 Flink 从 device-telemetry 消费做窗口聚合，checkpoint 5 分钟一次，重启后从 checkpoint offset 续读，不丢不重。」

**Q20: 异常场景快问快答**
- 消费组里一台机器挂了 → rebalance，它的分区被别人接管，从已提交 offset 继续
- producer 发消息网络抖动 → retries 重试，注意可能造成分区内重复（配幂等）
- 想从头重新消费 → 换个新 group_id + auto_offset_reset=earliest，或重置 offset（kafka-consumer-groups --reset-offsets）
- topic 删了会怎样 → 分区文件标记删除；__consumer_offsets 里的位移元数据随之清
- 一条消息多大合适 → 默认单条上限 1MB（message.max.bytes），大消息外置存对象存储、Kafka 只传引用

## 五、背诵优先级

1. ★★★ Q5 顺序 / Q6 不丢 / Q9 rebalance / Q11 为什么快 —— 几乎必问
2. ★★ Q4 组与分区 / Q7 重复与幂等 / Q18 分区数设计 / Q19 与流引擎配合
3. ★ 其余场景题，能答上来是加分项
