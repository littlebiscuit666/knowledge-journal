---
title: "Neo4j 学习环境部署与 Cypher 入门（MySQL 对照）"
date: 2026-08-20
category: 技术
tags: [neo4j, cypher, 图数据库, 日记归档]
draft: false
---

> 日期：2026-08-20
> 用途：独立学习 Neo4j（与 WeKnora 无关，但镜像同款周日可复用）

---

## 一、部署信息（已装好，记这些就够了）

| 项目 | 值 |
|---|---|
| 部署方式 | Docker 容器（名字 `neo4j-learn`） |
| 镜像 | `neo4j:2025.10.1`（经 DaoCloud 代理拉取后 tag 回原名） |
| 网页控制台 | **http://localhost:7474**（Neo4j Browser，学习主战场） |
| Bolt 协议端口 | 7687（程序连接用） |
| **用户名 / 密码** | **`neo4j` / `learn123456`** |
| 数据持久化 | docker 卷 `neo4j-learn-data`（删容器数据也不丢） |
| 库里现有数据 | 冰与火小图：24 节点（4 House + 17 Person + 3 Dragon）+ 39 关系 |

### 日常管理命令

```bash
docker stop neo4j-learn    # 关
docker start neo4j-learn   # 开
docker logs neo4j-learn    # 看日志
docker exec -it neo4j-learn cypher-shell -u neo4j -p learn123456   # 命令行进库
```

### 镜像是怎么拉下来的（周四直连被墙时的成功路线）

```bash
# Docker Hub 直连超时 → 走 DaoCloud 公共代理（2026-08-20 实测可用）
docker pull docker.m.daocloud.io/library/neo4j:2025.10.1
docker tag docker.m.daocloud.io/library/neo4j:2025.10.1 neo4j:2025.10.1

# 起容器
docker run -d --name neo4j-learn -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/learn123456 -v neo4j-learn-data:/data neo4j:2025.10.1
```

### ⚠️ 端口冲突提醒

本容器占用 7474/7687。**周日开 WeKnora 图谱功能前必须先 `docker stop neo4j-learn`**（WeKnora 的 neo4j 容器用同样端口；镜像同款不用重拉）。

### 免 Docker 的替代方式（备查）

- `winget install Neo4j.Neo4jDesktop`——官方 GUI（自带 JDK、点按钮建库，学习体验好）
- 官网 zip 免安装版：需要 JDK 21（本机 Java 25 未必兼容，有坑）

---

## 二、连接方式

| 方式 | 用法 |
|---|---|
| Browser（推荐） | http://localhost:7474 → neo4j / learn123456 |
| 命令行 | `docker exec -it neo4j-learn cypher-shell -u neo4j -p learn123456` |
| Python | `pip install neo4j`，见下 |

```python
from neo4j import GraphDatabase
driver = GraphDatabase.driver("bolt://localhost:7687", auth=("neo4j", "learn123456"))
with driver.session() as s:
    for r in s.run("MATCH (p:Person)-[:BELONGS_TO]->(h) RETURN p.name, h.name"):
        print(r["p.name"], "→", r["h.name"])
```

### Browser 自带免费教程（地址栏输入）

| 命令 | 内容 |
|---|---|
| `:play start` | 入门向导 |
| `:play movie-graph` | 经典电影数据集（一键导入练手） |
| `:play cypher` | Cypher 基础 |

---

## 三、概念对照：MySQL ↔ Neo4j

| MySQL | Neo4j | 说明 |
|---|---|---|
| database | database | 一样 |
| 表 table | **标签 label** | `Person`、`House` 相当于两张表 |
| 行 row | **节点 node** | 一行 = 一个节点 |
| 列 column | **属性 property** | 列是表级统一定义；属性是节点级自由 JSON，各节点可以不一样 |
| 主键 | 内置 `id(n)`（习惯自建唯一属性，如 name） | |
| **外键+中间表** | **关系 relationship** | ⭐核心区别：边是一等公民，自带方向、可带属性 |
| JOIN | 沿关系跳 | 多跳 SQL 要 N 个 JOIN，Cypher 写 `*1..3` |

## 四、关键词对照表

| 干什么 | MySQL | Cypher |
|---|---|---|
| 查 | `SELECT` | `MATCH ... RETURN` |
| 建数据 | `INSERT INTO` | `CREATE` |
| 有则更新无则插入 | `INSERT ... ON DUPLICATE KEY UPDATE` | `MERGE` |
| 改 | `UPDATE ... SET` | `MATCH` 到再 `SET` |
| 删行 | `DELETE FROM` | `MATCH` 到再 `DELETE n` |
| 删列 | `ALTER TABLE DROP` | `REMOVE n.属性` |
| 条件 | `WHERE` | `WHERE`（一样） |
| 连表 | `JOIN ... ON` | `(a)-[:关系]->(b)` |
| 聚合 | `GROUP BY + COUNT()` | `RETURN count()`（自动分组，无 GROUP BY） |
| 排序/分页 | `ORDER BY / LIMIT` | 一样 |
| 模糊 | `LIKE '%雪%'` | `CONTAINS '雪'` / `STARTS WITH` |
| IN / IS NULL | 一样 | 一样 |
| 建索引 | `CREATE INDEX ON 表(列)` | `CREATE INDEX FOR (p:Person) ON (p.name)` |
| 主键约束 | `PRIMARY KEY` | `CREATE CONSTRAINT ... IS UNIQUE` |
| 执行计划 | `EXPLAIN` | `EXPLAIN` / `PROFILE`（带真实行数） |

## 五、同一问题两种写法（全部可在本机 Browser 直接跑）

**① 查所有人**

```sql
SELECT name FROM persons;
```
```cypher
MATCH (p:Person) RETURN p.name
```

**② 条件查询（用什么字段查？属性就是字段）**

```sql
SELECT * FROM persons WHERE alias = '猎狗';
```
```cypher
MATCH (p:Person {alias:'猎狗'}) RETURN p            -- 属性写进模式
MATCH (p:Person) WHERE p.alias = '猎狗' RETURN p    -- 或 WHERE 风格
```

**③ 连表 vs 跳关系：兰尼斯特家都有谁**

```sql
SELECT p.name FROM persons p
JOIN person_house ph ON ph.person_id = p.id
JOIN houses h ON h.id = ph.house_id
WHERE h.name = '兰尼斯特';
```
```cypher
MATCH (p:Person)-[:BELONGS_TO]->(:House {name:'兰尼斯特'}) RETURN p.name
```

**④ 反向查询（换个箭头方向就行）**

```cypher
MATCH (:Person {name:'提利昂·兰尼斯特'})-[r:BELONGS_TO]->(h) RETURN h.name, r.note
```

**⑤ 多跳（SQL 的噩梦，Cypher 的主场）**

```cypher
MATCH (x)-[*1..2]-(c:Person {name:'瑟曦·兰尼斯特'}) RETURN DISTINCT x.name
```

**⑥ 聚合+排序（注意没有 GROUP BY）**

```sql
SELECT h.name, COUNT(*) cnt FROM ... GROUP BY h.name ORDER BY cnt DESC;
```
```cypher
MATCH (p:Person)-[:BELONGS_TO]->(h:House)
RETURN h.name, count(p) AS cnt ORDER BY cnt DESC
```

**⑦ 增 / 改 / 删**

```cypher
CREATE (g:Person {name:'格雷果·克里冈', alias:'魔山'})
MATCH (g:Person {name:'格雷果·克里冈'}) SET g.height := '八尺' RETURN g
MATCH (g:Person {name:'格雷果·克里冈'}) DELETE g
MATCH (g:Person {name:'桑铎·克里冈'}) DETACH DELETE g   -- ⚠️有关系的节点要 DETACH，连边删
MATCH ()-[r:SERVES]->() DELETE r                        -- 只删关系
```

**⑧ 最短路径（图的招牌菜）**

```cypher
MATCH p = shortestPath((a:Person {name:'琼恩·雪诺'})-[*..8]-(b:Person {name:'提利昂·兰尼斯特'}))
RETURN [n IN nodes(p) | n.name] AS 路径, length(p) AS 跳数
// 实测结果：琼恩→奈德←乔佛里←瑟曦→兰尼斯特←提利昂，5跳
```

**⑨ 索引与唯一约束（数据多了必备）**

```cypher
CREATE INDEX person_name IF NOT EXISTS FOR (p:Person) ON (p.name);
CREATE CONSTRAINT house_unique IF NOT EXISTS FOR (h:House) REQUIRE h.name IS UNIQUE;
```

## 六、思维差异（最容易踩的坑）

1. **`MATCH` 必须配 `RETURN`/`SET`/`DELETE`**——Cypher 是"先匹配模式再说干什么"，SELECT 不是独立动词
2. **关系是数据不是结构**：MySQL 加关系要 ALTER TABLE 建表；Cypher 直接 `MERGE (a)-[:新类型]->(b)`
3. **别裸 MATCH**：`MATCH (n)` 扫全库，养成带标签 `MATCH (p:Person)` 的习惯（= FROM persons）
4. **删带关系的节点会报错**，要用 `DETACH DELETE`
5. **性能直觉相反**：SQL 看 JOIN 数；图看"从哪起跳"——起点用索引属性锁住，再往外跳

## 七、练习题（Browser 里做）

```cypher
-- 1. 兰尼斯特家都有谁？
MATCH (p:Person)-[:BELONGS_TO]->(:House {name:'兰尼斯特'}) RETURN p
-- 2. 所有婚姻关系可视化
MATCH (a)-[r:MARRIED]->(b) RETURN a, r, b
-- 3. 瑟曦两跳以内能碰到谁？
MATCH p=(:Person {name:'瑟曦·兰尼斯特'})-[*1..2]-(x) RETURN p
-- 4. 艾莉亚和卓耿隔几跳？
MATCH p = shortestPath((a:Person {name:'艾莉亚·史塔克'})-[*..8]-(d:Dragon {name:'卓耿'})) RETURN p
-- 5. 亲手加：魔山（MERGE 幂等，重复跑不重复建）
MERGE (g:Person {name:'格雷果·克里冈'}) SET g.alias := '魔山'
MERGE (g)-[:SIBLING_OF]->(:Person {name:'桑铎·克里冈'}) RETURN g
```

自测综合题：**"查所有杀了人的人，以及死者属于哪个家族"**（两种关系类型组合）。

参考答案：
```cypher
MATCH (k:Person)-[:KILLED|ORDERED_EXECUTION_OF]->(v:Person)-[:BELONGS_TO]->(h:House)
RETURN k.name AS 谁, v.name AS 对象, h.name AS 家族
```

## 八、进阶路线

1. 索引/约束 → APOC（镜像自带，WeKnora 用的 apoc.merge 就来自它）→ 图数据建模（属性放节点还是关系）
2. GraphAcademy 免费官方课程（graphacademy.neo4j.com，有中文）
3. 想可视化玩：Browser 查询结果就是图，点节点可继续展开邻居
