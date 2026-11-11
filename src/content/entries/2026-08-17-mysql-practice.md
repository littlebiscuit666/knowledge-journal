---
title: "MySQL 实践总结"
date: 2026-08-17
category: 技术
tags: [mysql, jdbc, 部署, 日记归档]
draft: false
---

> 一天走完：本机复用建库 → 导出 → JDBC → 云 CDB 受挫 → 华为云 VPS 从零部署 → 摸清平台内网限制。附全部命令速查。

## 一、时间线

1. **排查**：想新装 MySQL，先查环境——发现本机早装有 MySQL Server 8.0.45（Windows 服务 `MySQL80`，占 3306）
2. **复用本机**：root 密码找回（123456）→ 建 `quant_ledger` 库（account/trade/watchlist 三简表+样例数据）→ 建复杂账号 `q_vrbN55ca`（18位随机密码）
3. **导出**：`mysqldump --databases` 导出全量 dump，附建账号语句
4. **课设平台**：只收 .sql + JDBC URL；测连接发现平台是在它服务器上连库 → 本机/局域网 IP 全不可达
5. **腾讯云 CDB**（5.7.18）：导入报 `Unknown collation: utf8mb4_0900_ai_ci` → 换 general_ci 解决；但中文变问号，没根治
6. **华为云 VPS**（113.45.x.x，Ubuntu 24.04）：apt 装 mysql-server 8.0.46 → 导入干净数据 → 建 `@'%'` 远程账号 → 公网实测可连 ✅
7. **终局**：平台表单校验 IP 前两位必须是内网段（RFC1918 私网）→ 数据不出内网是平台设计，正确姿势是**找管理员要官方内网库**

## 二、核心知识点

- **服务/实例/库/账号**：MySQL80 是 Windows 服务（一个实例），实例里建多个库；账号分 `user@host`——`@localhost` 只能本机连，远程要 `@'%'`（或指定来源 IP）
- **JDBC 与库的位置无关**：它只是 Java 连数据库的标准接口，URL 里 host 填谁就连谁（`127.0.0.1`=本机，公网 IP=云）
- **MySQL 8.0 vs 5.7**：`utf8mb4_0900_ai_ci` 是 8.0 专属排序规则，5.7 只认 `utf8mb4_general_ci`，跨版本导 dump 要 sed 替换
- **中文乱码排查**：终端显示乱 ≠ 数据脏；用 `SELECT HEX(列)` 看真实字节（UTF-8 中文每字3字节，`3F3F3F`=真丢成问号）
- **私网/内网**：RFC1918 规定 `10.x`、`172.16-31.x`、`192.168.x` 公网不可路由；企业内网=无数小 LAN 路由拼接的大私网；平台限制内网段=数据不出网
- **Ubuntu 的 MySQL root 免密**：apt 装的默认走 auth_socket，root 用户直接敲 `mysql` 就进，不是没密码

## 三、命令速查

### Windows 本机（PowerShell）

```powershell
# 登录（mysql.exe 不在 PATH，必须全路径）
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u q_vrbN55ca -p quant_ledger

# 查端口被谁占了（PID → 任务管理器看进程）
netstat -ano | findstr 3306

# 查有哪些 MySQL 服务 / 启停（启停要管理员）
sc query state= all | findstr /i mysql
net stop MySQL80 ; net start MySQL80

# 导出整库（--databases 会带上 CREATE DATABASE，导入方一键复现）
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe" -u root -p --default-character-set=utf8mb4 --databases quant_ledger > quant_ledger_dump.sql
```

### SQL（建库建账号的完整套路）

```sql
CREATE DATABASE IF NOT EXISTS quant_ledger DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- 账号 = 用户名@来源主机，localhost 只本机、% 任意主机（远程服务用）
CREATE USER 'q_vrbN55ca'@'%' IDENTIFIED BY '******';
GRANT ALL PRIVILEGES ON quant_ledger.* TO 'q_vrbN55ca'@'%';  -- 只授权这一个库
FLUSH PRIVILEGES;

ALTER USER 'root'@'localhost' IDENTIFIED BY '新密码';          -- 改密码
SELECT user, host FROM mysql.user;                             -- 看所有账号

-- 乱码取证：看真实存储字节
SELECT name, HEX(name) FROM watchlist LIMIT 1;   -- UTF-8中文=3字节/字，3F3F3F=已丢
```

### Linux 服务器（Ubuntu 24.04）

```bash
# 检查装没装
mysql --version
systemctl list-units --type=service | grep -iE "mysql|mariadb"
ss -tlnp | grep 3306          # 端口在不在听
which mysqld

# 安装（装完自动启动+开机自启）
sudo apt update && sudo apt install -y mysql-server

# 对外开放：改监听地址再重启
sudo sed -i "s/^bind-address.*/bind-address = 0.0.0.0/" /etc/mysql/mysql.conf.d/mysqld.cnf
sudo systemctl restart mysql

# 导入 dump（root 免密直接进）
mysql < /root/quant_ledger_dump.sql
```

⚠️ 云服务器放行 3306 要**两处**都开：系统防火墙（ufw/云镜像一般默认关）+ **云控制台安全组**（华为云/腾讯云控制台配，最容易漏）。

### JDBC 连接（Java 侧）

```xml
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <version>8.0.33</version>
</dependency>
```

```java
Connection conn = DriverManager.getConnection(
    "jdbc:mysql://主机:3306/quant_ledger?useSSL=false&serverTimezone=Asia/Shanghai&characterEncoding=utf8&allowPublicKeyRetrieval=true",
    "q_vrbN55ca", "******");
```

三个参数防三个经典报错：`serverTimezone`=时区错、`characterEncoding`=中文乱码、`allowPublicKeyRetrieval`=8.x 密码握手失败。

### 远程运维（paramiko 小工具）

```bash
# 工具在 C:\Users\yaya\.claude\tmp\vps_ssh.py，执行远程命令 / 传文件
python vps_ssh.py "systemctl status mysql"
python vps_ssh.py put 本地文件 /root/远程文件
# ★Git Bash 下传 /root 开头的参数必须加前缀，否则路径被转成 C:/Program Files/Git/root
MSYS_NO_PATHCONV=1 python vps_ssh.py put dump.sql /root/dump.sql
```

## 四、踩坑清单

| 坑 | 解法 |
|---|---|
| `mysql.exe` 不在 PATH | 全路径调用 |
| 5.7 报 `Unknown collation: utf8mb4_0900_ai_ci` | `sed 's/utf8mb4_0900_ai_ci/utf8mb4_general_ci/g'` 出 5.7 版 |
| CDB 控制台导入中文变 `???` | 未根治（疑导入通道非 UTF-8）；换自建服务器用 `mysql --default-character-set=utf8mb4 < dump` 绕过 |
| dump 里建的账号远程连不上 | dump 附的是 `@'localhost'`；远程要另建 `@'%'` |
| 平台 Connection refused | 平台在它自己服务器上发起连接，`127.0.0.1`/局域网 IP 全指错地方 |
| 平台校验 IP 前两位 | 只认内网段，公网云数据库也不收——找管理员要内网库 |

## 五、现有资产

- **本机 MySQL80**：`quant_ledger` + `q_vrbN55ca@localhost`（root/123456）
- **华为云 113.45.x.x**（root/@******）：MySQL 8.0.46 + `quant_ledger` + `q_vrbN55ca@'%'`，公网 3306 可连
- **腾讯 CDB**（gz-cdb-xxxxx.sql.tencentcdb.com:2xxxx，5.7.18，root/@******）：表结构在，中文数据脏
- **D:\Mysql-database**：schema.sql / 8.0 与 5.7 两版 dump / README / 搭建记录 / CREDENTIALS

## 六、待办

- [ ] 找平台管理员要内网 MySQL 地址+账号 → 导入 dump（按对方版本挑 8.0/5.7 文件）→ 平台表单照填
- [ ] 课设结束后收紧：华为云安全组 3306 限源 IP 或关闭；本机 root 密码更换
