---
title: "WeKnora 冰与火之歌全书导入 + 百炼 429 限流排查实录"
date: 2026-08-19
category: 技术
tags: [weknora, rag, 百炼, 日记归档]
draft: false
---

> 日期：2026-08-19
> 前篇：`2026-08-19_WeKnora本地Docker部署踩坑记录.md`（上午的部署篇）
> 结果：**完全成功** —— 11699 条向量 + 摘要 + 590 批问题生成 + Wiki 词条，总花费约 ¥15
> 素材：`冰与火之歌1-5卷+([美]乔治·R.R.马丁)+.epub`（13MB，932 万字符）

---

## 一、问题：embedding 阶段三连败

上传整本书后，解析（12s）和切块（12726 chunk）都正常，卡死在向量化阶段，
WeKnora 报 `EMBEDDING_RATE_LIMIT: batch index failed`。

| 尝试 | 时间 | 模型 | 结果 |
|---|---|---|---|
| 1 | 16:23 | 专属 endpoint `qwen3.7-text-embedding` | 30s 后失败 |
| 2（充值后） | 16:31 | 同上 | 20s 后失败，**充值无效** |
| 3 | 16:50 | 换公共 `text-embedding-v4` | 撑 102s 后失败 |

## 二、根因（官方错误码文档定案）

日志里挖出的上游原始报错（UI 的错误码是笼统的，必须看日志）：

```
429 insufficient_quota
- "Allocated quota exceeded, please increase your quota limit."        ← 专属 endpoint 版文案
- "You exceeded your current quota, please check your plan and billing" ← 公共 endpoint 版文案
```

**两种文案是同一个错误**：`Throttling.AllocationQuota / insufficient_quota`
= **每秒/每分钟消耗 Token 数（TPS/TPM）触发限流**。
和欠费完全无关（真欠费是 `400-Arrearage: Access denied`）——所以充值注定无效。

机理：WeKnora 默认开 5 个并发 goroutine、每请求 5 条 chunk，瞬间把当分钟
TPM 配额烧穿 → 前 ~100 秒在烧配额 → 被掐 → 5 次指数退避全落在同一个被限流的
分钟窗口里 → 整批失败、**0 条向量落库**（WeKnora 是整批算完才写库）。

官方解法：百炼控制台「限流提额」提升模型 TPM；或者降调用速率。

## 三、解法（本次实际采用）

### 1. 压并发：`.env` 第 741 行

```diff
# ants 协程池大小（Embedding 并发，出现 429 时调小）。
- CONCURRENCY_POOL_SIZE=5
+ CONCURRENCY_POOL_SIZE=1
```

（这行注释官方本来就这么写——就是为此设计的）改完 `docker compose up -d` 重建 app 容器。

### 2. 用公共按量模型

- base_url：`https://dashscope.aliyuncs.com/compatible-mode/v1`（公共，非专属 maas 域名）
- 模型：`text-embedding-v4`，维度 1024（默认就是）
- 价格 ¥0.514/百万 token，全书嵌入约 ¥4

### 3. 中途插曲：本地 Ollama（已放弃）

切 `nomic-embed-text`（768 维）测试，稳定但只有 ~34 批/分钟（每批 2s，本地推理慢），
跑 23% 后放弃换回云端。两个教训：
- nomic 是英文导向模型，中文书检索质量会打折；真要本地用应选 `bge-m3`（1024 维中英双语）
- 本地模型没有限流，`CONCURRENCY_POOL_SIZE` 可以调回 5 提速

## 四、最终成功数据

| 阶段 | 耗时 | 成果 |
|---|---|---|
| 解析 docreader | 12.5s | 932 万字符，157 张图 |
| 切块 | 1.6s | 12726 chunk（父子：384/4096） |
| **向量化** | **11.5 分钟，0 限流** | **11699 向量（86MB）** |
| 摘要 | 秒级 | qwen-plus 写的全书总结，质量很好 |
| 问题生成 | ~90 分钟（后台） | 590 批 × 20 chunk × 3 问，llm_failed=0 |
| Wiki 生成 | 与问题生成**并行** | 自动触发，词条由 qwen-plus 归纳 |

花费明细：向量 ~¥4 + 问题生成 ~¥9 + 摘要 ~¥0.2 ≈ **¥15**（qwen-plus 走公共按量，
问题生成批量 20 chunk/批，TPM 压力小，无限流）。

## 五、排查套路沉淀（下次直接用）

1. **看上游真实报错**：`docker logs WeKnora-app 2>&1 | grep ERROR`
   —— UI 显示的 `EMBEDDING_RATE_LIMIT` 是 WeKnora 笼统包装，真凶要看日志里 API 返回体
2. **模型配置在 postgres**：库名 `WeKnora`，表 `models`，密码在 `.env`（DB_PASSWORD）
   ⚠️ `api_key` 字段是 `enc:v1` 前缀的**密文**（AES 加密存储），导出来直接调 API 会报 invalid_api_key
3. **进度监控**：
   - 向量落库数：`select count(*) from embeddings e join chunks c on e.chunk_id=c.id where c.knowledge_id='...'`
   - 后处理进度：UI 轮询接口里的 `pending_subtasks_count`（590 批递减）
   - 注意：embedding 整批完成才落库，中途失败 = 0 条 + 重试从头再来
4. **错误时间戳对齐**：UI 会回显旧失败文档的历史 error_message，别被"幽灵错误"吓到
5. **百炼错误速查**：`insufficient_quota`（两种文案）= TPM 限流，去控制台"限流提额"；
   欠费是另一个码 `Arrearage`

## 六、遗留事项（明天待办）

- [ ] 好好逛 Wiki 页面，检验 qwen-plus 归纳的词条质量
- [ ] **图谱还是空白**：Neo4j 在可选 profile 没启动（`.env` 里 `NEO4J_ENABLE` 注释着），
      想要人物关系网 → 起 neo4j + 开 `graph_enabled` + 重解析（本地模型可免费重嵌）
- [ ] `CONCURRENCY_POOL_SIZE=1` 还在 .env：以后用本地模型/已提额时可调回 5
- [ ] 清理旧失败知识库残骸（first-try、冰与火之歌 旧库）
- [ ] "问题生成"开关在知识库设置里（本次没关，多花了 ~¥9；小说场景建议关）

## 七、关机与重启

```bash
# 关机（数据全在卷里，安全）
cd D:\WeKnora\WeKnora-0.7.2\WeKnora-0.7.2 && docker compose down   # ⚠️ 别带 -v！

# 重启
docker compose up -d   # 然后开 http://localhost
```
