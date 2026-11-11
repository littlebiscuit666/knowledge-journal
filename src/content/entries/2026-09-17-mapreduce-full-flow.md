---
title: "MapReduce 完整流程详解"
date: 2026-09-17
category: 技术
tags: [mapreduce, hadoop, 大数据, 日记归档]
draft: false
---

> 用 3 台从节点 + 多文件例子，演示 key 生成、分区、Shuffle、Reduce 全过程

---

## 一、环境设置

```
4 台机器：

机器A（主节点）：ResourceManager + NameNode
机器B（从节点）：NodeManager + DataNode
机器C（从节点）：NodeManager + DataNode
机器D（从节点）：NodeManager + DataNode

Reduce Task 数量：2
  Reduce Task 0 → 跑在机器C上
  Reduce Task 1 → 跑在机器D上
```

---

## 二、输入数据：3 个文件

```
文件1（存在机器B上）：
  第1行: I love Beijing
  第2行: I love Shanghai
  第3行: Beijing is great

文件2（存在机器C上）：
  第1行: Shanghai is big
  第2行: I love China

文件3（存在机器D上）：
  第1行: Beijing Shanghai
  第2行: China is great
```

---

## 三、Map 阶段 — 读数据，拆单词，生成 key-value 对

### key 是怎么生成的？

Map 函数的逻辑（伪代码）：

```
map(一行文本):
    for 每个单词 in 这一行.split(" "):
        emit(单词, 1)    # 单词就是 key，1 就是 value
```

每读一行，按空格切开，每个单词变成一个 (key, value) 对。

### Map Task 1（在机器B上）读文件1：

```
读第1行: "I love Beijing"
  → (I, 1)  (love, 1)  (Beijing, 1)

读第2行: "I love Shanghai"
  → (I, 1)  (love, 1)  (Shanghai, 1)

读第3行: "Beijing is great"
  → (Beijing, 1)  (is, 1)  (great, 1)

Map Task 1 共输出 9 个键值对
```

### Map Task 2（在机器C上）读文件2：

```
读第1行: "Shanghai is big"
  → (Shanghai, 1)  (is, 1)  (big, 1)

读第2行: "I love China"
  → (I, 1)  (love, 1)  (China, 1)

Map Task 2 共输出 6 个键值对
```

### Map Task 3（在机器D上）读文件3：

```
读第1行: "Beijing Shanghai"
  → (Beijing, 1)  (Shanghai, 1)

读第2行: "China is great"
  → (China, 1)  (is, 1)  (great, 1)

Map Task 3 共输出 5 个键值对
```

---

## 四、分区 — 每个 key 算 hash，决定去哪个 Reduce

### 分区公式

```
分区号 = key.hashCode() % ReduceTask数量

这里 ReduceTask 数量 = 2，所以：
  分区号 = 0 → 发给 Reduce Task 0（在机器C上）
  分区号 = 1 → 发给 Reduce Task 1（在机器D上）
```

### 关键规则

```
同一个 key 的 hashCode 永远相同
→ 同一个 key 不管出现在哪个 Map Task 里，都会被分到同一个 Reduce
→ 保证同一个 key 的所有 value 最终会被同一个 Reduce 汇总
```

### 每个 key 的分区结果

```
key         hashCode        % 2     去哪个 Reduce
──────────────────────────────────────────────────────
I           73              1       → Reduce Task 1（机器D）
love        3329934         0       → Reduce Task 0（机器C）
Beijing     -1851070909     1       → Reduce Task 1（机器D）
Shanghai    2035256660      0       → Reduce Task 0（机器C）
is          3417            1       → Reduce Task 1（机器D）
great       98541453        1       → Reduce Task 1（机器D）
big         97827           1       → Reduce Task 1（机器D）
China       2063935         1       → Reduce Task 1（机器D）
```

---

## 五、Map 输出按分区写入本地磁盘

### Map Task 1（机器B）的本地磁盘

```
机器B 本地磁盘：
┌──────────────────────────────────────┐
│ partition-0（给 Reduce Task 0）：     │
│   (love,1)  (love,1)                 │
│                                      │
│ partition-1（给 Reduce Task 1）：     │
│   (I,1)  (Beijing,1)                 │
│   (I,1)  (Shanghai,1)                │
│   (Beijing,1)  (is,1)  (great,1)     │
└──────────────────────────────────────┘
```

### Map Task 2（机器C）的本地磁盘

```
机器C 本地磁盘：
┌──────────────────────────────────────┐
│ partition-0（给 Reduce Task 0）：     │
│   (Shanghai,1)  (love,1)             │
│                                      │
│ partition-1（给 Reduce Task 1）：     │
│   (is,1)  (big,1)                    │
│   (I,1)  (China,1)                   │
└──────────────────────────────────────┘
```

### Map Task 3（机器D）的本地磁盘

```
机器D 本地磁盘：
┌──────────────────────────────────────┐
│ partition-0（给 Reduce Task 0）：     │
│   (Shanghai,1)                       │
│                                      │
│ partition-1（给 Reduce Task 1）：     │
│   (Beijing,1)                        │
│   (China,1)  (is,1)  (great,1)       │
└──────────────────────────────────────┘
```

---

## 六、Shuffle — Reduce Task 去各节点拉数据

### Reduce Task 0（在机器C上）拉所有 partition-0

```
① 从机器B 拉（走网络）：
   机器B 网卡 → 网线 → 机器C 网卡 → 机器C 内存
   拉到：(love,1) (love,1)

② 从机器C 本地读（不用走网络）：
   读到：(Shanghai,1) (love,1)

③ 从机器D 拉（走网络）：
   机器D 网卡 → 网线 → 机器C 网卡 → 机器C 内存
   拉到：(Shanghai,1)

合并排序后的结果（在机器C内存里）：
  love → [1, 1, 1]
  Shanghai → [1, 1]
```

### Reduce Task 1（在机器D上）拉所有 partition-1

```
① 从机器B 拉（走网络）：
   拉到：(I,1) (Beijing,1) (I,1) (Shanghai,1) (Beijing,1) (is,1) (great,1)

② 从机器C 拉（走网络）：
   拉到：(is,1) (big,1) (I,1) (China,1)

③ 从机器D 本地读（不用走网络）：
   读到：(Beijing,1) (China,1) (is,1) (great,1)

合并排序后的结果（在机器D内存里）：
  I → [1, 1, 1]
  Beijing → [1, 1, 1]
  Shanghai → [1]
  is → [1, 1, 1]
  great → [1, 1]
  big → [1]
  China → [1, 1]
```

---

## 七、Reduce 阶段 — 对每个 key 的 value 列表求和

### Reduce Task 0（机器C）计算

```
love → [1, 1, 1]       → sum = 3
Shanghai → [1, 1]      → sum = 2
```

### Reduce Task 1（机器D）计算

```
I → [1, 1, 1]           → sum = 3
Beijing → [1, 1, 1]     → sum = 3
Shanghai → [1]           → sum = 1
is → [1, 1, 1]           → sum = 3
great → [1, 1]           → sum = 2
big → [1]                → sum = 1
China → [1, 1]           → sum = 2
```

---

## 八、最终输出（写入 HDFS）

```
part-r-00000（Reduce Task 0 的输出，在机器C上写入 HDFS）：
  love      3
  Shanghai  2

part-r-00001（Reduce Task 1 的输出，在机器D上写入 HDFS）：
  I         3
  Beijing   3
  Shanghai  1
  is        3
  great     2
  big       1
  China     2
```

---

## 九、数据去向总结

| 数据阶段 | 存在哪里 | 原因 |
|----------|----------|------|
| Map 输出（中间结果） | Map 节点的本地磁盘 | 临时数据，快，Reduce 拉完可删 |
| Shuffle 拉取后 | Reduce 节点的内存（不够溢写磁盘） | 优先内存，快 |
| 最终结果 | HDFS（跨机器、有副本） | 永久保存，安全 |

---

## 十、每台机器硬件在各阶段的职责

| 阶段 | 机器A（主节点） | 机器B | 机器C | 机器D |
|------|----------------|-------|-------|-------|
| 提交任务 | CPU 接收任务 | — | — | — |
| 启动 AM | 网络通知B | CPU 启动 AM，内存占用 1GB | — | — |
| 启动 Map | 网络通知BCD | CPU 跑 Map1，内存 +1GB | CPU 跑 Map2，内存 +1GB | CPU 跑 Map3，内存 +1GB |
| Map 计算 | — | CPU 算数据，磁盘写结果 | CPU 算数据，磁盘写结果 | CPU 算数据，磁盘写结果 |
| Shuffle | — | 磁盘读+网卡发数据 | 磁盘读+网卡发+内存收+CPU合并 | 磁盘读+网卡发+内存收+CPU合并 |
| Reduce | — | — | CPU 求和，网卡写 HDFS | CPU 求和，网卡写 HDFS |

---

## 十一、核心要点速记

```
1. key 怎么生成？
   → Map 函数里你写的代码决定。WordCount 里每拆一个单词就输出 (单词, 1)

2. key 去哪台机器？
   → hashCode % Reduce数量。同一个 key 永远去同一个 Reduce

3. 数据怎么到 Reduce？
   → Reduce 主动通过网卡去各 Map 节点拉，收到自己内存里

4. 本地磁盘 vs HDFS？
   → 本地磁盘只有自己能访问，HDFS 所有机器都能访问且有副本
   → 中间结果存本地磁盘（临时），最终结果存 HDFS（永久）

5. 内存是共享的？
   → 不是，每台机器用自己的内存，数据交换靠网络

6. 为什么要落盘不全放内存？
   → Map 输出可能远超内存 → 溢写到磁盘
   → 需要排序 → 磁盘上归并排序
   → Reduce 来拉时间不确定 → 进程可退出释放资源
   → 进程崩溃 → 磁盘上有中间结果不完全丢失
```
