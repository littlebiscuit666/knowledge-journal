---
title: "重生之巅峰时代：LoRA 数据集制作 + lora-studio 应用总结"
date: 2026-08-22
category: 生活
tags: [漫画, lora, 数据集, 日记归档]
draft: false
---

> 2026-08-22 ｜ 接前日: 4角色定妆图由 Codex 产出(见`D:\Qoder-workspace\重生之巅峰时代\`两份交接文档)

## 一、今天完成的里程碑

### 1. 即梦4.0 参考图生图扩产成功（本项目数据问题的最终解法）

- **方法**: 以 Codex 定妆图为参考图（`binary_data_base64` 传原图），每张候选图用**同一张定妆图**锚身份，只换 prompt 里的场景词
- **参数**: `jimeng_t2i_v40`, `scale=0.3`（低=贴脸保服装，高=听场景会漂）, `force_single:true`（防多张计费）, 1024×1536
- **流程**: 先 4角色×3场景试水 → 用户看对比总表认可 → 扩满 12场景×4角色 = **48 张，全部验收通过**（"都可以的"）
- **12 个场景**: 书桌电脑/校园行走/微笑特写/教室听讲/图书馆抱书/讲台展示/操场跑步/食堂排队/夜晚屏光/雨天撑伞/托腮思考/大笑特写（覆盖角度/表情/姿势/室内外/昼夜）
- **关键认知**: 之前失败是"animagine 出图+即梦扩图"两套画风混着训；这次整包数据全部出自同一来源（Codex 底图+即梦同参数），画风内部统一，才过了关
- 产物: `D:\Qoder-workspace\重生之巅峰时代\lora_dataset\<角色>\v01~v12.png` + 对比总表 `expand_sheet_full.jpg`

### 2. 打标 + 上传 + 训练点火

- **txt 格式**（与服务器12个已训角色一致）: `<拼音>_char, 锚点串, 场景danbooru标签`；触发词首位靠 kohya `keep_tokens=1` 锁住
- **上传**: westc 这台的代理**支持 SFTP**（nmb1 那台不行，只能 base64-over-exec）——96 个文件 180 秒传完，落 `/root/autodl-tmp/lora_train/dataset/img/<char>/`
- **训练配方**: 12图×12repeats×10epoch = **360步/角色**（≈37分钟）。原本按模板跑15epoch，用户拍板"角色简单10轮够"，及时杀掉重启（才跑2分钟，零损失）
- 训练脚本: 服务器 `/root/autodl-tmp/lora_train/scripts/run_all_4char.sh`（本地镜像 `C:\Users\yaya\.claude\tmp\run_all_4char.sh`）
- 产物: `luchen-v1 / suqing-v1 / wanghaoran-v1 / zhaomingyuan-v1`，16:47 点火，ETA ~19:25
- 下一步: ComfyUI 验证一致性 → 开做漫画第1话

### 3. lora-studio 应用 v1（把今天的手工流程固化成工具）

**`D:\lora-studio`，`python app.py` → http://localhost:8899**

- 定位: 定妆图1张 → 即梦4.0扩产 → 前端✓/✗勾选+txt可编辑 → 打包 `output\<拼音>\img_NN.png+txt`+zip
- 架构: FastAPI(`app.py`) + 原生单页(`static/index.html`) + 纯逻辑(`core.py`可测) + 即梦薄封装(`jimeng.py`); AK/SK在`config.json`
- 特性: 12预置场景+自定义场景、scale滑条、候选流式回显(3s轮询)、单张失败重试、刷新从`work\`恢复会话、**开始生成前弹"马上要花钱了"确认框**（用户要求，已实测：取消=零请求）
- 质量: 5个pytest全过 + 浏览器E2E验证到生成前一步; git三连提交
- 边界: 应用只管到打包；上传AutoDL+训练仍由Claude接手

## 二、踩坑记录（新增）

| 坑 | 现象 | 解法 |
|---|---|---|
| pkill 自杀 | `pkill -f run_all_4char.sh` 把执行命令的SSH shell自己也匹配杀了(exec命令行里含同样字符串) | 按PID杀; 或 pkill -f 匹配串避开自身 |
| Git Bash 路径转义(又来) | 传给paramiko的`/root/...`被转成`C:/Program Files/Git/root/...`传到垃圾路径 | `MSYS_NO_PATHCONV=1`前缀, 已写进肌肉记忆 |
| curl 中文乱码 | Git Bash curl发multipart中文=GBK, 服务器存乱码 | 只是测试工具问题; python requests/浏览器UTF-8均正常, 服务器端无bug |
| 加速重训时机 | 改epoch数时训练已跑 | kohya前2分钟纯在加载, kill重启零成本; 发现配置不对趁早杀 |

## 三、关键路径速查

| 内容 | 路径 |
|---|---|
| 数据集(本地) | `D:\Qoder-workspace\重生之巅峰时代\lora_dataset\` |
| 定妆图(身份基准) | `D:\Qoder-workspace\重生之巅峰时代\角色定妆图\` |
| 扩图脚本 | `C:\Users\yaya\.claude\tmp\try_expand.py`(12场景在SCENES里) |
| 打标脚本 | `C:\Users\yaya\.claude\tmp\make_labels.py` |
| SFTP批量上传 | `C:\Users\yaya\.claude\tmp\upload_lora_dataset.py` |
| 训练状态(服务器) | `/root/autodl-tmp/lora_train/logs/run_all_4char.status` |
| lora-studio | `D:\lora-studio`(README有启动说明) |

## 四、待办

1. ✅ 训练完成确认(~19:25) → 软链 `/root/ComfyUI/models/loras/`
2. ComfyUI 拉起(6005) + 出跨场景一致性对比图给用户验收
3. 验收过 → 《重生之巅峰时代》漫画第1话(复用`comfy_run_comic.py`+`comic_compose.py`流水线)
