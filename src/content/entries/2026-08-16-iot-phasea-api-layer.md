---
title: "IoT 项目 Phase A：Java REST 数据服务层完成"
date: 2026-08-16
category: 技术
tags: [iot, java, api, 日记归档]
draft: false
---

**日期**：2026-08-16（深夜收工）
**状态**：✅ 9/9 任务完成，最终全分支审查 **CLEAN**，分支处置待明天决定
**分支**：`feat/iot-pipeline`（领先 main 33 commit，含 Phase 1-4 + Phase A）

---

## 一、交付了什么

Spring Boot 3.5.3 数据服务层 `api-service/`（端口 8000），聚合六库只读查询，**M1 验收 17/17 全过，测试 26/26 绿**。

| 层 | 内容 |
|---|---|
| 安全 | X-API-Key 过滤器（dev-key-001），跳过 /healthz /swagger-ui /v3/api-docs |
| 接口 ×10 | /devices 列表详情(Redis状态合并)、/latest(毫秒级)、/history(TDengine)、/raw(Mongo)、/search/logs + /alerts(ES)、/analytics/agg + /top-devices(ClickHouse)、/healthz |
| 探针 | StorageProbe SPI 六库聚合（mysql/redis/tdengine/mongodb/elasticsearch/clickhouse），坏一库→degraded 503 |
| 错误契约 | 401 unauthorized / 400 invalid_param / 404 not_found / 405 method_not_allowed / 503 storage_unavailable / 500 internal，统一体 `{"error","detail"}` |
| 防注入 | deviceId 全部 @Pattern `^[A-Za-z0-9_-]{1,64}$` + Metric/Interval/AggFunc 枚举白名单 |
| 脚本 | start.ps1/stop.ps1 一键起停（实测干净，8000 释放无 java 残留） |
| 文档 | api-service/README.md（六库表+10 接口表+构建/测试/示例）+ 根 README 索引 |

## 二、执行方式与质量数据

superpowers:subagent-driven-development：每任务 派实现者→任务级审查→FAIL 则修复轮→范围复审。全部子代理在后台串行接力，一次派一个。

- **13 个 commit**（c12fc25 计划 → 76477a8 收尾修复），12 个审查包，1 次最终全分支审查（最强模型档）
- 任务审查：6 个一次 PASS；3 个 FAIL→R1 修复→PASS（Task 2/4/9）；最终审查 NEEDS_FIX(3项)→一个修复 commit→CLEAN
- 审查员自证能力名场面：反编译 spring-boot-autoconfigure jar 实证 DataSource 自动配置回退机制、javap 证实 elasticsearch-java 8.11.4 无 `.number()` API、对照 flink/Agg1minJob.java:113 源码核实 CH 时区 +8h 闭环

## 三、重要发现（复用价值最高）

1. **DataSource bean 红线**：为辅助库（TD/CH）暴露 DataSource/JdbcOperations bean 会顶掉 Boot 的 `DataSourceAutoConfiguration`（@ConditionalOnMissingBean 回退）→ MyBatis 绑错库、mysql 假 ok。修法：DataSource 内联不出 bean + 手工补 `mysqlJdbcTemplate`。**单测切片对此失明（@Configuration 不进 @WebMvcTest），只有真机能暴露。**
2. **Redis 异常分类**：spring-data-redis 3.5.1 里命令超时是 `org.springframework.dao.QueryTimeoutException`、系统异常是 `RedisSystemException`——都不是 `RedisConnectionFailureException` 子类。catch 必须放宽到 `DataAccessException`，否则干净下机正常降级、挂死(超时)反而 500。
3. **Oracle javapath 垫片**：Windows 上 `Start-Process java` 解析到垫片 java.exe，它派生真 JVM 子进程；PID 表杀不净，stop 脚本必须 PID 表 + CIM 命令行兜底双层（实测缺一不可：垫片 21340 + 孤儿 JVM 24288）。
4. **@Validated 校验异常双路径**：完整应用走 AOP→`ConstraintViolationException`，切片场景走内建→`HandlerMethodValidationException`——handler 要两个都接，否则 400 落兜底 500。
5. **Flink 水位线特性**：事件时间水位只随新事件推进，模拟器停发后最后不满窗口永不触发属正常；判管道活性看表内数据新鲜度，别看 job 状态。

## 四、遗留（最终审查裁决 acceptable-as-is，25 条精选）

均不阻塞，多数已带护栏注释或 README 留痕：
- LatestService/DeviceService 已统一降级语义；探针无超时（六库全本机，/healthz 非热路径）
- ES `level` 参数收下未透传（README 已如实不载，Phase B 接线后写回）；ES 索引有 1 条验收种子文档 `_id=qba8CqABgR6u9itMxwRv`（keyword=overheat 验收依赖）
- TD/CH 用 DriverManagerDataSource 无连接池（演示可接受）；mysqlJdbcTemplate 放在 TdConfig 里（Phase B 拆 JdbcConfig 时挪）
- AnalyticsService SQL 用 String.format 拼接（插值全类型安全：enum/long/格式化时间；加自由文本参数必须改 ? 绑定）
- start.ps1 `-All -NoPython` 组合下 api-service 被静默跳过（头注释未说明）
- MysqlProbe 靠参数名匹配注入（未显式 @Qualifier，运行已验证）

## 五、明天的事

1. **分支处置三选一**：①本地合并回 main（33 commit 全进）②推远端建 PR ③继续留在 feat/iot-pipeline（Phase 1-4 一向如此）
2. Phase B（湖仓：MinIO+Iceberg+Trino，M2a-c）或 Phase C（anomaly 闭环，M3）——走同样的 brainstorm→plan→SDD 流程
3. 基建当前全在线：docker 六库 + 8 Python 服务 + Mosquitto（用户进程）+ Flink 两作业 RUNNING；api-service 已停（8000 空闲）。演示随时 `powershell -ExecutionPolicy Bypass -File scripts/start.ps1 -All`

## 六、面试可讲点（接 简历与面试准备.md 的 Q28/Q29）

- 六库选型各自视角 + 一层统一 REST 网关聚合（面试官爱问"为什么六个库"→现在有"每库一个最擅长的查询面"的完整答案）
- Spring 多数据源共存的三种坑（自动配置回退/限定符注入/异常分类），有 jar 级实证
- SDD 子代理流水线：12 commit 每个都过独立审查，FAIL 率 4/10 且全是计划逐字代码自带的 bug——"代码评审要独立验证机制，不能只看表面行为"
