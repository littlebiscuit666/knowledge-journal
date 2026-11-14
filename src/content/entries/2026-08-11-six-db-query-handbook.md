---
title: "6 个数据库查看命令手册（MongoDB/MySQL/ClickHouse/Redis/TDEngine/ES）"
date: 2026-08-11
category: 技术
tags: [数据库, 速查, bigdata, 日记归档]
draft: false
---

> 项目：`D:\Big-Data`，日期：2026-08-11
> 目标：新手向 —— 从「进容器 → 看库 → 看表 → 看数据 → 过滤 → 聚合 → 索引」逐层递进，6 个库全覆盖。
> 示例都用**你库里真实存在的表/集合名**，可直接复制粘贴运行。
>
> **三条总则**（先记住，省得每节重复）：
>
> 1. 敲门咒语统一是 `docker exec -it <容器名> <客户端工具>`，`-it` 照抄（交互模式）。
> 2. 这些 `docker exec` 命令在 **PowerShell / cmd / Git Bash 三个都一样**跑（docker 跨 shell 通用）。
> 3. 下面教的 `find` / `SELECT` / `GET` 全是**只读查询，改不坏数据**，随便试。怕打错就 `Ctrl+C` 重来。

---

## §0 一眼看懂：6 个库各是什么角色

| 库                      | 容器名            | 客户端工具                 | 一句话定位                                           | 你库里的真实数据                                             |
| ----------------------- | ----------------- | -------------------------- | ---------------------------------------------------- | ------------------------------------------------------------ |
| **MongoDB**       | `mongodb`       | `mongosh`                | 文档型（存 JSON），灵活，原始明细常丢这              | `iot.raw_telemetry` 36 条                                  |
| **MySQL**         | `mysql`         | `mysql`                  | 关系型老大哥，结构化表格、强事务                     | `iot.device` 5 行、`product` 0 行                        |
| **ClickHouse**    | `clickhouse`    | `clickhouse-client`      | 列存 OLAP，**专做海量统计聚合**飞快            | `iot.telemetry_agg_1min` 8 行、`iot.telemetry_raw` 13 行 |
| **Redis**         | `redis`         | `redis-cli`              | 内存键值缓存，极快，数据结构多（string/hash/list…） | 8 个 key                                                     |
| **TDEngine**      | `tdengine`      | `taos`                   | 时序数据库，**专存带时间戳的设备数据**         | ⚠️ 当前空                                                  |
| **Elasticsearch** | `elasticsearch` | **HTTP（不进容器）** | 全文检索 + 倒排索引，搜索/日志利器                   | `device-alert-20260811` 28 文档                            |

> 注意：**ES 不用 `docker exec`**，它通过 HTTP 接口访问，用 `curl` 或浏览器直接打 URL。

---

## §1 通用敲门咒语（30 秒）

每个库都是独立容器，进去要"用对应客户端敲门"：

```
docker exec -it <容器名> <客户端工具>
```

- `-i` = 保持输入流开着（能打字）
- `-t` = 分配伪终端（有提示符、能交互）
- 合起来 `-it` 就是"我要进去交互"，**照抄即可**。

退出几乎都是 `exit`（Redis/TDEngine 也能用 `Ctrl+D`）。中途想打断：`Ctrl+C`。

> 唯一小坑：Git Bash 下 `docker exec -it` 交互完全正常（mintty 支持 tty）；只有当命令含 `/开头路径参数`（如 `/opt/...`）才需要 `MSYS_NO_PATHCONV=1` —— 这里的查库命令都不涉及，三 shell 放心跑。

---

## §2 MongoDB（文档型，存 JSON）

进入：

```
docker exec -it mongodb mongosh
```

进去后提示符是 `>`，下面逐层试（每行回车一次）：

### 第 0 层 · 我在哪

```js
show dbs                       // 列出所有库 → 看到 iot
use iot                        // 切到 iot 库（不存在不报错，存数据时自动建）
db                             // 当前在哪个库 → test / iot
```

### 第 1 层 · 库里有什么"表"

```js
show collections                                // Mongo 叫"集合"(collection) → 看到 raw_telemetry
db.getCollectionNames()                         // 同上,返回数组形式
db.raw_telemetry.stats()                        // 这个集合的统计(大小/条数/索引)
```

### 第 2 层 · 看一条数据长啥样（先认清结构！）

```js
db.raw_telemetry.findOne()                      // 看一条完整 JSON,最直观
// ⚠️ 真实结构:温度/湿度/电压嵌套在 params 下,不在顶层!
//   { deviceId, productKey, type, ts, params: { temperature, humidity, voltage } }
//   → 后面按温度查必须写 "params.temperature"(点号+双引号,见第 4 层),写成 temperature 会查不到!
// 💡 对比:同一份遥测,ClickHouse/ES 的消费者把温度"拆平"存成顶层字段(CH 是 temperature 列,
//   ES 是 temperature 字段),所以 §4/§7 里直接写 temperature 是对的。MongoDB 存原始 JSON 保留嵌套
//   → 这就是三个库查询写法不同的根本原因,也是本项目"6 库不同视角"的体现。
```

### 第 3 层 · 看多条 + 分页 + 排序

```js
db.raw_telemetry.find().limit(5)                // 看 5 条
db.raw_telemetry.find().sort({ ts: -1 }).limit(5)  // 按时间倒序取最新 5 条
db.raw_telemetry.find().skip(10).limit(5)       // 分页:跳过 10 条取 5 条(第 3 页)
db.raw_telemetry.find().pretty()                // 漂亮地排版(换行显示)
```

### 第 4 层 · 条件过滤（查询操作符）

```js
// 等于
db.raw_telemetry.find({ deviceId: "dev_001" })

// 范围:温度 > 50   ⚠️ 温度在 params.temperature 下,字段名带点必须加双引号!
db.raw_telemetry.find({ "params.temperature": { $gt: 50 } })   // $gt=大于, $lt=小于, $gte/$lte, $ne=不等于

// 多条件 AND(某设备的高温记录)
db.raw_telemetry.find({ deviceId: "dev_001", "params.temperature": { $gt: 50 } })

// OR
db.raw_telemetry.find({ $or: [ { deviceId: "dev_001" }, { deviceId: "dev_002" } ] })

// 在某集合内(IN)
db.raw_telemetry.find({ deviceId: { $in: ["dev_001", "dev_002"] } })

// 只看需要的字段(投影:1=要,0=不要;嵌套字段同样要点号+引号)
db.raw_telemetry.find({}, { deviceId: 1, "params.temperature": 1, _id: 0 })

// 数条数(温度 > 50 的)
db.raw_telemetry.countDocuments({ "params.temperature": { $gt: 50 } })
```

### 第 5 层 · 聚合（aggregation pipeline，MongoDB 的统计分析利器）

```js
// 按设备分组算平均温度(聚合里嵌套字段也用点号:$params.temperature)
db.raw_telemetry.aggregate([
  { $group: { _id: "$deviceId", avgTemp: { $avg: "$params.temperature" }, cnt: { $sum: 1 } } },
  { $sort: { avgTemp: -1 } }
])

// 加过滤:只看高温的,再分组
db.raw_telemetry.aggregate([
  { $match: { "params.temperature": { $gt: 40 } } },
  { $group: { _id: "$deviceId", maxTemp: { $max: "$params.temperature" } } }
])
```

### 第 6 层 · 索引（MongoDB 的索引是传统 B-tree）

```js
db.raw_telemetry.getIndexes()                   // 看现有索引(默认只有 _id_)
db.raw_telemetry.createIndex({ deviceId: 1 })   // 给 deviceId 建升序索引(1=升序,-1=降序)
db.raw_telemetry.createIndex({ deviceId: 1, ts: -1 })  // 复合索引
db.raw_telemetry.createIndex({ "params.temperature": 1 })  // 嵌套字段也能建索引(常按温度查就建)
db.raw_telemetry.dropIndex("deviceId_1")        // 删索引(按名字)
db.raw_telemetry.getIndexes()                   // 确认

// 看查询有没有用上索引(关键调优技能)
db.raw_telemetry.find({ deviceId: "dev_001" }).explain("executionStats")
// 看 winningPlan 里的 stage 是不是 IXSCAN(用了索引),COLLSCAN 是全表扫(慢)
```

### 退出 / 快捷键

```js
exit           // 或 Ctrl+D
cls            // 清屏
```

---

## §3 MySQL（关系型，结构化表格）

进入（`-uroot -proot123` 是账号密码，`iot` 是直接进 iot 库）：

```
docker exec -it mysql mysql -uroot -proot123 iot
```

进去后提示符是 `mysql>`，**每条命令以 `;` 结尾回车才执行**（忘写分号它会等下一行）。

### 第 0 层 · 我在哪

```sql
SHOW DATABASES;              -- 列出所有库
USE iot;                     -- 切库(命令行已经带 iot,可省)
SELECT DATABASE();           -- 当前库
```

### 第 1 层 · 库里有哪些表

```sql
SHOW TABLES;                 -- → device, product
SHOW TABLES FROM mysql;      -- 看别的库的表
```

### 第 2 层 · 表结构长啥样

```sql
DESC device;                          -- 字段名/类型/主键,最常用
SHOW CREATE TABLE device\G            -- 看建表语句(\G 竖排,易读)
```

### 第 3 层 · 看数据

```sql
SELECT * FROM device LIMIT 5;                      -- 前 5 行
SELECT device_id, product_key, status FROM device LIMIT 5;  -- 只看某几列(字段名是 snake_case!)
SELECT * FROM device LIMIT 5 OFFSET 10;            -- 分页:跳 10 取 5
```

### 第 4 层 · 条件过滤

```sql
SELECT * FROM device WHERE device_id = 'dev_001';                        -- status 是 varchar,值要加引号
SELECT * FROM device WHERE device_id IN ('dev_001','dev_002');
SELECT * FROM device WHERE product_key LIKE '%sensor%';                  -- 模糊匹配(% 任意字符)
SELECT * FROM device WHERE status = 'online' AND device_id LIKE 'dev_%'; -- ⚠️ status='online' 不是 =1
SELECT * FROM device ORDER BY device_id DESC LIMIT 5;                    -- 排序
```

### 第 5 层 · 聚合统计

```sql
SELECT COUNT(*) FROM device;                                  -- 总数
SELECT status, COUNT(*) FROM device GROUP BY status;         -- 分组统计
SELECT status, COUNT(*) c FROM device GROUP BY status HAVING c > 0;
-- 常用聚合函数:COUNT/SUM/AVG/MAX/MIN
```

### 第 6 层 · 索引（B-tree 为主）

```sql
SHOW INDEX FROM device;                              -- 看现有索引(device_id 是主键,自带索引)
CREATE INDEX idx_product_key ON device(product_key); -- 建索引(device_id 已有索引,换 product_key 示例)
CREATE INDEX idx_multi ON device(status, product_key);  -- 复合索引
DROP INDEX idx_product_key ON device;                -- 删索引

-- 看查询用没用索引(调优神器)
EXPLAIN SELECT * FROM device WHERE product_key = 'env_sensor';
-- 看 type 列:const/eq_ref/ref 是好的(用上索引),ALL 是全表扫
```

### 退出 / 快捷键

```sql
exit;            -- 或 \q
system cls;      -- 清屏(Windows)
\G               -- 任何查询后加 \G 替代 ;  → 竖排显示
```

---

## §4 ClickHouse（列存 OLAP，统计飞快）

> ⚠️ **ClickHouse 的"索引"和 MySQL/Mongo 完全不一样**：它没有传统 B-tree 索引，靠**排序键（ORDER BY）+ 分区（PARTITION BY）+ 稀疏索引**提速。这是它列存快的关键。

进入：

```
docker exec -it clickhouse clickhouse-client
```

提示符是 `:)`，命令以 `;` 结尾。

### 第 0 层 · 我在哪

```sql
SHOW DATABASES;
USE iot;
SELECT currentDatabase();
```

### 第 1 层 · 库里有哪些表

```sql
SHOW TABLES FROM iot;                        -- → telemetry_agg_1min, telemetry_raw
SELECT name, engine, total_rows FROM system.tables WHERE database = 'iot';  -- 含引擎和行数
```

### 第 2 层 · 表结构 + 建表语句（重点看排序键！）

```sql
DESCRIBE iot.telemetry_agg_1min;                        -- 字段类型
SHOW CREATE TABLE iot.telemetry_agg_1min\G              -- 看建表语句
-- 注意 ORDER BY (...) 和 PARTITION BY —— 这就是 ClickHouse 的"索引"
```

### 第 3 层 · 看数据 + 控制输出格式

```sql
SELECT * FROM iot.telemetry_agg_1min LIMIT 5;
SELECT * FROM iot.telemetry_agg_1min LIMIT 5 FORMAT PrettyCompact;   -- 表格美化
SELECT * FROM iot.telemetry_agg_1min LIMIT 5 FORMAT Vertical;        -- 竖排(等同 \G)
SELECT * FROM iot.telemetry_agg_1min LIMIT 5 FORMAT JSONEachRow;     -- 每行一个 JSON
```

### 第 4 层 · 条件过滤

```sql
SELECT * FROM iot.telemetry_agg_1min WHERE deviceId = 'dev_001';
SELECT * FROM iot.telemetry_agg_1min WHERE avg_temp > 35 AND cnt >= 30;
SELECT * FROM iot.telemetry_agg_1min WHERE deviceId IN ('dev_001','dev_002');

-- PREWHERE:CH 特色,先过滤再读列(过滤性强时比 WHERE 快)
SELECT * FROM iot.telemetry_raw PREWHERE temperature > 50;
```

### 第 5 层 · 聚合统计（CH 的强项，亿级数据秒出）

```sql
-- 每设备平均温度
SELECT deviceId, avg(temperature) avg_t, count(*) cnt
FROM iot.telemetry_raw
GROUP BY deviceId
ORDER BY avg_t DESC;

-- 按分钟分桶(类似 Flink 窗口!)
SELECT toStartOfMinute(toDateTime(ts/1000)) AS minute,
       avg(temperature)
FROM iot.telemetry_raw
GROUP BY minute ORDER BY minute;

-- 高阶:分位数、TopK
SELECT quantile(0.9)(temperature) FROM iot.telemetry_raw;       -- 90 分位
SELECT topK(3)(deviceId) FROM iot.telemetry_raw;                -- 出现最多的 3 个设备
```

### 第 6 层 · "索引"（排序键 / 分区 / 数据跳过索引）

```sql
-- 1) 主索引 = 排序键,看 SHOW CREATE TABLE 里的 ORDER BY
SHOW CREATE TABLE iot.telemetry_agg_1min\G

-- 2) 分区:看实际分区落地
SELECT partition, rows, bytes FROM system.parts
WHERE database='iot' AND table='telemetry_agg_1min' AND active;

-- 3) 数据跳过索引(skip index,辅助加速)
--    语法:ALTER TABLE t ADD INDEX 名 字段表达式 TYPE 类型 GRANULARITY n
--    常用 TYPE: minmax(范围)、set(N)(去重集)、bloom_filter(布隆)
-- 示例(建在 telemetry_raw 上,需表存在):
-- ALTER TABLE iot.telemetry_raw ADD INDEX idx_temp temperature TYPE minmax GRANULARITY 1;
SHOW INDEX FROM iot.telemetry_raw;       -- 看已有跳数索引

-- 看查询扫了多少行(调优)
SELECT * FROM iot.telemetry_raw WHERE temperature > 50 LIMIT 1
FORMAT JSON;\   -- 不行就另起一行
-- 或用 clickhouse-client --max_rows_to_read=... 限制
```

### 退出 / 快捷键

```sql
exit;        -- 或 quit;
```

---

## §5 Redis（内存键值缓存）

> ⚠️ **Redis 没有传统"索引"概念** —— key 本身就是索引，底层按数据结构（hash/list/skiplist…）组织。新手记住：**一切操作围绕 key，先看 key 是什么类型，再用对应命令**。

进入：

```
docker exec -it redis redis-cli
```

提示符是 `127.0.0.1:6379>`，命令**不用分号**，回车即执行。

### 第 0 层 · 连通性 + 库

```
PING                 -- 返回 PONG = 通了
DBSIZE               -- 当前库有多少 key → 8
INFO                 -- 服务器信息(内存/连接数等),INFO memory 看内存
SELECT 0             -- 选库(默认 0,Redis 有 16 个库 0~15)
```

### 第 1 层 · key 总览

```
KEYS *                       -- 列出所有 key(⚠️ 生产慎用,key 多会卡死,改用 SCAN)
SCAN 0                       -- 渐进式扫,不阻塞,返回 游标 + 一批 key
KEYS device:*                -- 按模式找 key → device:dev_001:latest 等(本项目 key 命名规律:device:<设备号>:latest|status)
```

### 第 2 层 · 先看 key 是什么类型（重要！本项目全是 hash）

```
TYPE device:dev_001:latest   -- → hash(本项目 8 个 key 全是 hash 类型!)
EXISTS device:dev_001:latest -- 存在返回 1
TTL device:dev_001:latest    -- 剩余过期秒数(-1=永不过期,-2=不存在)
```

### 第 3 层 · 按类型读数据（本项目全是 hash，先看这节）

```
-- ★ hash(哈希表,像一个小对象 —— 本项目 device:dev_001:latest 就是这类型)
HGETALL device:dev_001:latest           -- 全部字段和值(先跑这条,看里面有哪些字段)
HGET device:dev_001:latest temperature  -- 取某个字段(字段名按 HGETALL 看到的填)
HKEYS device:dev_001:latest             -- 只看字段名
HVALS device:dev_001:latest             -- 只看值
HLEN device:dev_001:latest              -- 有几个字段

-- 下面是其他类型的通用语法(本项目暂无,遇到别的 key 类型时用)
-- string(纯字符串)
SET k "hello"   /   GET k   /   STRLEN k
-- list(列表,有序可重复;消息队列用)
LRANGE k 0 -1   /   LLEN k
-- set(集合,无序不重复)
SMEMBERS k   /   SCARD k
-- zset(有序集合,带分数;排行榜用)
ZRANGE k 0 -1 WITHSCORES   /   ZREVRANGE k 0 2 WITHSCORES
```

> 记住:**先 `TYPE key`,再按类型选命令** —— hash→H*, list→L*, set→S*, zset→Z*, string→GET/SET。类型选错会报 `(error) WRONGTYPE Operation against a key holding the wrong kind of value`。

### 第 4 层 · 删除 / 过期（⚠️ 改动操作，新手只读就别碰）

```
DEL 你的key                  -- 删除
EXPIRE 你的key 60            -- 60 秒后过期
PERSIST 你的key              -- 取消过期
FLUSHDB                      -- ⚠️⚠️ 清空当前库(练习别用)
```

### 第 5 层 · 索引相关

```
-- Redis 的"加速"靠数据结构本身,不靠建索引
-- 想在值里查?RedisSearch 模块(本项目没装)才支持二级索引
-- 普通 Redis:你按 key 设计来查,不是按 value 反查
```

### 退出

```
exit          -- 或 Ctrl+D
```

---

## §6 TDEngine（时序数据库）

> ⚠️ **TDEngine 概念特别**：核心是**超级表（STable，模板）+ 子表（每设备一张）+ 标签（Tags，设备属性）+ 主时间戳**。新手先理解这个，命令才看得懂。
> 当前你库是空的（业务库还没建），下面命令能跑，但没业务数据可看 —— 用 `SHOW DATABASES` 会只看到系统库。

进入：

```
docker exec -it tdengine taos
```

提示符是 `taos>`，命令以 `;` 结尾。

### 第 0 层 · 我在哪

```sql
SHOW DATABASES;                  -- 当前只有 information_schema / performance_schema
CREATE DATABASE iot;             -- 建业务库(若没有)
USE iot;
```

### 第 1 层 · 超级表 / 子表

```sql
SHOW STABLES;                    -- 超级表(模板,类似"设备型号")
SHOW TABLES;                     -- 子表(每个实际设备一张)
```

### 第 2 层 · 表结构（超级表 = 字段 + 标签）

```sql
DESC stable名;                   -- 字段 + 标签都列出来
SHOW CREATE TABLE stable名\G     -- 建表语句,看列定义和 TAG
```

### 第 3 层 · 看数据

```sql
SELECT * FROM 表名 LIMIT 10;
SELECT * FROM super表名 LIMIT 10;        -- 直接查超级表 = 查所有子表的并集
```

### 第 4 层 · 时序特色过滤（按时间、按子表、按标签）

```sql
-- 按时间窗口(时间戳列通常叫 ts)
SELECT * FROM super表名 WHERE ts > now - 1h;          -- 最近 1 小时
SELECT * FROM super表名 WHERE ts > '2026-08-11 10:00:00' AND ts < '2026-08-11 11:00:00';

-- 按子表名过滤
SELECT * FROM super表名 WHERE tbname = 'dev_001';

-- 按标签过滤(标签是设备属性,如 location)
SELECT * FROM super表名 WHERE location = '北京';
```

### 第 5 层 · 时序聚合（和 Flink 窗口神似！）

```sql
-- 按时间窗口降采样:每 1 分钟聚合一次
SELECT avg(temperature), max(temperature), count(*)
FROM super表名
WHERE ts > now - 1d
INTERVAL(1m);

-- 按设备分组再按时间窗
SELECT tbname, avg(temperature)
FROM super表名
PARTITION BY tbname
INTERVAL(5m);
```

### 第 6 层 · 索引

```sql
-- 时间戳列自动建索引(时序库核心),不用手动管
-- 标签默认也优化过;3.x 可对标签显式建索引(语法细节见官方,以版本为准)
-- CREATE INDEX idx名 ON iot.超级表名 (标签名);

-- 看建过的索引
SHOW INDEX FROM super表名;
```

### 退出

```sql
exit;          -- 或 \q / Ctrl+D
```

---

## §7 Elasticsearch（HTTP + 倒排索引，搜索/日志）

> ⚠️ **ES 两个不一样**：① **不进容器**，全程 HTTP（`curl` 或浏览器）。② **"索引"在 ES 里就是"库/表"那种数据集合**（名词），同时它的核心机制叫**倒排索引**（动词概念，天生就有，不用手动建）。

进入方式（二选一）：

```
# 方式 A:终端 curl(三 shell 通用)
curl "http://127.0.0.1:9200/"

# 方式 B:浏览器直接打开 URL(加 &pretty 排版,新手最直观)
http://127.0.0.1:9200/_cat/indices?v
```

### 第 0 层 · 集群/健康

```
curl "http://127.0.0.1:9200/"                       # 版本信息
curl "http://127.0.0.1:9200/_cluster/health?pretty" # 集群健康(status: green 就对了)
```

### 第 1 层 · 有哪些"索引"（≈ 库）

```
curl "http://127.0.0.1:9200/_cat/indices?v"
# 输出每行一个索引 + 文档数 + 大小 → device-alert-20260811 等
```

### 第 2 层 · 索引结构（mapping，≈ 表结构）

```
curl "http://127.0.0.1:9200/device-alert-20260811/_mapping?pretty"
# 看每个字段是什么类型(keyword/long/date...)
```

### 第 3 层 · 看数据（_search）

```
# 简单:看前几条
curl "http://127.0.0.1:9200/device-alert-20260811/_search?size=3&pretty"

# 看某一条(by id)
curl "http://127.0.0.1:9200/device-alert-20260811/_doc/文档id?pretty"

# 多索引一起查(通配符)
curl "http://127.0.0.1:9200/device-alert-*/_search?size=3&pretty"
```

### 第 4 层 · 条件过滤（Query DSL，JSON 体）

```
# 等于(term 精确匹配 keyword 字段)
curl -s "http://127.0.0.1:9200/device-alert-*/_search?pretty" -H "Content-Type: application/json" -d '
{ "query": { "term": { "deviceId.keyword": "dev_001" } } }'

# 全文匹配(match,会分词)
curl -s "http://127.0.0.1:9200/device-alert-*/_search?pretty" -H "Content-Type: application/json" -d '
{ "query": { "match": { "rule": "temp" } } }'

# 范围:温度 > 50
curl -s "http://127.0.0.1:9200/device-alert-*/_search?pretty" -H "Content-Type: application/json" -d '
{ "query": { "range": { "temperature": { "gt": 50 } } } }'

# 组合(bool + must/filter;filter 不算分更快,推荐)
curl -s "http://127.0.0.1:9200/device-alert-*/_search?pretty" -H "Content-Type: application/json" -d '
{ "query": { "bool": { "filter": [ { "term": { "deviceId.keyword": "dev_001" } }, { "range": { "temperature": { "gt": 50 } } } ] } } }'
```

> ⚠️ Git Bash 下 `curl -d '...'` 单引号正常；**PowerShell 里单引号也行，但 JSON 里的双引号要小心** —— 最省事的是用浏览器或 Kibana，或把 JSON 存文件 `curl -d @body.json`。

### 第 5 层 · 聚合（aggs）

```
curl -s "http://127.0.0.1:9200/device-alert-*/_search?pretty" -H "Content-Type: application/json" -d '
{ "size": 0,
  "aggs": { "by_device": { "terms": { "field": "deviceId.keyword" },
                           "aggs": { "avg_temp": { "avg": { "field": "temperature" } } } } } }'
# size:0 表示不要明细只要统计;按设备分桶,每桶算平均温度
```

### 第 6 层 · 索引操作（建/删/改结构）

```
# 建索引(可带 mapping)
curl -X PUT "http://127.0.0.1:9200/my_index?pretty" -H "Content-Type: application/json" -d '
{ "mappings": { "properties": { "deviceId": { "type": "keyword" }, "temperature": { "type": "double" } } } }'

# 删索引(⚠️ 数据没了)
curl -X DELETE "http://127.0.0.1:9200/my_index?pretty"

# 倒排索引是 ES 天生的,写入即建,不用手动操作
# 调优看 _stats / _segments:
curl "http://127.0.0.1:9200/device-alert-20260811/_stats?pretty"
```

### 退出

不用退出 —— 每条 curl 是独立 HTTP 请求，跑完就回终端。

---

## §8 跨库对照表（同一件事，6 个库分别怎么写）

| 想做的事             | MongoDB                 | MySQL                        | ClickHouse                         | Redis                         | TDEngine                             | ES                  |
| -------------------- | ----------------------- | ---------------------------- | ---------------------------------- | ----------------------------- | ------------------------------------ | ------------------- |
| **进客户端**   | `mongosh`             | `mysql`                    | `clickhouse-client`              | `redis-cli`                 | `taos`                             | (HTTP)              |
| **看所有"库"** | `show dbs`            | `SHOW DATABASES;`          | `SHOW DATABASES;`                | `INFO keyspace`             | `SHOW DATABASES;`                  | `_cat/indices`    |
| **切库**       | `use iot`             | `USE iot;`                 | `USE iot;`                       | `SELECT 0`                  | `USE iot;`                         | URL 里写索引名      |
| **看所有"表"** | `show collections`    | `SHOW TABLES;`             | `SHOW TABLES;`                   | `KEYS *`                    | `SHOW TABLES;` / `SHOW STABLES;` | `_mapping`        |
| **看表结构**   | `db.c.findOne()`      | `DESC t;`                  | `DESCRIBE t;`                    | `TYPE k`                    | `DESC t;`                          | `_mapping?pretty` |
| **看 5 条**    | `find().limit(5)`     | `SELECT * FROM t LIMIT 5;` | `SELECT * FROM t LIMIT 5;`       | `LRANGE k 0 4`(list)        | `SELECT * FROM t LIMIT 5;`         | `_search?size=5`  |
| **数总数**     | `countDocuments()`    | `COUNT(*)`                 | `count()`                        | `LLEN`/`SCARD`/`DBSIZE` | `COUNT(*)`                         | `_count`          |
| **条件等于**   | `{f:v}`               | `WHERE f=v`                | `WHERE f=v`                      | —                            | `WHERE f=v`                        | `term`            |
| **范围**       | `{$gt:n}`             | `WHERE f>n`                | `WHERE f>n`                      | —                            | `WHERE f>n`                        | `range`           |
| **排序**       | `.sort({f:-1})`       | `ORDER BY f DESC`          | `ORDER BY f DESC`                | `ZRANGE`(自带序)            | `ORDER BY`                         | `sort`            |
| **分组聚合**   | `aggregate([$group])` | `GROUP BY`                 | `GROUP BY`(最强)                 | —                            | `INTERVAL`/`PARTITION BY`        | `aggs`            |
| **看索引**     | `getIndexes()`        | `SHOW INDEX FROM t;`       | `SHOW CREATE TABLE`(看 ORDER BY) | (无,看`INFO`)               | `SHOW INDEX FROM t;`               | (天生倒排)          |
| **建索引**     | `createIndex({f:1})`  | `CREATE INDEX`             | `ADD INDEX ... TYPE`             | (无)                          | `CREATE INDEX`(标签)               | (自动)              |
| **看执行计划** | `.explain()`          | `EXPLAIN`                  | `system.query_log`               | —                            | `EXPLAIN`                          | `_validate/query` |
| **退出**       | `exit`                | `exit;`                    | `exit;`                          | `exit`                      | `exit;`                            | (无)                |

---

## §9 新手常见疑问

**Q：怎么退出？**
→ 几乎都是 `exit`（MySQL/CH/TD 加 `;`）。Redis/TD 也支持 `Ctrl+D`。

**Q：命令打错了怎么办？**
→ 回车报错而已，重打。中途打断按 `Ctrl+C`。这些都是只读查询，**改不坏数据**。

**Q：怎么清屏？**
→ mongosh/PowerShell：`cls`；cmd：`cls`；Git Bash：`clear`；MySQL：`system cls;`。

**Q：哪个 shell 跑这些最好？**
→ 都行。**Git Bash 粘贴多行最顺手**；PowerShell 跑 ES 的 `curl -d JSON` 时双引号易冲突，那种情况改用浏览器或 Kibana。

**Q：我改坏数据了吗？**
→ 本文档所有命令都是只读（`find`/`SELECT`/`GET`/`_search`）。只要你不跑 `DELETE`/`DROP`/`FLUSHDB`/`PUT`/`UPDATE`，数据绝对安全。文档里带 ⚠️ 的才是改动操作。

**Q：TDEngine 为什么是空的？**
→ 上次验证可能没起 `consumer_tdengine`（6 库消费者之一）。要补数据：`.\scripts\start.ps1 -All`（起全部消费者）→ 跑模拟器 → 再回来看。

**Q：ES 为什么不用进容器？**
→ ES 设计就是 HTTP API 服务，所有操作（查/写/管理）都通过 REST 接口，所以用 `curl` 或浏览器，比进容器敲命令还简单。

---

## §10 学习建议（看这一段少走弯路）

1. **先只学 §2 MongoDB 或 §3 MySQL 一个库**（推荐 MongoDB，你库里数据最多、JSON 最直观），把第 0~4 层跑通，建立"进 → 看 → 过滤"的肌肉记忆。
2. **再横向对比 §8 对照表** —— 同一件事在 6 库叫不同名字，但思路一样。这才是真正理解"数据库"。
3. **索引（第 6 层）每个库机制不同**，是各家最大差异点，值得专门琢磨：
   - MongoDB / MySQL：传统 B-tree 索引（最通用，先懂这个）
   - ClickHouse：排序键 + 分区（列存思路，反传统）
   - TDEngine：时间戳自动索引 + 标签索引（时序特色）
   - Redis：无索引（key 即索引）
   - ES：倒排索引（天生，写入即建）
4. **真要动手改数据前**，先 `SELECT`/`find` 看清楚要改什么，再跑改写命令；重要数据先查备份策略。
