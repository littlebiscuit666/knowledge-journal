---
title: "Godot 项目场景盘点与冰火之剑特效实战记录"
date: 2026-10-31
category: 技术
tags: [godot, 特效, 日记归档]
draft: false
---

> **记录日期**：2026-10-31  
> **项目路径**：`D:/godot_first/`（Godot 4.7.2-stable）

---

## 一、项目现有全部场景盘点（共 12 个 `.tscn` 场景 + 1 个 3D 模型场景）

### 1. 特效与视觉演示场景（VFX Demos）

| 场景文件 | 绑定脚本 | 核心节点与技术方案 | 场景功能说明 |
| :--- | :--- | :--- | :--- |
| `res://weapon_fire_demo.tscn` | `res://weapon_fire_demo.gd` | `Sprite2D` + 自定义 `ShaderMaterial` + 4 组 `GPUParticles2D` + `PointLight2D` + `WorldEnvironment` + `AnimationPlayer` | **冰与火之剑武器特效演示**：采用“方案 1（静态武器 + 引擎实时发光）”，支持红焰（炽热呼吸闪烁）与寒冰（凌冽寒风冰晶）双属性平滑切换、实时亮度/风力滑块调节、阵风吹拂飘动与剑/法杖武器切换。 |
| `res://portal_demo.tscn` | `res://portal_demo.gd` | 双层 `Sprite2D`（`BLEND_MODE_ADD` 加法混合）+ `AnimationPlayer`（`portal_idle`） | **魔法传送门特效演示**：利用双层传送门贴图（`magic_portal_texture.jpg`）反向旋转与呼吸缩放，叠加发光渐变表现旋涡能量感。 |
| `res://campfire_demo.tscn` | 无（纯动画驱动） | `Sprite2D`（`hframes=4, vframes=4`）+ `AnimationPlayer`（`burn`） | **篝火序列帧燃烧演示**：使用 4×4 精灵表 `res://asset/campfire/campfire_sheet.png` 循环播放 16 帧火焰燃烧动画。 |

### 2. 2D 骨骼动画与换装演示（Skeleton2D Demos）

| 场景文件 | 绑定脚本 | 核心节点与技术方案 | 场景功能说明 |
| :--- | :--- | :--- | :--- |
| `res://equip_demo.tscn` | `res://equip_demo.gd` | `Skeleton2D` + 多层级 `Bone2D`（身体/头/左右臂/手/左右脚）+ `AnimationPlayer` + UI 按钮 | **2D 骨骼角色换装与染色演示**：展示分部件贴图绑定骨骼的待机呼吸动画，支持一键切换武器（长剑/法杖）与装备随机染色。 |
| `res://knight.tscn` | `res://knight.gd` | `Skeleton2D` + `Bone2D` 部件绑定 + `AnimationPlayer` | **2D 骨骼骑士角色预制体**：完整的骑士骨骼角色场景，可被战斗场景直接实例化复用。 |
| `res://fly_demo.tscn` | `res://fly_demo.gd` | `Skeleton2D`（`BoneBody` / `BoneWingL` / `BoneWingR`）+ `AnimationPlayer`（`Animation_fly`） | **2D 骨骼振翅飞行演示**：通过骨骼旋转驱动左右翅膀高频扇动及身体上下浮空位移。 |
| `res://tentacle_demo.tscn` | `res://tentacle_demo.gd` | `Skeleton2D`（`BoneBase` → `BoneMid` → `BoneTip` 三段骨骼链） | **2D 多节骨骼触手/摆动演示**：演示父子层级骨骼链条的联动旋转与柔性摆动效果。 |

### 3. 玩法与角色控制场景（Gameplay Demos）

| 场景文件 | 绑定脚本 | 核心节点与技术方案 | 场景功能说明 |
| :--- | :--- | :--- | :--- |
| `res://battle_demo.tscn` | `res://battle_demo.gd` | `Camera2D` + `Player1` / `Player2`（实例化 `knight.tscn`）+ `StaticBody2D` 边界 + `RigidBody2D` 物理箱 | **双人骑士对战物理竞技场**：包含两名骑士角色同屏对战、四周碰撞围墙以及带物理材质（摩擦/弹性）的碰撞木箱。 |
| `res://robot_player.tscn` | `res://robot_player.gd` | `CharacterBody2D` + `Sprite2D`（4×2 精灵表）+ `CollisionShape2D` + `AnimationPlayer`（`idle`/`run`） | **2D 机器人角色移动控制**：标准 2D 平台/横版角色控制器，带待机与奔跑序列帧切换。 |
| `res://node_2d.tscn` | `res://game_manager.gd` | `GameManager` + `HandContainer` (`HBoxContainer`) + `Panel` (`drop_zone`) + `Button` | **卡牌手牌管理与出牌场景**：负责发牌、手牌排列布局以及出牌交互逻辑。 |
| `res://card_pre.tscn` | `res://texture_rect.gd` | `AtlasTexture` + `SpriteFrames` + 全息 Shader (`res://holographic.gdshader`) | **动态卡牌预制体**：单张城堡卡牌组件，支持图集序列帧动画与全息卡片视觉效果。 |

### 4. 3D 场景与模型（3D Demos）

| 场景文件 | 绑定脚本 | 核心节点与技术方案 | 场景功能说明 |
| :--- | :--- | :--- | :--- |
| `res://knight_3d.tscn` | `res://scripts/knight_3d.gd` | `Node3D` + `Camera3D` + `DirectionalLight3D` + `WorldEnvironment` + 3D 模型实例 | **3D 骑士动作场景**：加载并展示 `res://models/Sword And Shield Jump.fbx` 3D 角色模型与跳跃动作。 |
| `res://models/Sword And Shield Jump.fbx` | 内置导入 | FBX 导入的 `PackedScene` | **剑盾跳跃 3D 模型资产**：供 `knight_3d.tscn` 实例化的 3D 角色动作资源。 |

---

## 二、“武器周身冒光（冰与火之剑）”最佳实用方案总结

### 1. 为什么推荐“方案 1：静态武器 + 引擎实时发光”？
- **非常适合独立开发**：只需要 1 张透明背景的静态武器 PNG（如 `res://newasset/weapon_sword.png` 或 `weapon_staff.png`），无需逐帧绘制或让 AI 生成序列帧。
- **内存占用极低、复用性极强**：同一套 Shader + 粒子 + 光效节点，换一张武器贴图即可自动贴合新武器轮廓。
- **实时交互控制方便**：火焰/寒光的**明暗脉冲**、**风吹方向与强弱**、**属性变色（火/冰）**全部可以通过代码或 `AnimationPlayer` 实时平滑调节。

### 2. Godot 节点组合结构（`res://weapon_fire_demo.tscn`）
```text
WeaponFireDemo (Node2D) [挂载脚本: weapon_fire_demo.gd]
├── Background (ColorRect)               # 随火/冰模式平滑切换深红/深蓝氛围底色
├── WorldEnvironment (WorldEnvironment)  # 开启 2D Glow/Bloom 柔和辉光
├── WindParticles (GPUParticles2D)       # 全屏环境微风粒子，直观呈现风向与风速
├── WeaponAnchor (Node2D)                # 武器整体锚点（含悬浮动画与受风微倾）
│   ├── GlowHaloBack (Sprite2D)          # 底层径向柔光光晕（加法混合 BLEND_MODE_ADD）
│   ├── EnergySmokeParticles             # 暗红烟雾 / 冰蓝寒雾粒子（随风向侧上方翻涌）
│   ├── FlameAuraBack (Sprite2D)         # 后层周身火舌/寒霜 Shader（贴合剑刃轮廓随风飘动）
│   ├── WeaponSprite (Sprite2D)          # 静态武器本体 + 剑刃边缘受热/寒光 Shader
│   ├── FlameAuraFront (Sprite2D)        # 前层半透明火舌/寒气叠层（带本体中心遮罩防过曝）
│   ├── FireParticles (GPUParticles2D)   # 升腾火苗 / 凛冽寒气粒子
│   ├── SparkParticles (GPUParticles2D)  # 飞溅火星 / 碎裂冰晶粒子（开启 Turbulence 湍流）
│   └── FireLight (PointLight2D)         # 实时 2D 点光源，随呼吸明暗变化
├── AnimationPlayer                      # 自动循环播放 fire_pulse 动画
└── UI (CanvasLayer)                     # 左上角实时交互控制台（火/冰切换、亮度/风力滑块）
```

### 3. 相关资源文件路径速查
- **场景文件**：`res://weapon_fire_demo.tscn`
- **控制脚本**：`res://weapon_fire_demo.gd`
- **周身火焰/凛冽寒霜 Shader**：`res://weapon_flame_aura.gdshader`
- **剑刃边缘受热/冰霜高光 Shader**：`res://weapon_blade_heat.gdshader`
- **程序化渐变贴图**：
  - 光晕贴图：`res://newasset/fx_red_halo.tres`
  - 火焰/冰晶粒子贴图：`res://newasset/fx_fire_particle.tres`
  - 能量烟雾/寒雾贴图：`res://newasset/fx_smoke_particle.tres`
