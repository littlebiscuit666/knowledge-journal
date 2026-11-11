---
title: "Plane 自部署踩坑记录与周日重试方案"
date: 2026-08-18
category: 技术
tags: [docker, plane, 自部署, 日记归档]
draft: false
---

> 日期：2026-08-18（周二，无代理日）
> 目标：Docker 自部署 Plane（makeplane/plane，开源"Linear 平替"项目管理工具）自用，顺便学排期
> 状态：**套件已组装完毕，卡在镜像加速器缓存脏数据，等周日开代理重试**

---

## 一、最终成果（都在 D:\Plane\）

```
D:\Plane\
├── docker-compose.yml   ← 我组装的预构建镜像版（13服务）
├── .env                 ← 单文件配置（SECRET_KEY已生成，80/443已确认空闲）
└── _reference\          ← 官方各服务env模板存档
```

**架构一览（13 容器）**：
- 应用：web / admin / space / live（前端，内部端口全是3000）+ api（Django:8000）+ worker / beat-worker（Celery消费/定时）+ migrator（跑完迁移就退出，正常现象）
- 基础设施：postgres 15.7（业务数据）、valkey（=Redis开源分支，缓存）、**RabbitMQ（任务队列）**、minio（S3兼容对象存储）、Caddy proxy（唯一入口，路由实测：`/`→web、`/spaces`→space、`/god-mode`→admin、`/api|/auth|/static`→api:8000、`/uploads`→minio）
- 起来后：http://localhost 主应用（首注册账号=实例管理员）、/god-mode 管理后台

## 二、踩坑流水账（按时间线）

### 坑1：官方文档与代码脱节
- 文档说 `curl setup.sh | bash` 一键部署 → 实际 master 的 setup.sh 已变成**开发环境脚本**（复制 .env + 装 pnpm），空目录里跑直接炸（`./.env.example does not exist`、EPERM 改不了 Program Files 里的 pnpm）
- 老的 `deploy/` 目录、`docker-compose-hub.yml` 全部 404，官方把部署方式挪走了但文档没跟上
- 文档站 developers.plane.so 国内直连不可达

### 坑2：master 的 docker-compose.yml 是源码构建模式
- 每个服务都写 `build:`（现场编译 5 个镜像，3 个前端 Node 构建蜂巢）——工作日无代理，容器内 npm/pip 必挂
- **解法**：改用 Docker Hub 预构建镜像。镜像名逐一验证：`makeplane/plane-{web,admin,space,backend,live,proxy}:stable` 全部存在（proxy 已拉成功）

### 坑3：镜像名/路由拿不到地面真相
- 文档抓不到 → 直接把已拉下来的 `plane-proxy:stable` 镜像跑起来 `cat /etc/caddy/Caddyfile`，路由、服务名、端口全部拿到（proxy 已从 nginx 换成 Caddy）
- API 服务的 env 需求从 master 仓库的 `apps/*/.env.example` 抓模板（ghproxy 抓 raw 单文件稳定可用）

### 坑4（当前卡点）：加速器缓存脏数据
```
failed commit on ref "unknown-sha256:..."
failed size validation: 1396 != 1213: failed precondition
```
- plane-web 的某个小文件（1213字节）被加速器塞成 1396 字节的别的东西，**稳定复现**，重试无效
- plane-proxy 等其他 makeplane 镜像能正常拉 → 不是仓库整体被墙，是个别 blob 缓存脏
- 我的 Docker 开的是 **containerd 存储模式**（`docker info` driver=overlayfs 可查），校验严格，脏文件直接拒收
- 绕过尝试：DaoCloud 公共前缀 `docker.m.daocloud.io/makeplane/...` → 对 makeplane 返回 **403**（限制非官方镜像），失败

### 坑5：工具性小坑（顺手记）
- `docker manifest inspect` **不走加速器**（直连 registry-1.docker.io），国内必超时，查镜像存在性没用
- 我 git 全局配了 `127.0.0.1` 代理（周日才活的Clash），clone ghproxy 要 `git -c http.proxy= -c https.proxy= clone ...` 绕过
- ghproxy 抓小文件稳，**clone 大仓库会超时**，别指望
- `curl -f` 对 401 会判失败——探测"可达性"时 401/404 其实都算"对方活着"，别被自己的脚本骗了

## 三、周日重试方案（三步）

1. **开 Clash**（127.0.0.1:7890）
2. **Docker Desktop → Settings → Resources → Proxies** 填 `127.0.0.1:7890`——代理优先于加速器，直连官方源，脏缓存直接绕开
3. `cd D:\Plane && docker compose up -d`

预期现象：migrator 跑完退出正常；首次启动各服务互相等 1~2 分钟，502 先等等再刷。

## 四、知识点沉淀

- **Plane 为什么这么重**：SaaS 公司生产架构原样下放（Django 单体 + Celery 异步任务 + 完整基础设施），对比 Label Studio 的"单容器 Django+SQLite"重一个量级
- **RabbitMQ vs Kafka**（我 IoT 项目用后者）：RabbitMQ 是任务队列（工单，领走即删，"必须且只干一次"）；Kafka 是日志流（可回放，高吞吐多消费组）。Plane 的发邮件/webhook/通知要前者，传感器数据流要后者——同一个"削峰解耦"思想的两种形态
- valkey = Redis 改许可证后的社区分叉；minio = 私有化 AWS S3
- 借这个项目学排期的计划：Project=真实项目、Cycle=7天迭代、估点 S/M/L、周复盘 burndown——练"拆分粒度"和"容量诚实"这两个排期真功夫
