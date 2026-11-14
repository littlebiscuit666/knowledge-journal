---
title: "后端服务的底层实现：监听端口、接收请求、返回数据"
date: 2026-09-30
category: 技术
tags: [后端, socket, http, 面试, 日记归档]
draft: false
---

日期：2026-09-30

## 一、先搞清楚：什么才算"后端"

判断一个程序是不是后端，**不看它有没有连数据库**，而看两点：

1. 它运行在服务器上，长期监听一个端口，等着别人来连
2. 客户端（浏览器、App、别的程序）通过网络向它发请求，它处理后返回结果

数据库只是后端常用的一个"数据来源工具"，不是必要条件。数据可以来自：MySQL/Redis、硬盘文件、另一个服务的接口、纯计算、内存数据——这些都算后端。

三者关系：

    前端（客户端）  用户看到、操作的界面：浏览器网页、App、curl
        │  发 HTTP 请求
        ▼
    后端（服务端）  接收请求、写业务逻辑、决定返回什么   ← server.py 在这一层
        │  需要存/取数据时才访问
        ▼
    数据库         数据仓库，可换、可没有（本项目用 jsonl 文件代替）

本项目的数据并没有常驻内存：server.py 是**每来一个请求，就重新从硬盘读一次 jsonl**（`recs = load_records()` 写在 do_GET 内部），用完即弃。

---

## 二、"监听、接收、返回"都靠操作系统的 socket API

程序自己并不直接操作网卡，这些活全部是**调用操作系统内核提供的 socket 系统调用**。BaseHTTPRequestHandler 只是站在这些调用上面的一层封装。

内核提供的关键函数：

    socket()   创建一个 socket（通讯端点，拿到编号 fd）
    bind()     把 socket 绑到某个端口，如 8080（"占住门牌号"）
    listen()   开始监听，声明"我是服务器，等别人连"
    accept()   阻塞等待，直到有客户端连进来，返回一个"新 socket"专门和它对话
    recv()     从这条连接上读对方发来的字节
    send()     往这条连接上写字节，发给对方

注意：监听的 socket 只负责"接线"；每接进一个客户端，内核生成一条独立的新连接，在新连接上读写。

---

## 三、用最原始的 Python socket 写一个最小服务器（不借框架）

    import socket

    srv = socket.socket()              # socket()：造一个端点
    srv.bind(("0.0.0.0", 8080))        # bind()：占住 8080 端口
    srv.listen()                       # listen()：开始监听
    print("waiting...")

    conn, addr = srv.accept()          # accept()：卡住，直到有人连进来
    print("connected from", addr)

    data = conn.recv(4096)             # recv()：读客户端发来的原始字节
    print(data)                        # 这就是 HTTP 请求的文本

    conn.send(b"HTTP/1.1 200 OK\r\nContent-Length: 12\r\n\r\nhello world!")
                                       # send()：把响应字节写回去
    conn.close()

浏览器连上来时，recv 到的是一段符合 HTTP 格式的纯文本：

    GET /api/stats HTTP/1.1
    Host: 127.0.0.1:8080
    User-Agent: curl/...

---

## 四、HTTP 的本质：TCP 上收发的"规定格式文本"

- TCP 只保证"字节能可靠、按顺序到达"，它不认识 GET、URL
- HTTP 是双方约定的文本格式：
  - 请求 = 请求行 + 请求头 + 空行 + 正文
  - 响应 = 状态行 + 响应头 + 空行 + 正文

所以"返回数据"最终就是 send 一串按 HTTP 格式拼好的字节。`_send` 方法里写的状态码、Content-Type、Content-Length、空行、正文，就是手工拼这段文本，再由 `wfile.write` 发出（wfile 底层就是这条连接的 send）。

---

## 五、BaseHTTPRequestHandler 替你封装了什么

    原始 socket 要自己做的              父类替你做
    socket/bind/listen/accept          父类和 socketserver 全包
    recv 收一大坨字节                   替你收并解析
    自己解析请求行/请求头               解析成 self.path、self.headers
    判断请求方法                       自动调 do_GET / do_POST
    你只管                            重写 do_GET，写业务逻辑
    send 拼好的响应文本                send_response/send_header/wfile 帮拼

- `do_GET`：所有 GET 请求的入口，里面的 if/elif 就是**路由**，按 URL 路径分发到不同处理逻辑
- `_send`：复用工具，把任意数据按标准 HTTP 格式打包，**发回给正在等结果的调用方**（不是"发送到端口"；请求从端口进来，结果发回请求方，方向别搞反）

---

## 六、多个请求同时来：ThreadingHTTPServer

    监听 socket 每 accept() 进一个新连接
        → 开一个新线程
            → 在该线程创建一个 Handler 对象
            → 解析请求 → 调它的 do_GET
        → 主线程立刻回去 accept 下一个

多个客户端可同时被处理。"开线程"在 Linux 上最终就是 clone 系统调用。

---

## 七、内核在背后还做了什么（了解）

- 程序调 listen 后，内核替它完成 TCP 三次握手，把"已接通但还没 accept"的连接放队列
- 收到的网络数据先存内核缓冲区，recv 时才取走
- send 的字节先交给内核，由内核择机通过网卡发出
- "监听"这个状态是内核在替程序维持的

---

## 八、整条链路（从下到上）

    网卡
      → 内核 TCP/IP 协议栈（维持连接、收发缓冲）
      → socket 系统调用：socket/bind/listen/accept/recv/send
      → socketserver（循环 accept、每连接开线程）
      → BaseHTTPRequestHandler（解析 HTTP 文本、调 do_GET、拼响应）
      → 自己写的 Handler（路由 + 业务逻辑 + _send）

## 一句话总结

监听靠 bind/listen，接请求靠 accept/recv，返回靠 send，这些全是操作系统内核提供的 socket 系统调用；HTTP 只是这些字节要遵守的文本格式；父类把"连接管理 + HTTP 解析/拼装"封装好，让我们只写 do_GET 里的业务逻辑。
