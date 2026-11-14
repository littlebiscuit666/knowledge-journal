---
title: "Redis 八股与实战入门"
date: 2026-09-22
category: 技术
tags: [redis, 八股, 面试, 日记归档]
draft: false
---

> 整理自一次从"Redis 是什么"到"FastAPI 怎么接 Redis"的完整对话。
> 目标读者：刚接触 Redis、只熟悉 FastAPI + Postman 后端开发的同学。

---

## 一、Redis 八股（从简单到难）

### 第一层：基础概念

**1. 什么是 Redis？**
基于内存的键值对（key-value）数据库，支持多种数据结构。常用作缓存、会话存储、排行榜、消息队列。特点：快（内存操作 + 单线程 + IO 多路复用）、支持丰富数据类型。

**2. 为什么这么快？**
- 内存操作：省去磁盘 IO
- 单线程模型：避免线程切换和锁竞争（Redis 6.0 后网络 IO 多线程，命令执行仍单线程）
- IO 多路复用：基于 epoll（Linux）/ kqueue，单线程处理大量并发连接
- 高效数据结构：SDS、跳表、哈希表、压缩列表等

**3. 五种基本数据类型**

| 类型 | 说明 | 典型场景 |
|------|------|----------|
| String | 字符串（也存数字） | 缓存、计数器、分布式锁 |
| Hash | 字段-值映射 | 用户信息、对象存储 |
| List | 有序可重复列表 | 消息队列、最新列表 |
| Set | 无序不重复集合 | 标签、共同好友 |
| ZSet | 带 score 的有序集合 | 排行榜、延迟队列 |

扩展类型：BitMap、HyperLogLog、Geo、Stream 等。

### 第二层：缓存经典问题

**4. 缓存穿透 / 击穿 / 雪崩**
- **穿透**：查不存在的数据，缓存和 DB 都没有 → 每次打 DB。
  - 解决：布隆过滤器、缓存空值（NULL 也写缓存，设短过期）
- **击穿**：热点 key 突然过期，瞬间大量请求打 DB。
  - 解决：热点 key 逻辑过期、互斥锁、分布式锁
- **雪崩**：大量 key 同一时间集中过期，或 Redis 宕机 → DB 压垮。
  - 解决：过期时间加随机值打散、多级缓存、高可用（集群/哨兵）、限流降级

**5. 缓存和数据库一致性（Cache Aside Pattern）**
- 读：命中缓存返回；未命中读 DB 再写回缓存
- 写：先更新 DB，再**删除**缓存（不是更新缓存）
- 一致性增强：延迟双删、消息队列补偿、订阅 binlog（Canal）异步更新

### 第三层：持久化与内存

**6. 持久化：RDB 和 AOF**
- **RDB**：定时生成二进制快照。文件小、恢复快、适合备份；可能丢最后一次快照后数据
- **AOF**：记录每条写命令，重启重放。数据安全（可配 everysec）；文件大、恢复慢
- **混合持久化**（4.0+）：AOF 重写时先写 RDB 全量 + 增量 AOF
- 生产通常同时开启，AOF 为主

**7. Key 过期策略和内存淘汰**
- 过期删除：定时删除（耗 CPU）、惰性删除（访问时才查）、**定期删除**（Redis 采用：惰性 + 定期结合）
- 内存淘汰（maxmemory-policy）：
  - `noeviction`：不淘汰，写报错
  - `allkeys-lru` / `volatile-lru`：最近最少用
  - `allkeys-lfu` / `volatile-lfu`：最不常使用（4.0+）
  - `allkeys-random` / `volatile-random`
  - `volatile-ttl`：快过期的先淘汰

### 第四层：架构与高可用

**8. 单线程为何高性能？为何 6.0 引入多线程？**
- 单线程足够快，瓶颈不在 CPU 而在内存和 IO
- 6.0 引入网络 IO 多线程（处理读写/协议解析），命令执行仍单线程，避免并发安全问题；只为应对万兆网卡下网络 IO 瓶颈

**9. 主从复制、哨兵、集群**
- 主从复制：一主多从，从节点异步同步；故障需手动切换
- 哨兵（Sentinel）：监控主从，主挂了自动选新主 + 通知客户端；解决自动故障转移
- Cluster 集群：数据分片，16384 个哈希槽（slot）分布到各节点；支持水平扩展、高可用

**10. Redis 哈希槽 vs 一致性哈希**
- Redis Cluster 用固定 16384 个 slot + CRC16 取模；节点增减只迁移相关 slot
- 一致性哈希是另一种方案（哈希环），Redis 没用它，但面试常对比

**11. 分布式锁（Redisson / SETNX）**
- 基础：`SET key value NX EX seconds` 原子加锁
- 问题：锁过期但业务没执行完（误删别人锁）→ 唯一 value + Lua 脚本校验删除
- 进阶：Redisson 看门狗（watchdog）自动续期；RedLock 算法有争议（Martin Kleppmann 曾质疑其安全性）

### 第五层：深挖原理

**12. 底层数据结构**
- String 用 **SDS**（简单动态字符串）：O(1) 取长度、二进制安全、预分配减少扩容
- ZSet 底层：**跳表（skiplist）+ 哈希表**（跳表便于范围查询，哈希表 O(1) 查 score）
- Hash/List/ZSet 小数据量时用 **ziplist/listpack**（紧凑存储省内存），超阈值转 hashtable/linkedlist/skiplist

**13. 事件驱动模型**
基于 Reactor 模式：文件事件（网络 IO）+ 时间事件（定时任务），单线程循环处理 `aeApiPoll`（底层 epoll/kqueue/select）

**14. 大 Key 和热 Key**
- 大 Key：如一个 Hash 存百万字段 → 删除/序列化阻塞、迁移慢。解决：拆分、定期清理、SCAN 渐进删除
- 热 Key：某 key 访问量极高 → 单节点瓶颈。解决：本地缓存、key 加随机后缀打散、Cluster 扩容

**复习建议**：前三层（基础 + 穿透击穿雪崩 + 持久化）是必拿分项；第四层是分水岭；第五层是亮点。

---

## 二、Redis 实战接入（FastAPI 视角）

### 关键认知
- Redis **不会自动连接你的数据库**，也不需要你配接口让它俩同步
- 它们是**两个独立应用**，由**你写的业务代码**在中间当"调度员"
- Redis 不碰你的数据库，不需要你写接口；只要：① 起一个 Redis 服务，② 在代码里用客户端库连它，③ 配好密码和内存上限

### 典型链路
```
用户请求 → 你的应用服务（FastAPI）
                ├─ 先问 Redis：这个数据有缓存吗？
                │     有 → 直接返回（快）
                │     没有 → 去 MySQL 查 → 把结果写进 Redis → 返回
                └─ 数据更新时：先改 MySQL，再删 Redis 缓存
```

### Redis 配置了什么？
- 不需要给 Redis 单独开 HTTP 接口
- 是你的**应用服务**同时连接 Redis（用官方客户端库）和数据库
- `redis.conf` 生产必改项：
  ```conf
  bind 0.0.0.0
  port 6379
  requirepass yourpassword
  maxmemory 2gb
  maxmemory-policy allkeys-lru
  save 900 1
  appendonly yes
  ```

### 客户端怎么跟 Redis 通信？
- 客户端连 Redis 的 **6379 端口**，发的是 Redis 自己的 **RESP 协议**（文本命令），不是 HTTP
- 例：`redis-cli set name hello` 实际发送 `*3\r\n$3\r\nset\r\n$4\r\nname\r\n$5\r\nhello\r\n`
- 一条 TCP 连接可发多条命令（连接池思想，避免频繁建/断连接）
- RESP 对比 HTTP：HTTP 是浏览器/HttpClient 发起；Redis 是 redis-cli / SDK（Lettuce、redis-py）发起

### 加上 Redis 后，Postman → FastAPI 链路是什么？
```
Postman ──HTTP──> FastAPI 路由
                      ├─ 先问 Redis：有缓存吗？(内部 TCP 连接，不是 HTTP)
                      │     ├ 有 → 直接 return   ← 快，不碰数据库
                      │     └ 没有 → 查数据库 → 写进 Redis → return
```
- Postman 永远只跟 FastAPI 说话（HTTP 到 8080）
- Redis 是 FastAPI **内部**用 `redis-py` 客户端连的，对外无感知
- Postman 和 Redis 全程不直接对话

---

## 三、完整可运行示例（FastAPI + Redis）

不依赖真实数据库，用内存字典模拟 `users` 表，只看 Redis 缓存链路：

```python
from fastapi import FastAPI
import redis
import json

app = FastAPI()

# "客户端连 6379"——在 FastAPI 启动时就建好一条连接
# 如果 Redis 没密码，把 password 去掉即可
r = redis.Redis(host="localhost", port=6379, password="你的密码", db=0, decode_responses=True)


# ① 假数据库：真实项目里换成 SQLAlchemy / pymysql 等
#    用字典模拟一张 users 表
FAKE_DB = {
    1001: {"id": 1001, "name": "张三", "age": 28},
    1002: {"id": 1002, "name": "李四", "age": 32},
}

def db_query(user_id: int):
    """模拟查数据库，返回用户字典；查不到返回 None"""
    return FAKE_DB.get(user_id)


@app.get("/user/{user_id}")
def get_user(user_id: int):
    cache_key = f"user:{user_id}"

    # ② 先去 Redis 找缓存（decode_responses=True 已把结果转成 str）
    cached = r.get(cache_key)
    if cached:
        # 命中缓存：直接返回，不碰数据库
        return {"data": json.loads(cached), "source": "redis"}

    # ③ 没命中，才去数据库查
    user = db_query(user_id)
    if user is None:
        return {"data": None, "source": "not_found"}

    # ④ 顺手把结果写进 Redis，下次就快了（ex=过期时间，秒）
    r.set(cache_key, json.dumps(user), ex=3600)

    return {"data": user, "source": "database"}
```

### 怎么跑 / 怎么验证
```bash
# 1) 起一个 Redis（本地没装用 docker 一行搞定）
docker run -d -p 6379:6379 redis

# 2) 装依赖
pip install fastapi uvicorn redis

# 3) 启动（假设文件叫 main.py）
uvicorn main:app --reload --port 8000
```
用浏览器 / Postman 发两次 `GET http://localhost:8000/user/1001`：
- 第 1 次返回 `{"source": "database"}`
- 第 2 次返回 `{"source": "redis"}` ← 说明缓存生效
- 去 Redis 看：`redis-cli get user:1001` 能看到存进去的 JSON

> 备注：`decode_responses=True` 让 `r.get` 直接返回字符串而不是 `bytes`，省得再 `.decode()`。

---

## 四、一句话总结
> Postman → FastAPI 这条 HTTP 线**完全不变**。Redis 是 FastAPI **代码里的一个变量 `r`**，你在路由函数内部用 `r.set/r.get` 读写它，用来"挡在数据库前面"加速。Postman 和 Redis 全程不直接对话。客户端就是往 Redis 的 6379 端口发命令，发的是 Redis 自己的 RESP 协议文本，不是 HTTP。
