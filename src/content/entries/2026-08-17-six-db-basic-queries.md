---
title: "6 库基础查询速查（4 步走）"
date: 2026-08-17
category: 技术
tags: [数据库, 速查, bigdata, 日记归档]
draft: false
---

> 项目：`D:\Big-Data`  
> 只做 4 件事：**查有哪些表 → 查有哪些字段 → 查有多少数据 → 按某字段某顺序查**  
> 所有示例用你库里真实表名，可直接复制粘贴。

---

## 速查总表

| 步骤         | MongoDB                             | MySQL                              | ClickHouse                           | Redis                           | TDEngine                         | ES                       |
| ---------- | ----------------------------------- | ---------------------------------- | ------------------------------------ | ------------------------------- | -------------------------------- | ------------------------ |
| **查有哪些表**  | `show collections`                  | `SHOW TABLES;`                     | `SHOW TABLES;`                       | `KEYS *`                        | `SHOW STABLES;` / `SHOW TABLES;` | `_cat/indices?v`         |
| **查有哪些字段** | `db.raw_telemetry.findOne()`        | `DESC device;`                     | `DESCRIBE telemetry_raw;`            | `HGETALL device:dev_001:latest` | `DESC 超级表名;`                     | `_mapping?pretty`        |
| **查有多少数据** | `db.raw_telemetry.countDocuments()` | `SELECT COUNT(*) FROM device;`     | `SELECT count() FROM telemetry_raw;` | `DBSIZE`                        | `SELECT COUNT(*) FROM 表名;`       | `_count?pretty`          |
| **按字段排序查** | `.sort({ts:-1}).limit(5)`           | `ORDER BY device_id DESC LIMIT 5;` | `ORDER BY ts DESC LIMIT 5;`          | —                               | `ORDER BY ts DESC LIMIT 5;`      | `"sort":[{"ts":"desc"}]` |

---

## §1 MongoDB

```
docker exec -it mongodb mongosh
```

```js
use iot

// ---- 1. 查有哪些表（集合） ----
show collections                         // → raw_telemetry

// ---- 2. 查有哪些字段 ----
db.raw_telemetry.findOne()               // 看一条完整 JSON，字段一目了然
                                         // 结构：{ deviceId, productKey, type, ts, params: { temperature, humidity, voltage } }
                                         // ⚠️ 温度在 params.temperature 下，嵌套字段

// ---- 3. 查有多少数据 ----
db.raw_telemetry.countDocuments()        // → 36

// ---- 4. 按某字段某顺序查 ----
db.raw_telemetry.find().sort({ ts: -1 }).limit(5)      // 按时间倒序，取最新 5 条
db.raw_telemetry.find().sort({ ts: 1 }).limit(5)       // 按时间正序，取最早 5 条
db.raw_telemetry.find({ deviceId: "dev_001" }).sort({ ts: -1 }).limit(5)  // 加条件：某设备最新 5 条
```

---

## §2 MySQL

```
docker exec -it mysql mysql -uroot -proot123 iot
```

```sql
-- 1. 查有哪些表
SHOW TABLES;                             -- → device, product

-- 2. 查有哪些字段
DESC device;                             -- 字段名/类型/主键，最常用
SHOW CREATE TABLE device\G               -- 看完整建表语句（\G 竖排易读）

-- 3. 查有多少数据
SELECT COUNT(*) FROM device;             -- → 5
SELECT COUNT(*) FROM product;            -- → 0

-- 4. 按某字段某顺序查
SELECT * FROM device ORDER BY device_id DESC LIMIT 5;               -- 按 device_id 降序
SELECT * FROM device ORDER BY device_id ASC LIMIT 5;                -- 升序
SELECT device_id, status FROM device ORDER BY device_id DESC LIMIT 5;  -- 只看指定列
```

---

## §3 ClickHouse

```
docker exec -it clickhouse clickhouse-client
```

```sql
USE iot;

-- 1. 查有哪些表
SHOW TABLES;                             -- → telemetry_agg_1min, telemetry_raw
SELECT name, engine, total_rows FROM system.tables WHERE database = 'iot';  -- 含引擎和行数

-- 2. 查有哪些字段
DESCRIBE telemetry_raw;                  -- 字段名/类型
SHOW CREATE TABLE telemetry_raw\G        -- 看建表语句，重点看 ORDER BY（排序键 = CH 的"索引"）

-- 3. 查有多少数据
SELECT count() FROM telemetry_raw;       -- → 13
SELECT count() FROM telemetry_agg_1min;  -- → 8

-- 4. 按某字段某顺序查
SELECT * FROM telemetry_raw ORDER BY ts DESC LIMIT 5;               -- 按时间倒序
SELECT * FROM telemetry_raw ORDER BY temperature DESC LIMIT 5;     -- 按温度从高到低
SELECT * FROM telemetry_raw ORDER BY ts ASC LIMIT 5 FORMAT PrettyCompact;  -- 升序 + 表格美化
```

---

## §4 Redis

```
docker exec -it redis redis-cli
```

```
-- 1. 查有哪些"表"（Redis 没有表概念，看 key）
KEYS *                                   -- 列出所有 key（本项目 8 个）
SCAN 0                                   -- 渐进式扫描（key 多时用这个，不阻塞）

-- 2. 查有哪些"字段"（先看 key 类型，本项目全是 hash）
TYPE device:dev_001:latest               -- → hash
HGETALL device:dev_001:latest            -- 看所有字段和值（temperature/humidity/voltage/ts...）
HKEYS device:dev_001:latest              -- 只看字段名

-- 3. 查有多少数据
DBSIZE                                   -- 当前库 key 总数 → 8
HLEN device:dev_001:latest               -- 某个 hash 里有几个字段

-- 4. 按某字段某顺序查
-- Redis 不支持按 value 排序查询，key 本身就是索引
-- 如果 key 是 zset（有序集合）可以用 ZRANGE 排序：
-- ZRANGE 排行榜key 0 -1 WITHSCORES        -- 按分数升序
-- ZREVRANGE 排行榜key 0 4 WITHSCORES       -- 按分数降序取前 5
```

---

## §5 TDEngine

```
docker exec -it tdengine taos
```

```sql
-- 1. 查有哪些表
SHOW DATABASES;                          -- 先看有哪些库
USE iot;
SHOW STABLES;                            -- 超级表（模板）
SHOW TABLES;                             -- 子表（每设备一张）

-- 2. 查有哪些字段
DESC 超级表名;                            -- 字段 + 标签都列出来
SHOW CREATE TABLE 超级表名\G             -- 看建表语句，区分列和 TAG

-- 3. 查有多少数据
SELECT COUNT(*) FROM 子表名;
SELECT COUNT(*) FROM 超级表名;            -- 查超级表 = 所有子表合计

-- 4. 按某字段某顺序查
SELECT * FROM 超级表名 ORDER BY ts DESC LIMIT 5;    -- 按时间倒序取最新 5 条
SELECT * FROM 超级表名 WHERE ts > now - 1h ORDER BY ts DESC LIMIT 5;  -- 最近 1 小时倒序
```

> 当前 TDEngine 业务库为空，命令能跑但没数据返回。

---

## §6 Elasticsearch

> ES 不进容器，用 curl 或浏览器直接打 HTTP。

```bash
# 1. 查有哪些"表"（ES 叫 index / 索引）
curl "http://127.0.0.1:9200/_cat/indices?v"          # 每行一个索引 + 文档数 + 大小

# 2. 查有哪些字段（mapping）
curl "http://127.0.0.1:9200/device-alert-20260811/_mapping?pretty"

# 3. 查有多少数据
curl "http://127.0.0.1:9200/device-alert-20260811/_count?pretty"

# 4. 按某字段某顺序查（size=5 取前 5 条，sort 指定字段和方向）
curl -s "http://127.0.0.1:9200/device-alert-20260811/_search?pretty" \
  -H "Content-Type: application/json" -d '
{
  "size": 5,
  "sort": [ { "ts": "desc" } ],
  "query": { "match_all": {} }
}'

# 加条件 + 排序：某设备最新 5 条
curl -s "http://127.0.0.1:9200/device-alert-*/_search?pretty" \
  -H "Content-Type: application/json" -d '
{
  "size": 5,
  "sort": [ { "ts": "desc" } ],
  "query": { "term": { "deviceId.keyword": "dev_001" } }
}'
```

> ES 排序注意：`text` 类型字段不能直接排序，需用 `.keyword` 子字段或确保 mapping 里该字段是 `date`/`keyword`/`long` 等类型。`ts` 如果是 `date` 类型可以直接排序。

---

## 排序方向速记

| 需求           | MongoDB               | SQL 系（MySQL/CH/TD）          | ES                                |
| ------------ | --------------------- | --------------------------- | --------------------------------- |
| **从新到旧（倒序）** | `{ ts: -1 }`          | `ORDER BY ts DESC`          | `"sort":[{"ts":"desc"}]`          |
| **从旧到新（正序）** | `{ ts: 1 }`           | `ORDER BY ts ASC`           | `"sort":[{"ts":"asc"}]`           |
| **从大到小**     | `{ temperature: -1 }` | `ORDER BY temperature DESC` | `"sort":[{"temperature":"desc"}]` |
| **从小到大**     | `{ temperature: 1 }`  | `ORDER BY temperature ASC`  | `"sort":[{"temperature":"asc"}]`  |

Redis 例外：不支持按 value 排序查（除非用 zset 数据结构，分数即排序依据）。
