---
title: "SQL 函数 vs Spark（PySpark）函数对照总结"
date: 2026-09-21
category: 技术
tags: [sql, pyspark, 对照, 日记归档]
draft: false
---

> 日期：2026-09-21
> 用途：SQL 函数已熟悉，对照学习 Spark DataFrame API。
> 核心认知：SQL 是"写字符串声明要什么"，Spark 是"调用函数/Column 表达式"。两者底层函数逻辑几乎一一对应。

---

## 0. 先看整体写法差异

```python
# SQL
SELECT name, salary FROM Employee WHERE salary > 10000;

# PySpark：三种等价写法
df.select("name", "salary").where(df.salary > 10000)          # Column 写法
df.select("name", "salary").where(col("salary") > 10000)      # col() 写法
spark.sql("SELECT name, salary FROM Employee WHERE salary > 10000")  # 直接写SQL
```

关键对象：

- `col("列名")`：表示一列，类似 SQL 里直接写列名
- `lit(值)`：表示一个常量字面量，类似 SQL 里的数字/字符串（SQL 不需要，Spark 有时要显式声明）
- `expr("SQL表达式字符串")`：在 Spark 里直接塞一段 SQL 表达式

---

## 1. 聚合函数（GROUP BY 用）

| 功能             | SQL                   | PySpark                                                  |
| ---------------- | --------------------- | -------------------------------------------------------- |
| 计数             | COUNT(*) / COUNT(col) | count() / count(col)                                     |
| 求和             | SUM(salary)           | sum("salary") / F.sum(col("salary"))                     |
| 平均             | AVG(salary)           | avg("salary") / mean("salary")                           |
| 最大             | MAX(salary)           | max("salary")                                            |
| 最小             | MIN(salary)           | min("salary")                                            |
| 去重计数         | COUNT(DISTINCT dept)  | countDistinct("dept")                                    |
| 汇总多行成字符串 | GROUP_CONCAT(name)    | collect_list("name") / concat_ws(",", collect_list(...)) |
| 取集合（去重）   | -                     | collect_set("name")                                      |
| 标准差           | STDDEV()              | stddev() / stddev_samp()                                 |
| 方差             | VARIANCE()            | variance()                                               |
| 首值/末值        | -                     | first("col") / last("col")                               |

PySpark 分组写法：

```python
# SQL:  SELECT dept, AVG(salary) FROM Employee GROUP BY dept;
df.groupBy("dept").avg("salary")
df.groupBy("dept").agg(F.count("*").alias("cnt"),
                       F.max("salary").alias("top_sal"))
```

记忆：SQL 的 GROUP BY → Spark 的 groupBy；聚合函数都在 pyspark.sql.functions（通常 import 成 F）里。

---

## 2. 数学函数

| 功能     | SQL                | PySpark (F.)      |
| -------- | ------------------ | ----------------- |
| 四舍五入 | ROUND(x, 2)        | round(x, 2)       |
| 向上取整 | CEIL(x)            | ceil(x)           |
| 向下取整 | FLOOR(x)           | floor(x)          |
| 绝对值   | ABS(x)             | abs(x)            |
| 幂       | POW(x, 2)          | pow(x, 2)         |
| 开平方   | SQRT(x)            | sqrt(x)           |
| 取余     | MOD(x, y) 或 x % y | x % y             |
| 随机数   | RAND()             | rand()            |
| 对数     | LN(x) / LOG10(x)   | log(x) / log10(x) |
| 指数     | EXP(x)             | exp(x)            |

---

## 3. 字符串函数

| 功能         | SQL                  | PySpark (F.)                    |
| ------------ | -------------------- | ------------------------------- |
| 拼接         | CONCAT(a, b)         | concat(a, b)                    |
| 带分隔符拼接 | CONCAT_WS('-', a, b) | concat_ws("-", a, b)            |
| 长度         | CHAR_LENGTH(s)       | length(s)                       |
| 大写/小写    | UPPER(s) / LOWER(s)  | upper(s) / lower(s)             |
| 去空格       | TRIM(s)              | trim(s)（ltrim/rtrim）          |
| 截取子串     | SUBSTRING(s, 1, 3)   | substring(s, 1, 3)              |
| 替换         | REPLACE(s, 'a','b')  | regexp_replace(s, 'a','b')      |
| 模糊查找定位 | LIKE / INSTR(s,'x')  | instr(s, 'x')                   |
| 分割成数组   | -（SUBSTRING_INDEX） | split(s, ',')                   |
| 正则提取     | REGEXP_SUBSTR        | regexp_extract(s, pattern, idx) |
| 是否匹配正则 | s REGEXP 'pattern'   | s.rlike('pattern')              |
| 左/右填充    | LPAD / RPAD          | lpad(s, n, '0') / rpad(...)     |

注意：Spark 比 SQL 多了"数组类型"，split 结果是 ArrayType，可用 size() 取长度、explode() 炸开成多行。

---

## 4. 日期时间函数（大数据岗高频）

| 功能        | SQL（MySQL）                | PySpark (F.)                            |
| ----------- | --------------------------- | --------------------------------------- |
| 当前日期    | CURDATE() / CURRENT_DATE    | current_date()                          |
| 当前时间戳  | NOW()                       | current_timestamp()                     |
| 格式化      | DATE_FORMAT(d, '%Y-%m')     | date_format(d, 'yyyy-MM')               |
| 转日期      | STR_TO_DATE(s, fmt)         | to_date(s, 'yyyy-MM-dd')                |
| 转时间戳    | UNIX_TIMESTAMP              | unix_timestamp() / to_timestamp()       |
| 日期差      | DATEDIFF(a, b)              | datediff(a, b)                          |
| 月差        | -（PERIOD_DIFF）            | months_between(a, b)                    |
| 加天数      | DATE_ADD(d, INTERVAL 3 DAY) | date_add(d, 3)                          |
| 减天数      | DATE_SUB(d, INTERVAL 3 DAY) | date_sub(d, 3)                          |
| 加月        | -                           | add_months(d, 2)                        |
| 取年/月/日  | YEAR(d)/MONTH(d)/DAY(d)     | year(d)/month(d)/dayofmonth(d)          |
| 星期        | DAYOFWEEK(d)                | dayofweek(d)                            |
| 截断到月/年 | DATE(d)                     | date_trunc('month', d) / trunc(d, 'MM') |

注意格式符差异（最容易踩坑）：

- MySQL：%Y %m %d %H %i %s
- Spark：yyyy MM dd HH mm ss

---

## 5. 条件函数（CASE WHEN 对应）

| 功能           | SQL                           | PySpark (F.)                             |
| -------------- | ----------------------------- | ---------------------------------------- |
| 条件分支       | CASE WHEN a THEN b ELSE c END | when(a, b).otherwise(c)                  |
| MySQL简写      | IF(cond, x, y)                | （用 when/otherwise 或 expr("if(...)")） |
| 取第一个非NULL | COALESCE(a,b,c)               | coalesce(a,b,c)                          |
| NULL 转默认值  | IFNULL(a, 0)                  | coalesce(a, lit(0))                      |
| 相等返NULL     | NULLIF(a, b)                  | nullif(a, b)                             |

链式多个条件：

```python
# SQL:
# CASE WHEN score>=90 THEN 'A'
#      WHEN score>=60 THEN 'B'
#      ELSE 'C' END
F.when(col("score") >= 90, "A") \
 .when(col("score") >= 60, "B") \
 .otherwise("C")
```

---

## 6. 窗口函数

SQL 和 Spark 的窗口函数几乎完全同名，语法是最大的相似点。

| 功能         | SQL                                      | PySpark                |
| ------------ | ---------------------------------------- | ---------------------- |
| 行号         | ROW_NUMBER() OVER(...)                   | F.row_number().over(w) |
| 排名(跳号)   | RANK() OVER(...)                         | F.rank().over(w)       |
| 排名(不跳号) | DENSE_RANK() OVER(...)                   | F.dense_rank().over(w) |
| 分区内累计   | SUM(x) OVER(PARTITION BY .. ORDER BY ..) | F.sum(x).over(w)       |
| 取上一行     | LAG(x,1) OVER(...)                       | F.lag(x,1).over(w)     |
| 取下一行     | LEAD(x,1) OVER(...)                      | F.lead(x,1).over(w)    |
| 首值/末值    | FIRST_VALUE/LAST_VALUE                   | first/last().over(w)   |
| 分桶         | NTILE(4)                                 | ntile(4)               |

窗口定义方式不同：

```python
from pyspark.sql import Window
# SQL: OVER (PARTITION BY dept ORDER BY salary DESC)
w = Window.partitionBy("dept").orderBy(col("salary").desc())

df.withColumn("rk", F.dense_rank().over(w))
```

记忆：SQL 的 PARTITION BY/ORDER BY 写在 OVER 括号里，Spark 单独构造一个 WindowSpec 对象再传进去。

---

## 7. 类型转换函数

| 功能     | SQL                      | PySpark (F.)    |
| -------- | ------------------------ | --------------- |
| 强转类型 | CAST(x AS INT) / CONVERT | cast("integer") |
| 转字符串 | CAST(x AS CHAR)          | cast("string")  |
| 转日期   | CAST(x AS DATE)          | cast("date")    |

```python
df.withColumn("salary", col("salary").cast("double"))
```

Spark 常用类型名：string, int/integer, long, double, float, boolean, date, timestamp, decimal(10,2)

---

## 8. NULL 处理

| 功能     | SQL                   | PySpark                         |
| -------- | --------------------- | ------------------------------- |
| 是否为空 | IS NULL / IS NOT NULL | col("x").isNull() / isNotNull() |
| 取非空值 | COALESCE(...)         | coalesce(...)                   |
| 空值丢弃 | WHERE x IS NOT NULL   | df.na.drop()                    |
| 空值填充 | IFNULL/COALESCE       | df.na.fill(0) / fillna({"x":0}) |

```python
df.filter(col("email").isNotNull())
df.na.fill({"salary": 0, "name": "未知"})
```

---

## 9. 去重 / 排序 / 限制

| 功能       | SQL                  | PySpark                                   |
| ---------- | -------------------- | ----------------------------------------- |
| 去重行     | SELECT DISTINCT ..   | df.select(...).distinct()                 |
| 按列去重   | DISTINCT col         | df.dropDuplicates(["col"])                |
| 排序       | ORDER BY salary DESC | orderBy(col("salary").desc()) / sort(...) |
| 限制行数   | LIMIT 10             | limit(10)                                 |
| 分组后过滤 | HAVING count(*) > 5  | groupBy(...).agg(...).where("cnt > 5")    |

---

## 10. JOIN 对照（不是函数，但一起记）

| SQL        | PySpark                             |
| ---------- | ----------------------------------- |
| INNER JOIN | df1.join(df2, on="id", how="inner") |
| LEFT JOIN  | how="left"                          |
| RIGHT JOIN | how="right"                         |
| FULL JOIN  | how="outer"                         |
| CROSS JOIN | how="cross" 或 df1.crossJoin(df2)   |
| 多列连接   | ON a.id=b.id AND a.dt=b.dt          |

```python
# 不同列名
df1.join(df2, df1.dept_id == df2.id, "left")
# 同名列
df1.join(df2, "id", "inner")
```

---

## 11. Spark 特有、SQL 里没有/不明显的函数

这些是 Spark 处理嵌套/复杂数据类型的重点（面试会问）：

| 函数                         | 作用                                                 |
| ---------------------------- | ---------------------------------------------------- |
| explode(arr)                 | 把数组/Map 一列炸成多行（类似 LATERAL VIEW EXPLODE） |
| size(arr)                    | 数组长度                                             |
| array_contains(arr, x)       | 数组是否包含某值                                     |
| array(...) / struct(...)     | 构造数组/结构体列                                    |
| get_item / col("arr")[0]     | 按下标或key取值                                      |
| map_keys / map_values        | 取 Map 的键/值                                       |
| from_json / to_json          | JSON 字符串 ↔ 结构体                                |
| get_json_object(json, '$.a') | 取 JSON 字段（SQL 也有同名）                         |
| 生成唯一自增ID               | -                                                    |
| input_file_name()            | 当前行来自哪个文件                                   |
| broadcast(df)                | 广播小表（map join 提示）                            |
| repartition(n) / coalesce(n) | 调整分区数（并行度）                                 |
| cache() / persist()          | 缓存复用                                             |
| withColumnRenamed            | 改列名                                               |
| withColumn                   | 新增/替换列                                          |

行列数量级概念（SQL 没有）：

- Spark 数据分成多个 partition 并行处理
- transformation（select/filter/groupBy 转换，懒执行）vs action（count/show/write，触发真正计算）

---

## 12. 速记口诀

1. SQL 聚合函数名 → Spark 基本同名，放进 `F.` 里，分组用 groupBy。
2. CASE WHEN → when().when().otherwise()；COALESCE 完全同名。
3. 窗口函数同名，但要先造 Window.partitionBy().orderBy()。
4. 日期格式符：MySQL 用 %Y，Spark 用 yyyy，最容易错。
5. 类型转换：CAST AS → .cast()。
6. NULL：IS NULL → .isNull()；批量填充 na.fill()。
7. Spark 额外重点：explode、from_json、复杂类型、分区与懒执行。
8. 实在记不住 Spark 写法，就用 F.expr("...") 或 spark.sql("...") 直接写 SQL。

---

## 13. 导入模板（写代码直接抄）

```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, lit, concat, when, coalesce, count, avg, max
import pyspark.sql.functions as F
from pyspark.sql import Window

spark = SparkSession.builder.appName("demo").getOrCreate()
df = spark.read.csv("data.csv", header=True, inferSchema=True)
```
