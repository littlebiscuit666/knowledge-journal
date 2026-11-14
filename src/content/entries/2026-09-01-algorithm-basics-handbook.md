---
title: "算法基础速查手册"
date: 2026-09-01
category: 面试
tags: [算法, 速查, 面试, 日记归档]
draft: false
---

> 日期：2026-09-01
> 每个专题：简要概念 → 经典题 → Python 代码

---

## 1. 数组 (Array)

**概念**：连续内存存储，按下标 O(1) 随机访问，插入/删除需移位 O(n)。是所有数据结构的基石。

### 题目：两数之和 (LeetCode 1)

> 给定一个整数数组 `nums` 和一个整数目标值 `target`，请你在该数组中找出**和为目标值 `target`** 的那两个整数，并返回它们的数组下标。
> 你可以假设每种输入只会对应一个答案，且同一个元素不能使用两次。你可以按任意顺序返回答案。
>
> **示例**：`nums = [2, 7, 11, 15], target = 9` → 输出 `[0, 1]`
> 解释：因为 nums[0] + nums[1] == 9，所以返回 [0, 1]。
>
> **进阶**：你能想到时间复杂度为 O(n) 的解法吗？

```python
def two_sum(nums, target):
    seen = {}
    for i, x in enumerate(nums):
        if target - x in seen:
            return [seen[target - x], i]
        seen[x] = i

print(two_sum([2, 7, 11, 15], 9))  # [0, 1]
```

**关键点**：哈希表把 O(n²) 降到 O(n)，空间换时间。

---

## 2. 链表 (Linked List)

**概念**：节点通过指针连接，插入/删除 O(1)（已知位置时），但不能随机访问。核心技巧：**虚拟头节点** dummy 简化边界。

### 题目：反转链表 (LeetCode 206)

> 给你单链表的头节点 `head`，请你反转链表，并返回反转后的链表。
>
> **示例 1**：`head = [1,2,3,4,5]` → 输出 `[5,4,3,2,1]`
> **示例 2**：`head = [1,2]` → 输出 `[2,1]`
> **示例 3**：`head = []` → 输出 `[]`

```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def reverse_list(head):
    prev = None
    curr = head
    while curr:
        nxt = curr.next  # 先存下一个
        curr.next = prev # 反转指针
        prev = curr
        curr = nxt
    return prev
```

**关键点**：三指针 prev/curr/nxt，每次反转一个指针。

---

## 3. 二叉树遍历 (Binary Tree Traversal)

**概念**：前序(根左右)、中序(左根右)、后序(左右根)。用递归或栈实现。

### 题目：二叉树的中序遍历 (LeetCode 94)

> 给定一个二叉树的根节点 `root`，返回它的**中序遍历**结果。
> 中序遍历的顺序是：左子树 → 根节点 → 右子树。
>
> **示例**：
> ```
>     1
>      \
>       2
>      /
>     3
> ```
> 输入：`root = [1,null,2,3]` → 输出：`[1,3,2]`
>
> **进阶**：递归解法很简单，你能用**迭代（栈）** 来实现吗？

```python
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def inorder(root):
    if not root:
        return []
    return inorder(root.left) + [root.val] + inorder(root.right)

# 迭代写法（面试更喜欢）
def inorder_iter(root):
    stack, res = [], []
    curr = root
    while curr or stack:
        while curr:          # 一路向左
            stack.append(curr)
            curr = curr.left
        curr = stack.pop()   # 弹出 = 访问
        res.append(curr.val)
        curr = curr.right    # 转右子树
    return res
```

**关键点**：迭代用栈模拟递归，一路压左，弹出时访问，再走右。

---

## 4. BFS / DFS

**概念**：
- **BFS（广度优先）**：用队列，逐层扩展，找最短路径首选。
- **DFS（深度优先）**：用栈/递归，一条路走到底。

### 题目：岛屿数量 (LeetCode 200)

> 给你一个由 `'1'`（陆地）和 `'0'`（水）组成的二维网格，请你计算网格中岛屿的数量。
> 岛屿总是被水包围，并且每座岛屿只能由水平方向和/或垂直方向上相邻的陆地连接形成。
> 此外，你可以假设该网格的四条边均被水包围。
>
> **示例 1**：
> ```
> 输入：grid = [
>   ["1","1","1","1","0"],
>   ["1","1","0","1","0"],
>   ["1","1","0","0","0"],
>   ["0","0","0","0","0"]
> ]
> 输出：1
> ```
> **示例 2**：
> ```
> 输入：grid = [
>   ["1","1","0","0","0"],
>   ["1","1","0","0","0"],
>   ["0","0","1","0","0"],
>   ["0","0","0","1","1"]
> ]
> 输出：3
> ```

```python
from collections import deque

def num_islands(grid):
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    count = 0

    def bfs(r, c):
        queue = deque([(r, c)])
        grid[r][c] = '0'  # 标记访问
        while queue:
            x, y = queue.popleft()
            for dx, dy in [(0,1),(0,-1),(1,0),(-1,0)]:
                nx, ny = x+dx, y+dy
                if 0 <= nx < rows and 0 <= ny < cols and grid[nx][ny] == '1':
                    grid[nx][ny] = '0'
                    queue.append((nx, ny))

    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == '1':
                count += 1
                bfs(r, c)
    return count

grid = [
  ["1","1","1","1","0"],
  ["1","1","0","1","0"],
  ["1","1","0","0","0"],
  ["0","0","0","0","0"]
]
print(num_islands(grid))  # 1
```

**关键点**：BFS/DFS 都可以，BFS 更直觉，DFS 代码更短。

---

## 5. 排序 — 快排 & 归并

**快排**：选 pivot，小的放左边大的放右边，递归。平均 O(n log n)，最坏 O(n²)。
**归并**：不断对半分再合并，O(n log n) 稳定，但需要 O(n) 额外空间。

### 题目：手写排序（面试高频）

> 给你一个整数数组 `nums`，请你将该数组升序排列。要求手写实现快排和归并。
>
> **示例**：`nums = [5,2,3,1]` → 输出 `[1,2,3,5]`
> **示例**：`nums = [5,1,1,2,0,0]` → 输出 `[0,0,1,1,2,5]`

### 快排手写

```python
def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    mid  = [x for x in arr if x == pivot]
    right= [x for x in arr if x > pivot]
    return quicksort(left) + mid + quicksort(right)

print(quicksort([3,6,8,10,1,2,1]))  # [1, 1, 2, 3, 6, 8, 10]
```

### 归并排序手写

```python
def mergesort(arr):
    if len(arr) <= 1:
        return arr
    mid = len(arr) // 2
    left  = mergesort(arr[:mid])
    right = mergesort(arr[mid:])
    return merge(left, right)

def merge(l, r):
    res = []
    i = j = 0
    while i < len(l) and j < len(r):
        if l[i] <= r[j]:
            res.append(l[i]); i += 1
        else:
            res.append(r[j]); j += 1
    res.extend(l[i:])
    res.extend(r[j:])
    return res

print(mergesort([3,6,8,10,1,2,1]))  # [1, 1, 2, 3, 6, 8, 10]
```

---

## 6. 二分查找 (Binary Search)

**概念**：在有序数组中，每次砍掉一半。O(log n)。核心是**保持搜索区间不变量**。

### 题目：搜索插入位置 (LeetCode 35)

> 给定一个排序数组和一个目标值，在数组中找到目标值，并返回其索引。如果目标值不存在于数组中，返回它将会被按顺序插入的位置。
> 你必须使用时间复杂度为 O(log n) 的算法。
>
> **示例 1**：`nums = [1,3,5,6], target = 5` → 输出 `2`（目标值在数组中，索引为 2）
> **示例 2**：`nums = [1,3,5,6], target = 2` → 输出 `1`（目标值不在数组中，应插入到索引 1 的位置）
> **示例 3**：`nums = [1,3,5,6], target = 7` → 输出 `4`（目标值不在数组中，应插入到末尾）

```python
def search_insert(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return lo  # lo 就是插入位置

print(search_insert([1,3,5,6], 5))  # 2
print(search_insert([1,3,5,6], 2))  # 1
print(search_insert([1,3,5,6], 7))  # 4
```

**关键点**：`lo = mid + 1` 和 `hi = mid - 1`，别写成 `lo = mid` 会死循环。

---

## 7. 双指针 (Two Pointers)

**概念**：两个指针从不同位置出发，按条件移动。常见模式：左右对撞、快慢指针。

### 题目：盛最多水的容器 (LeetCode 11)

> 给你 n 个非负整数 `a1, a2, ..., an`，每个数代表坐标中的一个点 `(i, ai)`。在坐标系内画 n 条垂直线，垂直线 i 的两个端点分别为 `(i, ai)` 和 `(i, 0)`。找出其中的两条线，使得它们与 x 轴共同构成的容器可以容纳最多的水。
> **注意**：容器不能倾斜。
>
> **示例**：
> ```
> 输入：height = [1,8,6,2,5,4,8,3,7]
> 输出：49
> 解释：选择下标 1 和 8 的线（高度 8 和 7），宽度为 8-1=7，面积 = min(8,7) × 7 = 49
> ```
> **示例**：`height = [1,1]` → 输出 `1`

```python
def max_area(height):
    lo, hi = 0, len(height) - 1
    best = 0
    while lo < hi:
        area = min(height[lo], height[hi]) * (hi - lo)
        best = max(best, area)
        if height[lo] < height[hi]:
            lo += 1  # 移动短的那根
        else:
            hi -= 1
    return best

print(max_area([1,8,6,2,5,4,8,3,7]))  # 49
```

**关键点**：移动短指针才可能变大（宽度一定减小，高度得增加）。

---

## 8. 滑动窗口 (Sliding Window)

**概念**：维护一个窗口 [left, right]，右指针扩张，条件不满足时左指针收缩。O(n)。

### 题目：无重复字符的最长子串 (LeetCode 3)

> 给定一个字符串 `s`，请你找出其中不含有重复字符的**最长子串**的长度。子串是字符串中连续的字符序列。
>
> **示例 1**：`s = "abcabcbb"` → 输出 `3`
> 解释：因为无重复字符的最长子串是 `"abc"`，所以长度为 3。
> **示例 2**：`s = "bbbbb"` → 输出 `1`
> 解释：因为无重复字符的最长子串是 `"b"`，所以长度为 1。
> **示例 3**：`s = "pwwkew"` → 输出 `3`
> 解释：因为无重复字符的最长子串是 `"wke"`，注意 `"pwke"` 是子序列而非子串。

```python
def length_of_longest_substring(s):
    seen = set()
    left = 0
    max_len = 0
    for right in range(len(s)):
        while s[right] in seen:
            seen.remove(s[left])
            left += 1
        seen.add(s[right])
        max_len = max(max_len, right - left + 1)
    return max_len

print(length_of_longest_substring("abcabcbb"))  # 3
print(length_of_longest_substring("bbbbb"))     # 1
```

**关键点**：右扩左缩，哈希表记录窗口内字符。

---

## 9. 动态规划 (Dynamic Programming)

**概念**：把大问题拆成子问题，记住子问题的解避免重复计算。三要素：**状态定义、转移方程、初始条件**。

### 题目 1：爬楼梯 (LeetCode 70)

> 假设你正在爬楼梯。需要 `n` 阶才能到达楼顶。每次你可以爬 1 或 2 个台阶。你有多少种不同的方法可以爬到楼顶呢？
>
> **示例 1**：`n = 2` → 输出 `2`
> 解释：有两种方法可以爬到楼顶：1. 1 阶 + 1 阶；2. 2 阶。
> **示例 2**：`n = 3` → 输出 `3`
> 解释：三种方法：1. 1+1+1；2. 1+2；3. 2+1。

```python
def climb_stairs(n):
    if n <= 2:
        return n
    dp = [0] * (n + 1)
    dp[1], dp[2] = 1, 2
    for i in range(3, n + 1):
        dp[i] = dp[i-1] + dp[i-2]  # 从上一步或上两步到达
    return dp[n]

print(climb_stairs(10))  # 89
```

### 题目 2：零钱兑换 (LeetCode 322)

> 给你一个整数数组 `coins`，表示不同面额的硬币；以及一个整数 `amount`，表示总金额。计算并返回可以凑成总金额所需的**最少的硬币个数**。如果没有任何一种硬币组合能组成总金额，返回 `-1`。你可以认为每种硬币的数量是无限的。
>
> **示例 1**：`coins = [1, 2, 5], amount = 11` → 输出 `3`
> 解释：11 = 5 + 5 + 1，最少需要 3 枚硬币。
> **示例 2**：`coins = [2], amount = 3` → 输出 `-1`
> 解释：只有一枚 2 元硬币，无法凑出 3 元。
> **示例 3**：`coins = [1], amount = 0` → 输出 `0`

```python
def coin_change(coins, amount):
    dp = [float('inf')] * (amount + 1)
    dp[0] = 0
    for i in range(1, amount + 1):
        for c in coins:
            if i >= c:
                dp[i] = min(dp[i], dp[i - c] + 1)
    return dp[amount] if dp[amount] != float('inf') else -1

print(coin_change([1,2,5], 11))  # 3  (5+5+1)
```

**关键点**：dp[i] 表示"凑出金额 i 的最少硬币数"，逐个尝试每种硬币。

---

## 10. TopK / 堆 (Heap)

**概念**：堆是完全二叉树，Python 用 `heapq`（最小堆）。求第 K 大/小 → 维护一个大小为 K 的堆。

### 题目：第 K 大的元素 (LeetCode 215)

> 给你一个整数数组 `nums` 和整数 `k`，请返回数组中第 `k` 个最大的元素。请注意，你需要找的是数组排序后的第 `k` 个最大的元素，而不是第 `k` 个不同的元素。你必须设计并实现时间复杂度为 O(n) 的算法解决此问题。
>
> **示例 1**：`nums = [3,2,1,5,6,4], k = 2` → 输出 `5`
> 解释：排序后为 [1,2,3,4,5,6]，第 2 个最大的元素是 5。
> **示例 2**：`nums = [3,2,3,1,2,4,5,5,6], k = 4` → 输出 `4`
> 解释：排序后为 [1,2,2,3,3,4,5,5,6]，第 4 个最大的元素是 4。

```python
import heapq

def find_kth_largest(nums, k):
    min_heap = nums[:k]
    heapq.heapify(min_heap)  # O(k)
    for num in nums[k:]:
        if num > min_heap[0]:
            heapq.heapreplace(min_heap, num)  # 弹小推大
    return min_heap[0]

print(find_kth_largest([3,2,1,5,6,4], 2))  # 5
print(find_kth_largest([3,2,3,1,2,4,5,5,6], 4))  # 4
```

**关键点**：维护大小为 k 的最小堆，遍历完堆顶就是第 k 大。

### 手写堆排序（面试加餐）

```python
def heap_sort(arr):
    import heapq
    h = arr[:]
    heapq.heapify(h)
    return [heapq.heappop(h) for _ in range(len(h))]

print(heap_sort([3,6,8,10,1,2,1]))  # [1, 1, 2, 3, 6, 8, 10]
```

---

## 速查表

| 结构 | 核心操作 | 时间复杂度 | 典型用途 |
|------|---------|-----------|---------|
| 数组 | 随机访问 O(1) | 增删 O(n) | 连续存储 |
| 链表 | 插入删除 O(1) | 访问 O(n) | 动态增删 |
| 二叉树 | 遍历 O(n) | 搜索 O(n)/O(log n) | 层级数据 |
| BFS/DFS | 遍历图/树 | O(V+E) | 最短路径/连通性 |
| 快排 | 分治 | O(n log n) 平均 | 通用排序 |
| 归并 | 分治 | O(n log n) 稳定 | 稳定排序 |
| 二分 | 查找 | O(log n) | 有序数组 |
| 双指针 | 两端逼近 | O(n) | 数组/链表 |
| 滑动窗口 | 左右边界 | O(n) | 子串/子数组 |
| DP | 记忆化 | 视问题 | 最优子结构 |
| 堆 | 取极值 | O(log n) | TopK/优先队列 |
