---
title: "即梦绘图 API 实测报告（3.1 文生图 + 4.0 参考生图）"
date: 2026-09-02
category: 工具
tags: [即梦, api, 文生图, 日记归档]
draft: false
---

> 测试日期：2026-09-02 ｜ 执行：ZCode
> 脚本：`C:\Users\yaya\volc_i2i\volc_t2i.py`（3.1）、`volc_j40.py`（4.0），AK/SK 复用 `volc_i2i.py`
> 结论：**两条链路全部通畅，漫画流水线底座可用** ✅

---

## 一、测试结果总览

| 项目 | 文生图 3.1（jimeng_t2i_v31） | 参考生图 4.0（jimeng_t2i_v40） |
|---|---|---|
| 结果 | ✅ 成功出图 1 张 | ✅ 成功出图 1 张 |
| 提交→出图耗时 | 约 15 秒（2 次排队+1 次生成） | 约 25~30 秒（2 次排队+5 次生成） |
| 输出尺寸 | 1472×1104（4:3，按传入参数） | 1728×2304（3:4 竖版，2K 智能判比例） |
| 文件大小 | 132 KB | 3.2 MB |
| 测试文件 | [test_31_20260902.jpg](../images/2026-09-02/test_31_20260902.jpg) | [test_40_20260902.jpg](../images/2026-09-02/test_40_20260902.jpg) |
| task_id | 9161188469369557255 | 10652134511533584167 |

## 二、测试详情

### 2.1 文生图 3.1

```bash
python volc_t2i.py "一只橘猫趴在窗台上看雨, 温暖的午后阳光, 吉卜力动画风格, 电影感构图" \
  --width 1472 --height 1104 --out test_31_20260902.jpg
```

- 流程正常：提交 → in_queue ×2 → generating → done，全程约 15 秒
- 出图质量：吉卜力风格的橘猫雨窗图，构图、氛围、细节（玻璃雨痕、爪子搭窗台）都符合 prompt
- 尺寸精确按传入的 1472×1104 输出

### 2.2 参考生图 4.0（角色一致性验证）

```bash
python volc_j40.py "参考图中的少女在海边夕阳下回头微笑, 漫画分镜风格" \
  --ref anime_ref.jpg --out test_40_20260902.jpg
```

- 本地 base64 传参考图依然可用（文档只写了 image_urls，实际兼容，与 8/18 实测一致）
- **一致性 ★★★★★**：对照 `anime_ref.jpg`，以下特征全部保留——
  - 银灰双马尾 + 红色丝带
  - 琥珀/橙色眼睛
  - 水手服 + 蓝色领结 + 白色短上衣
  - 米色开衫滑肩穿法，**连左肩橙色补丁都在**
  - 深蓝百褶裙 + 腰间狐狸挂包（含链条和红流苏）
- 场景迁移正确：新场景（海边夕阳）+ 新表情（微笑开口）
- 小瑕疵：prompt 里「回头」没被严格执行（正对镜头而非回眸），4.0 对动作细节的服从度不如对身份/服饰的保持——出分镜时动作描述要写得更具体

## 三、周边工具状态（同日检查）

| 工具 | 状态 | 备注 |
|---|---|---|
| 即梦脚本（AK/SK 直连） | ✅ 可用 | 本次实测通过 |
| MiniMax CLI（mmx 1.0.19） | ✅ 可用 | API Key 有效，额度充足（general 98%）；image-01 支持 `--subject-ref` 角色一致性，视频 MiniMax-H3/海螺2.3，另有音乐/语音/视觉/搜索 |
| arkcli（方舟 CLI v1.0.17） | ✅ 可用 | 当日 SSO 重新登录后恢复（STS 有效，Key `ark-****423b` active），`models search` 端到端实测通过 |

## 四、待办与新发现

- [x] ~~arkcli SSO 重新登录~~（2026-09-02 当日已恢复，端到端验证通过）
- [x] ~~4.0 动作服从度问题~~（记录保留：分镜动作写具体）
- [x] ~~MiniMax image-01 `--subject-ref` 与即梦 4.0 一致性对比~~（2026-09-02 完成，结论见第七节：**即梦 4.0 完胜**）
- ★ **方舟出图实测（见第六节）**：Agent Plan 图片线只有 `doubao-seedream-5.0-lite`；`doubao-seedream-5-0-pro`/`260128` 均报「不支持 agent plan」，套餐外模型走不了

## 六、方舟 +gen 出图实测（Seedream 5.0-lite，同日追加）

```bash
arkcli +gen --model doubao-seedream-5.0-lite --modality image \
  --size 2304x1728 --save-to "D:\zcode-workspace\images\2026-09-02" \
  "一只橘猫趴在窗台上看雨, 温暖的午后阳光, 吉卜力动画风格, 电影感构图"
```

**结果 ✅**：出图 `ark_seedream5lite_cat_20260902.jpg`（2304×1728），水彩感吉卜力风，猫为趴姿（比即梦 3.1 那张更贴「趴在窗台」），色调更亮更柔；右下角自带「AI生成」水印。

**踩坑记录（重要）**：
1. **模型名对号**：用户口中的「seedance-lite-5.0」实际是 **`doubao-seedream-5.0-lite`**——Seedream=图片线，Seedance=视频线（最新 doubao-seedance-2-5），别混
2. **Agent Plan 图片模型白名单只有一个**：`arkcli resources list --modality image` 可查（注意默认只列 text！）。`doubao-seedream-5-0-pro`、`doubao-seedream-5-0-260128` 都报 `The requested model does not support the agent plan feature`
3. **尺寸下限 3686400 像素**（约 2K）：1472x1104 会报错；4:3 用 2304x1728 可过
4. `+gen` 指定模型时必须带 `--modality image`（模型名带点号时 CLI 推断不出模态）
5. 保存目录用 `--save-to`（是个目录，文件名自动生成 `ark-gen.jpeg`，之后手动改名）

## 七、MiniMax（mmx image-01）对比实测（同日追加）

> 参考 `C:\Users\yaya\.claude\skills\mmx-cli\SKILL.md` 教程实战（同款教程在 `~/.agents/skills/mmx-cli/`，ZCode 可直接加载为 mmx-cli skill）

```bash
# 组1: 同款橘猫 prompt（三方画风对比）
mmx image generate --prompt "一只橘猫趴在窗台上看雨..." --width 2048 --height 1536 --out-dir . --out-prefix mmx_cat --quiet

# 组2: 角色一致性（对标即梦4.0）
mmx image generate --prompt "参考图中的少女在海边夕阳下回头微笑..." \
  --subject-ref "type=character,image=C:/Users/yaya/volc_i2i/anime_ref.jpg" \
  --width 1536 --height 2048 --out-dir . --out-prefix mmx_ref --quiet
```

**结果**：
| 对比项 | MiniMax image-01 | 即梦 |
|---|---|---|
| 橘猫图画风 | ❌ 忽略「吉卜力」要求，出写实半厚涂 | ✅ 3.1 准吉卜力 |
| 角色一致性 | ⚠️ 只保住琥珀眼+「回头」动作执行了；**双马尾→侧马尾金绳、银灰发→粉棕、水手服+狐狸挂包全丢** | ✅ 4.0 全套保留（发饰/服装/挂包/开衫补丁） |
| 分辨率上限 | 2048，多张可指定 | 3.1 最高2K面积；4.0 默认2K可4K |
| 水印 | 默认无 | 方舟+gen自带「AI生成」角标 |

**结论：漫画流水线继续用即梦**——角色一致性是硬需求，即梦 4.0 断层领先；MiniMax 的价值在**视频**（H3/海螺）和**语音/音乐**（`speech-2.8-hd` 中文音色表教程里有），做动态漫/有声漫时再启用。

**mmx 使用注意**（教程重点摘录）：
- Agent 场景三件套：`--quiet --output json --non-interactive`
- ⚠️ **Windows 坑**：`--out` 传 `/d/...` MSYS 路径会 ENOENT（Node 不翻译）——用 `cd` + 相对路径，或 `D:/` 风格
- 出图保存：`--out-dir . --out-prefix <前缀>`，stdout 干净可直接管道
- 视频进阶看 `mmx-cli/h3-video/SKILL.md`（MiniMax-H3 专属教程）

## 五、测试产物

统一在 `D:\zcode-workspace\images\2026-09-02\`：

- `test_31_20260902.jpg` — 即梦3.1 橘猫雨窗（1472×1104）
- `test_40_20260902.jpg` — 即梦4.0 夏蝶海边夕阳（1728×2304）
- `ark_seedream5lite_cat_20260902.jpg` — 方舟 Seedream 5.0-lite 橘猫（2304×1728，带AI角标）
- `mmx_cat_001.jpg` — MiniMax image-01 橘猫（2048×1536，写实风）
- `mmx_ref_001.jpg` — MiniMax subject-ref 一致性测试（1536×2048，角色漂移）

> ★ **新约定（2026-09-02 起）**：ZCode 生成的图片统一放 `D:\zcode-workspace\images\<日期>\`，按天分文件夹；即梦脚本用 `--out` 指到该目录，mmx 用 `--out-dir`，arkcli 用 `--save-to`。
