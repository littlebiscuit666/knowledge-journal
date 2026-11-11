---
title: "官方 Colab CLI 直连 SSH，弃用 cloudflared 隧道"
date: 2026-11-09
category: 工具
tags: [colab, ssh, kaggle, 日记归档]
draft: false
---

## 一、起因：colab-ssh + trycloudflare 隧道全灭的排查

想 SSH 进 Colab 跑任务，用的是老方案 colab-ssh：

```python
!pip install colab-ssh --upgrade
from colab_ssh import launch_ssh_cloudflared
launch_ssh_cloudflared(password="...")
```

然后本地 `ssh xxx.trycloudflare.com`，报错：

```
websocket: bad handshake
Connection closed by UNKNOWN port 65535
```

### 排查过程（证据链）

| 步骤 | 证据 | 结论 |
|---|---|---|
| 1. 查 `~/.ssh/config` | ProxyCommand 配置正确，cloudflared 2026.10.7 正常 | 本地无问题，报错是 cloudflared 发出的 |
| 2. 第一条隧道 curl | HTTP **530**（Cloudflare Tunnel error） | 隧道进程已死，主机名已注销 |
| 3. Colab 重新 launch 拿新主机名再 curl | HTTP **502** Bad gateway | **隧道活着**（边缘连得上），但 origin 侧服务死了 |
| 4. cloudflared debug 日志 | websocket 升级请求被拒，"failed to connect to origin" | Colab 侧 sshd（22端口）没起来 |
| 5. 扒 colab-ssh 源码（GitHub） | 靠 `apt install openssh-server` + `service ssh start`，**2022 年后停更** | 在 2026 年 Colab 镜像上装不动 sshd |
| 6. Colab 官方 FAQ | 免费档（无计算单元）**明确禁止 SSH shell/远程控制**，且"随时无警告终止" | 就算修好也会被平台掐 |

**结论：免费 Colab + colab-ssh 这条路已死，是政策+技术双重死亡，不值得修。**

> 转机：Google 自己出了官方 CLI（自带 `ssh` 子命令），官方支持的连接方式不受禁令影响。

## 二、新方案：官方 Colab CLI（google-colab-cli 0.7.5）

```bash
uv tool install google-colab-cli    # 装到 C:\Users\yaya\.local\bin\colab.exe
```

⚠️ 官方 README 声明 **Linux/macOS only, Windows 暂不支持** —— 但实测 Win11 + Git Bash 完全可用（execute/ssh/upload 全链路验证过），放心用。

### 授权（一次性的，令牌存本地 `~/.config/colab-cli/`）

任意命令（如 `colab sessions`）会触发 OAuth 流程：打印 URL → 浏览器打开 → 登录 Google → 复制授权码 → 贴回终端。

本次用的授权码（**一次性，已消费作废**，仅作流程记录）：

```
4/0AUn6…（一次性授权码，已消费作废）
```

备用手动授权方法（CLI 交互流程失败时）：

```bash
gcloud auth application-default login --no-launch-browser
```

走同样的 Google OAuth 流程拿授权码。注意：授权必须在**真实交互终端**里做（Claude Code 的 `!` 前缀模式没有 stdin，贴不了码直接 Aborted）。

### 验证全链路

```bash
colab new -s claude-cpu                          # 开 CPU 会话，秒开
echo 'print(1)' | colab exec -s claude-cpu       # 代码执行 ✅ bf7195d3fe1d / Python 3.13
ssh colab-cpu "hostname && whoami"               # SSH ✅ root@bf7195d3fe1d，密钥直连免密码
```

## 三、当前配置

`~/.ssh/config` 新增段（密钥 `id_ed25519` 自动经 `X-Colab-Ssh-Pubkey` 头注册给 VM，无需密码）：

```
Host colab-cpu
    User root
    ProxyCommand C:/Users/yaya/.local/bin/colab.exe ssh --proxy-mode -s claude-cpu
```

VS Code Remote-SSH 直接填 host `colab-cpu` 即可连。旧的 `*.trycloudflare.com` 段已无用（残留无害）。

### 常用命令表

| 场景 | 命令 |
|---|---|
| 进 root shell | `ssh colab-cpu` |
| 开新会话 | `colab new -s 名字`（CPU）/ `colab new -s 名字 --gpu T4`（T4/L4/G4/H100/A100） |
| 跑代码不进 shell | `echo '代码' \| colab exec -s 名字` |
| 一次性跑脚本（跑完自动释放） | `colab run script.py`（加 `--gpu T4` 可带 GPU） |
| 传文件 | `colab upload/download -s 名字 本地 远端` |
| 查会话 | `colab sessions`（活着的不带 `[?]`）/ `colab status` |
| 释放会话 | `colab stop -s 名字` |
| 查算力余额 | `colab usage` |
| 交互式 REPL | `colab repl -s 名字` |

## 四、坑清单（★重点）

1. **`[?]` 前缀 = 僵尸会话登记**：VM 早死了但登记还占着，`exec`/`stop` 都报 "not found"——**但 stop 仍会清掉登记**（报错是假的），要多跑几次+重查列表确认。僵尸堆积会占会话名额导致 `Allocation refused`。
2. **GPU 需要 compute units**：余额 0 时 `--gpu T4` 一律被拒（"Allocation refused (precondition failed)"）。CPU 完全免费不耗额度。本次余额已耗尽（0.00），T4 开不了，`colab pay` 看充值页。
3. **`colab exec` 代码走 stdin 管道**，不收位置参数（`colab exec -s X "code"` 报错）。
4. **首次 `ssh colab-cpu` 要 `-o StrictHostKeyChecking=accept-new`** 登记主机指纹，之后免确认。
5. **授权必须真终端交互**，`!` 前缀/管道模式没 stdin 会 Aborted。
6. Windows "不受支持"但实测能用；出怪问题先想到这层。

## 五、后续

- GPU 需求：要么 `colab pay` 充计算单元（T4/L4/A100/H100 都能开），要么继续用 AutoDL 4080S（现成工具链 `autodl_ssh.py` + 全套配方，性价比更高）
- colab-ssh / cloudflared / trycloudflare 那套彻底退役，本地 cloudflared 程序和 ssh config 残留段可择机清理

## 六、同日追加：Kaggle CLI 配置（GPU 白嫖续命方案）

Colab 算力归零后转向 Kaggle（免费 GPU 约 30h/周，T4/P100）。

```bash
pip install kaggle    # 装的是 google-colab-cli 之外独立的 kaggle CLI 2.2.5，Python311 全局
```

### 认证（新版 token 方式，非老版 kaggle.json）

Kaggle 网页 Settings → API → Create New Token 生成 `KGAT_` 开头的新式 token，存到：

```bash
mkdir -p ~/.kaggle && echo KGAT_xxx > ~/.kaggle/access_token && chmod 600 ~/.kaggle/access_token
```

（也可用环境变量 `KAGGLE_API_TOKEN`。本次配置已验证：`kaggle competitions list` 认证通过拉到列表。）

### 操作 Notebook 的完整闭环（kernels 系列）

| 操作 | 命令 |
|---|---|
| 本地 notebook 推上去跑 | `kaggle kernels push`（元数据可设 enable_gpu / 联网 / 挂数据集） |
| 查运行状态 | `kaggle kernels status`（可轮询） |
| 拉回输出 | `kaggle kernels output` |
| 拉/学别人 notebook | `kaggle kernels pull` |

工作流：本地写 ipynb → push（自动 Save & Run All）→ 轮询 status → output 拉回结果。
Token 文件位置 `C:\Users\yaya\.kaggle\access_token`，别外传。
