---
title: "虾皮笔试复盘与 Spark 八股 / LRU 补课笔记"
date: 2026-09-06
category: 面试
tags: [虾皮, spark, 八股, LRU, 日记归档]
draft: false
---

> 日期：2026-09-06
> 背景：虾皮大数据开发岗笔试已考完，全程不会做，直接交卷。本篇是对当场回忆出的题目的完整复盘 + Spark/LRU 补课。
> 相关文档：`2026-09-04_虾皮大数据开发面试题集与参考答案.md`

---

## 一、笔试总体诊断

考完的感受是"一道都做不出来"，但把题目拼起来看（迷宫 BFS、链表求和、单词计数），**全是 easy~medium 的标准题，没有怪题偏题**。差距来自**手生 + 考场慌**，不是能力天花板，练两三周可抹平。

三种可能原因自查：
1. 题型没准备到（复习范围偏了）
2. 考试状态宕机（平时会做，限时+紧张就空白）→ 应试问题
3. 基本功有洞 → 补上就行

**重要情报：虾皮笔试复用题库。** 本次第二题"艾尔罗大迷宫"就是虾皮 2025-04-02 笔试原题，在卡码网/CodeFun2000 上有收录且可直接提交。刷历年虾皮真题比漫无目的刷 LeetCode 命中率高得多。

---

## 二、当场题目逐题复盘

### 2.1 第二题：艾尔罗大迷宫（BFS/DFS）

- **出处**：虾皮 2025-04-02 笔试真题第 2 题
- **题库地址**：
  - 卡码网 352（可在线提交）：https://www.kamacoder.com/problemset.php?page=9
  - CodeFun2000 P2790：https://codefun2000.com/ide/P2790
- **题意**：N×M 迷宫，0 可走、1 是障碍，从起点 (0,0) 出发只能走 0，统计**不可达格子数**
- **解法**：从起点做一次 BFS/DFS 标记所有可达格子 → `答案 = 总格子数 − 可达格子数`
- 同类参考：LeetCode 1036「逃离大迷宫」（BFS 变体，加分项）

### 2.2 编程题：两链表求和（只过 27%）

LeetCode 2 变体。四种常见死法，对号入座：

1. **尾部进位没处理**（最常见）：`[5]+[5]` 应输出 `[0,1]`，漏了最后补进位节点
2. **两链表长度不齐**：短的走完后没补 0 继续参与进位
3. **顺序理解反了**：LC2 是低位在头直接加；若 OA 版本高位在头，要先反转或用栈
4. **先转整数再相加**：Java/C++ 的 long 扛不住超长链表，大数据用例全爆

修法核心：循环条件 `l1 or l2 or carry`，循环结束后 `if carry: 补尾节点`。

### 2.3 最后一题：countSegments（白给题）

**LeetCode 434「统计字符串中的单词个数」**，方法签名就叫 `countSegments`。

```python
# Python 一行流：split() 不带参数自动吞掉任意空白
def countSegments(s: str) -> int:
    return len(s.split())
```

```java
// 通用扫描法：当前字符非空格，且是开头或前一个字符是空格 → 新单词
int countSegments(String s) {
    int count = 0;
    for (int i = 0; i < s.length(); i++) {
        if (s.charAt(i) != ' ' && (i == 0 || s.charAt(i - 1) == ' ')) {
            count++;
        }
    }
    return count;
}
```

坑：Java 用 `split(" ")` 会把连续空格切成空串全算成单词（要 `trim().split("\\s+")`）；空串特判返回 0。

### 2.4 八股题 1：Redis 没有 integer 类型

- 基础五类：**String、List、Hash、Set、ZSet**
- 扩展：Bitmap、HyperLogLog、GEO、Stream、Bitfield
- **没有独立 integer 类型**。数字存在 String 里，值为整数且在 long 范围时 redisObject 用 **int 编码**优化（整数直接塞进对象指针位置）

### 2.5 八股题 2：Spark stage 的 task 数由什么决定

标准答案：**该 stage 最后一个 RDD 的分区数**。笔试选了"job"，错——层级跨了两级，详见下节。

---

## 三、Spark 执行模型四级层级（必背）

```
Application（一个应用）
 └─ Job      ← 由 action 算子决定（count/collect/save，一个 action 一个 Job）
     └─ Stage ← 由宽依赖决定（遇到 shuffle 切一刀，Stage 数 = 宽依赖数 + 1）
         └─ Task  ← 由分区数决定（一个分区一个 Task）
```

**三句口诀：action 切 Job，shuffle 切 Stage，分区切 Task。**

笔试选择题三个变体：

| 问法 | 答案 |
|---|---|
| Job 数由什么决定 | action 算子的个数 |
| Stage 数由什么决定 | 宽依赖（shuffle）个数 + 1 |
| Task 数由什么决定 | 该 stage 最后一个 RDD 的**分区数** |

### 3.1 硬件视角：一行代码在集群上的真实旅程

spark-submit 后的现场：1 台跑 **Driver**（JVM 进程，指挥部，不算数据），4 台各跑一个 **Executor**（JVM 进程，各 4 核 8G + 本地磁盘）。HDFS 文件 100GB = 400 个 256MB block。

- **Application** = 集群上跑着的一组 JVM 进程（1 Driver + N Executor）
- **Job** = Driver 里一次"要结果"事件（action 触发），本身不在机器上跑
- **Task** = Executor JVM **线程池里的一个线程**（不是进程！），负责一个分区：读盘→算→写盘/回传
- **Stage** = shuffle 造成的同步屏障

Map task 线程的物理动作（400 个 task，16 个线程槽分 25 波跑）：
① 本机/就近读 256MB block → ② 逐条过 filter（不落盘）→ ③ 原地 map 成 (key,1)，全程内存流水线 → ④ 攒 32MB 排序 spill 落盘 → ⑤ 合并成 1 个数据文件 + 1 个索引文件 → ⑥ 向 Driver 汇报位置

Reduce task 线程：① 拿账本 → ② netty 网络拉取各上游机器自己那个分区的字节段 → ③ 内存归并聚合 → ④ 结果流回 Driver

关键理解：
- **窄依赖 pipeline** = 一条记录接一条记录穿过算子链，中间不落盘
- **shuffle 为什么是 stage 边界** = 数据必须过一次磁盘+网卡，下游要等上游全部写完，物理同步点

---

## 四、Spark 八股全景（11 条，面试官最爱问的顺序）

### 1. RDD 是什么
五大属性：**一组分区列表、每个分区的计算函数、依赖（血缘）列表、（可选）K-V 分区器、（可选）优先位置**。"弹性"：内存不够落盘、分区数可调、血缘可回溯重算。

### 2. 窄依赖 vs 宽依赖
- 窄：父分区最多被一个子分区依赖 → `map/filter/flatMap/union/mapPartitions`
- 宽：子分区依赖父 RDD 多个分区（shuffle）→ `reduceByKey/groupByKey/distinct/join/repartition`
- DAGScheduler 遇到宽依赖切 stage

### 3. Task 数由什么决定
分区数。分区数来源：HDFS block 数 / `spark.sql.shuffle.partitions`（SQL，默认 200）/ `spark.default.parallelism` / coalesce/repartition。

### 4. reduceByKey vs groupByKey
groupByKey 不做 map 端预聚合，全量 shuffle 必 OOM；reduceByKey 先局部聚合（combine）再 shuffle。能用 reduceByKey 就别用 groupByKey。

### 5. Shuffle 机制
HashShuffle（M×R 小文件爆炸，已废弃）→ SortShuffle（每 task 写 1 个数据文件 + 1 个索引文件）；bypass 模式：下游分区数 ≤ `spark.shuffle.sort.bypassMergeThreshold`(200) 且不需要 map 端聚合时不排序。shuffle 贵在：**落盘 IO + 网络传输 + 序列化**。

### 6. cache / persist / checkpoint
- `cache()` = `persist(MEMORY_ONLY)`，常用 **MEMORY_AND_DISK**
- cache 不切断血缘（挂了按血缘重算）；checkpoint 落可靠存储，**切断血缘**
- 坑：cache 惰性，后面要跟 action 才生效

### 7. coalesce vs repartition

| | shuffle | 能否增分区 | 用途 |
|---|---|---|---|
| `coalesce(n)` | 默认不（窄） | 理论能但不推荐 | 减分区、合并小文件 |
| `repartition(n)` | 走 shuffle（=coalesce(n,true)） | 可增可减 | 增并行度、打散数据 |

### 8. 数据倾斜（场景题之王）
- 现象：99% task 秒完，个别跑几十分钟/OOM
- 定位：Spark UI 看 task 耗时/数据量分布 + shuffle key 采样
- 五招解法：① 两阶段聚合（加盐）② 广播 join ③ 调大 shuffle.partitions ④ 过滤异常 key ⑤ 倾斜 key 拆出单独处理再 union

### 9. Join 策略
小对大 → BroadcastHashJoin（最快）；大对大 → SortMergeJoin（默认）；ShuffleHashJoin 居中。广播 join 同时是数据倾斜头号解法。

### 10. YARN client vs cluster
- client：Driver 在提交机本地，调试方便，提交机断则作业死 → 调试用
- cluster：Driver 在 AM 里，与提交端解耦 → 生产用

### 11. 加分小件
- 广播变量：只读变量分发到每 executor（不是每 task）；累加器：只加不减，driver 读
- 内存模型：统一内存管理——预留 300M，剩 60% execution/storage 共用（可互借）+ 40% 用户内存

---

## 五、LRU 补课

### 5.1 是什么
**Least Recently Used（最近最少使用）**缓存淘汰策略：内存装不下时，把最久没被用过的数据踢出去。例：手机后台最多 6 个 App，开第 7 个时杀掉最久没切换回去的那个。

### 5.2 算法题：LeetCode 146「LRU Cache」（手撕频率前三）

容量 `capacity` 的缓存，`get/put` 都要 **O(1)**；满了淘汰最久没用的 key。

容量 2 的走位示例：
```
put(1,a) → [1]
put(2,b) → [2,1]
get(1)   → 返回a, [1,2]（1提到最前）
put(3,c) → 淘汰2, [3,1]
get(2)   → -1
```

**为什么是哈希表 + 双向链表**：哈希表管"按 key O(1) 查"；双向链表管"O(1) 摘任意节点/挪队头/砍队尾"（单向链表摘节点要先找前驱，O(n)）。

```python
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.od = OrderedDict()   # 内部就是哈希表+双向链表

    def get(self, key: int) -> int:
        if key not in self.od:
            return -1
        self.od.move_to_end(key)      # 刚用过 → 提到队尾(最新)
        return self.od[key]

    def put(self, key: int, value: int) -> None:
        if key in self.od:
            self.od.move_to_end(key)
        self.od[key] = value
        if len(self.od) > self.cap:
            self.od.popitem(last=False)  # 弹队头(最久没用)
```

手搓版要点：`Node(key, val, prev, next)` + 虚拟头尾哨兵节点，逻辑同上（remove + add_to_tail）。

### 5.3 为什么大数据岗必考
LRU 是整个体系里到处在跑的机制，可层层往下拷：
- **Redis**：淘汰策略 `allkeys-lru` / `volatile-lru`
- **操作系统**：页面置换 LRU（追问 O(1) 实现 → Clock 时钟近似）
- **MySQL InnoDB**：buffer pool 改进版 LRU（冷热分区防全表扫描冲掉热数据）
- **Spark**：缓存内存满按 LRU 淘汰 block

### 5.4 相关题
| 题 | 说明 |
|---|---|
| LC 146 LRU Cache | 必刷，OrderedDict 版 + 手搓双向链表版都要会 |
| LC 460 LFU Cache | 进阶：按使用次数淘汰，次数相同比新旧 |
| LC 380 / 381 | O(1) 插入/删除/随机取，同款结构组合思路 |

---

## 六、行动项

- [ ] 卡码网/CodeFun2000 刷虾皮历年笔试真题（题库复用是明牌，优先级最高）
- [ ] LC 146 LRU 手写三遍：OrderedDict 版跑通 → 脱稿手搓双向链表版
- [ ] LC 2 两链表求和：把 27% 的死因定位出来（重点查尾部进位）
- [ ] LC 434 countSegments：练一遍扫描法（Java 版注意连续空格坑）
- [ ] Spark 八股 11 条过一遍，重点背三句口诀 + 数据倾斜五招
- [ ] 待回忆：笔试第一题是什么（补全复盘）
- [ ] 下一步可深钻：shuffle 落盘细节（spill 排序、bypass vs 普通 SortShuffle 文件结构）
- [ ] 模拟面试：让 AI 扮演面试官按 Spark 八股清单逐条拷打

## 参考资料

- 卡码网虾皮真题集：https://www.kamacoder.com/problemset.php?page=9
- CodeFun2000 艾尔罗大迷宫题解：https://codefun2000.com/ide/P2790
- LeetCode 146 / 460 / 434 / 2 / 1036
