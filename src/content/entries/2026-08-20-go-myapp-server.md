---
title: "Go 服务端 myapp 项目全记录"
date: 2026-08-20
category: 技术
tags: [go, vps, 部署, git, 日记归档]
draft: false
---

> 日期：2026-08-20
> 本地代码：`D:\myapp`（Windows，32G，Go 1.26.4）
> 线上：华为云 VPS 113.45.x.x（Ubuntu 24.04，2G 内存，MySQL 8.0）
> 状态：✅ 已部署上线，公网可访问（API Key 鉴权）

---

## 一、项目是什么

一个"最小但生产形状"的 REST API 服务：**纯 Go 标准库 + MySQL 驱动**（外部依赖只有 go-sql-driver/mysql 一个），内存占用 ~20M，跑在 2G 小机上毫无压力。业务是一个 notes 笔记的增删改查——**业务是壳，骨架是目的**：以后换任何业务表，改 store.go 就行。

## 二、架构与部署形态

```
┌─ 本地 Windows（32G，写代码）────┐        ┌─ VPS（2G，只跑服务）───────────┐
│  D:\myapp 源码                  │ git    │  /srv/git/myapp.git 裸仓库     │
│  go build + 本地MySQL80冒烟测试 │─push──▶│      │ git pull                │
│  （密码走环境变量，不入库）      │ vps    │  /opt/myapp → bin/myapp       │
│                                 │        │  systemd 守护(myapp服务)       │
└─────────────────────────────────┘        │  MySQL 本机连(127.0.0.1:3306)  │
                                           │  :8080 对公网 + API Key 鉴权    │
                                           └────────────────────────────────┘
```

**为什么这样开发**：2G 服务器跑不动 vscode-server（300-500M），所以"本地开发、服务器只跑"——代码走 git 裸仓库直推服务器，不需要 GitHub/Gitee。

## 三、代码结构（三层，每层职责单一）

| 文件 | 职责 | 关键点 |
|---|---|---|
| `main.go` | 骨架 | env 读配置→连接池(上限16)→路由→优雅关闭(SIGTERM 10s)→两个中间件(日志+鉴权) |
| `handler.go` | HTTP 层 | 解析/校验/状态码；不含 SQL；请求体限 1MB |
| `store.go` | 数据层 | 全部 SQL 在这；全部 `?` 参数化；`ErrNotFound` 哨兵错误→404 |
| `schema.sql` | 建表 | 幂等（IF NOT EXISTS），可重复执行 |
| `deploy/` | 部署三件套 | myapp.service(systemd, MemoryMax=200M)、first_deploy.sh、deploy.sh |

Go 1.22+ 标准库路由写法（不用框架的原因：依赖少、看得穿）：

```go
mux.HandleFunc("GET /api/v1/notes/{id}", h.Get)   // 方法+路径模式+路径参数
id := r.PathValue("id")                            // 取路径参数
```

鉴权中间件（公网开放的保护层）：

```go
// API_KEY 环境变量非空时，除 /healthz 外都要求请求头 X-API-Key
func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := os.Getenv("API_KEY")
		if key != "" && r.URL.Path != "/healthz" && r.Header.Get("X-API-Key") != key {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "无效或缺失的 API Key"})
			return
		}
		next.ServeHTTP(w, r)
	})
}
```

## 四、API 一览

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/healthz` | 免Key | 健康检查 |
| GET | `/api/v1/notes?q=&limit=&offset=` | 要Key | 分页+标题模糊搜 |
| POST | `/api/v1/notes` | 要Key | `{"title","content"}` → 201 |
| GET/PUT/DELETE | `/api/v1/notes/{id}` | 要Key | 详情/更新/删除(204) |

调用示例（公网）：

```bash
curl http://113.45.x.x:8080/healthz
curl -H "X-API-Key: b638****（已打码）" http://113.45.x.x:8080/api/v1/notes
curl -X POST -H "X-API-Key: b638****（已打码）" \
     -H "Content-Type: application/json" \
     -d '{"title":"测试","content":"hello"}' \
     http://113.45.x.x:8080/api/v1/notes
```

（Key 存在服务器 `/etc/myapp.env`，600 权限）

## 五、完整命令手册

### A. 一次性环境准备（都已做过，备查）

```bash
# === VPS 上：建裸仓库 ===
sudo mkdir -p /srv/git && sudo chown yaya /srv/git
git init --bare /srv/git/myapp.git
git config --global init.defaultBranch main          # 消除 master 提示
git -C /srv/git/myapp.git symbolic-ref HEAD refs/heads/main  # HEAD 指向 main（修复 clone 为空）
git config --global --add safe.directory /srv/git/myapp.git  # root 拉 yaya 的仓库需豁免

# === 本地：SSH 免密 ===
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519 -C "yaya-windows"
# 把 ~/.ssh/id_ed25519.pub 内容追加到 VPS 的 /home/yaya/.ssh/authorized_keys
# （mkdir -p .ssh; chmod 700; echo '公钥' >> authorized_keys; chmod 600; chown -R yaya:yaya）

# === 本地：挂远程 ===
cd /d/myapp
git init -b main
git remote add vps ssh://yaya@113.45.x.x/srv/git/myapp.git
```

### B. 日常开发循环（最常用）

```bash
cd /d/myapp
export GOPROXY=https://goproxy.cn,direct       # 国内 Go 代理

go vet ./... && go build -o bin/myapp.exe .    # 体检+编译

# 本地起服务冒烟（8081 避开本地 WeKnora 的 8080）
export DB_USER=root DB_PASS=<本地MySQL密码> DB_NAME=myapp APP_ADDR=:8081
./bin/myapp.exe                                # 前台跑，Ctrl+C 优雅退出

# 冒烟测试
curl -s http://localhost:8081/healthz
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8081/api/v1/notes \
     -H "Content-Type: application/json" -d '{"title":"t1","content":"c1"}'
taskkill //F //IM myapp.exe                    # Windows 杀进程
```

### C. 交付与服务器更新

```bash
# 本地
git add . && git commit -m "改动说明" && git push vps main

# VPS（已可配成脚本；我远程代跑用的是 root 的 paramiko 通道）
cd /opt/myapp && git pull && go build -o bin/myapp . && sudo systemctl restart myapp
curl -s http://127.0.0.1:8080/healthz           # 验证
```

### D. 首次部署（已执行过，备查）

```bash
# VPS 上：
cd /tmp && git clone /srv/git/myapp.git && cd myapp && git checkout main
sudo bash deploy/first_deploy.sh
# 脚本自动做：建库建 myapp 账号(只授权 myapp 库增删改查)→导表→clone 到 /opt/myapp
#            →GOPROXY=goproxy.cn→编译→写 /etc/myapp.env(600)→装 systemd→启动
```

### E. 运维命令

```bash
systemctl status myapp          # 状态
journalctl -u myapp -f          # 实时日志
sudo systemctl restart myapp    # 重启
free -h                         # 内存（服务约 20M）
ss -tlnp | grep 8080            # 确认监听 0.0.0.0:8080
```

### F. 公网访问（已完成）

1. 华为云控制台 → ECS → 安全组 → 入方向规则：TCP/8080，源 0.0.0.0/0（或自家IP/32 更安全）
2. `/etc/myapp.env` 里 `API_KEY=...`（非空即启用鉴权），改完 `systemctl restart myapp`
3. 换 Key：直接改 /etc/myapp.env 里的值再重启

## 六、踩过的坑（这次真实的排障记录）

| 坑 | 现象 | 解法 |
|---|---|---|
| 裸仓库 HEAD 指 master | clone 出来空目录，`deploy/*.sh 找不到` | `git symbolic-ref HEAD refs/heads/main` |
| root 拉 yaya 的仓库 | `dubious ownership` | `git config --global --add safe.directory /srv/git/myapp.git` |
| CRLF 损坏脚本 | git 警告 LF→CRLF，.sh 到 Linux 会带 `\r` 跑不动 | 仓库加 `.gitattributes`：`* text=auto eol=lf` |
| Windows curl 路径 | `--data-binary @/tmp/x.json` 报错读不了文件 | Windows curl 不认 Git Bash 的 /tmp，文件放当前目录 |
| 终端中文乱码干扰判断 | curl 返回的中文显示乱码 | 用 `SELECT HEX(title)` 验字节；测试请求用 `\u` 转义或 python 码点生成 body 绕开控制台 |
| git push 卡认证 | `Permission denied (publickey,password)` | 生成密钥+装公钥；脚本里推用 `GIT_SSH_COMMAND="ssh -o BatchMode=yes"` 快速失败不挂起 |
| git 参数路径被 Git Bash 转换 | `/srv/...` 变成 `C:/Program Files/Git/srv/...` | 命令前加 `MSYS_NO_PATHCONV=1` |

## 七、值得记住的五个命令模式

1. **密码走环境变量/环境文件**：本地 `export DB_PASS=...`，线上 `/etc/myapp.env`(600)——命令行 `-p` 只图快（有 insecure 警告）
2. **`curl -s -o /dev/null -w "%{http_code}"`**：测 API 只看状态码，验证协议行为而非肉眼看内容
3. **`HEX()` 验字符编码**：显示层会骗人，字节不会
4. **`grep -qF ... || echo >>`**：幂等追加，重跑不重复（与 `IF NOT EXISTS` 同思想）
5. **`BatchMode + accept-new`**：让 ssh 在脚本里要么成要么快失败，不挂起等输入

## 八、后续升级方向（按需）

1. post-receive 钩子 → push 即部署，不用登服务器
2. 域名 + Caddy 反代 → HTTPS（80/443 + 自动证书）
3. 换真实业务表（如交易记录/持仓快照，接量化线）
4. 接口限流、请求日志落库
5. Gitee 第二远程做备份+作品集
