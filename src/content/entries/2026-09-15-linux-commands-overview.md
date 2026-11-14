---
title: "Linux 常见命令速览（面试/上机）"
date: 2026-09-15
category: 技术
tags: [linux, 速查, 面试, 日记归档]
draft: false
---

> 2026-09-15 整理。环境：Windows 11 + WSL2 Ubuntu。
> 进入 WSL：cmd 里输入 `wsl`；退出：`exit` 或 Ctrl+D。
> 注意区分：提示符含 MINGW64 的是 Git Bash，路径为 `/mnt/c/...` 的才是 WSL 真 Linux。

## 1. 目录与文件（最高频）

```bash
pwd                 # 我在哪
ls                  # 列文件
ls -l               # 长格式（权限、大小、时间），可简写 ll
ls -a               # 显示隐藏文件（.开头的）
cd /etc             # 绝对路径跳转
cd ..               # 回上一级
cd ~                # 回家目录
cd -                # 回上一次所在目录

mkdir test          # 建目录
mkdir -p a/b/c      # 递归建多层目录
touch a.txt         # 建空文件 / 更新时间戳
rm a.txt            # 删文件
rm -r test          # 删目录（递归）
rm -rf test         # 强制递归删，慎用！没有回收站
cp a.txt b.txt      # 复制
cp -r dir1 dir2     # 复制目录
mv a.txt /tmp/      # 移动 / 改名
```

## 2. 查看文件内容

```bash
cat a.txt           # 全量输出（小文件）
less a.txt          # 分页看（空格翻页，q 退出，/关键词 搜索）
head -n 10 a.txt    # 前 10 行
tail -n 20 a.txt    # 后 20 行
tail -f app.log     # 实时追踪日志（面试看日志高频，Ctrl+C 退出）
wc -l a.txt         # 统计行数（-w 词数，-c 字节数）
```

## 3. 查找与文本处理（上机常考）

```bash
find /etc -name "*.conf"        # 按名字找文件
find . -type f -mtime -1        # 当前目录下 1 天内改过的文件
which python                    # 命令装在哪

grep "error" app.log            # 在文件里找包含 error 的行
grep -n "error" app.log         # 带行号
grep -r "main" .                # 递归搜整个目录
grep -i "error" a.log           # 忽略大小写
grep -v "debug" a.log           # 反向：输出不匹配的行
```

管道组合（重点，面试爱考）：

```bash
cat a.log | grep "ERROR" | wc -l        # 统计 ERROR 出现次数
ps aux | grep python                    # 找 python 进程
history | grep cd                       # 从历史命令里找
```

awk / sort / uniq：

```bash
awk '{print $1}' access.log             # 打印每行第 1 列
awk -F',' '{print $2}' data.csv         # 用逗号分隔，取第 2 列
sort nums.txt | uniq -c                 # 排序后统计每行出现次数
```

## 4. 权限管理

```bash
ls -l a.sh
# -rwxr-xr-x：属主 rwx / 属组 r-x / 其他人 r-x
chmod +x a.sh          # 加可执行权限
chmod 755 a.sh         # rwxr-xr-x：自己读写执行，别人读执行
chmod 644 a.txt        # rw-r--r--：自己读写，别人只读
sudo xxx               # 以管理员身份执行
```

记忆：r=4，w=2，x=1，相加得权限数字。

## 5. 进程与系统

```bash
ps aux                 # 看所有进程
ps aux | grep nginx    # 找某个进程（拿到 PID）
kill 1234              # 按 PID 结束进程
kill -9 1234           # 强杀（普通 kill 不响应时）
top                    # 动态看 CPU/内存（q 退出）
df -h                  # 磁盘使用情况
free -h                # 内存使用情况
```

## 6. 压缩解压（大数据岗常考）

```bash
tar -czvf a.tar.gz dir/      # 打包压缩（c 创建，z gzip，v 显示过程，f 文件）
tar -xzvf a.tar.gz           # 解压（x 解开，解压到当前目录）
tar -xzvf a.tar.gz -C /opt   # 解压到指定目录
unzip a.zip                  # zip 解压
```

口诀：**压缩 c，解开 x**，z/v/f 都一样。

## 7. 网络与下载

```bash
ip addr                # 看 IP（老命令 ifconfig）
ping baidu.com         # 测连通（Ctrl+C 停）
curl http://localhost:8080/api    # 请求接口
wget https://xxx/file.tar.gz      # 下载文件
```

## 8. 其他高频小命令

```bash
echo "hello"           # 输出
> a.txt                # 清空文件 / 创建空文件
>> 、>                 # 追加重定向、覆盖重定向
|                      # 管道：前一个命令的输出给后一个
history                # 历史命令
clear                  # 清屏（Ctrl+L）
shutdown now           # 关机（虚拟机里才用）
```

## WSL 常用常识

- 访问 Windows C 盘：`/mnt/c/`，例如桌面 `/mnt/c/Users/yaya/Desktop`
- Linux 家目录：`cd ~`
- 装软件：`sudo apt update && sudo apt install -y vim curl`
- 窗口内右键 = 粘贴；新版终端 Ctrl+Shift+C/V 复制粘贴
- 输 sudo 密码时屏幕不显示，正常现象

## 上机练手 5 连击

```bash
mkdir -p ~/test && cd ~/test
echo -e "apple\nbanana\napple\ncherry" > fruits.txt
cat fruits.txt
sort fruits.txt | uniq -c
grep apple fruits.txt
```

覆盖：建目录、写文件、查看、排序去重、查找。
