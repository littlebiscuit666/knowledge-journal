---
title: "IoT 项目启动 / 停止命令速查（PowerShell / cmd / Git Bash）"
date: 2026-08-11
category: 技术
tags: [iot, kafka, 速查, 日记归档]
draft: false
---

> 项目：`D:\Big-Data` IoT 数据流学习项目（模拟器 → Mosquitto → Kafka → Flink + 6 库消费者 → 6 库）
> 日期：2026-08-11
> 适用：Windows 11，Docker Desktop，本机 Mosquitto，Python venv 在项目根 `.venv\`
>
> **怎么用这份文档**：先看 §0 的「五种 shell 差异」表（理解了就一通百通），再按 §1 启动顺序 / §2 停止顺序 操作。每个命令尽量给三种写法，**完全一致的标「三 shell 通用」只写一次**。

---

## §0 先懂这五种差异（核心）

| 差异点                           | PowerShell                       | cmd（命令提示符）                                          | Git Bash                          |
| -------------------------------- | -------------------------------- | ---------------------------------------------------------- | --------------------------------- |
| **切到项目目录**（跨盘符） | `cd D:\Big-Data`               | `cd /d D:\Big-Data`（**`/d` 必带**，否则不切盘） | `cd /d/Big-Data`                |
| **路径分隔符**             | `\` 或 `/` 都认              | `\`（`/` 多数情况也认）                                | `/`                             |
| **一行写不下续行**         | 反引号`` ` ``（行尾）            | 脱字符`^`（行尾）                                        | 反斜杠`\`（行尾）               |
| **设环境变量**             | `$env:MSYS_NO_PATHCONV="1"`    | `set MSYS_NO_PATHCONV=1`                                 | `export MSYS_NO_PATHCONV=1`     |
| **激活 venv**              | `.\.venv\Scripts\Activate.ps1` | `.venv\Scripts\activate.bat`                             | `source .venv/Scripts/activate` |

> 不想激活 venv 也行 —— 全程用全路径 `.venv\Scripts\python.exe`（PS/cmd）或 `.venv/Scripts/python.exe`（bash）直接调，下面命令默认这么写。

### ⚠️ Git Bash 独有大坑：`MSYS_NO_PATHCONV`

Git Bash（MSYS2）会把**命令行里以 `/` 开头的参数**当成 Windows 路径转换，于是容器内路径 `/opt/flink/xxx.jar` 被误转成 `C:/Program Files/Git/opt/flink/xxx.jar`，docker 找不到文件。

- **只影响 Git Bash**，PowerShell / cmd 不会做这种转换。
- **只影响含 `/开头路径参数` 的命令**（如 `docker exec ... /opt/flink/...`、`docker run -v /app`）。
- 解决：Git Bash 里先 `export MSYS_NO_PATHCONV=1` 再跑（PowerShell/cmd **不要**加，加了反而可能出问题）。

---

## §1 完整启动流程（按顺序）

### 前置：这些应该已经在跑

- **Docker Desktop** —— 已启动（任务栏图标常亮）
- **Mosquitto** —— 本机装的服务（通常开机自启），监听 `127.0.0.1:1883`

检查 / 手动起 Mosquitto：

```powershell
# PowerShell（管理员）
Get-Service *osquitto*          # 看服务名和状态
Start-Service Mosquitto         # 没起就起（服务名按上一步看到的填）
```

```cmd
:: cmd（管理员）
sc query | findstr /I mosquitto
net start Mosquitto
```

```bash
# Git Bash —— 直接调上面任一（bash 里也能 net start，但要管理员权限的终端）
# 或前台调试模式：
mosquitto.exe -v
```

---

### 步骤 1/6　启动 Docker 容器群（Kafka + 6 库 + Flink + Grafana）

先切到项目目录（**这是唯一三种写法不同的地方**）：

```powershell
cd D:\Big-Data
```

```cmd
cd /d D:\Big-Data
```

```bash
cd /d/Big-Data
```

然后启动（**三 shell 通用**，命令本身一样）：

```bash
docker compose up -d            # 后台起全部容器
docker compose ps               # 看状态，等都是 healthy/Up（ES/MySQL 等约 30s）
```

容器清单：`kafka` `mysql` `tdengine` `redis` `elasticsearch` `mongodb` `clickhouse` `flink-jobmanager` `flink-taskmanager` `grafana`。

> 端口映射（宿主机→容器）：MySQL `3307→3306`、Grafana `3001→3000`、Kafka 外部 `29092→29092`，其余原样。宿主机 Python 连 Kafka 用 `127.0.0.1:29092`，连 MySQL 用 `127.0.0.1:3307`。

---

### 步骤 2/6　（仅首次或改过 Java 代码）构建 Flink fat jar

> 跳过条件：`flink\target\flink-jobs-1.0.jar` 已存在且代码没改。构建是下载/编译类操作，**在用户终端跑**。

```bash
# 三 shell 通用（前提：已装 Maven，或复用 mvnw 缓存里的 mvn.cmd）
cd flink
mvn -s settings.xml package
# 产物：target/flink-jobs-1.0.jar（~44MB）
```

> 本机没全局 Maven 时，可复用旧项目缓存：`cmd //c "C:/Users/yaya/.m2/wrapper/dists/apache-maven-3.9.9-bin/*/apache-maven-3.9.9/bin/mvn.cmd" -s settings.xml -f pom.xml package`

---

### 步骤 3/6　（仅首次或重新构建后）拷 jar + 提交 Flink 两个作业

```powershell
# PowerShell —— 容器内 /opt/ 路径直接写，PS 不转换
docker cp flink\target\flink-jobs-1.0.jar flink-jobmanager:/opt/flink/
docker exec flink-jobmanager flink run -d -c iot.Agg1minJob  /opt/flink/flink-jobs-1.0.jar
docker exec flink-jobmanager flink run -d -c iot.AlertTempJob /opt/flink/flink-jobs-1.0.jar
```

```cmd
:: cmd —— 同 PowerShell，容器内 /opt/ 路径直接写
docker cp flink\target\flink-jobs-1.0.jar flink-jobmanager:/opt/flink/
docker exec flink-jobmanager flink run -d -c iot.Agg1minJob  /opt/flink/flink-jobs-1.0.jar
docker exec flink-jobmanager flink run -d -c iot.AlertTempJob /opt/flink/flink-jobs-1.0.jar
```

```bash
# Git Bash —— ★必须先禁路径转换，否则 /opt/flink/... 被误转成 C:/Program Files/Git/opt/...
export MSYS_NO_PATHCONV=1
docker cp flink/target/flink-jobs-1.0.jar flink-jobmanager:/opt/flink/
docker exec flink-jobmanager flink run -d -c iot.Agg1minJob  /opt/flink/flink-jobs-1.0.jar
docker exec flink-jobmanager flink run -d -c iot.AlertTempJob /opt/flink/flink-jobs-1.0.jar
```

提交后浏览器看作业 DAG：**http://localhost:8081**（两个作业都 RUNNING 才算成）。

> 已经提交过且没改代码 → 跳过这步。作业 `-d`（detached）持久化，容器不重启就一直在。

---

### 步骤 4/6　启动 Python 服务（ingest 必起，消费者按需）

服务清单（都在 `services\` 下，用 `-m` 模块方式跑）：

| 服务                                  | 作用                                                                  | 何时起                                 |
| ------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| `services.ingest_service.main`      | **MQTT → Kafka 桥**（必经环节）                                | **必起**，否则数据断在 Mosquitto |
| `services.consumer_tdengine.main`   | Kafka → TDEngine                                                     | 跑 Phase 3 全链路时起                  |
| `services.consumer_mysql.main`      | Kafka → MySQL                                                        | 同上                                   |
| `services.consumer_redis.main`      | Kafka → Redis                                                        | 同上                                   |
| `services.consumer_es.main`         | Kafka → ES（原始遥测）                                               | 同上                                   |
| `services.consumer_mongodb.main`    | Kafka → MongoDB                                                      | 同上                                   |
| `services.consumer_clickhouse.main` | Kafka → ClickHouse（原始明细）                                       | 同上                                   |
| `services.consumer_alerts.main`     | device-alerts topic → ES（**Phase 4 告警**，Flink Job B 下游） | 跑 Flink 告警链路时起                  |

**最简（只要 Flink 聚合 + 告警跑通）**：只起 `ingest_service` + `consumer_alerts` 两个。
**完整（6 库都要数据）**：ingest + 6 个 consumer 都起。

下面以「起 ingest」为例，三 shell 后台写法：

```powershell
# PowerShell —— 后台 + 日志重定向（NoNewWindow 不弹新窗口）
mkdir logs -Force | Out-Null
Start-Process -NoNewWindow `
  -FilePath ".venv\Scripts\python.exe" `
  -ArgumentList "-m","services.ingest_service.main" `
  -RedirectStandardOutput "logs\ingest.log" `
  -RedirectStandardError  "logs\ingest.err"
```

```cmd
:: cmd —— start /B 后台不开新窗口，重定向到日志
if not exist logs mkdir logs
start "ingest" /B .venv\Scripts\python.exe -m services.ingest_service.main > logs\ingest.log 2>&1
```

```bash
# Git Bash —— & 放后台，> 重定向
mkdir -p logs
.venv/Scripts/python.exe -m services.ingest_service.main > logs/ingest.log 2>&1 &
```

> 起多个服务就把上面这条复制 N 份，换模块名和日志文件名（`consumer_mysql`→`logs\mysql.log` 等）。
>
> **嫌麻烦**：直接用 §4 的一键脚本 `bash scripts/verify_e2e.sh`（自动起 ingest + 6 消费者）或 `bash scripts/verify_flink.sh`（起 ingest + alerts）。这些是 bash 脚本，但**三 shell 都能调**（见 §4）。
>
> 起完等 ~8s 让它们连上 Kafka/Mosquitto（看 `logs\ingest.log` 出现 `connected to ...:29092` 即就绪）。

---

### 步骤 5/6　跑模拟器产生数据

```bash
# 三 shell 通用（venv 全路径，前台跑，跑完 count 自动退）
.venv\Scripts\python.exe -m services.device_simulator.main --devices 4 --interval 2 --count 50
# bash 用 .venv/Scripts/python.exe（正斜杠）
```

含义：4 台设备，每 2s 上报一次，每台上报 50 轮（≈100s，能覆盖完整 1 分钟窗口）。
跑完自动退出，数据已进入整条链路。

---

### 步骤 6/6　验证落库结果

```bash
# 三 shell 通用 —— 查 6 库 + ClickHouse 聚合 + ES 告警
.venv\Scripts\python.exe scripts\query_all.py
```

或单独查某库（三 shell 通用）：

```bash
# ClickHouse 聚合表（Flink Job A 产出）
curl -s "http://127.0.0.1:8123/" --data-binary "SELECT window_start,deviceId,avg_temp,max_temp,min_temp,cnt FROM iot.telemetry_agg_1min ORDER BY window_start DESC LIMIT 10 FORMAT PrettyCompact"

# ES 告警计数（Flink Job B + consumer_alerts 产出）
curl -s "http://127.0.0.1:9200/device-alert-*/_count"

# 看 Flink 作业状态
docker exec flink-jobmanager flink list
```

---

## §2 完整停止流程（按顺序，与启动反向）

### 步骤 1/3　（可选）取消 Flink 作业

> 容器要重启就免不了重提作业；只是暂停 Python 服务则跳过这步。

```bash
# 三 shell 通用 —— list/cancel 不含 /opt 路径，Git Bash 也安全（无需 MSYS_NO_PATHCONV）
docker exec flink-jobmanager flink list                      # 拿 32 位 job id
docker exec flink-jobmanager flink cancel <job-id>           # 逐个 cancel
```

### 步骤 2/3　停 Python 服务（ingest + 所有 consumer）

**最省事 —— 三 shell 都能调**（脚本内部用 PowerShell 杀 `services.*` 的 python 进程，所以任意 shell 都行）：

```bash
bash scripts/clean.sh
```

或各 shell 等价的原生命令：

```powershell
# PowerShell 原生（精确杀 services.* 的 python，不影响别的 python）
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -like '*services*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

```cmd
:: cmd —— 简单粗暴版（会杀掉所有 python.exe，正在跑的其他 python 会被误杀！）
taskkill /F /IM python.exe
:: 不想误杀就改用：bash scripts/clean.sh
```

```bash
# Git Bash 原生（按命令行过滤）
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='python.exe'\" | Where-Object { \$_.CommandLine -like '*services*' } | ForEach-Object { Stop-Process -Id \$_.ProcessId -Force }"
```

> 若服务是前台开的（没重定向日志），直接在对应终端窗口按 **Ctrl+C** 即可。

### 步骤 3/3　停 Docker 容器（三档，按需选）

```bash
# 三 shell 通用 —— 三种力度
docker compose stop        # 档1：停容器（保留容器+数据），下次 start 秒起，作业状态/库数据都在
docker compose down        # 档2：删容器（保留数据卷），下次 up 要重建容器、Flink 作业要重提
docker compose down -v     # 档3：连数据卷一起删（库数据全清，回到全新状态，慎用）
```

> 日常暂停推荐 **档1 `stop`**（Flink 作业下次 `start` 后仍在）。改了 compose 配置才需要 **档2 `down`**。

---

## §3 常用单条命令速查

| 干啥                          | 命令（三 shell 通用）                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 看容器状态                    | `docker compose ps`                                                                                                                                   |
| 看某容器日志（跟踪）          | `docker logs -f kafka` / `docker logs -f flink-taskmanager`                                                                                         |
| 看 Kafka topic 列表           | `docker exec kafka kafka-topics --bootstrap-server localhost:9092 --list`                                                                             |
| 看 topic 里有没有数据（计数） | `docker exec kafka kafka-console-consumer --bootstrap-server localhost:9092 --topic device-telemetry --from-beginning --max-messages 5`               |
| 看 Flink 作业                 | `docker exec flink-jobmanager flink list`                                                                                                             |
| Flink Web UI                  | 浏览器开 http://localhost:8081                                                                                                                          |
| Grafana                       | 浏览器开 http://localhost:3001 （admin/admin）                                                                                                          |
| ClickHouse 查询               | `curl -s "http://127.0.0.1:8123/" --data-binary "SELECT * FROM iot.telemetry_agg_1min LIMIT 5"`                                                       |
| ES 查告警                     | `curl -s "http://127.0.0.1:9200/device-alert-*/_count"`                                                                                               |
| 看后台服务日志                | PS:`Get-Content logs\ingest.log -Tail 20 -Wait` · cmd: `type logs\ingest.log` · bash: `tail -f logs/ingest.log`                                 |
| 进 Python 容器/库             | MySQL:`docker exec -it mysql mysql -uroot -proot123 iot` · Mongo: `docker exec -it mongodb mongosh` · TDengine: `docker exec -it tdengine taos` |

---

## §4 一键脚本（bash 写的，但三 shell 都能调）

| 脚本                                              | 干啥                                                                           | 何时用                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------- |
| `bash scripts/verify_e2e.sh`                    | 起 ingest+6 消费者 → 跑模拟器(4×3) → 查 6 库 → 清理                        | 验 Phase 3 六库链路          |
| `bash scripts/verify_flink.sh`                  | 提交 2 Flink 作业 → 起 ingest+alerts → 跑模拟器(4×50) → 查 CH/ES → 停作业 | 验 Phase 4 Flink 链路        |
| `bash scripts/clean.sh`                         | 杀所有`services.*` 的 python 进程                                            | 单独清后台服务               |
| `.venv\Scripts\python.exe scripts\query_all.py` | 查 6 库 + CH 聚合 + ES 告警计数                                                | 不跑模拟器，只看当前落库结果 |

> PowerShell / cmd 里调 bash 脚本：直接 `bash scripts/verify_flink.sh` 即可（前提装了 Git Bash，Windows 上一般都有）。
> **注意**：`verify_flink.sh` 和 `clean.sh` 内部已 `export MSYS_NO_PATHCONV=1`，但仅在 Git Bash 下生效；PowerShell/cmd 调用时不需此变量。

---

## §5 坑提醒（踩过的）

1. **Git Bash 转换容器路径** → 含 `/opt/...` 的 docker 命令前必须 `export MSYS_NO_PATHCONV=1`（详见 §0）。PowerShell/cmd 不受影响。
2. **cmd 不跨盘符切目录** → `cd /d D:\Big-Data`，少了 `/d` 会停在 C 盘。
3. **taskkill /F /IM python.exe 会误杀** → 正在跑的 Qwen3-TTS、ComfyUI、其他 python 全杀。用 `bash scripts/clean.sh` 精确过滤 `services.*`。
4. **Flink 作业卡 RESTARTING** → taskmanager 默认 1 个 slot，两个作业抢不够。已在 `docker-compose.yml` 给 taskmanager 加 `taskmanager.numberOfTaskSlots: 4`。若仍卡，看 `docker logs flink-taskmanager` 找 `NoResourceAvailableException`。
5. **数据全空** → 90% 是忘了起 `ingest_service`（模拟器只发 MQTT，没 ingest 数据断在 Mosquitto）。先看 `logs\ingest.log` 有没有 `MQTT->Kafka` 字样。
6. **Docker Desktop 不读 daemon.json** → 镜像加速器必须在 Settings → Docker Engine GUI 里加，手改文件无效。
7. **端口冲突 3306/3000** → 本机已占，项目改用 3307(MySQL)/3001(Grafana)，连库时用映射后的宿主机端口。
8. **venv 执行策略（PS 激活报错）** → `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 一次即可。

---

## §6 最小启动 / 最小停止（TL;DR）

只想最快跑通看一眼数据？

```bash
# === 最小启动（Flink 聚合 + 告警）===
cd /d/Big-Data                      # PS: cd D:\Big-Data · cmd: cd /d D:\Big-Data
docker compose up -d
# 等 ~30s 容器 healthy；首次还要 §1 步骤2-3 构建+拷jar+提作业
bash scripts/verify_flink.sh        # 一条命令搞定 ingest+alerts+模拟器+查询

# === 最小停止 ===
bash scripts/clean.sh               # 杀 Python 服务
docker compose stop                 # 停容器（数据保留）
```
