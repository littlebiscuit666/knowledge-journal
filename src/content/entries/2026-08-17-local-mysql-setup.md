---
title: "本机 MySQL 8 (3306) 搭建总结"
date: 2026-08-17
category: 技术
tags: [mysql, 部署, 日记归档]
draft: false
---

> 2026-08-17

## 背景与决策
- 想在 `D:\Mysql-database` 搭一个 MySQL，表字段自由设计、凭据要复杂
- 排查发现本机**早就装了 MySQL Server 8.0.45**（Windows 服务 `MySQL80`，监听 3306，这就是 IoT 项目当时 3306 被占的原因）
- root 密码想起来了（123456），最终选择**复用现有实例**，不再 Docker/新装
- Docker 方案备而未用：`mysql:8.0` 镜像本地已有（IoT 容器占 3307），哪天要隔离实例可零下载起容器

## 建了什么
- 库：`quant_ledger`（utf8mb4），3 张简表：account（账户）/ trade（成交流水，外键→account）/ watchlist（自选股），附少量样例数据
- 专用账号：`q_vrbN55ca` / `******`（18位随机，仅 localhost，权限仅限 quant_ledger）
- 脚本与文档：`D:\Mysql-database\`（schema.sql 幂等 / README.md / CREDENTIALS.txt）
- 数据物理位置：`C:\ProgramData\MySQL\MySQL Server 8.0\Data`

## 坑
- `mysql.exe` 不在 PATH，必须全路径：`C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe`
- root 密码 123456 偏弱且已暴露在聊天里，**建议更换**（一条命令：`ALTER USER 'root'@'localhost' IDENTIFIED BY '新密码';`）
- 登录图形工具（Navicat 等）连 `127.0.0.1:3306` 即可，专用账号只在本机有效
