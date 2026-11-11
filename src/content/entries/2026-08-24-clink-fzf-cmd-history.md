---
title: "cmd 命令历史记录：Clink + fzf 安装配置"
date: 2026-08-24
category: 工具
tags: [clink, fzf, 终端, 日记归档]
draft: false
---

> 日期:2026-08-24(周一)
> 需求:在 cmd 里记录命令历史、支持模糊搜索(类似 Linux 下 Atuin/fzf 的体验)

## 一、最终方案

| 组件 | 版本 | 作用 |
|---|---|---|
| [Clink](https://github.com/chrisant996/clink) | v1.9.31 | 给 cmd 注入持久化历史、灰色自动建议、Ctrl+R 搜索 |
| [fzf](https://github.com/junegunn/fzf) | 0.74.3 | 通用模糊搜索器 |
| [clink-fzf](https://github.com/chrisant996/clink-fzf) | main 分支 | 把 fzf 接进 clink,Ctrl+R/Ctrl+T 变成 fzf 面板 |

选型参考(按终端分):
- **PowerShell** → PSReadLine(自带)+ PSFzf
- **cmd** → Clink + clink-fzf(本次方案)
- **Git Bash / WSL** → Atuin(SQLite 存历史、全文搜索、多机加密同步)

## 二、安装命令(全部 winget/curl 可复现)

```cmd
:: 1. Clink
winget install chrisant996.Clink

:: 2. fzf
winget install junegunn.fzf

:: 3. clink-fzf 插件(单个 lua 文件,见下方坑2,推荐用 api.github.com 下载)
curl -s -m 60 -H "Accept: application/vnd.github.raw" "https://api.github.com/repos/chrisant996/clink-fzf/contents/fzf.lua" -o "%USERPROFILE%\clink\fzf.lua"
```

装完**把 cmd / Windows Terminal 整个关掉重开**(PATH 改过,旧窗口和新标签页都是旧环境快照),验证:

```cmd
clink info      :: clink 状态
fzf --version   :: fzf 版本
```

## 三、踩坑记录

### 坑1:winget 装完 Clink 后 `clink` 命令找不到
- 现象:`'clink' 不是内部或外部命令`
- 原因:winget 静默安装**没把安装目录加进 PATH**,但 cmd 的 AutoRun 注入注册表项是配好的(新 cmd 其实已经在用 clink 了)
- 补救:PowerShell 手动追加用户 PATH
  ```powershell
  [Environment]::SetEnvironmentVariable("Path", [Environment]::GetEnvironmentVariable("Path","User") + ";C:\Program Files (x86)\clink", "User")
  ```
- 教训:**装完≠PATH 立即生效**,已开的窗口永远看不到,必须整个重开 Windows Terminal(新标签页也继承旧环境!)

### 坑2:clink-fzf 的下载地址是错的
- 网上教程写的 `github.com/.../releases/latest/download/fzf.lua` → **404**,该仓库根本没有 Releases,`fzf.lua` 直接放在 main 分支根目录
- 换 `raw.githubusercontent.com/chrisant996/clink-fzf/main/fzf.lua` → **卡死超时**。原因:国内网络下 `github.com`、`api.github.com`、`objects.githubusercontent.com`(winget 下载走这个)可能直连可通,但 `raw.githubusercontent.com` 基本必被墙,两个域名通不通互不相干
- **通用解法:用 GitHub contents API 拿原始文件**(走 api.github.com):
  ```bash
  curl -s -H "Accept: application/vnd.github.raw" "https://api.github.com/repos/ owner/repo/contents/文件路径" -o 输出文件
  ```
  这个技巧以后在无代理环境拉 GitHub 单个文件都能用

### 坑3:Git Bash 里查注册表
- `reg query ... /v` 的 `/v` 参数会被 Git Bash 路径转义弄坏,报"无效语法"
- 解法:前面加 `export MSYS_NO_PATHCONV=1`(和给 paramiko 传 /root 参数同一个坑)

## 四、日常用法速查

| 操作 | 效果 |
|---|---|
| 敲命令时出现灰色建议 | 按 `→` 或 `End` 一键接受整条 |
| `Ctrl+R` | fzf 面板模糊搜历史,随便输片段(`3306`、`findstr`都行),实时过滤 |
| `Ctrl+T` | 模糊补全文件名(fzf 面板选当前目录文件,选中插入路径) |
| `history` | 查看全部历史 |

### 实战示例:查端口占用 → 定位进程

```cmd
netstat -ano | findstr :3306          :: 拿到 PID(本机实例:PID 7008)
tasklist /fi "PID eq 7008"            :: → mysqld.exe (MySQL80 服务)
tasklist | findstr mysql              :: 按名字查任务
netstat -ano | findstr LISTENING      :: 看全部监听端口
taskkill /pid <PID> /f                :: 杀进程(⚠️系统服务别这么杀,用 net stop)
```

第一次手敲,以后 `Ctrl+R` 输个端口号就能召回整条。

## 五、关于"远程连接命令会不会被记住"(未完待验证)

- cmd 里敲的连接命令(如 `ssh root@1.2.3.4`)**会**进 clink 历史(明文,存本地 `C:\Users\yaya\clink\`)
- **ssh 连上之后在服务器里敲的命令不在 clink 里**——那是服务器端自己的 `~/.bash_history`
- PowerShell / Git Bash 里的命令也不在,各家历史独立
- ⚠️ 安全提醒:历史是明文,别把密码写进命令行(如 `mysql -uroot -p密码` 会被原样记录);ssh 用密钥登录。clink 支持排除规则(`clink set history.ignore "pattern"`)和"命令前加空格不记录"开关(`history.ignore_spc`)
- (具体配置值还没验证完,下次继续)

## 六、网络环境备注

今天周一未开 Clash,实测:`github.com` 直连可通(winget 从 GitHub 下载成功)、`api.github.com` 可通、`raw.githubusercontent.com` 不通。和"代理仅周日可用"的记忆吻合,但 GitHub 主站不一定每次都通,不通就等周日。
