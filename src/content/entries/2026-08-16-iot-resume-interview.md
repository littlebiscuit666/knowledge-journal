---
title: "IoT 数据流项目 · 简历写法 + 面试问答准备"
date: 2026-08-16
category: 面试
tags: [面试, 简历, iot, 日记归档]
draft: false
---

> 日期:2026-08-16 ｜ 项目:`D:\Big-Data`(分支 feat/iot-pipeline,19 commits,端到端已验收)
> 用途:求职简历项目描述 + 面试官针对该项目可能提问的 Q&A。
> 原则:**所有答案都和实际实现核对过**(代码/文档/验收数据),面试时不会说漏嘴。

---

## 一、简历项目描述

### 1.1 详细版(项目经历主体,约占简历半页)

---

**IoT 设备数据流实时处理平台**(个人项目)  2026.08

**技术栈**:Kafka · Flink(Java DataStream) · MQTT · TDengine · ClickHouse · Elasticsearch · MongoDB · Redis · MySQL · Grafana · Docker Compose · Python

**项目描述**:从零设计并实现物联网设备数据的端到端实时链路:设备经 MQTT 上报 → Kafka 削峰缓冲 → Flink 流计算(窗口聚合 + 阈值告警)与 6 个落库消费者并行消费 → 6 种范式数据库分库存储 → Grafana 实时监控看板;以 8 项端到端 checklist 实测验收全部通过。

- **多范式存储架构**:同一份数据流按查询模式落 6 库——TDengine 时序明细(超级表 + 设备子表)、ClickHouse 明细副本 + Flink 聚合结果(OLAP 分析)、Redis 设备最新值(Hash 覆盖写)、ES 上报日志与告警(按天索引)、MongoDB 原始报文留存、MySQL 设备元数据;按「时序/关系/KV/搜索/文档/列式」各取所需,而非同一份数据无脑存六遍
- **Flink 实时计算(Java)**:开发 2 个作业并提交真集群运行——①事件时间语义 + 有界乱序水位线(容忍 5s)的 1 分钟滚动窗口,按设备聚合 avg/max/min 温度,JDBC Sink 写 ClickHouse(处理容器 UTC 时区,窗口起点换算北京时间);②温度 >50°C 阈值告警经 Kafka 二次解耦后落 ES,复用已验证的 HTTP 客户端,Flink 侧零新增 connector 依赖;开启 30s checkpoint
- **自研 9 个 Python 服务**:设备模拟器、MQTT→Kafka 接入桥(断线自动重连)、6 个独立消费组的落库消费者 + 告警消费者;共享数据模型层 TDD 开发(消息模型 / Kafka 客户端单测覆盖)
- **工程化交付**:Docker Compose 编排 10 个容器(健康检查控制启动顺序),Grafana 数据源与看板 provisioning(配置即代码,容器重建自动恢复),一键启停/验证脚本(fat jar 缺失自动补拷、作业未提交自动提交)
- **问题攻坚**:独立排查 Grafana 第三方数据源插件与 Grafana 11 的兼容性问题(ClickHouse v4 插件私有 query schema、TDengine 插件 proxy 路径 502),用「数据源层 / SQL 层 / 渲染层」分层诊断法 + Explore URL 逆向出插件真实 query 结构,定位根因并沉淀踩坑文档

---

### 1.2 精简版(简历空间紧张时,3 行)

**IoT 设备数据流实时处理平台**(个人项目)| Kafka · Flink · MQTT · TDengine/CH/ES/Mongo/Redis/MySQL · Docker
- 端到端实时链路:MQTT 接入 → Kafka 削峰 → Flink(事件时间 1min 滚动窗口聚合→ClickHouse、阈值告警→Kafka→ES,30s checkpoint)与 6 个消费组并行 → 按查询模式分 6 库存储 → Grafana 看板
- 自研 9 个 Python 服务 + Java Flink 双作业;Compose 编排 10 容器 + Grafana provisioning,8 项端到端验收 checklist 全部实测通过

### 1.3 写作要点(改简历时保持)

1. **每个动词都对应真实做过的事**:「设计/自研/编排/排查」都有 commit 和文档背书,不怕追问
2. 数字尽量保留(1min 窗口、5s 水位线、30s checkpoint、6 库、10 容器、8 项 checklist)——具体数字 = 真做过
3. 如果投的岗位偏 Java 大数据 → 把 Flink Java 那条挪到最上面;偏数据开发/Python → 把 Python 服务条挪上去
4. **不要写**「高并发」「百万级数据」「生产环境」——这是学习项目,定位写成「从零吃透链路的实践项目」,面试时主动说清楚,反而加分

---

## 二、开场介绍(背熟)

### 2.1 一分钟版(「介绍一下你这个项目」)

> 这是我为了从零吃透大数据实时处理链路搭的个人项目,场景是 IoT 设备数据上报。整条链路是:设备模拟器走 MQTT 协议把温度、湿度、电压发到 Mosquitto Broker,一个接入服务订阅后转投 Kafka 做缓冲削峰;Kafka 下游两条消费路线并行——一条是 Flink 流计算,做 1 分钟滚动窗口聚合和超温阈值告警;另一条是 6 个 Python 消费者,把同一份数据按不同范式落 6 个数据库:TDengine 存时序明细、Redis 存最新值、ES 存日志、MongoDB 留原始报文、ClickHouse 做分析、MySQL 管元数据。最后用 Grafana 看板验收,我给自己定了 8 项端到端 checklist,全部实测通过。整条链路的架构设计、8 个常驻服务、Flink 作业、容器编排都是我自己完成的,过程中踩了很多真实的坑,也沉淀了一套分层排查的方法。

### 2.2 三分钟版(在 1 分钟版基础上,追加三段)

> **为什么是 6 个库**:核心思想是「一份数据流、按查询模式各取所需」。查单设备历史曲线走时序库、查当前状态走 Redis、全文检索走 ES、跨设备统计分析走 ClickHouse 列存——这是看了 IoT 平台真实架构后的刻意练习,不是把一份数据冗余存六遍。
>
> **Flink 用 Java 而不是 PyFlink 的决策**:我两条路线都做了设计对比。PyFlink 要往容器装 350MB 的 Python 依赖还要手动放三个 jar;Java 是 Flink 的母语,Maven 打一个 44MB fat jar 提交 jobmanager 就完事,更贴近生产真实用法,所以我最终落地的 Java 路线。
>
> **一个印象最深的坑**:Grafana 全部面板 No data,我调了很久。最后的排查思路是分层:先 curl 直查数据库 REST 接口证明数据和 SQL 没问题,再用 Grafana 的 /api/ds/query 端点证明数据源层通,最后锁定是第三方插件的 query schema 和标准数据源完全不同。我通过在 Explore 页面操作一次、读浏览器 URL 里序列化的 JSON,逆向出了插件真实使用的字段,照抄进 provisioning 配置才解决。

---

## 三、面试 Q&A

> 格式:**Q = 面试官问题**;A = 建议回答(第一人称,可直接说)。★ = 高频必问。

### A. 架构与选型

**Q1 ★ 为什么用 6 个数据库?一个 MySQL 不行吗?是不是过度设计?**

A:这是面试官最容易挑战的点,也是这个项目的核心设计。回答分两层:
1. **每个库对应一种真实的查询模式**:查「dev_001 最近 24 小时温度曲线」→ TDengine,时序库按设备建子表、数据连续存放,单设备范围查询快,MySQL 单表存高频时序数据会快速膨胀、索引失效;查「设备当前温度/在不在线」→ Redis,毫秒级;「搜昨天所有超温记录」→ ES 倒排索引;「全部设备平均温度 Top10」→ ClickHouse 列存,只读需要的列、压缩比高;「留原始报文以后字段可能变」→ MongoDB 文档弹性;设备/产品元数据 → MySQL 关系型约束。
2. **这不是我发明的是行业通用做法**:IoT 平台(阿里云 IoT、联通物联网)都是时序库 + 缓存 + 搜索库多库并用。我承认它是学习项目里的刻意练习,但「按查询模式选存储」这个思想我在每个库的 schema 设计里都落实了——比如 Redis 只存 latest 用 Hash 覆盖写天然幂等,ES 按天建索引方便生命周期管理。

**Q2 ★ 设备为什么不直接发 Kafka,前面还要 MQTT + Mosquitto?**

A:因为 IoT 设备和后端服务的约束完全不同。MQTT 是为弱网低功耗设备设计的:轻量(头几个字节)、支持 QoS/遗嘱消息/主题通配,一片 ESP32 也能跑;Kafka 客户端重,而且要求服务端可达。真实 IoT 平台的接入层都是 MQTT Broker 承接设备,再用网关服务(我的 ingest-service)把消息转投 Kafka。**多这一层还顺带解耦了**:接入协议和内部数据管道互不干扰,内部换队列不动设备固件。我的 MQTT topic 按 `device/property/{productKey}/{deviceId}` 设计,ingest 用 `device/#` 通配订阅。

**Q3 ★ Kafka 在这里面的作用是什么?为什么需要消息队列?**

A:三个作用。①**削峰**:设备上报是突发流量(比如整点集体上报),下游落库速度跟不上时,Kafka 当传送带缓冲,消费方按自己的节奏拉;②**扇出/解耦**:一条消息被 Flink 和 6 个消费者组**各自独立消费**——每条数据既要做实时计算又要落 6 个库,如果是同步调用,一个库挂了全链路阻塞,走 Kafka 后各消费组互不影响;③**持久化 + 可重放**:消费 offset 由消费者自己管理,新增一个消费者可以从头回放历史数据,这是「再加一种存储」零成本的原因。

**Q4 为什么选 Flink?Spark Streaming / Kafka Streams 不行吗?**

A:三个理由。①Flink 是**真流处理**,逐条触发,延迟毫秒~秒级;Spark Streaming 是微批,分钟级窗口要等批次凑齐;我的 1 分钟窗口 + 秒级告警场景 Flink 更自然。②**事件时间语义是 Flink 原生的**:窗口按数据自带的时间戳归组,而不是到达时间——数据晚到 3 秒仍然算进它属于的窗口,这在管道有延迟时保证结果确定。③**状态管理 + checkpoint**:窗口聚合的中间状态由 Flink 管理,checkpoint 定期快照,故障恢复后从快照继续,不用自己管状态。Kafka Streams 也行但它嵌在应用 JVM 里,没有独立集群和 Web UI,不适合我「作业独立提交到集群」的架构。实际我用的 Flink 1.18,通过 jobmanager 提交,Web UI 8081 能看作业状态。

**Q5 你的数据量多大?(最容易暴露,见 §Q29)**

A:诚实版见「弱点应对」类。

### B. Kafka 深挖

**Q6 ★ 6 个消费者和 Flink 怎么做到互不干扰?**

A:**消费者组机制**。Kafka 的消费进度(offset)是按「topic + 消费者组」隔离的。我的 7 个消费方——6 个 Python 落库消费者 + Flink 的 2 个作业(其实 Flink 是 2 个独立消费组 flink-agg / flink-alert,加上 consumer_alerts 共 8 个组)——每个都有独立 group id,各自维护自己的 offset,所以一个消费者重启/落后,完全不影响别人。组内才有分区分配:topic 3 个分区,组内消费者数最多 3 个有效,再多就空闲。

**Q7 offset 怎么管理的?自动提交还是手动?**

A:分两条路。①Python 消费者用的 kafka-python,常规的 poll 循环 + 自动提交,at-least-once 语义,写库失败重试几次后记录日志不阻塞(设计上预留了死信 topic 思路);②Flink 的 KafkaSource 在 **checkpoint 模式**下,offset 提交和 checkpoint 绑定——只有 checkpoint 成功才提交 offset,这样故障恢复时从 checkpoint 里的 offset 重新消费,配合下游幂等写,不会丢数据。这正是我代码里注释写的「Kafka offset 提交 + JDBC 批量 flush 都依赖 checkpoint」。

**Q8 topic 为什么设计 3 个分区?消息顺序怎么保证?**

A:3 分区是为「组内并行消费」预留的——现在每个组里只有 1 个消费者,3 分区用不满,但如果某个落库消费者吞吐不够,同组加实例立刻能分到分区。**顺序性**上:Kafka 只保证分区内有序,我的消息目前没按 deviceId 设 message key,是轮询进分区,所以跨设备全局无序、单设备也可能乱序到不同分区——但这不破坏正确性,因为 Flink 里我重新 keyBy(deviceId) 按 key 哈希分区,窗口聚合在同一设备的 keyed stream 上算,顺序在算子层面重新保证了。**改进点**:produce 时以 deviceId 为 key,同一设备固定进同一分区,可以把顺序保证前移到 Kafka 层,还能让 Flink 免去 shuffle。

**Q9 消息会丢吗?会重复吗?**

A:诚实回答:**at-least-once,可能重复、设计上尽量不丢**。不丢:Kafka 本身落盘持久化,ingest 有 MQTT 断线重连 + produce 失败重试;Flink 侧 checkpoint 里存了 offset 和状态。可能重复:checkpoint 恢复后从上个快照重放,边界上的消息可能写两次。**对策是幂等写**:Redis 的 HSET latest 天然幂等(覆盖);ClickHouse 聚合表按 (window_start, device_id) 重写同窗口结果也是幂等的;ES 用固定 doc id 也能幂等。端到端 exactly-once 我没做,思路知道:Flink 两阶段提交的 Kafka transactional sink,或者_source 精确一次 + sink 幂等,这是学习项目刻意划出去的范围。

### C. Flink 深挖(重点,Java 岗必问)

**Q10 ★ 讲讲你的窗口聚合作业是怎么实现的?**

A:作业 Agg1minJob,流程是:KafkaSource 订阅 device-telemetry(消费组 flink-agg)→ map 把 JSON 解析成 Telemetry POJO,同时过滤 type != property 和没有温度值的 → **assignTimestampsAndWatermarks** 挂事件时间水位线(时间戳取消息自带的 ts 毫秒,forBoundedOutOfOrderness 容忍 5 秒乱序)→ keyBy(deviceId) → **TumblingEventTimeWindows.of(1 分钟)** 滚动窗口 → process 函数在窗口内迭代累积 avg/max/min/count → 窗口关闭时输出一条结果,JDBC Sink 批量写 ClickHouse 的 telemetry_agg_1min 表。另外作业里处理了时区:ClickHouse 容器是 UTC,我把窗口起点 epoch 毫秒加 8 小时换算成北京墙钟再写入,否则看板上的时间和人对不上。

**Q11 ★ 事件时间和处理时间有什么区别?你为什么用事件时间?**

A:事件时间是数据里自带的发生时间(设备上报的 ts),处理时间是数据到达 Flink 的时间。我用事件时间,因为**结果确定、可重放**:同一段数据不管什么时候重算、管道快还是慢,窗口归组结果一样;如果用处理时间,一次消费积压或管道抖动,数据就会被算进错误的窗口。代价是必须处理乱序和迟到——这就是水位线的职责。

**Q12 ★ 水位线是什么?5 秒怎么定的?迟到数据怎么办?**

A:水位线是一个单调递增的逻辑时钟,语义是「时间戳小于它的数据都到齐了」。窗口的触发条件就是水位线越过窗口结束点。forBoundedOutOfOrderness(5s) 表示我允许数据最多乱序 5 秒——这个值是结合场景拍的:模拟器 2 秒一条、本机网络,乱序窗口很小,5 秒绰绰有余;生产上要按 P99 管道延迟定。**超过 5 秒的迟到数据现在会被丢掉**(窗口已关)——改进方案我知道:allowedLateness 再宽限一段时间,或者 sideOutput 侧输出流把迟到数据单独收集补偿,这在讲改进点时我会主动说。

**Q13 滚动窗口和滑动窗口的区别?为什么用滚动?**

A:滚动窗口不重叠,一条数据只属于一个窗口,适合「每分钟一个统计快照」的报表语义;滑动窗口有步长和长度可以重叠,适合移动平均这种平滑曲线。我要的是每分钟独立的 avg/max/min,不想要跨分钟平滑,所以滚动。如果要做「最近 5 分钟平均、每 1 分钟更新」,就换 SlidingEventTimeWindows.of(5min, 1min)。

**Q14 ★ checkpoint 是怎么工作的?你为什么开 30 秒?**

A:checkpoint 是 Flink 的容错机制:JobManager 定期 barrier 对齐,把所有算子的状态(包括 KafkaSource 的 offset、窗口内累积的中间聚合值)快照到持久存储,故障恢复时全体回到同一个一致点。我开 30 秒是学习和验证用的折中——太频繁影响性能,太稀疏恢复时重放的数据多。checkpoint 在我的作业里还直接绑着两件事(代码注释里专门写了):KafkaSource 的 offset 提交和 JDBC Sink 的批量 flush 都由它驱动。

**Q15 并行度为什么是 1?怎么扩展?**

A:单机 docker 里的 Flink,taskmanager 槽位有限,学习项目数据量小,并行度 1 够用,我还给 taskmanager 提过槽位。扩展路径很清楚:keyBy 之后每个 deviceId 的窗口状态互相独立,天然可并行——加 taskmanager、把并行度提到和 Kafka 分区数对齐(3),吞吐就能上去;再往上就是分区数、taskmanager 数量一起加。

**Q16 keyBy 之后数据倾斜怎么办?**

A:IoT 场景设备多而均匀,一般不倾斜;真遇到热点设备(比如某个网关下挂一千个子设备共用一个 id),标准解法是**两阶段聚合**:第一阶段在原始 key 上拼随机前缀打散做预聚合,第二阶段去掉前缀做最终聚合,把大 key 的计算摊薄。另一个角度是 Kafka 侧如果按 deviceId 做 key,热点设备的分区会热,那就要在 key 设计上加盐。

**Q17 你在 Flink 上踩过什么坑?(有真实素材,大胆讲)**

A:两个。
①**水位线泛型坑**:KafkaSource 输出的是 String,我一开始想把 Telemetry 的事件时间水位线直接挂给 fromSource,编译报错对不上——fromSource 的 WatermarkStrategy 泛型必须匹配 Source 的输出类型。正确做法是 fromSource 用 noWatermarks,在 map 解析成 POJO **之后**再 assignTimestampsAndWatermarks。
②**JDBC Sink 的 lambda 参数顺序**:JdbcStatementBuilder 的函数签名是 (PreparedStatement, T)——statement 在前、数据在后,和直觉相反,我写反了之后报「找不到符号」,定位了很久,因为这个错误信息完全不指向参数顺序。后来养成的习惯是写 lambda 前先看函数式接口的签名。
③(补充)构建链路上的:Git Bash 里 docker cp 传容器内绝对路径,MSYS 会把 `/opt/flink/...` 误转换成 `C:/Program Files/Git/opt/...`,必须 `MSYS_NO_PATHCONV=1`。

**Q18 告警作业为什么绕道 Kafka 再落 ES,不直接 ES Sink?**

A:架构决策,三个理由。①Flink 的 ES connector 是 native 客户端,版本要严格对齐 ES 8.11,API 细节当时无法联网核实,直接写代码有返工风险;②我在 Phase 3 已经沉淀了一条经验——**凡 native 客户端都换 HTTP REST**(TDengine 就是用 REST 连的),Java ES connector 恰恰是又一个 native 客户端,走 Kafka 解耦后,ES 写入复用现成的、已验证的纯 HTTP es_client;③解耦本身有价值:告警落 ES 只是告警的一种消费方式,经 Kafka 中转后,以后加「告警发钉钉」「告警入库」都是加个消费者,不动 Flink 作业。代价是多一跳延迟,但告警场景几百毫秒完全无感。

### D. 数据库深挖

**Q19 ★ TDengine 的表怎么设计的?为什么时序数据不用 MySQL?**

A:TDengine 用**超级表 + 子表**模型:超级表 device_property 定义公共列(ts, temperature, humidity, voltage),deviceId 和 productKey 作为**标签(tag)**;每个设备自动一张子表,同一设备的数据物理上连续存放。查「dev_001 最近 24 小时」就是扫一张子表的连续块,天然快;跨设备聚合走超级表。MySQL 不合适的原因:高频写入(几千设备每秒一条,一天几亿行)单表膨胀,B+ 树索引维护代价大;时序库是追加写 + 按时间组织的存储,还有数据压缩(TTL/降采样)这些时序特性。

**Q20 ClickHouse 为什么快?你用它存什么?**

A:列存 + 向量化执行:分析查询只读涉及的那几列(比如只算温度),IO 和内存都省;同列数据类型一致压缩比高;批量追加写契合时序写入模式。我存两样:telemetry_raw 明细副本(跨设备 OLAP 分析口径)和 Flink 写的 telemetry_agg_1min 聚合表,看板上「全部设备的窗口均温/最高温」就是查它。**明细和聚合都放 CH 的原因**:明细在 TDengine 也有,但那是「单设备视角」;CH 这份是「全设备分析视角」,同一范式两个访问模式分开放是刻意的。

**Q21 Redis 里存什么?为什么用 Hash?**

A:两类 key:`device:{id}:latest` 是 Hash,field 是属性名(temperature/humidity/voltage),每条上报 HSET 覆盖——天然幂等,读一次 HGETALL 拿全部最新值;`device:{id}:status` 存在线状态 + last_seen。「设备当前状态」是高频读(仪表盘轮询),毫秒级必须走内存 KV,这是缓存最教科书的使用场景。

**Q22 ES 的索引为什么按天建?**

A:`device-log-YYYYMMDD` 按天分割:①过期数据整索引删除,不用逐 doc 删(那是昂贵的 segment 合并);②写入按时间路由到新索引,热点集中;③可以用 ILM 做生命周期管理(热→冷→删)。告警索引 device-alert-YYYYMMDD 同理。检索「昨天的超温记录」变成索引名 + 条件过滤,又快又好清理。

### E. 工程实践与踩坑(最能出彩的部分)

**Q23 ★ 项目里遇到的最难的问题是什么?**

A:讲 Grafana 那一役(3 分钟版里的第三段),展开讲分层诊断方法论:
1. 现象:provisioning 好的看板全部面板 No data;
2. 第一层,**先证明数据和 SQL 没错**:绕开 Grafana,curl 直打 TDengine REST(6041 端口)和 ClickHouse HTTP(8123 端口),SQL 直接返回数据 → 问题不在数据层;
3. 第二层,**区分数据源层还是渲染层**:用 Grafana 的 /api/ds/query 端点发查询,ClickHouse 通、TDengine 也通 → 数据源配置没错,怀疑面板渲染路径;
4. 第三层,**看服务端日志**:docker logs grafana 里 grep error,发现 TDengine 插件在 proxy 路径报 `unsupported protocol scheme ""`——同一个插件两条请求路径,/api/ds/query 正常、/api/datasources/proxy 在 Grafana 11 下解析数据源 url 失败,这是**插件版本和 Grafana 11 的兼容性 bug**,看板层面无解;
5. ClickHouse 那边是另一个问题:官方 v4 插件的 query schema 和标准数据源完全不同(rawSql 不是 rawQuery、format 是数字不是字符串、必须带 meta.builderOptions)——我**在 Explore 页面操作一次,读浏览器地址栏 URL 里序列化的 panes 参数,逆向出插件真实使用的 query JSON**,照抄进 provisioning 才通。
6. 收获沉淀成文档:**遇到 No data,先分清数据源层、SQL 层还是渲染层的问题,再对症下药**;第三方插件的私有 schema 别硬猜,逆向真实请求最快。

**Q24 怎么验证整条链路是「活的」而不是历史残留数据?**

A:我定义了 8 项端到端 checklist(模拟器在发→Mosquitto 收到→ingest 转发→Kafka offset 在涨→消费者在写→6 库查得到→Flink 聚合/告警有产出→Grafana 出图),但光看点数不能证明「现在还活着」——所有库里都躺着历史数据。我的做法:**起一个 25 秒的短模拟器,隔 8 秒和 20 秒各采样一次 ClickHouse 明细行数**:429 → 453,12 秒涨 24 条,正好等于 4 设备 × 每 2 秒一条的频率,增量和生产端频率对得上,才能下「链路是活的」的结论。这个「用增量对频率」的验证思路本身就是收获。

**Q25 你的部署/启动是怎么编排的?**

A:分两类。**基础设施**(Kafka、6 库、Flink jobmanager/taskmanager、Grafana)全部在 docker-compose,用 depends_on + 健康检查控制启动顺序,6 库的建库建表 init 脚本挂载进各自容器;**Python 服务**本机 venv 跑(Mosquitto 也是本机原生装的)——这是我知道的已知限制,Python 服务容器化(Task 5.1)没做完,要做就是每个服务一个 Dockerfile 进 compose。之上我写了一键启停:start.ps1 -All 会起 docker、提交两个 Flink 作业、拉起全部 Python 服务,而且**带自愈**:fat jar 缺失自动从构建产物补拷、作业没提交自动提交;stop.ps1 反向全停。还有 verify_flink.sh 一条命令跑完「提交→起服务→发数据→查结果→清理」的完整验证。

**Q26 Grafana 的配置是怎么管理的?**

A:**provisioning,配置即代码**:数据源(datasources.yml)和看板 JSON 都在 git 里,挂载到容器约定目录,容器重建后自动恢复——早期我手动在 UI 配过一次,发现 `docker compose up --force-recreate` 之后全没了,才改成 provisioning。插件安装也固化进 compose 的 GF_INSTALL_PLUGINS 环境变量(同样的原因,grafana cli 手动装的插件只活在当前容器)。踩的一个坑:provisioning 数据源**必须显式指定 uid**,否则 Grafana 随机生成,看板 JSON 里写死的 datasource.uid 对不上就报找不到数据源;配 deleteDatasources 清理旧同名残留。

**Q27 项目怎么测试的?**

A:分两层。**单元测试**(TDD):数据模型和序列化、Kafka producer/consumer 工厂,pytest,先写测试再写实现;**端到端验收**:就是那 8 项 checklist + query_all.py 一键查 6 库和 Flink 产出 + 「短模拟器看增量」的活性验证。中间层(单个服务的集成测试)做得薄,这也是学习项目的取舍——端到端打穿比每个服务 mock 测试对「验证链路理解」更有价值。

### F. 弱点应对与改进方向(最重要的一节)

**Q28 ★ 这是学习项目,数据量很小吧?(一定会有,主动准备好)**

A:主动承认,立刻转成扩展思路:
「对,定位就是学习项目,常态是 4 台设备每 2 秒一条(每秒 2 条),数据量不是重点,重点是链路的完整性。但扩容的路径我想得很清楚:①**接入层**:Mosquitto 单机几万连接没问题,再多就 EMQX 集群;②**Kafka**:加分区、加 broker,副本保证可用性——我 topic 已经预留了 3 个分区;③**Flink**:keyBy 天然可并行,提并行度、加 taskmanager,和分区数对齐;④**存储**:TDengine/ClickHouse 都支持分布式集群,CH 明细表换分布式表加分片;⑤压力上来后瓶颈在哪我说不准,但我知道怎么定位——看 Flink Web UI 的反压指标、Kafka 消费 lag、各库写入延迟,哪层 lag 涨哪层扩。」

**Q29 ★ 项目有什么不足?重做你会改什么?**

A:(挑 3~4 个说,每个都带「为什么当时没做 + 怎么做」,体现取舍意识而非能力缺口)
1. **Python 服务没容器化**(Task 5.1 未做):当时判断本机 venv 跑已能完整体验数据流,容器化是工程收尾不是学习核心;要做就是每服务一个 Dockerfile 进 compose,连 simulator 一起。
2. **端到端 exactly-once 没做**:当前 at-least-once + 下游幂等(Hash 覆盖、按窗口键重写)兜底;要严格 exactly-once 需要 Flink 两阶段提交 sink(Kafka transactional + 只在 checkpoint 提交),复杂度高,学习项目刻意划出范围。
3. **告警规则硬编码**:50 度阈值写死在作业里;应该外置成规则表(MySQL)或配置中心,作业定期拉取/广播刷新,甚至上规则引擎——我在设计的「后续扩展」里列了。
4. **迟到数据直接丢**:水位线 5 秒外的数据没有侧输出兜底,可以加 allowedLateness + side output 收集后补偿写。
5. **无运维监控**:Flink/Grafana 自身没有 Prometheus 监控,链路挂了靠 checklist 手查。

**Q30 下行控制/设备影子这些为什么没做?**

A:范围管理(YAGNI)。我在设计文档里明确列了「不包含」:REST API、规则引擎、下行控制、设备影子、设备鉴权——因为学习目标是「数据上报侧的端到端数据流」,这些做完战线太长。但设计文档里都留了扩展方向,需要的话能讲下行控制的 MQTT topic 设计和设备影子的 JSON 结构思路。

**Q31 这个项目你学到了什么?(收尾题,准备一个利落的答案)**

A:「①**分库思想**:存储选型跟着查询模式走,不追求一个库打天下;②**流处理的核心概念落地**:事件时间、水位线、窗口、checkpoint,从『背过』变成『调过、错过、修过』;③**分层排查方法论**:No data 先分层定位——数据源/SQL/渲染,这套思路到任何排查场景都通用;④**工程化习惯**:配置即代码(provisioning)、一键脚本、验收 checklist、踩坑沉淀文档——这个项目 19 个 commit 里一半是文档,我把过程当产品在做。」

---

## 四、数字卡(面试前背一遍)

| 类别 | 数字 |
|---|---|
| 设备/频率 | 4 台设备 × 每 2s 一条 = 2 条/s;温度模拟范围 15~55°C 均匀分布 |
| 告警概率 | P(temp>50) = 5/40 = **12.5%**,不用改模拟器自然产生告警 |
| Kafka | topic `device-telemetry` **3 分区**,KRaft 模式(无 ZooKeeper),端口 29092 |
| Flink | 1.18.1 / Java 17;**2 个作业**(Agg1minJob / AlertTempJob);并行度 1;checkpoint **30s**;水位线 forBoundedOutOfOrderness **5s**;事件时间取消息 ts |
| 窗口 | **1 分钟滚动窗口**,按 deviceId keyBy,输出 avg/max/min/count |
| 告警 | temperature > 50 → Kafka `device-alerts` → ES `device-alert-YYYYMMDD` |
| 消费组 | flink-agg、flink-alert 各自独立 + 6 个落库消费者 + consumer_alerts |
| 构建 | Maven fat jar **43.9MB**;阿里云镜像;Flink 核心依赖 provided 不打进 jar |
| 验收快照 | Kafka 累计 1077 条;TDengine dev_001 子表 128 行;ES log 415 / alert 55;Mongo 436;CH 明细 413 / 聚合窗口 16;活性验证 12s 涨 24 条(=4 设备×2s) |
| 部署形态 | docker **10 容器**(kafka + flink×2 + 6 库 + grafana)+ 本机 Mosquitto + 本机 8 个 Python 常驻进程 |
| 代码量 | Python ~700 行(9 服务)+ Java ~292 行(3 类);19 commits;6 阶段计划;8 项验收 checklist |
| 端口 | Mosquitto 1883 / Kafka 29092 / Grafana **3001** / Flink UI 8081 / CH 8123 / ES 9200 |

---

## 五、面试策略与红线

### 5.1 主动引导话题

这个项目最硬的三块,想办法把面试官往这引:
1. **「一份数据六库各取所需」的选型逻辑**(Q1)——展示架构思维
2. **分层排查方法论 + Grafana 逆向**(Q23)——展示解决未知问题的能力,比背八股稀缺得多
3. **PyFlink vs Java 的路线对比**(2.2 节)——展示技术决策能力

### 5.2 红线(说了就露馅)

- ❌ 不说「生产环境」「线上」——说「端到端验收跑通」
- ❌ 不说「高并发/大数据量」——被问就按 Q28 的答案转扩展思路
- ❌ 不把「设计了」说成「实现了」:设备影子/规则引擎/下行控制/REST API/压测 = 设计文档里的**未做项**,被问到主动归类为「明确的扩展方向」
- ❌ checkpoint 说成「实现了 exactly-once」——准确说法:开了 checkpoint(30s),语义是 at-least-once + 下游幂等

### 5.3 和八股的联动准备

这个项目天然会把面试引向这些八股题,提前复习:
- Kafka:分区/副本/ISR、acks、rebalance 触发条件、offset 提交时机
- Flink:时间语义、水位线传播、checkpoint barrier 对齐、savepoint vs checkpoint、反压怎么看
- 存储:B+ 树 vs LSM-Tree vs 列存、Redis 持久化 RDB/AOF、ES 倒排原理
- 通用:CAP、消息队列对比(RocketMQ/RabbitMQ/Kafka)、Docker 网络模式(容器间用服务名互访、host.docker.internal 访问宿主机)

### 5.4 可以带进面试室的演示

如果有机会现场展示(或视频面共享屏幕):`scripts/start.ps1 -All` 一键起全链路 → Grafana 3001 看板出图 → query_all.py 一键查 6 库。「一键起、看得见」本身就是工程化能力的证明。

---

## 附:素材出处索引(复习时回查)

| 素材 | 文件 |
|---|---|
| 架构与选型理由 | `D:\Big-Data\2026-08-10-iot-platform-design.md` |
| Flink Java 设计(PyFlink 对比/依赖矩阵) | `2026-08-10-iot-phase4-flink-java-design.md` |
| 踩坑全过程(Grafana/Flink) | `2026-08-12-iot-grafana-flink-pitfalls.md` |
| 验收数据(数字卡来源) | `2026-08-12-iot-acceptance-summary.md` |
| 6 库 schema 细节 | `2026-08-13-iot-database-schema.md` |
| 跑通步骤/8 项 checklist | `README.md` |
