---
title: "虾皮大数据开发面试题集（含参考答案）"
date: 2026-09-04
category: 面试
tags: [虾皮, 大数据, 面试题, 日记归档]
draft: false
---

> 日期：2026-09-04
> 用法：先自己写，写完再看答案。练习时可用 `!!ai` 核对思路。
> SQL 均为 HiveSQL 语法（虾皮数仓主流），算法默认 Python（现场可声明换语言）。

---

## 第一部分：手写 SQL（6题）

### SQL-1 分组 TopN ★★★

**题目**：表 `sales(order_id, category, product_id, quantity)`，求**每个品类销量前3的商品**，并说明 `row_number` / `rank` / `dense_rank` 的区别。

```sql
SELECT category, product_id, total_qty, rn
FROM (
    SELECT category, product_id,
           SUM(quantity) AS total_qty,
           ROW_NUMBER() OVER (PARTITION BY category
                              ORDER BY SUM(quantity) DESC) AS rn
    FROM sales
    GROUP BY category, product_id
) t
WHERE rn <= 3;
```

**区别（必答点）**：
- `ROW_NUMBER()`：并列也编不同的号：1,2,3,4
- `RANK()`：并列同名次，跳号：1,2,2,4
- `DENSE_RANK()`：并列同名次，不跳号：1,2,2,3
- 业务上"前3名允许并列"用 `DENSE_RANK() <= 3`，严格取3条用 `ROW_NUMBER()`

---

### SQL-2 连续登录 ★★★

**题目**：表 `user_login(user_id, login_date)`（一人一天最多一条），求**连续登录≥7天的用户**及连续起止日期。

```sql
SELECT user_id,
       MIN(login_date) AS start_date,
       MAX(login_date) AS end_date,
       COUNT(*)        AS consecutive_days
FROM (
    SELECT user_id, login_date,
           DATE_SUB(login_date,
                    ROW_NUMBER() OVER (PARTITION BY user_id
                                       ORDER BY login_date)) AS grp
    FROM (SELECT DISTINCT user_id, login_date FROM user_login) a
) t
GROUP BY user_id, grp
HAVING COUNT(*) >= 7;
```

**核心思想（面试官想听的）**：连续日期减去递增行号，差值 `grp` 是常量；按 `grp` 分组即可把"连续段"聚在一起。

---

### SQL-3 次日留存率 ★★★

**题目**：表 `user_login(user_id, login_date)`，求每天的活跃用户数与次日留存率。

```sql
SELECT a.login_date,
       COUNT(DISTINCT a.user_id) AS active_uv,
       COUNT(DISTINCT b.user_id) AS retained_uv,
       ROUND(COUNT(DISTINCT b.user_id) / COUNT(DISTINCT a.user_id), 4) AS retention_rate
FROM user_login a
LEFT JOIN user_login b
       ON a.user_id = b.user_id
      AND b.login_date = DATE_ADD(a.login_date, 1)
GROUP BY a.login_date
ORDER BY a.login_date;
```

**易错点**：
- 条件 `b.login_date = 次日` 必须写在 **ON** 里而不是 WHERE 里（写 WHERE 会把 LEFT JOIN 变成 INNER JOIN，留存为0的用户整行消失）
- 新用户次日留存：加 `a.login_date = (该用户首次登录日)` 的限定即可

---

### SQL-4 行转列 + 列转行 ★★

**题目**：表 `scores(student, subject, score)`，把长表转成宽表（每个学生一行，语文/数学/英语三列）；再反着转回去。

**行转列**：
```sql
SELECT student,
       MAX(CASE WHEN subject = '语文' THEN score END) AS chinese,
       MAX(CASE WHEN subject = '数学' THEN score END) AS math,
       MAX(CASE WHEN subject = '英语' THEN score END) AS english
FROM scores
GROUP BY student;
```

**列转行**：
```sql
SELECT student, subject, score
FROM scores_wide
LATERAL VIEW EXPLODE(MAP('chinese', chinese, 'math', math, 'english', english)) e AS subject, score;
```

---

### SQL-5 GMV 环比 ★★

**题目**：表 `orders(order_id, amount, pay_time)`，求每月GMV及环比增长率。

```sql
SELECT month, gmv,
       LAG(gmv, 1) OVER (ORDER BY month) AS last_gmv,
       ROUND((gmv - LAG(gmv, 1) OVER (ORDER BY month))
             / LAG(gmv, 1) OVER (ORDER BY month) * 100, 2) AS mom_pct
FROM (
    SELECT SUBSTR(pay_time, 1, 7) AS month,
           SUM(amount) AS gmv
    FROM orders
    GROUP BY SUBSTR(pay_time, 1, 7)
) t;
```

**注意**：先聚合再开窗；第一期 `LAG` 为 NULL，环比天然 NULL，不用特判。

---

### SQL-6 转化漏斗 ★★

**题目**：埋点表 `events(user_id, event_name, dt)`，`event_name ∈ {view, cart, pay}`。求某天 浏览→加购→支付 的各环节人数和转化率。

```sql
SELECT
    COUNT(DISTINCT CASE WHEN event_name = 'view' THEN user_id END) AS view_uv,
    COUNT(DISTINCT CASE WHEN event_name = 'cart' THEN user_id END) AS cart_uv,
    COUNT(DISTINCT CASE WHEN event_name = 'pay'  THEN user_id END) AS pay_uv,
    ROUND(COUNT(DISTINCT CASE WHEN event_name = 'pay' THEN user_id END) /
          COUNT(DISTINCT CASE WHEN event_name = 'view' THEN user_id END), 4) AS view2pay_rate
FROM events
WHERE dt = '2026-09-01';
```

**加分点**：这是"宽口径漏斗"（当天发生过即可）。若要求**严格顺序路径**（先view后cart后pay），需要用 `ROW_NUMBER` 分别取每人各事件最早时间再比较先后，能说出这个区别即可。

---

## 第二部分：算法手撕（5题）

### ALGO-1 LRU 缓存 ★★★（虾皮超高频）

```python
from collections import OrderedDict

class LRUCache:
    def __init__(self, capacity: int):
        self.cap = capacity
        self.od = OrderedDict()

    def get(self, key: int) -> int:
        if key not in self.od:
            return -1
        self.od.move_to_end(key)      # 最近使用挪到尾部
        return self.od[key]

    def put(self, key: int, value: int) -> None:
        if key in self.od:
            self.od.move_to_end(key)
        self.od[key] = value
        if len(self.od) > self.cap:
            self.od.popitem(last=False)  # 淘汰头部(最久未用)
```

**追问必答**：`OrderedDict` 底层就是**哈希表 + 双向链表**。要求手写时：`dict` 存 key→node，双向链表维护顺序，头部淘汰、尾部最近；get/put 均 O(1)。

---

### ALGO-2 TopK ★★★

**题目**：数组里找最大的 K 个数（不能全排序）。

```python
import heapq

def top_k(nums, k):
    heap = []                       # 小根堆，维护当前最大的k个
    for x in nums:
        if len(heap) < k:
            heapq.heappush(heap, x)
        elif x > heap[0]:
            heapq.heapreplace(heap, x)
    return heap
```

- 时间 O(n log k)，空间 O(k) —— k 小时近似线性
- 追问"更快"：**快速选择**（快排分区只递归一边），平均 O(n)，最坏 O(n²)
- 追问"数据在海量文件里"：见第三部分海量题

---

### ALGO-3 无重复字符的最长子串 ★★

```python
def length_of_longest_substring(s: str) -> int:
    win = set()
    left = ans = 0
    for right, ch in enumerate(s):
        while ch in win:            # 收缩左边界直到无重复
            win.remove(s[left])
            left += 1
        win.add(ch)
        ans = max(ans, right - left + 1)
    return ans
```

滑动窗口模板题，O(n)。要点：右指针扩张、遇重复收缩左边界。

---

### ALGO-4 手写快排 ★★（大数据岗偏爱）

```python
import random

def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = random.choice(arr)      # 随机pivot防有序数组退化
    lt = [x for x in arr if x < pivot]
    eq = [x for x in arr if x == pivot]
    gt = [x for x in arr if x > pivot]
    return quick_sort(lt) + eq + quick_sort(gt)
```

- 平均 O(n log n)，最坏 O(n²)（已有序+固定取首元素时）；随机化可避免
- **追问必答**：为什么大数据场景用归并思想而不是快排？——**外部排序基于归并**（快排随机访问不友好，归并可顺序流式合并）

---

### ALGO-5 二叉树层序遍历 ★

```python
from collections import deque

def level_order(root):
    if not root:
        return []
    q, res = deque([root]), []
    while q:
        level = []
        for _ in range(len(q)):     # 固定本层节点数
            node = q.popleft()
            level.append(node.val)
            if node.left:  q.append(node.left)
            if node.right: q.append(node.right)
        res.append(level)
    return res
```

---

## 第三部分：海量数据场景题（3题）

### BIG-1 10G文件找Top100高频词（内存限制1G）★★★

**答题主线（三步）**：
1. **哈希切分**：遍历大文件，对每个词 `hash(word) % 1000`，写入对应小文件 `f_i`。同一词必落同一小文件（这是切分合法性的关键）
2. **分桶统计**：每个小文件约10M，用 HashMap 词→频次统计，每个文件取局部 Top100（小根堆，堆容量100）
3. **归并**：1000 个局部 Top100（共10万对）过一遍小根堆，得全局 Top100

**加分点**：某个小文件仍超内存 → 说明该桶词高度重复，换第二个 hash 函数再切一次即可。

---

### BIG-2 两个各100G的URL文件求交集（内存4G）★★★

**答**：
1. 对文件A、B用**同一 hash 函数** `% 1000` 切分成 a₀..a₉₉₉ 和 b₀..b₉₉₉
2. hash 相同 → 同一 URL 必在编号相同的一对桶里，只需逐对比 `(a_i, b_i)`
3. 加载 `a_i` 进 set，遍历 `b_i` 查 set，命中即交集

**加分点**：允许误判、只要判断存在性 → 布隆过滤器：A 建布隆过滤器，B 流式查，内存可压到几百MB。

---

### BIG-3 布隆过滤器 ★★

**题目**：100亿个黑名单URL，判断任意URL是否在名单里，允许万分之一误判，怎么省内存？

**要点**：
- 一个**位数组**（如 bitset）+ **k 个独立哈希函数**
- 插入：k 个哈希位置全置1；查询：k 个位置全为1才"可能存在"
- **特点**：说"不存在"一定不存在；说"存在"可能误判（哈希位被别人置过1）
- 不支持删除（删会误伤其他元素）；要删除用**计数型布隆过滤器**
- 误判率由 位数组大小/元素数/哈希个数 共同决定，工程上直接用现成公式或 Redis 的 Bloom 模块

---

## 第四部分：附加——SQL 数据倾斜调优（场景编程题）★★★

**题目**：`SELECT ... FROM big_a a JOIN big_b b ON a.key = b.key`，某个 key（如默认值 `''` 或超级大V的 id）占了 90% 数据，任务卡在 99% 一个 reducer，怎么治？

**答题框架（按优先级）**：
1. **空值/默认值单独处理**：空 key 不参与业务就先过滤；要保留则给空 key 加随机数打散：
   ```sql
   SELECT ...
   FROM (
       SELECT CASE WHEN key = '' THEN CONCAT('rand_', RAND()) ELSE key END AS key, ...
   ) a JOIN b ON a.key = b.key  -- 空key join不上，不影响结果量
   ```
2. **热点 key 加盐两阶段聚合**：map 端给 key 加随机前缀 `rand_0~N` 先聚合一次，再去前缀二次聚合（本质是把一个热点 reducer 摊到 N 个）
3. **开 map join**：小表不大时直接 `/*+ MAPJOIN(b) */`，广播小表彻底绕开 shuffle
4. **参数兜底**：`hive.groupby.skewindata=true`（group by 倾斜）/ `hive.optimize.skewjoin=true`

**面试官追问"怎么发现倾斜"**：看 YARN 上该 job 的 counter —— 某个 reduce 的输入记录数远超均值，基本就是它。

---

## 附：练习建议

1. SQL 题全部**在真实引擎里跑一遍**（本地装个 Hive 太重，可用 SparkSQL local 模式或在线 SQL 平台），光看不写面试必翻车
2. 算法题限时 20 分钟/题，写完能**边写边讲思路**
3. 海量题背"三步框架"：**hash切分 → 分桶统计 → 归并/合并**，90% 的海量题都是这个骨架的变体
