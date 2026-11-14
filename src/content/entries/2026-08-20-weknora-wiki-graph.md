---
title: "WeKnora Wiki 与图谱生成机制学习"
date: 2026-08-20
category: 技术
tags: [weknora, rag, 知识图谱, 日记归档]
draft: false
---

> 日期：2026-08-20
> 源码：`C:\Users\yaya\weknora`（v0.7.2，Go 后端）
> 本地部署：`D:\WeKnora\WeKnora-0.7.2\WeKnora-0.7.2`（Docker，冰与火之歌-2 已导入）
> 注意：v0.7.2 没有 taskflow DAG，后台管线 = asynq 队列 + 插件式 chat_pipeline

## 总览

Wiki 和图谱是**两套完全独立的机制**：

| | Wiki | 实体-关系图谱 |
|---|---|---|
| 本质 | LLM 写作的百科页面网络（Map-Reduce 流水线） | LLM 逐 chunk 抽取的实体关系图（GraphRAG local search） |
| 存储 | Postgres `wiki_pages` 等 4 张表 | Neo4j（SQL 库里没有图数据） |
| 生成粒度 | 按文档→按页面 | **按 chunk** |
| 边的语义 | 无（只是"正文提到了"） | 有关系类型（受白名单约束）+属性 |
| 实体去重 | LLM 判重，质量高 | apoc.merge 按裸名合并，易分裂 |
| 服务对象 | 人（浏览/编辑/导航）+RAG（页面进向量库 1.3x 加权） | 机器检索（实体邻域扩展召回） |
| 前置条件 | KB 开 Wiki | NEO4J_ENABLE + KB 两级开关，**当前未开** |

---

## 一、Wiki 生成全链路

### 1. 触发与调度——防抖设计

- 文档主流程（解析→切块→向量化）走完进入 postprocess：`internal/application/service/knowledge_post_process.go:78`
- `kb.IndexingStrategy.WikiEnabled && 有文本块` → 写持久队列 `task_pending_ops`（task_type="wiki:ingest"）
- 投 asynq 任务**延迟 30 秒**（`wiki_ingest.go:531`）——批量导入时攒批，省 LLM 钱
- 专用 worker 池 QueueWiki 并发 8（`internal/router/task.go:217`）；每批 5 篇文档、每 KB 最多 4 批在飞（Redis ZSET+Lua 信号量）

### 2. MAP 阶段（每篇文档，`wiki_ingest_batch.go:1151` mapOneDocument）

1. **拼回完整内容**：全部 chunk + OCR/caption 回填，但**截断 32768 字符**（`maxContentForWiki`）——超大单文件后半本实体抽不到（引证步骤是全量 chunk 的，证据不丢）
2. **Pass 0 抽候选骨架**：`WikiCandidateSlugPrompt`（`prompts_wiki.go:172`）只输出名字/slug/别名/≤300字描述，不写正文；粒度三档 Focused/Standard/Exhaustive 由 KB 配置
3. **去重**：pg_trgm 三元组相似度**免费预筛** + `WikiDeduplicationPrompt`（:449）LLM 精判——"只有同一真实事物的名称变体才能合并，related ≠ same"
4. **两路并行**（:1320-1361）：
   - A. `WikiSummaryPrompt`（:60）生成文档摘要页，首行强制 `SUMMARY:`，正文写 `[[slug|显示名]]` 双链
   - B. **分块引证**（`wiki_ingest_cite.go:256`）：全部 chunk 按 12000 字符分批，每批一次 `WikiChunkCitationPrompt` 判定"哪些实体被实质讨论"→ `{citations:{slug:[chunkID]}}` + 补漏 new_slugs。chunk 用 `c000` 短句柄防 LLM 抄错 UUID（`wiki_slug_handles.go`）
   - 引证建立**页面→原文可追溯性**（chunk_refs 字段）

### 3. 目录规划

`planBatchTaxonomy`（`wiki_ingest_taxonomy.go:32`）：每 ≤60 页一次 `WikiTaxonomyPlanPrompt` 分配最多 2 层目录；`wiki_folders` 邻接表是唯一真源，页面上的 path 是缓存。

### 4. REDUCE 阶段（按 slug 并行，`wiki_ingest_batch.go:1694`）

核心提示词对（`prompts_wiki.go:321/345`）：

- System：**COMPILER 编译器人设**，禁止创作/幻觉，chunk ID 不得出现在正文
- User 是结构化合并现场（XML 分段）：`<existing_page_content>` 旧页全文 + `<new_information>` 被 cite 的 **chunk 原文** + `<valid_wiki_links>` 白名单 + `<deleted_documents>` + 冲突检查指令
- **增量导入 = 旧页+新证据整体重编译**，不是追加段落 → 解决内容漂移
- 落库版本+1，旧版进 `wiki_page_revisions`（机器版保留 50 条）
- summary 页不调 LLM 直接覆盖；entity/concept 页走上述合并

### 5. 收尾 finalize（KB 级防抖 20s，`wiki_ingest_batch.go:911`）

- 重建 Index 页：首次 `WikiIndexIntroPrompt`；增量 `WikiIndexIntroUpdatePrompt`（只喂 document_added/removed 变更）
- `cleanDeadLinks` / `injectCrossLinks`（纯文本操作不花 LLM 钱）/ 剪空目录（等队列清空）
- 失败 op 重试 5 次进死信表 `task_dead_letters`；重启恢复 `container/recover_pending_wiki_tasks.go:32`

### 6. LLM 调用工程细节（`wiki_ingest.go:2449`）

Temperature 0.3；MaxTokens **32768**（防 DeepSeek 默认 8192 截断 JSON）；3 次重试 2s 退避；singleflight 合并在飞请求；引证提示词静态规则前置吃 provider 前缀缓存。

### 7. 读取侧

- HTTP API：`routes_knowledge.go:294-333`（列表/详情/搜索 pg_trgm/版本/回滚/lint 体检+自动修复）
- 检索增强：wiki 页切块（chunk_type=`wiki_page`）进向量库，`chat_pipeline/wiki_boost.go` rerank 后 **1.3x 加权**
- wiki-qa 智能体工具集：`wiki_read_page` / `wiki_search` / `wiki_read_source_doc`（用 chunk_refs 回读原文）/ `wiki_write_page`（Agent 可写 synthesis 页）等，`internal/agent/tools/wiki_*.go`
- 链接图 API：`GET /wiki/graph`（overview / ego BFS），数据就是 in_links/out_links

### 8. 数据模型（`internal/types/wiki_page.go`）

| 表 | 说明 |
|---|---|
| `wiki_pages` | slug KB 内唯一；page_type=summary/entity/concept/index/synthesis/comparison；source_refs（文档级）+chunk_refs（chunk 级）；in/out_links 双链；folder_id |
| `wiki_page_revisions` | 不可变版本快照，机器版 50 / 硬上限 200 |
| `wiki_folders` | 目录邻接表 |
| `wiki_page_issues` | Agent/lint 标记的问题 |

slug 约定：`entity/<kebab>`、`concept/<kebab>`、`summary/<slugify(knowledgeID)>`（故意不用文件名防幻觉）。

删除文档反向链路：`knowledge_delete.go:226` 写 Redis 墓碑 + retract 任务。

---

## 二、实体-关系图谱（GraphRAG，未开）

### 1. 两套代码，一套活一套死

- **现役**：Neo4j 管线 `ChunkExtractService`（`internal/application/service/extract.go`）
- **死代码**：内存版 `NewGraphBuilder`（`graph.go:77`）全仓库零引用；config.yaml 的 `prompt_templates/graph_extraction.yaml` 两个模板只被死代码用，**对现役管线无效**
- 现役提示词来自 config.yaml `extract.extract_graph` 段（两步走：实体抽取+属性富化 → 关系抽取+校验），`%s` 用 KB 的 Tags 白名单填充，few-shot 来自 KB extract_config
- **没有 Leiden/社区发现/社区摘要/global search**——只有 local search

### 2. 三层开关

1. 部署级 `NEO4J_ENABLE=true`（.env；不开则入库不投任务、查询直接跳过，零开销）
2. KB 级：`indexing_strategy.graph_enabled` **且** `extract_config.enabled` 同时为 true；后者要求 text/tags/nodes/relations 配置齐全
3. 单次上传可按文件覆盖

### 3. 入库（每 chunk 恰好 1 次 LLM）

```
chunk → 拼 prompt（模板+KB自定义指令+关系白名单+few-shot）
      → 1 次 LLM（temp 0.3 / maxTokens 4096 / 模型=KB 的 SummaryModelID）
      → ParseGraph 剥 ```json 围栏（截断兜底）
      → rebuildGraph：按名字合并节点、丢自环、补缺失端点
      → Neo4j：apoc.merge.node + apoc.merge.relationship
```

Neo4j 结构：节点 label = `ENTITY<kbID>_<knowledgeID>`（**按文档隔离**，跨文档不合并！）；属性 `{name, kg, attributes[], chunks[]}`——chunks[] 是图与原文的连接点。asynq 任务 type="chunk:extract"，queue="graph"，重试 3 次。

删除路径：`DelGraph` 按 kg 批量删（重解析/删知识/删 KB 时调用）。

### 4. 查询期（session_knowledge_qa.go 管线）

```
[QUERY_UNDERSTAND] PluginExtractEntity：1 次 LLM 从问题抽实体
[CHUNK_SEARCH_PARALLEL] 向量检索 ∥ 实体检索：
    SearchNode: MATCH (n)-[r]-(m) WHERE n.name CONTAINS 实体名（子串匹配+1跳邻居）
    filterSeenChunk：剔除向量已命中的 chunk（图谱只做增量召回）
    → Score=1.0 / MatchType=graph 进统一 rerank 池
```

注意：CONTAINS 是子串匹配，实体名对不上就查不到。Agent 工具 `query_knowledge_graph` 名字唬人但不查 Neo4j（普通混合检索+可视化配置状态，Cypher 支持标注 under development）。

### 5. 成本

入库：**每个文本类 chunk 1 次 LLM**（含 OCR/caption）；查询：每次提问 +1 次。冰与火之歌-2 有 **12727 chunk ≈ 12727 次调用**，且百炼 TPM 限流 CONCURRENCY_POOL_SIZE=1 串行——十几小时起步，费用数倍于 Wiki 的 ¥15。**建议先建小 KB 导一卷验证效果再决定全书重建**（存量文档不会自动建图，需重新导入）。

### 6. 开启步骤（等周日开 Clash）

```bash
docker pull neo4j:2025.10.1        # WeKnora compose 用同款镜像
# .env 取消注释：NEO4J_ENABLE=true / NEO4J_URI / USERNAME / PASSWORD(设真密码)
cd /d/WeKnora/WeKnora-0.7.2/WeKnora-0.7.2 && docker compose --profile neo4j up -d
# 验证：http://localhost:7474 进 Neo4j Browser；系统状态 GraphDatabaseEngine=Neo4j
# 前端 KB 设置勾选图谱 + 配置 tags(关系白名单)/nodes/relations(示例)
```

---

## 三、Wiki 链接图 vs 实体-关系图谱（易混淆点）

- **Wiki 链接图**：页面正文 `[[双链]]` 的副产品，存 in_links/out_links 两个字段；边无语义、自动维护（injectCrossLinks/cleanDeadLinks）；给人导航用，**不参与 RAG 检索**；实体去重质量高（Reduce 阶段 LLM 判重过）
- **实体图谱**：专门的图存储（Neo4j）；边有关系类型+属性；节点挂 chunks 做检索索引；给机器用；实体按裸名合并易分裂
- 两者节点集相似但构建不同（文档级合成 vs chunk 级抽取），恰好互补

---

## 四、冰与火实例数据印证（2026-08-20 查库）

- 冰与火之歌-2：385 wiki 页 = 355 entity + 28 concept + 1 summary + 1 index，max_depth=2
- 提利昂页 aliases=`["提利昂","小恶魔","侏儒提利昂"]`、chunk_refs 一串 UUID（引证机制产物）；库里存在两个略不同的提利昂页（去重是概率性的）
- 龙蛋页 in_links 指向 dany/illyrio 等页（双链解析产物）
- spans 遥测：postprocess.wiki.extract 336 次 ~4.6s/次、wiki.classify ~110s 最重、wiki.page[entity/xxx] 逐页生成可见
- 全库 81 篇文档跑过 wiki 管线

## 五、最值得记住的三个设计

1. **"骨架→引证→编译"三段式**：出名单、配证据、做合并，三次便宜调用替代一次黑盒"读完全书写百科"，每步可校验可追溯
2. **COMPILER 人设 + 增量重编译**：旧页+新证据整体重编译而非追加，配合版本快照解决增量漂移
3. **两个图各取所长互补**：Wiki 图实体归并好/边无语义；Neo4j 图边有语义/实体易分裂

## 六、源码速查

| 模块 | 文件 |
|---|---|
| Wiki 流水线核心 | `internal/application/service/wiki_ingest.go`（3137行）、`wiki_ingest_batch.go`、`wiki_ingest_cite.go`、`wiki_ingest_dedup.go`、`wiki_ingest_taxonomy.go` |
| Wiki 提示词（11 个全在此） | `internal/agent/prompts_wiki.go` |
| Wiki 触发点 | `knowledge_post_process.go:179,402`、`knowledge_delete.go:226` |
| Wiki 读写服务/API | `wiki_page.go`、`handler/wiki_page.go`、`routes_knowledge.go:294-333` |
| 图谱入库 | `internal/application/service/extract.go:223-407` |
| 图谱查询插件 | `chat_pipeline/extract_entity.go`、`search_entity.go` |
| Neo4j 仓储 | `neo4j/repository.go` |
| 数据模型 | `internal/types/wiki_page.go`、`indexing_strategy.go`、`knowledgebase.go:801`（IsGraphEnabled） |
| 队列定义 | `internal/types/task.go`、`internal/router/task.go` |
| 图谱文档 | `docs/KnowledgeGraph.md`、`docs/wiki/核心功能/开启知识图谱功能.md` |

---

## 附：Neo4j 单独学习路线（与 WeKnora 无关）

```bash
docker run -d --name neo4j-learn -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/learn123456 -v neo4j-learn-data:/data neo4j:2025.10.1
```

1. Browser（http://localhost:7474）输入 `:play start` / `:play movie-graph` / `:play cypher` 跟自带教程
2. Cypher 五招：CREATE / MATCH / MERGE（≈UPSERT）/ 变长路径 `*1..3` / `shortestPath`
3. 练手项目：手工建冰与火人物-家族小图（BELONGS_TO / KNOWS 带属性的关系），再用 shortestPath 查人物关系链——正好体会 WeKnora 图谱在自动做什么
4. Python：`pip install neo4j`，`GraphDatabase.driver("bolt://localhost:7687", auth=...)`
5. 进阶：索引约束（`CREATE INDEX FOR (p:Person) ON (p.name)`）、APOC（镜像自带）、图数据建模、GraphAcademy 免费课程（有中文）

⚠️ 学习容器占 7474/7687；以后开 WeKnora 图谱前先 `docker stop neo4j-learn`（同镜像不用重拉）。
