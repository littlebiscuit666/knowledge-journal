---
title: "Godot 升级 4.7.2 + Mixamo FBX 动画导入"
date: 2026-10-07
category: 技术
tags: [godot, mixamo, 动画, 日记归档]
draft: false
---

> 2026-10-07 与Claude协作完成 |godot_first项目首次接入3D资源,MCP全程自动化操作

---

## 一、Mixamo FBX 导入 Godot(4.5 时完成)

- **素材**:`Sword And Shield Jump.fbx`(1.7MB,Mixamo 下载,角色 Beta_Joints/Beta_Surface)
- **导入**:Godot 4.3+ 内置 ufbx 导入器,**无需 FBX2glTF 转换**;拷进 `models/` → 扫描 → 直接实例化成场景
- **导入后结构**:
  ```
  Sword And Shield Jump (Node3D)
  ├── Skeleton3D(骨骼) + Beta_Surface(网格) + Beta_Joints
  └── AnimationPlayer
      ├── mixamo_com (0.83s,53轨道) ← 实际动作
      └── Take 001  (3.3s,默认姿势)
  ```
- **搭好的场景 `knight_3d.tscn`**:模型 + Camera3D(pos 0.4,1.3,5 微俯视) + Sun平行光 + WorldEnvironment(默认程序化天空)
- **按键播动画** `scripts/knight_3d.gd`:project.godot 里加 action `play_jump` 绑 M 键;脚本 `_unhandled_input` 里 `event.is_action_pressed("play_jump")` → stop+play 重播;`_ready` 里 seek 第0帧定格,避免开局 T-Pose
- **MCP 验证手法**:game 运行中 `input_key` 模拟按 M → 0.4s 后截 game 画面,看到屈膝动作即动画生效(该动作不是跳跃,是蹲伏类)

## 二、Godot 4.5.1 → 4.7.2 升级

- **动机**:godot-ai MCP 插件 v4 要求 Godot ≥4.7,4.5 下只跑 v3 桥(日志:"v4 migration requires Godot 4.7 or newer")
- **便携版升级 = 单 exe 替换**,步骤:
  1. 关编辑器 → 官网/GitHub 下 `Godot_v4.7.2-stable_win64.exe.zip`(86MB)
  2. 解压出主程序 + `_console.exe`
  3. 旧 exe 移入 `D:\godot\backup_4.5.1\`(留退路),新 exe 挪进 `D:\godot\`
  4. 快捷方式死链修复:PowerShell `WScript.Shell` 重定向 TargetPath 再改名(桌面 + D:\godot 两处)
- **插件迁移**:新引擎打开项目后自动 v3.2.5 → **v4.3.0**(protocol 1→2),断连时 `/mcp` 重连即可
- **项目兼容**:4.5 项目直接打开,场景/脚本/导入资源零损失
- ⚠️ 排查插曲:升级后 MCP 一直 0 会话,等了半天没动静,最后是**用户手动 /mcp 重连**秒好——重连才是最后一步,别干等

## 三、知识小结(当日问答)

1. **FBX 里为什么自带动画**:FBX 是 Autodesk 场景格式,网格/骨骼/关键帧都在一个文件里;Godot 导入时翻译成 AnimationPlayer 下的动画条目,编辑器里双击 fbx → 选中 AnimationPlayer → 底部动画面板可预览
2. **Blender 自建模型导出格式**:**GLB 优先**(Godot 官方推荐,贴图内嵌、坐标系一致);FBX 也能用但坑多
3. ⚠️ **Blender 多动作导出丢失坑**:glTF 导出默认只带 NLA 里的内容,每个 Action 要在 NLA 编辑器 **Push Down/Stash**,到 Godot 才是一个独立动画条目

## 四、待办/清理

- [ ] 确认 4.7.2 稳定后删 `D:\godot\backup_4.5.1\`(省156MB)
- [ ] 删 Downloads 里的 `Godot_v4.7.2-stable_win64.exe.zip`(86MB)
- [ ] 后续:Blender 自建角色 → GLB → 进 Godot;3D 骑士接 CharacterBody3D 移动逻辑
