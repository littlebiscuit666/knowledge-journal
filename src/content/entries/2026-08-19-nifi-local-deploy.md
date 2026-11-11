---
title: "NiFi 本地部署记录：数据流可视化学习"
date: 2026-08-19
category: 技术
tags: [nifi, 数据流, 日记归档]
draft: false
---

日期：2026-08-19
结果：已跑通。`https://localhost:8443`，纯可视化拖拽学数据流转，零代码。

---

## 背景与选型

目的：学习数据流转。本机已有一套手工链路（D:\Big-Data：MQTT→Kafka→Flink→六库），想再补一个"平台化"的做对照。候选过这几个：

| 项目 | 定位 | 备注 |
|---|---|---|
| **Apache NiFi**（选了它）| 拖节点画流程图的数据流平台 | 数据流概念最直观，Provenance 能追每条数据的路径 |
| Apache SeaTunnel | Source→Transform→Sink 声明式集成 | 中文生态好，以后做范式对比 |
| DataX（阿里）| 经典离线库间同步 | JSON 配置，最朴素的抽灌模型 |
| Debezium | CDC：MySQL binlog→Kafka | 进阶项，现成 Kafka 可接 |
| Vector / Fluent Bit | 轻量日志管道 | 单二进制，分钟级体验 |

选 NiFi 的原因：核心卖点就是**零代码**——300+ 内置处理器全是表单配置，运行时队列积压、每条数据流转路径全在界面上看。唯一"类代码"是 `${filename}` 这类表达式占位符和可选的 ExecuteScript，学习阶段都碰不到。

## 下载

- 官方 `dlcdn.apache.org` 是美国源，浏览器下载慢，取消
- 换国内镜像（实测三家都有 2.11.0，约 788MB）：
  - `https://mirrors.tuna.tsinghua.edu.cn/apache/nifi/2.11.0/nifi-2.11.0-bin.zip`
  - 备用：`mirrors.aliyun.com/apache/nifi/...`、`mirrors.ustc.edu.cn/apache/nifi/...`
- 终端断点续传写法：`curl.exe -C - -O <镜像URL>`

## 部署

- 解压到：`D:\NiFi\nifi-2.11.0-bin\nifi-2.11.0`
- Java：本机 Oracle JDK 25 可直接跑（NiFi 2.11 要求 21+）
- **端口排查结论**：
  - `8080`（NiFi 1.x 习惯端口）被 Docker 占着（`com.docker.backend` + `wslrelay` 转发 WSL2 容器端口）→ 不用
  - `1080` 当时空闲，但**保留给 Penpot 的 mailcatch**（compose 里写死），不给 NiFi
  - `8443`（NiFi 2.x 默认 HTTPS）空闲 → 直接用默认值，没改任何配置

## 启动与登录

```
启动：D:\NiFi\nifi-2.11.0-bin\nifi-2.11.0\bin\nifi.cmd start
停止：同路径 nifi.cmd stop
```

- 独立 Java 进程，**开机不自启**、不跟 Docker Desktop 联动（符合预期）
- 首次启动约半分钟，JVM 占约 1GB 内存
- 访问 `https://localhost:8443`：浏览器报自签证书警告 → 高级 → 继续访问
- NiFi 2.x 是 single-user 模式，首次启动随机生成用户名/密码（只在日志出现一次）
- **2026-08-19 已改为自定义账号**：用户名 `yaya`（密码不存文档）
- 凭据存在 `conf\login-identity-providers.xml`（密码为 bcrypt 哈希）。改密方法：python bcrypt 生成哈希写进去重启；忘密码就把 Username/Password 两行清空重启，会重新随机生成并打在 `logs\nifi-app.log` 里
- 日常启停用桌面快捷方式：`启动NiFi.bat` / `停止NiFi.bat`（或命令行 `bin\nifi.cmd start|stop`）

## 上手玩法（待实践）

1. 第一条流：拖 `GenerateFlowFile` → 连到 `LogAttribute`，点 ▶ 启动，看数据在连线上流动
2. 右键连线可看队列积压；顶部 Provenance 菜单追任意一条数据的完整流转路径
3. 要学的核心概念：处理器（Processor）、连接队列、背压（Back Pressure）、FlowFile、Controller Service（共享连接配置，如数据库连接）
4. 连真库：用 Controller Service 配 MySQL/ES 连接，处理器里选一下填个表名就能抽数

## 后续路线

- 进阶 1：在现有 MySQL 上挂 **Debezium**，体验 binlog→Kafka 的工业标准 CDC 流
- 进阶 2：装 **SeaTunnel**，感受"写配置 vs 画流程图 vs 写代码"三种数据流开发范式差别
