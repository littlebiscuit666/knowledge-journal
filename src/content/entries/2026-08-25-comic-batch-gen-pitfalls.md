---
title: "重生之巅峰时代批量出图踩坑总结"
date: 2026-08-25
category: 生活
tags: [漫画, comfyui, 批量出图, 日记归档]
draft: false
---

今天一气呵成把第13-35章(85话 / ~1020格)的分镜预产推完,然后租 AutoDL 把第51-165话全量出图底图。中间踩了几个坑,有些是脚本 bug,有些是网络/服务架构问题,有些是我自己一开始理解错的,记下来给以后的自己/接手的人。

---

## 一、今日工作概览

| 阶段 | 内容 | 用时 |
|---|---|---|
| 上午 | 第26-35章分镜预产(10章 50话 600格),4波并行分身 | ~3 小时 |
| 中午 | 第13-25章跨章锚点冲突兜底(陈思远/刘思琪/顾维明/李鹏飞/周瀚文) | ~30 分钟 |
| 下午 | 租卡日环境准备:SSH 探测 → deploy_comfyui.sh → 隧道 → lora-studio → 烟雾测试 → 全量 | ~1.5 小时 |
| 中途 | 换网事故排查 + 服务重启 + 重跑 | ~25 分钟 |
| 现在 | 全量跑继续(后台,预计 ~4 小时) | - |

---

## 二、分镜预产阶段(上午)

### 坑 1:分身 API 429 限额

- ch29 分身读完后准备写梗概时,被 API 限额(`[1308] 5 小时使用上限,2026-08-25 14:02:12 重置`)
- **重跑后正常**(等重置即可)。但要是卡在"已读原文、未写文件"的中间状态,会浪费一次完整的原文读取
- **以后**:不要用 4 个并行分身太多,1-2 个更稳;且每个分身必须**先读完原文再开始写**,失败不要从中间续

### 坑 2:跨章锚点冲突

- ch32 写 周瀚文 = "43岁高盛亚太科技组执行董事"
- ch33 写 周瀚文 = "40岁投行代表(模糊化,不写高盛)"
- 同名+同人,需要在 01_锚点库.md 标 `★跨章统一`,prompt 端用干净版(ch33 那个),文档(梗概)里把"高盛"全替换为"投行代表"
- 类似的还有 ch14/ch15 黄志强、ch19-21 陈思远刘思琪、ch22-23 李鹏飞体型
- **统一铁律**:脸锚不变,服装可变,年龄随剧情年份;**任何跨章命名角色必须在 01_锚点库先查有没有 → 复用 → 没有就新加**

### 坑 3:克隆遏制(audit.py 救场)

- 200+ LoRA 格漏写 `solo, completely empty bokeh background` 配方
- 一波 4 分身写完才审计发现,临时写 `audit.py` 自动修复:prompt 中检测 `solo` + `bokeh` 任一缺失,自动插入 `solo, completely empty bokeh background, ` 在 STYLE 后缀前;negative_extra 补 `clone, duplicate, twin, multiple same person`
- **以后**:每个分身 prompt 里直接强调"每写一个 panel 立即自查克隆遏制",写在铁律清单第一条

---

## 三、租卡日环境准备(下午)

### 坑 4:ComfyUI 启动路径硬编码

- 我第一反应是直接 `cd /root/ComfyUI && python main.py --port 6006 --listen 0.0.0.0`
- **错的**。用户提醒后才发现有 `/root/deploy_comfyui.sh`,干的事:
  1. 软链 diffusers 底模(`/root/autodl-tmp/models/animagine-xl-3.1/` → `ComfyUI/models/{unet,vae,clip}/`)
  2. 软链 lora_train/output 全部 LoRA → `ComfyUI/models/loras/`
  3. 复用 `lora_train/env`(已有 torch 2.13 cu130)
  4. `setsid nohup` 启动 → PID 写入 `c.log`
- 我手动启的话会漏软链(用 checkpoints/animagine-xl-3.1.safetensors 单文件,而非 diffusers 三件套),workflow 要用 `UNETLoader + DualCLIPLoader + VAELoader` 而非默认 Load Checkpoint
- **以后**:任何 AutoDL 上的 ComfyUI 操作,**先看有没有 deploy_*.sh,优先跑**

### 坑 5:端口变更未同步

- 8/9 之后 ComfyUI 迁到 **6005**(走 SSH -L 隧道),6006 留给 http.server 下载服务
- 但 `deploy_comfyui.sh` **没改,仍 hardcode 6006**
- 我跑 deploy_comfyui.sh,ComfyUI 又占回 6006(刚好 http.server 没运行,没冲突)
- `cfy.sh` 内部已经是 6005(下一次重启会正确)
- **以后**:deploy_*.sh 和 launch_*.sh 端口要统一,定期校对

### 坑 6:autodl_forward.py 隧道路径

- `autodl_forward.py` 是 **本地 6007 → 远程 6006** 的 SSH 隧道
- lora-studio 的 `config.json` 里 `comfy_url: http://localhost:6007`
- 链路:`lora-studio 8899` 调 → `localhost:6007` → SSH tunnel → `AutoDL:6006 (ComfyUI)` → 出图 → 回到本机下载
- **隧道是个独立的 Python 进程**,由 `Bash run_in_background` 启 → 用 task_id 管
- 隧道参数跟 config.json 配套,改要同步

---

## 四、批量出图脚本 bug

### 坑 7:Python 3.11 f-string 嵌套限制

- `batch_generate.py` 里 3 处用了 f-string 内嵌 f-string(`f"x" + (f"y" if cond else "")`)
- Python 3.11 报 SyntaxError(PEP 701 之前限制)
- **修复**:提前算 `tail = ", error " + str(err) if err else ""`,然后用普通 f-string 拼接
- **以后**:Python 3.12 之前,别在 f-string 表达式里再写 f-string;或者直接 `.format()`

### 坑 8:batch_generate 把"全 error"算完成

- 代码:
  ```python
  if gen == 0:  # 没在 generating
      log(f"    {eid} 完成: ok {ok}/{total}{tail}")
      break
  ```
- 问题:如果某话 12 张全 error(网络断了 / 提交失败),`gen=0` 也满足 → 当作完成,进下一话,**永不回头 retry**
- **修复**:跑完后用 `python batch_generate.py 51 165 --retry` 兜底,跑一次 error 重提
- **更优改进**(待做):每话结束如果 `err > 0` 且 `< total`,自动 retry 该话

### 坑 9:超时 deadline 兜底释放 `_comic_running`

- lora-studio worker 内部 while 循环:`while pending and time.time() < deadline`,deadline = 900s
- 如果 fetch 抛异常但被 fetch() 内部 try-except 兜底返回 "running",worker 永远不死循环
- 直到 deadline → timeout 兜底 → finally discard eid from `_comic_running`
- 换网 8 分钟 < 900s,**worker 一直 hold 第55话的 _comic_running**,新提交的同一话被 400 拒绝
- **改进**:fetch() 抛异常时不返回 "running",而抛出来让 worker 记入 failed 集合(可能修起来工程量大)

---

## 五、换网事故(核心踩坑)⏰

**事故链**(10:33 → 10:52 全过程):
1. 10:33 全量跑起,51-54话顺利,55话 6 ok + 6 submitting
2. **你换网**,本机到 AutoDL TCP 隧道瞬断
3. 10:40-10:48 lora-studio worker fetch ComfyUI 异常 → 把 55话 6 + 56-63话全标 error
4. 10:48 我重启 batch_generate → 但 lora-studio worker stuck,_comic_running 占着 → 第55话提交 400
5. 10:48-10:52 错误累积,越跑越乱
6. 10:52 我 `os.kill(3536, SIGTERM)` 杀旧 lora-studio → subprocess.Popen 重启 → 重启 batch_generate → 链路通了

### 坑 10:autodl_forward.py 隧道不自动重连

- paramiko SSHClient 长连接断后,**不会自动 reconnect**
- 进程还活着,但新连接过来时 transport 已 dead,handler 抛 10054
- **修复**:换完网必须 **TaskStop + 重启 tunnel**(Bash run_in_background)
- **改进**(待做):在 autodl_forward.py 加 `while True: try accept ... except: reconnect transport`

### 坑 11:batch_generate 的 urllib.socket stuck

- 第一次换网后,旧 batch_generate 进程 urllib.socket 进入 broken state
- 同一个进程,本地 8899 lora-studio 重启后能 200,但 batch_generate 仍报 WinError 10061
- **解决**:**只能 TaskStop + 重启 batch_generate**,没别的办法
- **改进**:fetch 时增加重试 + 失败重连 socket

### 坑 12:lora-studio 杀进程

- 旧 lora-studio 是 `Bash run_in_background` 启的 task (blje04geb)
- 但**它只是个挂着 read 的 Python 进程**,Python 进程本身 = FastAPI server
- 想清理状态只能杀 Python 进程:
  - Git Bash 下 `tasklist /FI` 被 MSYS 路径转换搞坏(`/` 当路径分隔符)
  - **最稳**:`netstat -ano | grep 8899` 拿 PID → Python `os.kill(pid, SIGTERM)`
  - PID 3536 = lora-studio
- 重启用 `subprocess.Popen([...], cwd=..., stdout=open(log,'a'), stderr=STDOUT)`,detached 后**不再依赖 background task**

### 坑 13:换网前预警(应该提醒用户)

- 当时没明确告诉用户"换网要 TaskStop batch_generate",只说"换完我帮你重启"
- **应该**:换网前停一切 background 任务(隧道 + batch_generate + lora-studio 都是),换完按顺序重启:
  1. autodl_forward.py (隧道)
  2. lora-studio
  3. batch_generate
- **以后做**:写个 `restart_all.bat` 脚本

---

## 六、命令速查(以后照抄)

```bash
# === SSH 远程命令 ===
AUTODL="C:/Users/yaya/.claude/tmp/autodl_ssh.py"
PY="C:/Users/yaya/AppData/Local/Programs/Python/Python311/python.exe"
"$PY" "$AUTODL" "<cmd>"

# 探活
"$PY" "$AUTODL" "nvidia-smi --query-gpu=memory.used,utilization.gpu --format=csv,noheader"
"$PY" "$AUTODL" "ps aux | grep main.py | grep -v grep"
"$PY" "$AUTODL" "ls /root/ComfyUI/output/ | wc -l"  # 已出图数

# 部署 ComfyUI(走标准流程)
"$PY" "$AUTODL" "bash /root/deploy_comfyui.sh"

# === 本机 ===
# 隧道(后台)
"$PY" "C:/Users/yaya/.claude/tmp/autodl_forward.py"   # task ID

# lora-studio(后台或 detached)
cd /d/lora-studio && "$PY" app.py                       # 用 background task
# 或 detached:
"$PY" -c "import subprocess; subprocess.Popen(['$PY','D:/lora-studio/app.py'], cwd='D:/lora-studio', stdout=open('D:/lora-studio/app.log','a'), stderr=subprocess.STDOUT)"

# 批量出图
"$PY" "C:/Users/yaya/.claude/tmp/batch_generate.py" 51 165
"$PY" "C:/Users/yaya/.claude/tmp/batch_generate.py" 51 165 --retry  # error 重提

# 探活 8899 / 6007
"$PY" -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8899/api/comic/episodes', timeout=5).status)"
"$PY" -c "import urllib.request; print(urllib.request.urlopen('http://localhost:6007/system_stats', timeout=5).status)"

# 看日志
tail -f C:/Users/yaya/.claude/tmp/batch_generate.log

# 杀进程(Git Bash 友好)
netstat -ano | grep ':8899' | head -3   # 拿 PID
"$PY" -c "import os, signal; os.kill(3536, signal.SIGTERM)"
```

---

## 七、待改进(下次直接做)

1. **`batch_generate.py`**:
   - 每话结束如果 `err > 0`,自动 inline retry(不依赖 --retry)
   - 增加心跳 ping lora-studio 8899(失败就重连 socket)
   - 增加全局 `--from-episodes` 参数,从指定话开始
2. **`autodl_forward.py`**:
   - transport 断开自动 reconnect 循环
   - 加 `--auto-reconnect` 开关
3. **`lora-studio` 改进**(可选):
   - fetch() 失败时区分网络异常 vs 真"running",前者重试,后者等待
   - `_comic_running` 加 watchdog,超时自动释放
4. **`restart_all.bat`**:一键重启隧道 + lora-studio + batch_generate
5. **`deploy_comfyui.sh`**:把端口改成可配置(`--port ${COMFY_PORT:-6005}`)
6. **出图后清理**:`/root/ComfyUI/output/` 老的失败图脚本化清理(按 episode.json panel.image 反向对账,没引用的全删)

---

## 八、当前进度(写文档时)

```
第51-54话: ✅ 23 张图,本机已下载
第55话:    🔄 6 ok + 6 error 正在重跑
第56-63话: 🔄 全部 error 正在重跑(换网期间失败 8 话)
第64-165话: ⏳ pending 等待

后台 batch_generate 任务: bl93g7r4z
日志: C:\Users\yaya\.claude\tmp\batch_generate.log

预计: ~4 小时全部完成
```

## 九、参考的既有文档(2026-07-30 / 2026-08-03)

今天开干前我应该先读这两份,你桌面已有,这里只列关键摘要:

### 9.1 `2026-07-30_AutoDL部署工作总结.md`

今天踩的很多坑本来文档里已经写过了,记录如下:

| 已知坑 | 今天的踩法 |
|---|---|
| **AutoDL 自定义服务只代理 6006/6008** | 我用了 6007+SSH 隧道(只本机用,完全 OK),但要清楚 6006/6008 是公网可访问 |
| **ComfyUI 部署用 deploy_comfyui.sh(系统盘+软链 diffusers+复用 lora_train/env)** | 我第一反应手动启 `python main.py`,被提醒才走 deploy_comfyui.sh |
| **deploy_comfyui.sh 内部 nohup 没 `</dev/null`**,autodl_ssh.py 启动必须 `setsid bash deploy_comfyui.sh </dev/null` | 我用 `bash /root/deploy_comfyui.sh` 跑,直接执行(非 ssh helper),走了 30s sleep 验 listening,绕开了这个坑 |
| **autodl_ssh.py 对 `setsid &` 后台命令 exit 1 + 漏读 stdout** | 同上,直接跑 ssh helper 命令 + sleep + ss/netstat 验 |
| **AutoDL 容器无 `fuser`** | 杀进程靠 `pkill -f` / Python `os.kill(pid, SIGTERM)`(我用的是后者,因为 Git Bash 下 tasklist /FI 被 MSYS 路径转换搞坏)|
| **pip 装 torch cu 版拖一堆 nvidia-* 大包**,同机已装就软链复用 | deploy_comfyui.sh 自动复用 lora_train/env,无需重装 |
| **gradio 4.44 bug** | 跟我无关(Qwen-TTS 项目才用) |

### 9.2 `AutoDL westc 服务器文件路径地图.md`

| 已知信息 | 今天的踩法 |
|---|---|
| **ComfyUI 路径**:`/root/ComfyUI`(系统盘) | ✅ 我找到了 |
| **底模软链**:`models/unet/animagine_unet.safetensors` 等三个组件 | deploy_comfyui.sh 已自动建(我手动启会漏) |
| **LoRA 软链**:`models/loras/*.safetensors` ← `lora_train/output/` | deploy_comfyui.sh 已自动建(我手动启会用错路径) |
| **底模是组件软链 → workflow 必须用 UNETLoader + DualCLIPLoader + VAELoader** | lora-studio 已有 `templates/comic_lora_*.json` 走这套,无需手动改 |
| **`cfy.sh` 内部 `--port 6005`**(8/9 改),`deploy_comfyui.sh` 内部 `--port 6006`(没改) | 我直接跑了 deploy_comfyui.sh,ComfyUI 启在 6006。http.server 6006 没在跑,所以没冲突,但 cfy.sh 和 deploy_comfyui.sh 端口应该统一 |
| **路径地图说 6005 走 ssh -L 隧道,不走 AutoDL 自定义服务** | 我用 6007 → 6006(本机隧道),本质相同,只是端口号不同 |
| **6006 是 http.server 下载服务** | 我占了 6006 跑 ComfyUI,没冲突是巧合(没人在跑 http.server) |
| **AutoDL 杀 ComfyUI 不要 `pkill -f main.py`**(会自杀),要 `pkill -f 'env/bin/python main.py'` | 我用 Python `os.kill(3536, SIGTERM)`,直接 PID 杀,更精准 |
| **`setsid bash /root/cfy.sh </dev/null`** 启动套路 | 没用(cfy.sh 当前是 6005,我跑 deploy_comfyui.sh 是 6006)|
| **autodl_ssh.py Git Bash 传 `/root/...` 路径参数要 `MSYS_NO_PATHCONV=1`** | 我全程直接走 ssh helper,没用 Git Bash 路径参数,绕开 |
| **ComfyUI 工作流默认 6005**,config.json 写 `comfy_url: http://localhost:6007`(上一版配置,已自改)| 我查时是 6007,符合预期 |

### 9.3 我应该在开干前就建立的 checklist

```
□ 读 桌面\日记\2026-07-30_AutoDL部署工作总结.md
□ 读 桌面\日记\AutoDL westc 服务器文件路径地图.md
□ 读 记忆:AutoDL-ComfyUI部署 / autodl_ssh setsid& 坑 / autodl 角色 LoRA 配方
□ SSH 上去 ls /root/ComfyUI /root/cfy.sh /root/deploy_comfyui.sh(确认存在)
□ 确认 GPU 型号 + 显存(40/80S/40/A100 决定 LoRA 选择)
□ 跑 bash /root/deploy_comfyui.sh(不要手动启 main.py)
□ sleep 25 + curl localhost:6006/system_stats 验
□ 起 autodl_forward.py 隧道(6007 → 6006)
□ 起 lora-studio (8899),config.json comfy_url=6007
□ 烟雾跑 51-52(2 分钟验链路)
□ 跑全量 batch_generate.py 51 165
```

---

## 十、架构反思(本对话最后一条)

今天出图链路其实是过度设计了:

### 现在的链路(我搭的)

```
[AutoDL 远程 GPU]
  ComfyUI :6006 ← 出图 → 存 /root/ComfyUI/output/<时间戳>.png
      ↑ HTTP API
[本机 8899]                  [本机 6007]
  lora-studio  ──SSH隧道──→  autodl_forward.py → 6006
      │
      ├─ 提交 workflow prompt
      ├─ fetch + download 结果
      └─ 存到 D:\lora-studio\work\comic\第N话\<pid>_<seq>.png
[用户] → 本地浏览器访问 localhost:8899 看图
```

**问题**:SSH 隧道很脆弱 — 换网/休眠/网络抖动直接挂,worker stuck,需要手动重启。

### 用户想要的简化链路

> "其实不需要把远程的 ComfyUI 代理到本地的端口,只需要远程批量生成图片,然后我能在 lora_studio 看到就可以了啊"

→ **核心思路**:lora-studio 不需要驱动 ComfyUI,只看图就行

### 关于端口(关键澄清,别再混淆)

**任何端口都行** —— 之前我说的"6006/6008"只是 AutoDL **公网代理**的硬限制,跟实际服务端口无关。

| 访问方式 | 端口限制 |
|---|---|
| **AutoDL 公网代理**(任何浏览器能访问)| **只能 6006 / 6008**(系统硬限制,这是 AutoDL 规定)|
| **SSH 隧道本地访问**(本机 localhost:XXXX)| **任何端口都行**(我现在用的 6007 就是)|
| **AutoDL 容器内 127.0.0.1**(同机 lora-studio 调 ComfyUI)| **任何端口都行** |

所以方案 A "6008"只是"想从任何地方访问才必须 6008",如果你只在本机 SSH 隧道访问,**8899 / 7000 / 12345 都行**。

### 简化方案(下次租卡用这个)

**方案 A:lora-studio 跑在 AutoDL,图全在远程(最简)**

```
[AutoDL 容器内部]
  ComfyUI :<任意端口,比如 6006> ← 出图
  lora-studio :<任意端口,比如 6008 或 8899>
       │ (127.0.0.1 同机直连,没隧道)
[如果你想任何浏览器访问] → 走 AutoDL 6006/6008 公网代理
[如果你只用本机] → 本机 ssh -L 隧道 / autodl_forward.py 任意端口
[用户] → 浏览器看图
```

- ✅ 没有 SSH 隧道(lora-studio 跟 ComfyUI 同机 127.0.0.1 直连)
- ✅ 不怕换网
- ✅ 端口随便挑(只要 AutoDL 公网访问限制 6006/6008)
- ⚠️ 需要把 lora-studio 部署到 AutoDL(目前只在本地)
- ⚠️ lora-studio 数据(work/comic/...)也要放 /root/autodl-tmp/

**方案 B:本地 lora-studio + 远程 ComfyUI 独立跑(轻改)**

```
[AutoDL]
  ComfyUI :<任意端口> ← 出图存 /root/ComfyUI/output/
  watch_and_sync.sh: 每分钟把新图 rsync/scp 到本机 D:\lora-studio\work\comic\第N话\
  batch_generate.py 直接调 ComfyUI HTTP API(跑在 AutoDL 上,不绕本机)
[本机]
  lora-studio :<任意端口> 只看图,不驱动
  [用户] → 浏览器访问 localhost:<任意端口>
```

- ✅ 本机 lora-studio 工作流不变,用户使用习惯不变
- ✅ 没有 SSH 隧道依赖
- ✅ 任何端口都行
- ⚠️ batch_generate 要搬到 AutoDL 跑
- ⚠️ 需要写个简单的"sync 图到本机"的 watch 脚本

**方案 C(终局):本机自己有 GPU 的话,完全在本地跑**

- 当前架构不用改,但 AutoDL 不用租了
- (今天租卡是因为没有本地 GPU,所以此方案不适用)

### 我的建议

**这次就继续用现在的架构把第51-165话跑完**(已经跑了一半,改架构风险大)。**下次租卡用方案 A**:

1. 把 lora-studio 整个项目 rsync 到 `/root/autodl-tmp/lora-studio/`
2. 在 AutoDL 上 `nohup python app.py --port <任意> &`(或者挂 6006/6008 让 AutoDL 代理)
3. 数据(work/comic/) 也放远程
4. 浏览器访问(看访问方式选 AutoDL 6006/6008 公网代理,或本机 ssh -L)

进一步:
- lora-studio 加"远程模式"配置(指向 http://localhost:<ComfyUI 端口> 而不是 6007)
- batch_generate 同样跑在 AutoDL 上(因为它直接调 ComfyUI)

### 关键判断:什么时候值得重构?

- 现在跑着 → 不重构,跑完再说
- 重构收益 > 1 次重跑成本 → 值得(下次开机直接用)
- 这次换网故障(25 分钟)≈ 0.5 张图的 GPU 时间 + 人力排查 —— 下次再发生就亏了

---

*文档生成于 2026-08-25,AutoDL 实例 connect.westc.seetacloud.com:5xxxx / RTX 4080 SUPER*
