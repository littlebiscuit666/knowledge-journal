---
title: "DataX 实战：银行模拟数据的 ETL 全流程"
date: 2026-09-04
category: 技术
tags: [datax, etl, 数据同步, 日记归档]
draft: false
---

> 目标：用 DataX 走完一遍完整 ETL 流程——以"银行核心系统"为模拟源，把客户/机构/交易/渠道数据
> 抽取(E)装载(L)到贴源层 ODS，再用 SQL 清洗、标准化、关联、汇总(T)成数仓主题层和汇总层。
> 所有环境都在本机：MySQL 8.0 Docker 容器 + 解压版 DataX，零依赖外部服务。

---

## 一、环境

| 组件 | 版本/位置 | 说明 |
|---|---|---|
| MySQL | Docker 容器 `mysql8-lab` | 端口映射 3307，root/music123 |
| DataX | `D:\zcode-workspace\datax` | 开源版 202309，约 1.6GB |
| Java | 25.0.2 | DataX 官方要求 JDK 8，实测 Java 25 可跑，仅弃用警告 |
| Python | 3.11.9 | 只用来启动 datax.py |

**DataX 启动入口**：`D:\zcode-workspace\datax\bin\datax.py`
**通用命令格式**：`python D:\zcode-workspace\datax\bin\datax.py <作业.json>`

---

## 二、下载 DataX 的坑（重要，别再走弯路）

1. **GitHub releases 上没有编译好的 DataX**！releases 页面只有 "Source code (zip/tar.gz)"，
   下载下来是纯源码（15MB，全是 pom.xml），必须 Maven 编译才能用，别下这个。
2. 官方编译版托管在**阿里云 OSS**，地址必须带日期路径段：

   ```
   https://datax-opensource.oss-cn-hangzhou.aliyuncs.com/202309/datax.tar.gz
   ```

   不带 `/202309/` 直接访问会 403。国内直连速度约 6MB/s。
3. **完整性自查**：压缩包应约 1.6GB（我第一次只下到 137MB，解压报 `unexpected end of file`）；
   解压后应有 `bin / conf / job / lib / plugin` 目录，`plugin` 下 reader/writer 各十几个插件。

---

## 三、数据流全貌

物理上所有库都在同一个 MySQL 容器里，用三个 database 模拟三个"系统"：

```
src_core（模拟银行核心交易系统）
    │  ① E+L：DataX 4 个作业（只搬运，不加工）
    ▼
ods_bank（贴源层：表结构与源系统一一对应，码值原样保留）
    │  ② T：SQL 加工（清洗→码值标准化→关联维度→预聚合）
    ▼
dw_bank（dim 维度层 / dwd 明细主题层 / ads 汇总层）
```

外加一个**异构源**：`D:\etl_demo\data\dim_chnl.csv`（渠道映射文件，模拟从文件接口接数）。

---

## 四、第 ① 步：建库造数（模拟源系统）

脚本：`D:\etl_demo\01_seed_source.sql`

```bash
docker exec -i mysql8-lab mysql -uroot -pmusic123 --default-character-set=utf8mb4 < D:\etl_demo\01_seed_source.sql
```

产出：`src_core` 6 机构 / 15 客户 / 508 笔交易（500 笔 CTE 随机生成 + 8 笔手工脏数据）。
`ods_bank`、`dw_bank` 两库同时创建，`02_create_dw_tables.sql` 负责建目标表。

**故意埋的 8 笔脏数据**（后面清洗环节验证用）：
- 姓名 `" 李娜 "` 带空格；客户 C0011 手机号为 NULL
- 负金额 -50.00；未知交易码 9999；未知渠道码 099
- 2 笔失败交易（jnl_sts='1'）

---

## 五、第 ② 步：DataX 作业配置（E+L）

4 个作业在 `D:\etl_demo\job\`：

| 作业 | reader | writer | 数据量 |
|---|---|---|---|
| job1_cust_mysql2ods.json | mysqlreader（table 模式） | mysqlwriter（replace） | 15 行客户 |
| job2_txn_mysql2ods.json | mysqlreader（**querySql 模式**，带日期增量过滤） | mysqlwriter（**insert**） | 508 行交易 |
| job3_org_mysql2ods.json | mysqlreader | mysqlwriter（replace） | 6 行机构 |
| job4_chnl_file2ods.json | **txtfilereader**（读 CSV 文件） | mysqlwriter | 3 行渠道映射 |

### 关键配置项

```json
"setting": {
  "speed":     { "channel": 1 },   // 并发通道数，调大=多线程并行搬运
  "errorLimit":{ "record": 0 }     // 容错额度，0=错一条整个作业失败
}
```

- **table 模式**：配 `table` + `column`，整表平搬；
- **querySql 模式**：自己写 SELECT（可带 WHERE 过滤/多表 JOIN），
  ⚠️ **querySql 必须写在 connection 对象内部（与 jdbcUrl 平级）**，写在 parameter 顶层会报
  `table和querySql应该并且只能配置一个`；
- **writeMode**：`insert` 纯插入（重复跑会翻倍）/ `replace` 主键覆盖（可重复跑）；
- reader 的 SELECT 列 与 writer 的 `column` 列**顺序必须严格对齐**，DataX 按位置传输。

---

## 六、第 ③ 步：T 加工 SQL

脚本：`D:\etl_demo\03_transform.sql`

```bash
docker exec -i mysql8-lab mysql -uroot -pmusic123 --default-character-set=utf8mb4 < D:\etl_demo\03_transform.sql
```

四层加工逻辑：

1. **维度层**：ods 机构/渠道 → `dim_org`、`dim_chnl`；
2. **客户主题 `dwd_cust`**：TRIM 姓名、证件类型源码 `0/1 → 10/20`、状态 `00/01 → 1/3`、
   手机号缺失打 `IS_SUSPECT=1` 质量标记；
3. **交易主题 `dwd_txn`**：`WHERE jnl_sts='0'` 剔除失败交易、负金额 `ABS` 修正、
   交易码 CASE 标准化（未知→'其他'）、JOIN 渠道映射表翻译标准渠道码（未知→'99'兜底）；
4. **汇总层 `ads_org_txn_daily`**：按 机构×日期 GROUP BY，算笔数/收入/支出/客户数——
   报表直接取这张宽表，不用再扫明细（预聚合换性能）。

---

## 七、完整跑批命令（可整段重放）

```cmd
:: 0. 清空 ODS（job2 是 insert 模式，重跑前必须清，否则翻倍）
docker exec mysql8-lab mysql -uroot -pmusic123 -e "TRUNCATE ods_bank.ods_core_cust_info; TRUNCATE ods_bank.ods_core_txn_jnl; TRUNCATE ods_bank.ods_core_org_info; TRUNCATE ods_bank.ods_dim_chnl"

:: 1. E+L：四个 DataX 作业
python D:\zcode-workspace\datax\bin\datax.py D:\etl_demo\job\job1_cust_mysql2ods.json
python D:\zcode-workspace\datax\bin\datax.py D:\etl_demo\job\job2_txn_mysql2ods.json
python D:\zcode-workspace\datax\bin\datax.py D:\etl_demo\job\job3_org_mysql2ods.json
python D:\zcode-workspace\datax\bin\datax.py D:\etl_demo\job\job4_chnl_file2ods.json

:: 2. T：加工
docker exec -i mysql8-lab mysql -uroot -pmusic123 --default-character-set=utf8mb4 < D:\etl_demo\03_transform.sql
```

> 乱码解决：cmd 里先执行 `chcp 65001`（终端切 UTF-8），DataX 中文日志就正常了。

---

## 八、验证结果

| 层 | 表 | 行数 | 说明 |
|---|---|---|---|
| ODS | ods_core_cust_info | 15 | 与源一致 |
| ODS | ods_core_txn_jnl | 508 | 与源一致 |
| ODS | ods_dim_chnl | 3 | 文件接入 |
| DW | dwd_cust | 15 | 全保留，问题字段打标 |
| DW | dwd_txn | **506** | 508 − 2 笔失败被清洗 ✅ |
| ADS | ads_org_txn_daily | 146 | 机构×日期组合 |

脏数据处理逐项验证过：空格姓名被 TRIM、负金额变 +50、9999→'其他'、099→'99'、
失败 2 笔被过滤、渠道码经 CSV 映射表翻译成 10/20/30。

---

## 九、今天踩的坑（经验值）

1. **DataX 下载**：GitHub releases 只有源码；编译版在阿里云 OSS 且地址带 `/202309/` 路径段；
   压缩包约 1.6GB，注意校验完整性。
2. **querySql 位置**：必须放 connection 里，放 parameter 顶层直接报错。
3. **DataX 不建表、不去重**：目标表要自己先建好；insert 模式重复跑会翻倍，
   生产上一般配 `preSql: ["TRUNCATE TABLE ..."]` 让作业自清理。
4. **DataX 的真实搬运很慢吗？不**：508 行实际只花 0.4s，整个作业 10s 几乎全是 JVM 启动开销。
5. **Java 25 跑 DataX**：能用，只有 `sun.misc.Unsafe` 弃用 WARNING，无视即可。
6. **占位符别直接复制运行**：示例命令里的 `你的作业.json` 要替换成真实路径。

---

## 十、概念对照（本次实验 ↔ 生产环境）

| 本次实验 | 生产银行 |
|---|---|
| src_core 库 | 另一台主机上的核心交易系统 |
| ods_bank / dw_bank 库 | Teradata / Hadoop 集群上的数仓 |
| DataX JDBC 拉取 | OGG / DataX / Flink CDC 采集 |
| 手工依次执行命令 | Control-M / DolphinScheduler 调度几千个作业 |
| ads_org_txn_daily 宽表 | 供报表/监管报送的集市层 |

后续可玩：交易作业加增量 WHERE 模拟日终跑批、ADS 结果接 Metabase 出报表、
用 ClickHouse 容器当集市层写 `mysqlreader → clickhousewriter` 作业。

---

# 附一：MySQL 查询优化——美团经典文章笔记

来源：美团技术团队《MySQL索引原理及慢查询优化》(2014)
https://tech.meituan.com/2014/06/30/mysql-index.html
作者当时专职慢查询优化，手上过百真实案例。原理部分至今完全成立，
个别细节按 MySQL 8.0 修正（见附二实测）。

## 1. 索引为什么快：只需要记住三件事

1. **磁盘 IO 是万恶之源**：一次磁盘 IO 约 9ms（寻道 5ms + 旋转延迟 4.17ms），
   CPU 每秒能执行 5 亿条指令——一次 IO = CPU 执行 40 万条指令的时间。
   索引设计的唯一目标：**把查找的磁盘 IO 次数压到常数级**。
   操作系统"按页预读"（一次 IO 读 4K/8K 整页）是 B+树工作的前提。
2. **B+树 = 3 次 IO 定位百万数据**：非叶子节点只存"指路"的索引项，
   真实数据全在叶子节点。3 层 B+树能表示上百万数据。
3. **由树结构推出的两条铁律**：
   - IO 次数 = 树高 → **索引字段要尽量小**（int 比 bigint 让树更矮一半）；
   - 复合索引按从左到右建搜索树 → **最左匹配特性**。

## 2. 建索引五大原则（原文核心干货）

1. **最左前缀匹配**：一直向右匹配，**遇到范围查询（>、<、between、like）就停止**。
   `a=1 and b=2 and c>3 and d=4` 建 (a,b,c,d) 则 d 用不到；建 (a,b,d,c) 则全部用上。
2. **= 和 in 可以乱序**：优化器会自动调整成索引能识别的形式。
3. **选区分度高的列**：区分度 = count(distinct col)/count(*)，
   唯一键是 1，状态类字段趋近 0；**join 字段建议 0.1 以上**。
4. **索引列不能参与计算（保持列干净）**：
   `from_unixtime(create_time)='2014-05-29'` 用不上索引，应写成
   `create_time = unix_timestamp('2014-05-29')`——函数挪到常量侧。
   （MySQL 8.0 虽已支持函数索引，但最干净的写法仍是后者。）
5. **尽量扩展现有索引，不要新建**，避免索引膨胀拖累写入。

## 3. 慢查询优化标准流程（6 步工作法）

```
0. 先跑一遍确认真的慢（SQL_NO_CACHE 排除缓存假象）
1. 拆解 where 条件，逐字段查区分度，锁定"返回记录最少"的表
2. explain 验证执行计划是否符合预期
3. order by limit 型语句，让排序的表优先驱动
4. 【关键】找业务方了解使用场景
5. 按五大原则加索引
6. 观察结果，不达预期回到第 0 步
```

核心指标只有一个：**explain 的 rows——优化慢查询本质上就是把 rows 降下来**。

## 4. 三个经典案例

| 案例 | 现象 | 解法 | 效果 | 启示 |
|---|---|---|---|---|
| ① 复杂 SQL 改写 | join 的 ON 里带 or，派生表 63727 行大部分白构造 | 拆成两条 SQL 用 union（需去重）连接，join 条件下沉 | 1.87s→0.01s（200 倍） | or 条件常导致索引失效，拆分下沉是标准解法 |
| ② 低区分度也能建索引 | accurate_result（-1/0/1）理论上不该建索引 | 业务每 5 分钟只扫约 1000 条待处理数据 → 建 (accurate_result, sync_status) 联合索引 | 6.22s→0.20s（30 倍） | 区分度理论有边界，**数据分布 + 业务场景才是最终依据** |
| ③ order by limit 陷阱 | explain 各表 rows 都不大却查 13s，实际 join 后 77 万行排序 | 改 exists 先排序再 join | 13s→0.00s，但换参数变 2min18s | **不是所有 SQL 都能优化；优化要测极端参数** |

> 金句：任何数据库层面的优化都抵不上应用系统的优化。
> 同样的 MySQL，可以支撑 Google/淘宝，也可能连个人网站都撑不住。

---

# 附二：EXPLAIN 查询计划实测（本机 src_core.core_txn_jnl，508 行）

为做实验给交易表加了 4 个索引：`idx_cust(cust_no)`、`idx_dt(txn_dt)`、
`idx_dc(dc_flag, txn_cd)`、`idx_cust_dt(cust_no, txn_dt)`。
（重跑 01_seed_source.sql 会连库带索引全部重建，不影响实验环境。）

## 1. 三种形态

```sql
EXPLAIN SELECT ...;              -- 传统表格：优化器"打算"怎么做（估算）
EXPLAIN FORMAT=TREE SELECT ...;  -- 8.0 树形：计划结构一目了然
EXPLAIN ANALYZE SELECT ...;      -- 8.0.18+：真执行，显示实际耗时/行数
```

实测对比：`rows=40` 是估算，`actual rows=40` 是真实值，
两者差距大说明统计信息过期（ANALYZE TABLE 刷新）。大表慎用 ANALYZE（会真执行）。

## 2. 输出列速查

| 列 | 说明 |
|---|---|
| id | 相同 id 自上而下；子查询 id 递增，**大 id 先执行** |
| select_type | SIMPLE / PRIMARY / SUBQUERY / DERIVED（派生表，美团案例①元凶） |
| type | **访问方式，最重要**，见下表 |
| possible_keys | "可能用得上"的索引（≠会用） |
| key | **实际选用的索引**，NULL = 没用索引 |
| key_len | **实际用到的索引字节数**，判断联合索引用了几列 |
| ref | 索引在跟什么匹配（const=常量 / 驱动表的列） |
| rows | **预估扫描行数——优化的北极星** |
| filtered | 按 WHERE 过滤后剩余百分比 |
| Extra | 补充信息（filesort 等报警在这） |

## 3. type 等级制：system > const > eq_ref > ref > range > index > ALL

| type | 含义 | 本机实测 |
|---|---|---|
| const | 主键/唯一键等值，最多 1 行 | `jnl_no='JNLDIRTY000001'` → 1 行 |
| eq_ref | JOIN 被驱动表走主键/唯一键 | cust 表作为常量表被 PK 命中 |
| ref | 普通索引等值 | 加索引后 cust_no 查询：508→40 行 |
| range | 索引范围扫 / LIKE '前缀%' | `LIKE 'JNL%'` 走 PRIMARY range |
| index | 扫整棵索引树（仍是全量） | — |
| ALL | 全表扫 | 无索引时 508 行全扫 |

经验目标：核心 OLTP 查询保住 ref 以上；百万行表出现 ALL 基本就要优化了。

## 4. key_len 实测：联合索引用了几列，字节长度不会说谎

公式：列定义字节数 + 2（varchar 长度前缀）+ 1（允许 NULL），utf8mb4 每字符 4 字节。
cust_no varchar(20) = 80+2+1 = **83**；txn_dt DATE = 3+1 = **4**。

```
联合索引 idx_dc(dc_flag, txn_cd)：  dc_flag char(1)=5；txn_cd varchar(6)=27

WHERE dc_flag='1'                    → key_len=5    只用第 1 列（rows 254）
WHERE dc_flag='1' AND txn_cd='1001'  → key_len=32   两列全用（rows 254→72）
WHERE txn_cd='1001'                  → type=ALL     跳过第 1 列，索引废掉
WHERE cust_no='C0001' AND txn_dt>='2026-08-25' → key_len=87(83+4) 两列全用
  Extra: Using where; Using index    → 覆盖索引生效，连回表都省了
```

口诀：建了 (a,b,c) 索引，key_len 只算出 a 的长度 = 查询只吃到索引前缀。

## 5. Extra 高频值

| Extra | 含义 | 态度 |
|---|---|---|
| Using index | 覆盖索引，零回表 | ✅ 喜报 |
| Using index condition | ICP：引擎层先用索引列过滤再回表 | ✅ 良好 |
| Using where | 服务层再过滤一遍 | ➖ 正常 |
| Using filesort | 排序无法用索引，额外排一次 | ⚠️ 大结果集要优化 |
| Using temporary | 建了临时表（GROUP BY/DISTINCT/派生表） | ⚠️ 重点关注 |
| Using join buffer | JOIN 无索引，靠内存块批量匹配 | ⚠️ 给关联字段加索引 |

## 6. 两个反直觉现象（实测原样记录）

1. **有索引 ≠ 走索引**：`txn_dt >= '2026-08-25'` 有 idx_dt 却走了全表扫
   （possible_keys 有它，key=NULL）。filtered=32.87%：范围覆盖约 1/3 数据，
   优化器算账后认为走索引的 170 次随机回表不如顺序全扫。
   **成本决策不是 bug**：百万行表 + 1% 选择率时它自然会走。
2. **函数包裹让索引隐身**：`DATE(txn_dt)='2026-08-25'` 建了索引依然全表扫、
   possible_keys=NULL。B+树存的是原始值，套函数后每行都要算一遍，
   有序性失效。改成 `txn_dt='2026-08-25'` 后 rows 508→21。
   同理：字符串列用数字比较（隐式 CAST）也会失效，varchar 比较记得带引号。

彩蛋：JOIN 查询里 `SELECT t.jnl_no` 显示 Using index——
**InnoDB 二级索引叶子节点自动携带主键**，jnl_no 恰是主键，白嫖覆盖索引。

## 7. 实战 Checklist（拿到 EXPLAIN 先看五处）

1. type 是 ALL/index？→ 大表亮红灯
2. key 是 NULL？→ 没走索引：没建 / 函数包裹 / 隐式转换 / 选择率太低
3. key_len 没用满联合索引？→ 按字节算用到第几列
4. Extra 有 filesort/temporary？→ 大结果集必须处理
5. rows 估算与实际返回行数的比值——比例越差白扫越多，优化就是把它打下去
