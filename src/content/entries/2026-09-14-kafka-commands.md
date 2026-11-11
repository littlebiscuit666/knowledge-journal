---
title: "Kafka 实操命令与输出记录"
date: 2026-09-14
category: 技术
tags: [kafka, 命令行, 日记归档]
draft: false
---

> 2026-09-14 · 首次完整走通 Kafka 操作闭环（本机 Docker 环境）
> 环境：confluentinc/cp-kafka:7.5.0 容器，单 broker，属 big-data 项目
> 已有业务 topic：device-telemetry / device-alerts；本次练习建了 demo-topic

---

## 〇、本环境专属注意事项（坑位备忘）

1. **CP 版 Kafka 命令没有 .sh 后缀**：是 `kafka-topics` 不是 `kafka-topics.sh`（Apache 发行版才带 .sh）
2. **Git Bash 里 docker exec 的路径会被转换**：容器内路径要加 `MSYS_NO_PATHCONV=1`，否则 `/bin` 被转成 `C:/Program Files/Git/bin`
3. **端口两套**：容器之间互连用 `kafka:9092`；宿主机上的代码/工具连 `localhost:29092`（端口映射）
4. **消费者不会自己退出**：命令行演示要套 `timeout 6`，否则一直挂着监听
5. kcat 快捷命令 `kc` 在 `C:\Users\yaya\bin\kc`，内容：
   ```sh
   #!/bin/sh
   exec docker run --rm -i --network big-data_default edenhill/kcat:1.7.0 -b kafka:9092 "$@"
   ```

## 一、启动与查看 topic

```bash
docker start kafka
# 列出所有 topic
MSYS_NO_PATHCONV=1 docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list
```

输出：

```
__consumer_offsets     ← Kafka 内部 topic（存消费位移），别动
device-alerts
device-telemetry
test-topic
```

## 二、查看 topic 分区结构

```bash
MSYS_NO_PATHCONV=1 docker exec kafka kafka-topics --bootstrap-server localhost:9092 --describe --topic device-telemetry
```

输出：

```
Topic: device-telemetry  PartitionCount: 1  ReplicationFactor: 1  Configs:
	Topic: device-telemetry	Partition: 0	Leader: 1	Replicas: 1	Isr: 1
```

解读：1 分区 1 副本（单机学习环境）。Replicas/Isr 里的 `1` 是 **broker 编号**不是数量。

## 三、创建 topic（3 分区）

```bash
MSYS_NO_PATHCONV=1 docker exec kafka kafka-topics --bootstrap-server localhost:9092 \
  --create --topic demo-topic --partitions 3 --replication-factor 1
```

输出：`Created topic demo-topic.`

## 四、生产消息（带 key）

```bash
MSYS_NO_PATHCONV=1 docker exec -i kafka bash -c \
  'printf "%s\n" "sensor-a:25.1" "sensor-b:30.2" "sensor-a:25.3" "sensor-c:19.9" "sensor-b:30.5" \
   | kafka-console-producer --bootstrap-server localhost:9092 --topic demo-topic \
     --property parse.key=true --property key.separator=:'
```

要点：`parse.key=true` + `key.separator=:` 把每行拆成 key:value。**同 key 消息永远进同一分区**（hash 路由）。

## 五、消费消息

```bash
MSYS_NO_PATHCONV=1 docker exec kafka bash -c \
  'timeout 6 kafka-console-consumer --bootstrap-server localhost:9092 --topic demo-topic --from-beginning'
```

输出（注意：**和写入顺序不一致**！）：

```
19.9
25.1
30.2
25.3
30.5
```

原因：3 个分区，消费者轮流从各分区拉，跨分区不保证全局顺序。

## 六、查各分区消息数（验证 key 路由）

```bash
MSYS_NO_PATHCONV=1 docker exec kafka kafka-get-offsets --bootstrap-server localhost:9092 --topic demo-topic
```

输出：

```
demo-topic:0:4      ← 分区0 有4条（offset 0~3）
demo-topic:1:0      ← 分区1 空
demo-topic:2:1      ← 分区2 有1条
```

验证了：sensor-a 两条必在同一分区；不同 key 也可能撞进同一分区。

## 七、kcat（kc）调试三连

```bash
kc -L -t demo-topic                       # 看元数据
kc -C -t demo-topic -e -f '分区%p 偏移%o  key=%k  value=%s\n'   # 带位置读消息
echo hello | kc -P -t demo-topic          # 一条命令发消息
```

`-L` 输出：

```
Metadata for demo-topic (from broker 1: kafka:9092/1):
 1 brokers:
  broker 1 at kafka:9092 (controller)
 1 topics:
  topic "demo-topic" with 3 partitions:
    partition 0, leader 1, replicas: 1, isrs: 1
    partition 1, leader 1, replicas: 1, isrs: 1
    partition 2, leader 1, replicas: 1, isrs: 1
```

带格式消费输出（本课精华，分区+偏移可视化）：

```
分区0 偏移0  key=sensor-a  value=25.1
分区0 偏移1  key=sensor-b  value=30.2
分区0 偏移2  key=sensor-a  value=25.3
分区0 偏移3  key=sensor-b  value=30.5
分区2 偏移0  key=sensor-c  value=19.9
```

分区内 offset 严格递增 = **分区内有序**；跨分区乱序。

## 八、常用命令速查表

```bash
# topic 管理
kafka-topics --bootstrap-server localhost:9092 --list
kafka-topics --bootstrap-server localhost:9092 --create --topic X --partitions 3 --replication-factor 1
kafka-topics --bootstrap-server localhost:9092 --describe --topic X
kafka-topics --bootstrap-server localhost:9092 --delete --topic X

# 收发消息
kafka-console-producer --bootstrap-server localhost:9092 --topic X \
  --property parse.key=true --property key.separator=:
kafka-console-consumer --bootstrap-server localhost:9092 --topic X --from-beginning --group g1

# 消费组（查积压/进度）
kafka-consumer-groups --bootstrap-server localhost:9092 --list
kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group g1

# 查分区水位
kafka-get-offsets --bootstrap-server localhost:9092 --topic X

# kcat（宿主机 kc 命令）
kc -L                                   # 全局元数据
kc -C -t X -e                           # 读到末尾退出（-e）
kc -C -t X -p 0 -o 2                    # 只读分区0、从 offset 2 开始
```

## 九、Python 客户端（代码开发姿势）

```bash
pip install kafka-python
```

```python
from kafka import KafkaProducer, KafkaConsumer

# 生产者（宿主机连 29092！）
p = KafkaProducer(bootstrap_servers='localhost:29092')
p.send('demo-topic', key=b'sensor-a', value=b'25.1')
p.flush()

# 消费者（组内自动分配分区；auto_offset_reset 首次入组从哪读）
c = KafkaConsumer('demo-topic', bootstrap_servers='localhost:29092',
                  group_id='my-group', auto_offset_reset='earliest')
for msg in c:
    print(msg.partition, msg.offset, msg.key, msg.value)
```

## 十、本次实验的核心结论

1. key 相同 → 同分区 → **单 key 有序有保障**；跨分区无序
2. 消息读后不消失，offset 只是消费者的书签；`--from-beginning`/`auto_offset_reset='earliest'` 就是"倒带"
3. 分区数 = 并行消费上限；`demo-topic` 分区1 全程空载 = key 恰好没路由过去
4. 消费者设计为长驻监听，脚本里用 timeout 控制退出
