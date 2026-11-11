---
title: "Blender 精灵剑全流程 demo + cc-blender-skill 安装"
date: 2026-10-07
category: 技术
tags: [blender, 3d, skill, 日记归档]
draft: false
---

> 2026-10-07 与Claude协作完成 | 昨天装的skill今天第一次实战跑通

---

## 一、昨日补记：cc-blender-skill 30件套安装（2026-10-06）

- **来源**：GitHub `RobLe3/cc-blender-skill` v1.3.0
- **仓库位置**：`C:\Users\yaya\cc-blender-skill`（更新 = 里面 `git pull` 即生效）
- **安装方式**：30个skill以 **junction** 链接到 `C:\Users\yaya\.claude\skills\`
- **junction创建脚本**：`C:\Users\yaya\.claude\tmp\mk_blender_junctions.ps1`
  - ⚠️ 坑：Git Bash里 `cmd //c mklink` 引号被吃报"语法不正确"，必须写.ps1用 `New-Item -ItemType Junction` + `-File` 跑
- **总调度skill**：`text-to-blender`（自动路由到建模/材质/灯光/相机/渲染/动画子技能）
- **配套**：blender-mcp（ahujasid版，addon socket端口9876）→ 操控 `D:\blender\blender.exe`（5.0.1中文界面）

---

## 二、今日正题：精灵剑"建模→特效→成片"全流程

### 1. 静态hero shot（Cycles渲染）

按真实单手剑尺寸建模（全长~97cm）：
- 剑刃78cm（精灵叶状收窄+真尖头：顶点收拢+remove_doubles）、20cm金护手+两端圆头、13cm皮革握柄+两道金环、金柄头+**青色发光宝石**、剑刃前后**符文发光条**
- 材质：拉丝精钢（噪声拉伸→粗糙度）、暖金、深棕皮革（Voronoi凹凸）、自发光符文/宝石
- 布光：金属类三点光（暖主光280W@3200K + 冷辅光 + 冷轮廓光），世界强度0.5
- 相机：60mm f/4景深，bbox感知机位，TRACK_TO追焦
- 渲染：Cycles CPU 256样本+OIDN降噪，1920×1080，**14秒出图**（Intel Arc无CUDA也不慌）

### 2. 动画特效（EEVEE渲染）

| 特效 | 做法 |
|------|------|
| ✨ 发光呼吸脉冲 | 符文条+宝石的Emission Strength打关键帧，10秒2循环，宝石相位错开，帧1=帧240无缝循环 |
| 🌟 剑身魔法粒子 | 两道符文条做发射器×250，4mm青色发光小球做实例，Wind上升+Turbulence扰动，重力归零 |
| 🎥 相机360°环绕 | 相机挂`Empty-orbit_pivot`空物体，pivot转360°线性插值，TRACK_TO全程追焦 |

- 渲染：**EEVEE** 720p约2.6秒/帧（Cycles要15s+/帧，展示动画不值），240帧约10分钟
- 后台无头渲染：`blender.exe -b 场景.blend -P 脚本.py`（绕开MCP的180秒超时）
- 合成：ffmpeg PNG序列→MP4

### 3. 概念澄清（重要）

- **相机环绕转台**：剑不动相机转，成片里看起来=剑在转。适合道具/产品展示
- **骨骼动画**：Armature绑骨+蒙皮+姿势关键帧，角色动画主力（Godot Skeleton2D的3D版）
- Blender视口里看"转"的效果：视口切**相机取景**（Numpad 0）+空格播放

---

## 三、文件路径清单

| 文件 | 路径 |
|------|------|
| ★成品hero图 1920×1080 | `C:\Users\yaya\blender_renders\sword_hero_final.png` |
| ★成品动画MP4 720p/10s | `C:\Users\yaya\blender_renders\sword_magic_anim.mp4` |
| 动画PNG序列(240帧) | `C:\Users\yaya\blender_renders\anim\frame_0001~0240.png` |
| ★Blender场景文件 | `C:\Users\yaya\blender_renders\sword_scene.blend`（含全部模型/材质/动画） |
| 无头渲染脚本 | `C:\Users\yaya\blender_renders\render_final.py`（Cycles静帧）/ `render_anim.py`（EEVEE动画） |
| 渲染日志 | `C:\Users\yaya\blender_renders\render_log.txt` / `anim_log.txt` |
| 中间产物(草稿/排查图) | `C:\Users\yaya\blender_renders\` 下的 `sword_hero_draft*.png`、`hilt_inspect.png`、`red_test.png`、`anim_test_frame60*.png` |
| ★skill仓库 | `C:\Users\yaya\cc-blender-skill` |
| junction脚本 | `C:\Users\yaya\.claude\tmp\mk_blender_junctions.ps1` |
| ffmpeg | `D:\ffmpeg-8.0.1-essentials_build\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe` |
| 工作流/工具文档(旧) | `桌面\日记\2026-08-14_Blender-MCP接入与3D建模准备.md` + `2026-08-14_Blender-MCP工具清单与建模工作流.md` |

---

---

## 四、加餐：火柴人骨骼动画（同日晚些时候）

首个骨骼动画demo——**走路+跳跃全套**：

- **骨架**：`ARM-stickman` 9骨（root/spine/head/双肩单骨臂/双大腿/双小腿），18个网格部件**刚性绑骨**（免刷权重）
- **走路**：1-96帧两循环，正弦采样打关键帧（大腿±25°/膝盖摆动相弯55°/双臂反相20°/骨盆bob）
- **跳跃**：100-164帧8个pose：蹲(骨盆-0.22屈膝78°)→蹬地→腾空(+0.55收腿举臂)→落地缓冲→恢复
- **时间线**：240帧@24fps=10秒：走路→跳跃→再走路

### 骨骼动画三大坑（血泪换来的，全部进记忆）
1. **姿势骨默认QUATERNION**——直接写rotation_euler存了值但求值器不读；先`pb.rotation_mode='XYZ'`再打值，且切模式会覆写
2. **BONE绑定锚点在骨尾**——`matrix_local.inverted()`补偿会差一个骨长；最终用**数值求解法**（恒等矩阵测P_eff→inv=P_eff⁻¹）18/18归位
3. **姿势骨location是本地轴**——root骨朝上时本地Y=世界Z，骨盆升降写location的Y分量

### 取景迭代
腾空手顶实测2.492m vs 45mm画幅顶2.449m削手4cm→**40mm镜头**（顶边2.63m）解决。教训：取景别心算，实测部件峰值高度再对画幅。

### 路径追加
| 文件 | 路径 |
|------|------|
| ★火柴人动画MP4 | `C:\Users\yaya\blender_renders\stickman_walk_jump.mp4` |
| ★火柴人场景(可复用) | `C:\Users\yaya\blender_renders\stickman_scene.blend` |
| 帧序列 | `C:\Users\yaya\blender_renders\stickman_anim\frame_0001~0240.png` |
| 渲染脚本 | `C:\Users\yaya\blender_renders\render_stickman.py` |

---

---

## 五、收官：火柴人骑士进Web3D（可玩Demo）

把火柴人+精灵剑搬进浏览器，**WASD移动 / J键攻击 / 右键拖拽环视 / 滚轮缩放**。

- **项目**：`D:\gemini-workspace\stickman-knight-3d\`（独立新文件夹，没动原来的3DHexWorld）
  - `index.html` + `main.js`（Three.js r170 importmap免构建）
  - `lib\`：three.module.js + GLTFLoader + BufferGeometryUtils（npmmirror拉的本地化，离线可跑）
  - `assets\stickman_knight.glb`：火柴人+精灵剑+蒙皮+GameClips动画（890KB）
  - **双击 `start.bat` 即玩**（自动起8777端口开浏览器）
- **资产管线**：剑append进火柴人场景→绑右手骨→单条时间线 Idle(1-48)/Walk(49-97循环闭合)/Attack(101-135挥砍) → 转标准蒙皮 → glTF导出 → three.js里`AnimationUtils.subclip`按帧切片成三段动画
- **本次新增大坑**（已进记忆）：
  1. 库append的物体不自动链进场景（`in_scene=False`不渲染），要手动link
  2. glTF导出只认**Armature修改器+顶点组**，BONE父子绑定导出后无蒙皮无动画
  3. 导出器净化骨骼节点名（`shoulder.R`→`shoulderR`）但动画轨道名留原名 → **L/R骨骼动画在three.js静默失绑**（手臂腿全不动！），subclip后要修补track.name
  4. Armature修改器变形顶点不动物体原点，验证变形要读求值后的顶点坐标

---

---

## 六、剑"隐身"排查记（对照实验定案）

用户反馈Web里只见宝石不见剑。层层剥离出**五个叠加原因**，全部修复：
1. **金属无环境贴图=黑金属**：three.js里metallic=1没有scene.environment就是近黑 → 加`RoomEnvironment`+PMREM
2. **程序化粗糙度导不出**：拉丝钢的ramp→Roughness链路导出回退成roughness=1（全粗糙金属更黑）→ 断链设常数0.32
3. **刃面朝向**：6.5cm宽面恰好侧对相机，正对相机的只有0.8cm薄刃截面（1-2px）→ 宽薄轴互换
4. **对比度**：银刃贴深色身体 → 加宽到6.5cm+提亮+12mm发光条(强度90)+宝石加大
5. 教训：**修几何时绕原点缩放会把部件推飞**（剑刃/发光条先后跑偏x=±0.5m），缩放必须围绕部件自身轴线，改完逐件量包围盒

验证手段论：applyBoneTransform读数会骗人、matrix_world对蒙皮无意义，**隐藏其他部件看孤岛渲染**+**顶点级求值坐标**才是硬验证。

---

## 七、今日踩坑速查（已沉淀进Claude记忆）

1. **中文UI节点名本地化**：`Principled BSDF`→`原理化 BSDF`、`Material Output`→`材质输出`——按名找必炸，一律按type找（`BSDF_PRINCIPLED`/`OUTPUT_MATERIAL`/`EMISSION`）
2. **薄物件采样饥饿**：8mm薄刃在<64采样下被降噪器抹到"消失"，草稿看着黑的先加采样再判材质
3. **AgX高光去饱和**：强主光下暗色皮革被洗成粉色（介电高光主导），roughness≥0.8+降主光解决；小面积自发光也会洗白
4. **粒子API全是老名字**：`factor_random`/`drag_factor`/`emit_from='FACE'`/`TURBULENCE`（无NOISE）
5. **粒子模拟状态在评估依赖图**：`ob.evaluated_get(deps).particle_systems[...]`，原始数据块永远total=0，别误判模拟没跑
6. **point_cache钳制负帧**：粒子想用-200预热不可行，改frame_start=1连续发射
7. **风场方向**：这版沿本地**+Z**吹（翻转180°反而向下喷）
8. **宝石"消失"真凶是设计**：藏在护手与刃面夹角被挡，挪到柄头正面才见光——渲染前先想"从相机看得到吗"
