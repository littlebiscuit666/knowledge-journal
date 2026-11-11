---
title: "MySQL + Redis 学习实验场搭建全记录"
date: 2026-08-31
category: 技术
tags: [mysql, redis, sqlalchemy, 日记归档]
draft: false
---

> 今天把面试清单上剩下的硬骨头全部落地成了"可运行实验"：
> ✅ MySQL 索引、事务、锁、调优　✅ 连接池配置　✅ Redis 五大类型 + 三大经典问题　✅ 缓存一致性
> 不再是背八股，而是**每条结论都在自己的真实云数据库上跑出过证据**。

## 一、项目位置与环境

- 项目：`D:\zcode-workspace\mysql-redis-lab`（Python 3.11 + pymysql + SQLAlchemy + redis-py）
- 数据库：腾讯云 MySQL **5.7.18**（`gz-cdb-q6v9mfmr.sql.tencentcdb.com:23594`，与 data-agent 同一实例）
  - 新建了独立学习库 **`mysql_lab`**，完全没碰 userdraw 数仓 ✅
  - 造了 10 万行 `orders` 订单表当实验数据
- Redis：本机 Docker 新容器 `redis-lab`（官方 `redis:7-alpine` 镜像，端口 6379）
  - Docker Desktop 之前没在跑，先拉起的 Desktop 再 `docker run` 的
  - 没配 `--restart`：重启电脑后要手动 `docker start redis-lab`
  - 没挂数据卷：学习够用，存真数据要加 `-v redis-data:/data --appendonly yes`

## 二、八个模块（每个 = README 笔记 + 可跑实验脚本，全部验证过）

| 模块 | 实验内容 | 实测亮点 |
|---|---|---|
| 01 索引 | EXPLAIN 逐字段解读、最左前缀、覆盖索引、ORDER BY 免排序、各类失效 | 加索引后 Handler 真实读取 **100003 行 → 8 行**（4 个数量级） |
| 02 事务 | 双客户端对话式复现脏读/不可重复读/幻读；MVCC 快照锚定、SAVEPOINT、autocommit 陷阱 | RR 快照读防幻读；间隙锁把别的事务 INSERT 卡到 1205 超时 |
| 03 锁 | 行锁互斥、**无索引条件锁全表**（rows_locked 实证）、间隙锁范围、死锁复现、MDL 阻塞 DDL | 真实死锁 1213 + `SHOW ENGINE INNODB STATUS` 死锁现场报告 |
| 04 调优 | 深分页延迟关联、函数改写、count(*) 三兄弟、游标分页 | `LIMIT 90000,10` 102ms → 延迟关联 55ms → 游标 38ms |
| 05 连接池 | SQLAlchemy 池参数（对照 HikariCP）、20 线程压 15 连接看排队、池耗尽、断连自愈 | 前 15 个请求借连接 ~0ms，后 5 个等 2.6s；pre_ping 自愈 307ms |
| 06 Redis 类型 | String 计数器/锁、List 队列、Hash 购物车、Set 共同关注/抽奖、ZSet 排行榜 | 每个类型配一个业务场景；SCAN 渐进遍历 1000 key 仅 6.8ms |
| 07 缓存三大问题 | 穿透（空值缓存+布隆过滤器）、击穿（互斥锁重建）、雪崩（TTL 抖动） | 击穿防御 **20 次 DB 调用 → 1 次**；布隆把不存在 id 拦成 0 次 |
| 08 缓存一致性 | 先删缓存(反例)、Cache Aside、延迟双删、binlog/Canal | 真实复现"旧值回填"导致的脏缓存 ❌ → 延迟双删修复 ✅ |

## 三、关于我自己云实例的三个重要发现

1. **默认隔离级别是 READ-COMMITTED**，不是官方默认的 REPEATABLE-READ！
   所以实验脚本里每条连接都显式 `SET SESSION TRANSACTION ISOLATION LEVEL`，两种级别都演示。
   （RR 防幻读靠 ReadView + 间隙锁；RC 都没有——这是"为什么 MySQL 默认 RR"的活教材）
2. **`wait_timeout = 3600`（1 小时）**，比默认 8 小时激进得多 → 连接池必须
   `pool_recycle=3600` + `pool_pre_ping=True`，不然空闲一会儿就 2006 gone away。
3. **binlog 已开启（log_bin=ON）且 root 有 REPLICATION SLAVE 权限** →
   将来想真搭 Canal 订阅 binlog 异步删缓存，这台实例直接就能做。

## 四、今天踩的两个坑（都有教育意义）

1. **MDL 事故现场（意外收获）**：演示"长事务阻塞 DDL"时，我的脚本自己被堵死了——
   原因是只设了 `innodb_lock_wait_timeout`（管行锁），没设 `lock_wait_timeout`（管 MDL，**默认等一年**）。
   一个 pending 的 ALTER 又把后续所有 SELECT 堵在队列里，标准 MDL 雪崩。
   救火：杀进程释放连接 → 已写进 `common/db.py` 的 Client。
   ```sql
   SET SESSION lock_wait_timeout = 3;   -- DDL 前必设！
   ```
2. **密码里的 `@` 打爆 SQLAlchemy URL**：`@******` 里的 @ 被当成 user@host 分隔符，
   报 `Can't connect to '******@gz-cdb...'`。解法：`quote_plus(password)` 做 URL 编码。

## 五、两个追问的知识点（问答记录）

**Q：SQL 写完要不要 COMMIT？**
- mysql 命令行 / Navicat：服务端默认 `autocommit=1`，不用；
- **pymysql / SQLAlchemy：默认 autocommit=False，必须 `conn.commit()`**，否则连接一断整体回滚，
  而且未提交事务一直握着行锁会卡别人。验证：`SELECT @@autocommit;`
- 项目里故意关 autocommit，因为模块 2/3 的实验全靠"事务开着不提交"才能观察锁和快照。

**Q：Redis 是怎么起的？**
- Docker Desktop 拉起后 `docker run -d --name redis-lab -p 6379:6379 redis:7-alpine`；
- 镜像是 Docker Hub 官方的（本地本来就躺着 6-alpine/7.0-alpine 几个旧镜像，复用与否取决于 tag 是否已存在）；
- 镜像=模板，容器=实例；管理：`docker ps / start / stop / rm -f redis-lab`、
  `docker exec -it redis-lab redis-cli`。

## 六、几个可以背下来的数字（今天实测）

- 3 层 B+ 树 ≈ 2000 万行，单点查询最多 3 次 IO
- 无索引全表扫 vs 二级索引 ref：Handler 读取 100003 → 8
- 深分页：裸 LIMIT 102ms → 延迟关联 55ms → 游标分页 38ms（越深差距越大）
- 连接池排队：pool_size+max_overflow=15，第 16~20 个请求等 2.6s
- 击穿：互斥锁让 20 并发只打 DB 1 次
- 云库档案：RC 隔离 / buffer_pool 768MB / max_connections=750 / wait_timeout=3600s

## 七、怎么继续学

```bash
cd D:\zcode-workspace\mysql-redis-lab
# 按模块顺序：先读每个目录的 README.md，再按编号跑脚本
python 01_index/00_setup.py     # 已跑过，重置数据可再来
python 01_index/01_explain.py
python 02_transaction/01_anomalies.py
python 03_lock/02_gap_and_deadlock.py
# ...以此类推，脚本都可反复执行
```

下一步可做的延伸：① 用 REPLICATION 权限真搭一个 Canal/伪 slave 读 binlog 删缓存；
② 把模块 7 的布隆过滤器换成 RedisBloom 模块对比误判率；③ 给 orders 表上到 100 万行再测深分页。
