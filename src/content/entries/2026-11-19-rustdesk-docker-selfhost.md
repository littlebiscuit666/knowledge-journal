---
title: 自建 RustDesk 私有远程控制服务：华为云 Ubuntu + Docker Compose 全流程记录
date: 2026-11-19
category: 技术
tags: [rustdesk, docker, ubuntu, 远程控制, 自建]
---

这次在一台华为云 ECS（Ubuntu 24.04，2核2G，3Mbps）上用 Docker Compose 部署了 RustDesk 私有服务端，手机可以远程控制 Windows/Mac，不再依赖官方公共服务器。以下是我们这次部署的完整精简记录，以后换一台服务器，基本可以照着这个流程重新部署。

## 一、服务器基本情况

| 项目 | 配置 |
| --- | --- |
| 云服务器 | 华为云 ECS |
| 操作系统 | Ubuntu 24.04 LTS |
| CPU / 内存 | 2 核 / 2GB |
| 公网带宽 | 3Mbps |
| Docker | 29.6.1 |
| RustDesk Server | 1.1.16 |
| 部署目录 | `/opt/rustdesk` |

## 二、实际做了什么

1. 检查 Ubuntu 的 CPU、内存及进程，发现 MySQL 占用约 417MB。
2. 停止不再需要的 MySQL 和 `tracker.service` 等服务，可用内存从约 950MiB 增加到 1.3GiB。
3. 确认 Docker 已安装，并启动 Docker 后台服务。
4. 由于 Docker Hub 连接超时，改从 GitHub Container Registry 下载 RustDesk 镜像。
5. 使用 Docker Compose 启动 `hbbs`（ID 服务器）和 `hbbr`（中继服务器）。
6. 开放云服务器安全组端口，获取公钥，在手机及电脑端配置 RustDesk。
7. 完成远程连接测试，确认手机使用了 TCP 加密中继连接。

## 三、核心 Linux 命令

### 1. 检查服务器资源

```bash
free -h                 # 查看内存
df -h /                 # 查看磁盘
ps aux --sort=-%mem | head -20  # 查看内存占用最高的进程
```

### 2. 管理系统服务

```bash
systemctl status mysql          # 查看状态
systemctl stop mysql            # 停止 MySQL
systemctl disable mysql         # 禁止开机自启

systemctl disable --now tracker.service
```

`stop` 是立即停止，`disable` 是禁止开机自启，`--now` 表示同时执行停止操作。

这些是我们清理服务时用过的命令，重建服务器时不必执行，除非确实存在相同且不再需要的服务。

### 3. 启动 Docker

```bash
systemctl start docker
systemctl enable docker
docker --version
docker compose version
```

## 四、RustDesk 部署代码（最关键）

### 1. 创建目录

```bash
mkdir -p /opt/rustdesk/data
cd /opt/rustdesk
```

### 2. 下载镜像

由于服务器无法访问 Docker Hub，改用 GHCR：

```bash
docker pull ghcr.io/rustdesk/rustdesk-server:1.1.16
```

### 3. 创建 `compose.yml`

```bash
cat > compose.yml <<'EOF'
services:
  hbbs:
    image: ghcr.io/rustdesk/rustdesk-server:1.1.16
    container_name: rustdesk-hbbs
    command: hbbs
    volumes:
      - ./data:/root
    network_mode: host
    restart: unless-stopped

  hbbr:
    image: ghcr.io/rustdesk/rustdesk-server:1.1.16
    container_name: rustdesk-hbbr
    command: hbbr
    volumes:
      - ./data:/root
    network_mode: host
    restart: unless-stopped
EOF
```

| 配置 | 含义 |
| --- | --- |
| `image` | 使用哪个 Docker 镜像 |
| `command: hbbs` | 启动 ID / 信令服务器 |
| `command: hbbr` | 启动中继服务器 |
| `volumes` | 保存服务器密钥和数据 |
| `network_mode: host` | 使用宿主机网络 |
| `restart: unless-stopped` | 自动恢复运行，除非被手动停止 |

### 4. 启动容器

```bash
docker compose up -d
```

`-d` 表示在后台运行。检查：

```bash
docker compose ps
docker stats --no-stream
```

实测两个容器空闲时的内存占用分别约为 1.5MiB 和 0.7MiB，非常轻量。

## 五、服务器端口配置

云服务器安全组需要开放：

| 端口 | 协议 | 作用 |
| --- | --- | --- |
| 21115 | TCP | NAT 检测 |
| 21116 | TCP | 连接协调 |
| 21116 | UDP | 设备注册和打洞 |
| 21117 | TCP | 远程桌面中继 |

检查监听：

```bash
ss -tulnp | grep -E '21115|21116|21117'
```

检查 Ubuntu 防火墙：

```bash
ufw status
```

如果 UFW 已启用，还需要放行对应端口。

## 六、获取服务器公钥并配置客户端

```bash
cat /opt/rustdesk/data/id_ed25519.pub
```

之后在所有设备的 RustDesk 客户端中设置：

| 字段 | 填写 |
| --- | --- |
| ID Server | 云服务器公网 IP |
| Relay Server | 留空 |
| API Server | 留空 |
| Key | 服务器公钥 |

远程控制某台设备，还需要它的 RustDesk ID + 访问密码或授权。

## 七、日常维护命令

```bash
cd /opt/rustdesk

docker compose ps          # 查看状态
docker compose logs -f     # 查看日志
docker compose restart     # 重启服务
docker compose down        # 停止并移除容器
docker compose up -d       # 重新启动
docker stats --no-stream   # 查看资源占用
```

备份时重点保存：

```bash
/opt/rustdesk/compose.yml
/opt/rustdesk/data/
```

其中 `data` 包含服务器身份密钥，私钥不能公开，也不要随意删除。

## 八、三个核心概念

- **Docker：运行环境** — 把 RustDesk 服务端程序及其依赖打包成镜像，方便部署和管理。
- **hbbs：连接协调者** — 帮助设备互相找到对方，尝试建立 P2P 连接。
- **hbbr：画面中继者** — 如果 P2P 不成功，由它转发远程桌面数据，受服务器 3Mbps 带宽约束。

一句话总结：通过 Docker Compose 在 Ubuntu 上运行两个 RustDesk 服务进程，利用云服务器的公网 IP 提供设备发现、连接协调和画面中继，从而实现手机远程控制 Windows。

以后维护这套系统，最重要的是记住 `/opt/rustdesk` 目录、`docker compose` 命令、21115–21117 端口，以及服务器公钥和私钥的区别。
