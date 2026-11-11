---
title: "AutoDL ComfyUI 更新记录"
date: 2026-08-09
category: 技术
tags: [autodl, comfyui, 更新, 日记归档]
draft: false
---

> **实例**: `connect.westc.seetacloud.com:5xxxx` · root · RTX 4080 SUPER 32G
> **来源**: 2026-08-09 实地连接侦察(本机 paramiko 脚本)
> **上次快照**: 2026-08-03,见同目录《AutoDL westc 服务器文件路径地图.md》

---

## 一、本次核心变化(相比 8/3 快照)

### 1. 服务端口改为 6005 ★
- `/root/cfy.sh` 现在启动 ComfyUI 在 **6005**(8/3 记录的是 6006)
- 用户确认:就用 6005
- ⚠️ AutoDL「自定义服务」网页只代理 6006,6005 需 SSH 隧道访问(见 §三)

### 2. 新增自定义节点(custom_nodes)
8/3 只有 `ComfyUI-Impact-Pack` + `websocket_image_save.py`,本次确认新增:
| 节点包 | 版本 | 用途 |
|---|---|---|
| **ComfyUI-Manager** | V3.41 | 节点/模型管理器(以后装东西方便) |
| **ComfyUI-ComfyCouple** | — | 双人/情侣出图 |
| **ComfyUI-Impact-Subpack** | V1.3.5 | Impact 子包 |

### 3. Detailer 缺依赖问题已修复 ★
- 之前:Impact-Pack 缺 `skimage`,`FaceDetailer` 等 Detailer 类节点不可用(基本出图不影响)
- 现在:装了 Impact-Subpack 后修复。`/object_info` 确认 **FaceDetailer / FaceDetailerPipe / DetailerForEach 等 34 个 Detailer 节点全部就绪**
- 节点总数达 **1018**

### 4. 新增工作流(user/default/workflows/,全 2026-08-08)
| 文件 | 大小 | 修改时间 | 说明 |
|---|---|---|---|
| `sdxl_char_lora.json` | 14K | 15:08 | 单角色 LoRA 基础出图流 |
| `couple_kafuka_robin.json` | 25K | 17:28 | kafuka+robin 情侣图(初版) |
| `couple_kafuka_robin_facedetail.json` | 33K | 19:13 | 加 face detail |
| `couple_kafuka_robin_facedetail_fixed.json` | 33K | 19:13 | face detail 修复版 |
| `couple_kafuka_robin_facedetail_v2.json` | 33K | 20:30 | face detail v2(**最新**) |

主线:**kafuka+robin 双人情侣图**,face detail 反复迭代(_fixed → _v2)。

---

## 二、ComfyUI 运行状态快照(2026-08-09 13:48)

- **进程**: PID 1402 — `/root/autodl-tmp/lora_train/env/bin/python main.py --listen 0.0.0.0 --port 6005`
- **版本**: ComfyUI 0.29.0 / frontend 1.47.10 / PyTorch 2.13.0+cu130 / Python 3.10.8
- **GPU**: RTX 4080 SUPER,显存 33.5G 空闲
- **探活**: `curl http://127.0.0.1:6005/system_stats` 正常响应
- **日志**: `/root/autodl-tmp/c.log`,全部自定义节点加载无报错

---

## 三、启动与访问速查

### 启动 ComfyUI(6005)
本机 Git Bash(paramiko 脚本,密码已硬编码):
```bash
MSYS_NO_PATHCONV=1 python "C:/Users/yaya/.claude/tmp/autodl_ssh.py" \
  'setsid bash /root/cfy.sh </dev/null >/dev/null 2>&1 & sleep 25 ; pgrep -af "env/bin/python main.py" | grep -v pgrep'
```
要点:
- `cfy.sh` 内部 `nohup ... &` 没有 `</dev/null`,经 SSH 启动**必须**包 `setsid ... </dev/null >/dev/null 2>&1`,否则 ComfyUI 持有 channel stdin 卡死
- **不要** `pkill -f "ComfyUI/main.py"`(命令串含该字样会杀掉自己);停服务用 `pkill -f 'env/bin/python main.py'`

### 浏览器访问(6005 走 SSH 隧道)
本地另开终端:
```
ssh -p 5xxxx -L 6005:localhost:6005 root@connect.westc.seetacloud.com
```
密码 `********`,然后浏览器开 `http://localhost:6005`

### 停服务
```bash
pkill -f 'env/bin/python main.py'
```

---

## 四、待办 / 下一步

- [ ] 跑 kafuka+robin 情侣图验证 `couple_kafuka_robin_facedetail_v2`(FaceDetailer 现已可用)
- [ ] 备份 `user/default/workflows/` 下 5 个工作流到本地(防实例丢失)
- [ ] (可选)同步本文件信息到《AutoDL westc 服务器文件路径地图.md》——其 §2.1 / §2.4 / §6 已过时

---

## 五、本次踩坑备忘

1. **`pkill -f "ComfyUI/main.py"` 自杀**:命令行本身含匹配串,pkill 杀掉了正在执行的 shell → 输出中途断裂。改用 `env/bin/python main.py` 精确匹配。
2. **`~/autodl_ssh.py` 路径错**:Windows python 把 `~` 展开后的 `/c/Users/...` 当成 `C:\c\Users\...`。要用 Windows 风格 `C:/Users/yaya/.claude/tmp/autodl_ssh.py`。
3. **paramiko 连接偶发 timeout**:AutoDL 网络抖动,重试即可(本次重试一次成功)。
4. **`ss -tlnp | grep 6005` 在该容器对 localhost 回显为空**,但 `curl` 能通 → 以 curl 探活为准,别被空 ss 误导。

---

**相关文档**:
- 《AutoDL westc 服务器文件路径地图.md》(2026-08-03,部分已过时,见 §四)
- 《AutoDL部署ComfyUI经验总结.md》
