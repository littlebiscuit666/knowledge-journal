---
title: "dbt + DuckDB + jaffle_shop 学习记录"
date: 2026-08-26
category: 技术
tags: [dbt, duckdb, 数仓, 日记归档]
draft: false
---

> 2026-08-26 | 从零安装 → 官方教学项目全流程跑通（seed/run/test/docs）
> dbt = 把 SQL 变成可测试、可追溯的"模型代码"；DuckDB = 零服务的本地分析数据库；jaffle_shop = 官方虚拟煎饼店教学项目

---

## 一、文件都在哪

| 内容 | 位置 |
|---|---|
| 项目总目录（含一切，删此即全清） | `D:\dbt-learn\` |
| Python 虚拟环境（dbt 装在这里，**没碰全局**） | `D:\dbt-learn\.venv\` |
| dbt 版本 | Core 1.12.3 + duckdb 插件 1.11.0 |
| jaffle_shop 教学项目 | `D:\dbt-learn\jaffle_shop\` |
| DuckDB 数据库文件（seed/run 的产物） | `D:\dbt-learn\jaffle_shop\jaffle_shop.duckdb` |
| 数据库连接配置（自己写的，新版仓库不带） | `D:\dbt-learn\jaffle_shop\profiles.yml` |
| 文档/血缘图产物 | `D:\dbt-learn\jaffle_shop\target\` |

## 二、当初怎么装的（备忘）

```cmd
:: 建独立环境（Python 3.11）
uv venv D:\dbt-learn\.venv --python 3.11

:: 装 dbt-duckdb（走清华镜像，不需要代理）
uv pip install --python D:\dbt-learn\.venv\Scripts\python.exe dbt-duckdb --index-url https://pypi.tuna.tsinghua.edu.cn/simple

:: 克隆官方教学项目（走 7890 代理直连 GitHub）
git clone --depth 1 -c http.proxy=http://127.0.0.1:7890 https://github.com/dbt-labs/jaffle_shop.git D:\dbt-learn\jaffle_shop
```

⚠️ 注意：`dbt init jaffle_shop` 只会生成**空白项目**，不会有教学模型——教学项目必须 clone 仓库。

## 三、日常命令（cmd 直接跑，不用激活环境）

都在项目目录跑，`--profiles-dir .` 让 dbt 读项目里的 profiles.yml：

```cmd
cd D:\dbt-learn\jaffle_shop

:: 导入 CSV 种子数据（seeds\raw_*.csv → 库里3张表）
D:\dbt-learn\.venv\Scripts\dbt.exe seed --profiles-dir .

:: 跑模型（3个staging视图 + 2个mart表，1秒内）
D:\dbt-learn\.venv\Scripts\dbt.exe run --profiles-dir .

:: 跑20个数据质量测试（非空/唯一/引用完整性）
D:\dbt-learn\.venv\Scripts\dbt.exe test --profiles-dir .

:: 重新生成文档
D:\dbt-learn\.venv\Scripts\dbt.exe docs generate --profiles-dir .
```

懒人版：先激活 venv 就不用写全路径了

```cmd
D:\dbt-learn\.venv\Scripts\activate
dbt seed --profiles-dir .
dbt run --profiles-dir .
dbt test --profiles-dir .
```

## 四、★ 文档服务（血缘图）怎么启动

```cmd
cd D:\dbt-learn\jaffle_shop
D:\dbt-learn\.venv\Scripts\dbt.exe docs serve --profiles-dir . --port 8085
```

- 浏览器开 **http://localhost:8085**
- `Ctrl+C` 停止服务
- ★ 必须 `--port 8085`：默认 8080 被 Docker 相关服务占用
- ★ 页面左下角"圆点图标"进 Lineage 血缘图，点节点看 SQL/测试/列
- 图标 404 是 dbt 1.12 静态资源小 bug，不影响使用

## 五、项目结构速览（jaffle_shop）

```
jaffle_shop\
├── profiles.yml          ← 连接配置（DuckDB两行：type/ path）
├── dbt_project.yml       ← 项目定义
├── seeds\                ← 原始CSV（raw_customers/orders/payments）
├── models\
│   ├── staging\          ← 清洗层（3个视图 stg_*，重命名/过滤）
│   ├── customers.sql     ← 汇总层：每客户终身价值（join stg层）
│   ├── orders.sql        ← 汇总层：订单宽表（金额/状态）
│   └── schema.yml        ← 模型描述+测试定义（20个测试在这）
└── jaffle_shop.duckdb    ← 跑出来的数据库（一个文件）
```

分层思想：**raw（脏数据）→ staging（标准化）→ mart（业务汇总）**，与数仓经典分层一致。

## 六、踩坑记录

- ★ 新版 jaffle_shop 仓库**没有 profiles.yml**（老教程都有）——需自建，内容就5行：
  ```yaml
  jaffle_shop:
    target: dev
    outputs:
      dev:
        type: duckdb
        path: jaffle_shop.duckdb
        threads: 4
  ```
- dbt 默认去 `~\.dbt\profiles.yml` 找配置——不想放用户目录就每条命令带 `--profiles-dir .`
- 后台跑 `docs serve` 时命令**别接 `| head`**：管道一关，serve 进程跟着死
- venv 里没 numpy：`duckdb` 的 `.df()` 会报错，用 `.fetchall()` 代替
- `dbt seed` 有个 deprecation 警告（MissingArgumentsPropertyInGenericTest，教学项目写法偏老），不影响

## 七、下一步学习建议

1. 打开 `models\customers.sql` 读懂它怎么 join 出终身价值
2. 动手实验：给 customers 加一列"订单总数"，`dbt run` 后刷新血缘图看列变化
3. 在 `schema.yml` 里给自己加一个测试（如某列 > 0），故意破坏数据看 `dbt test` 报错
4. 进阶方向：dbt 增量模型 / snapshot / macro；真实场景可把 DuckDB 换成你华为云 VPS 上的 MySQL（adapter 换一下就行）
