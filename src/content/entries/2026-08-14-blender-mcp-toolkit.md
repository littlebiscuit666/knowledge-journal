---
title: "Blender MCP 工具清单与 3D 建模专家工作流"
date: 2026-08-14
category: 工具
tags: [mcp, blender, 3d, 日记归档]
draft: false
---

> 日期：2026-08-14
> 环境：Blender **5.0.1**（`D:\blender\blender.exe`）+ blender-mcp addon（已 Connect，端口 9876）
> 互补文档：同日另有一篇 `2026-08-14_Blender-MCP接入与3D建模准备.md`，讲的是**怎么装、怎么连**；本篇讲**有哪些工具、专家怎么按顺序用**。

---

## 0. 一句话心智模型

**blender-mcp 的高层工具主要干两件事：①AI 生成 / 市场下载 3D 资产，②查看当前场景。真正的"建模"几乎全靠 `execute_blender_code` 写 bpy（Blender Python API）。**

把工具分成两层看就清楚了：

| 层 | 是什么 | 擅长 | 局限 |
|---|---|---|---|
| **高层 MCP 工具** | `mcp__blender-mcp__*` 系列封装函数 | 一句话生成模型、下 Polyhaven/Sketchfab 资产、截图看场景 | 没有细粒度建模操作（建立方体、加倒角、设材质节点都没有） |
| **底层 bpy 代码** | `execute_blender_code` 执行任意 Python | 全部能力：几何、修改器、节点材质、灯光、相机、渲染、导出 | 需要懂 bpy API（但 AI 替你写） |

> 结论：**专业建模 = 「高层工具拿素材」+「bpy 做主体、上材质、打光、渲染、导出」**。下面按这个分工展开。

---

## 1. 高层 MCP 工具清单（共约 20 个）

### 1.1 场景查看（建模时最高频，反复用）

| 工具 | 作用 | 关键参数 |
|---|---|---|
| `get_scene_info` | 列出场景所有对象/类型/位置/材质数 | `user_prompt`（遥测用） |
| `get_object_info` | 看单个对象详情（网格、修改器、材质槽等） | `object_name` |
| `get_viewport_screenshot` | **截当前视口图**（AI 看图迭代的核心） | `max_size`（默认 1000） |
| `execute_blender_code` | **执行任意 bpy Python**（建模主力，见第 2 节） | `code`、`user_prompt` |

### 1.2 AI 生成 3D 资产（文生 / 图生）

| 工具 | 作用 | 关键参数 |
|---|---|---|
| `generate_hyper3d_model_via_text` | Hyper3D Rodin **文生**模型（带材质） | `text_prompt`、`bbox_condition`（长宽高比 [L,W,H]） |
| `generate_hyper3d_model_via_images` | Hyper3D Rodin **图生**模型 | `input_image_paths` 或 `input_image_urls`（列表）、`bbox_condition` |
| `generate_hunyuan3d_model` | 腾讯 Hunyuan3D 文/图生模型 | `text_prompt`、`input_image_url` |

> 生成是**异步**的：调 `generate_*` 返回 job_id → 用对应的 `poll_*_job_status` 轮询 → 状态变 DONE 后调 `import_generated_asset(_hunyuan)` 导入 Blender。
> - Hyper3D：`poll_rodin_job_status`（MAIN_SITE 用 `subscription_key` / FAL_AI 用 `request_id`）→ `import_generated_asset(name, task_uuid|request_id)`
> - Hunyuan3D：`poll_hunyuan_job_status(job_id)` → `import_generated_asset_hunyuan(name, zip_file_url)`
> - 用前先 `get_hyper3d_status` / `get_hunyuan3d_status` 确认集成开关是否开启（往往没配 API key，就用不了，回退到 bpy）。

### 1.3 资产市场下载（免费高质量素材）

| 工具 | 作用 |
|---|---|
| `search_polyhaven_assets` | 搜 Poly Haven（HDRI 环境、贴图、模型），可按 `categories` 过滤 |
| `get_polyhaven_categories` | 看 Poly Haven 有哪些分类（hdris/textures/models/all） |
| `download_polyhaven_asset` | 下载并导入（`asset_id`、`asset_type`、`resolution`、`file_format`） |
| `set_texture` | 把已下载的 Polyhaven 贴图**应用到指定对象**（`object_name`、`texture_id`） |
| `search_sketchfab_models` | 搜 Sketchfab 模型（`query`、`count`、`downloadable`） |
| `get_sketchfab_model_preview` | 下 Sketchfab 前先看缩略图确认 |
| `download_sketchfab_model` | 下载 Sketchfab 模型，**按 `target_size` 自动缩放**（米为单位） |

> 用前 `get_polyhaven_status` / `get_sketchfab_status` 确认开关。

---

## 2. 底层 bpy：建模专家真正的工具箱

通过 `execute_blender_code` 调用。**这是 90% 建模工作发生的地方**。下面是按建模阶段归类的核心 API。

### 2.1 创建原始几何（`bpy.ops.mesh.primitive_*`）
```python
import bpy
bpy.ops.mesh.primitive_cube_add(size=2, location=(0,0,0))
bpy.ops.mesh.primitive_uv_sphere_add(radius=1, segments=32, ring_count=16, location=(3,0,0))
bpy.ops.mesh.primitive_cylinder_add(radius=0.5, depth=2, location=(6,0,0))
bpy.ops.mesh.primitive_plane_add(size=10, location=(0,0,-1))   # 地面
bpy.ops.mesh.primitive_torus_add(major_radius=1, minor_radius=0.2)
bpy.ops.mesh.primitive_cone_add(radius1=1, depth=2)
```
拿到对象：`obj = bpy.context.active_object` 或 `obj = bpy.data.objects['名字']`。

### 2.2 修改器（Modifier，建模核心，非破坏性）
```python
obj = bpy.context.active_object
def add_mod(obj, mtype, name=None):
    m = obj.modifiers.new(name=name or mtype, type=mtype)
    return m

add_mod(obj, 'SUBSURF').levels = 2          # 细分平滑
add_mod(obj, 'SOLIDIFY').thickness = 0.05    # 给面加厚度
bevel = add_mod(obj, 'BEVEL'); bevel.width = 0.02; bevel.segments = 3   # 倒角
arr = add_mod(obj, 'ARRAY'); arr.count = 5                                 # 阵列
add_mod(obj, 'MIRROR')                       # 镜像（对称建模，X 轴）
add_mod(obj, 'DECIMATE').ratio = 0.3         # 减面（导游戏模型用）
```
> 实测本机 5.0.1 常用修改器类型：Subdivision(`SUBSURF`) / Mirror / Boolean / Array / Solidify / Bevel / Screw / Decimate / Simple Deform。

### 2.3 变换与层级
```python
obj.location = (1, 2, 3); obj.rotation_euler = (0, 0, 1.5708); obj.scale = (1, 1, 2)
# 应用变换（把缩放/旋转烤进网格，避免修改器算错）
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
# 复制、删除、父子
bpy.ops.object.duplicate(); bpy.ops.object.delete()
obj.parent = bpy.data.objects['父对象']
```

### 2.4 布尔运算（组合两个形体）
```python
cutter = bpy.data.objects['切割体']
target = bpy.data.objects['主体']
bpy.context.view_layer.objects.active = target
b = target.modifiers.new(name='Bool', type='BOOLEAN')
b.operation = 'DIFFERENCE'   # UNION / INTEREST
b.object = cutter
bpy.ops.object.modifier_apply(modifier='Bool')   # 应用后切割体常删掉
```

### 2.5 节点材质（PBR，专业做法）
```python
mat = bpy.data.materials.new(name="陶瓷")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.9, 0.9, 0.95, 1)
bsdf.inputs["Roughness"].default_value = 0.2
bsdf.inputs["Metallic"].default_value = 0.0
obj.data.materials.append(mat)   # 关联到对象
```
> 贴图走 `set_texture`（Polyhaven）或手动连 Image Texture → BSDF 的 Base Color / Roughness / Normal。

### 2.6 灯光（三点布光标配）
本机灯光枚举实测：**POINT / SUN / SPOT / AREA**。
```python
# 主光 Key（AREA 软光）
bpy.ops.object.light_add(type='AREA', location=(4, -4, 6))
key = bpy.context.object; key.data.energy = 800; key.data.size = 3
# 补光 Fill
bpy.ops.object.light_add(type='AREA', location=(-4, -2, 3))
fill = bpy.context.object; fill.data.energy = 300
# 轮廓光 Rim / Back
bpy.ops.object.light_add(type='AREA', location=(0, 5, 4))
rim = bpy.context.object; rim.data.energy = 500
```

### 2.7 相机与构图
```python
bpy.ops.object.camera_add(location=(7, -7, 5), rotation=(1.1, 0, 0.785))
cam = bpy.context.object
bpy.context.scene.camera = cam                       # 指定为活动相机
# 相机对着某物体
import mathutils
obj = bpy.data.objects['主体']
direction = obj.location - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
```

### 2.8 世界环境（HDRI 背景）
- 快路：`download_polyhaven_asset(asset_type='hdris')` 下一个 HDRI → 节点连到 World Background。
- 或纯色：`bpy.context.scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.05,0.05,0.06,1)`

### 2.9 渲染设置 + 出图
```python
scn = bpy.context.scene
scn.render.engine = 'BLENDER_EEVEE'           # 实时引擎，快（见第 5 节踩坑）
scn.render.resolution_x = 1920; scn.render.resolution_y = 1080
scn.render.resolution_percentage = 100
scn.render.image_settings.file_format = 'PNG'
scn.render.filepath = r'C:\Users\yaya\Desktop\render.png'
bpy.ops.render.render(write_still=True)
```

### 2.10 导出（实测 5.0.1 的正确路径！）
```python
# ⚠️ Blender 5.0 起，OBJ/PLY/STL 搬到 bpy.ops.wm.* 下了（不是老教程的 export_mesh）
bpy.ops.wm.obj_export(filepath=r"C:\Users\yaya\Desktop\mug.obj")
bpy.ops.wm.ply_export(filepath=r"C:\Users\yaya\Desktop\mug.ply")
bpy.ops.wm.stl_export(filepath=r"C:\Users\yaya\Desktop\mug.stl")   # 3D 打印用
bpy.ops.wm.usd_export(filepath=r"C:\Users\yaya\Desktop\mug.usd")   # 影视/USD 管线
# FBX、glTF 仍在 export_scene 下
bpy.ops.export_scene.fbx(filepath=r"C:\Users\yaya\Desktop\mug.fbx")              # 游戏 Unity/UE
bpy.ops.export_scene.gltf(filepath=r"C:\Users\yaya\Desktop\mug.glb", export_format='GLB')  # Web/Three.js
```
> 只导出选中对象：调用前 `bpy.ops.object.select_all(action='DESELECT')` 再 `obj.select_set(True)`，并在导出参数里设 `use_selection=True`。

---

## 3. 建模专家的标准工作流（按顺序，每步对应函数）

> 这是"自然语言 → 成品"的固定节奏。**每改一次都 `get_viewport_screenshot` 看一眼**，跟画画一样对着改。

```
①看场景对齐意图
   get_scene_info / get_viewport_screenshot / get_object_info
        │
②搭主体几何（从原始体开始 / 或 AI 生成拿粗模）
   execute_blender_code → bpy.ops.mesh.primitive_* + 修改器 + 布尔
   或 generate_hyper3d_model_via_text → poll → import_generated_asset
        │
③细化与拓扑
   execute_blender_code → SUBSURF/SOLIDIFY/BEVEL/MIRROR/DECIMATE
   transform_apply 把缩放烤进网格
        │
④上材质
   execute_blender_code → Principled BSDF 节点
   或 download_polyhaven_asset(textures) + set_texture
        │
⑤打光（三点布光）
   execute_blender_code → AREA×3（Key/Fill/Rim）
        │
⑥相机与构图
   execute_blender_code → camera_add + to_track_quat 对着主体
        │
⑦世界环境
   download_polyhaven_asset(hdris) 挂 HDRI，或纯色背景
        │
⑧预览渲染（反复迭代）
   get_viewport_screenshot（视口快看）
   execute_blender_code → bpy.ops.render.render（正式出图）
        │
⑨导出交付
   execute_blender_code → FBX/glTF/OBJ/STL/USD（按下游用途选）
```

**频率分布**（给一个直觉）：`get_viewport_screenshot` 占 40%（反复看），`execute_blender_code` 占 50%（建模主力），高层资产生成/下载占 10%。

---

## 4. 端到端示例：按顺序做一个陶瓷马克杯（可整段粘贴跑）

```python
import bpy, mathutils

# --- 清场（只留相机灯光，可选）---
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()

# --- ②主体：杯身（圆柱 + 布尔挖凹 + 厚度）---
bpy.ops.mesh.primitive_cylinder_add(radius=0.4, depth=1.0, vertices=64, location=(0,0,0.5))
body = bpy.context.active_object; body.name = 'Mug_Body'

bpy.ops.mesh.primitive_cylinder_add(radius=0.34, depth=0.9, vertices=64, location=(0,0,0.6))
inner = bpy.context.active_object; inner.name = 'Mug_Inner'   # 用来挖空

bpy.context.view_layer.objects.active = body
b = body.modifiers.new('Bool', 'BOOLEAN'); b.operation='DIFFERENCE'; b.object=inner
bpy.ops.object.modifier_apply(modifier='Bool')
bpy.data.objects.remove(inner, do_unlink=True)                # 删切割体

# 把手（圆环 torus）
bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.05, location=(0.42,0,0.5),
                                 rotation=(1.5708,0,0))
handle = bpy.context.active_object; handle.name='Mug_Handle'
# 合并杯身+把手
body.select_set(True); handle.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join(); body.name='Mug'

# --- ③细化：倒角 + 细分 ---
bevel = body.modifiers.new('Bevel','BEVEL'); bevel.width=0.01; bevel.segments=2
sub = body.modifiers.new('Sub','SUBSURF'); sub.levels=1

# --- ④材质：陶瓷 ---
mat = bpy.data.materials.new('Ceramic'); mat.use_nodes=True
bsdf = mat.node_tree.nodes['Principled BSDF']
bsdf.inputs['Base Color'].default_value=(0.95,0.95,0.92,1)
bsdf.inputs['Roughness'].default_value=0.25
body.data.materials.append(mat)

# --- ⑤三点布光 ---
bpy.ops.object.light_add(type='AREA', location=(3,-3,4)); bpy.context.object.data.energy=600; bpy.context.object.data.size=3
bpy.ops.object.light_add(type='AREA', location=(-3,-1,2)); bpy.context.object.data.energy=200
bpy.ops.object.light_add(type='AREA', location=(0,4,3));  bpy.context.object.data.energy=300

# --- ⑥相机 ---
bpy.ops.object.camera_add(location=(2.5,-2.5,1.8))
cam = bpy.context.object; bpy.context.scene.camera=cam
dir = body.location - cam.location
cam.rotation_euler = dir.to_track_quat('-Z','Y').to_euler()

# --- ⑦地面（接阴影）+ 世界 ---
bpy.ops.mesh.primitive_plane_add(size=8, location=(0,0,0))
bpy.context.scene.world.node_tree.nodes['Background'].inputs[0].default_value=(0.08,0.08,0.09,1)

# --- ⑧渲染 ---
scn=bpy.context.scene; scn.render.engine='BLENDER_EEVEE'
scn.render.resolution_x=1280; scn.render.resolution_y=960
scn.render.filepath=r'C:\Users\yaya\Desktop\mug_render.png'
bpy.ops.render.render(write_still=True)

# --- ⑨导出 glTF（Web 用） ---
bpy.ops.export_scene.gltf(filepath=r'C:\Users\yaya\Desktop\mug.glb',
                          export_format='GLB', use_selection=True)
```
> 跑完后调一次 `get_viewport_screenshot` 给我看，我帮你判断杯壁厚度 / 把手位置对不对，再迭代。

---

## 5. Blender 5.0.1 版本差异 & 踩坑备忘（实测）

这些是今天探测脚本里**实测确认**的，老教程经常写错：

| 项 | 实测结果（5.0.1） | 老教程常错成 |
|---|---|---|
| 渲染引擎枚举 | 当前场景只列 **`BLENDER_EEVEE`**（5.0 新 EEVEE） | 4.x 写 `BLENDER_EEVEE_NEXT` |
| 渲染引擎 | Cycles 通过 `cycles` 插件提供（已注册），需在 Render Properties 切到 CYCLES 才用光追 | — |
| OBJ 导出 | **`bpy.ops.wm.obj_export`** | `bpy.ops.export_scene.obj`（已废弃） |
| PLY 导出 | `bpy.ops.wm.ply_export` | `bpy.ops.export_mesh.ply` |
| STL 导出 | `bpy.ops.wm.stl_export` | `bpy.ops.export_mesh.stl` |
| glTF / FBX | 仍在 `bpy.ops.export_scene.gltf` / `.fbx` | 正确 |
| 灯光类型 | POINT / SUN / SPOT / AREA 四种 | 一致 |
| 默认场景 | 已含 Camera + Light + 一个 Monkey + 一个 Western Dragon（你的场景） | 默认只有 Cube |

> 内存补充：本机 5.0.1 安装目录 `D:\blender\`，插件目录 `...\Blender Foundation\Blender\5.0\scripts\addons\`（addon.py = blender-mcp 插件本体）。

---

## 6. MCP 能力边界（什么时候用哪层）

| 场景 | 用高层 MCP 工具 | 用 bpy（execute_blender_code） |
|---|---|---|
| 要一个现成模型快速放进场景 | ✅ Hyper3D / Sketchfab 生成下载 | — |
| 要照片级材质贴图 | ✅ Polyhaven textures + `set_texture` | 程序化节点材质 |
| 环境光照 | ✅ Polyhaven hdris | World 纯色背景 |
| **从零建特定几何** | ❌ 没有 | ✅ 唯一选择 |
| **加倒角/细分/布尔/镜像** | ❌ 没有 | ✅ |
| **打光、构图、渲染参数** | ❌ 没有 | ✅ |
| **导出 FBX/glTF/OBJ/STL** | ❌ 没有 | ✅ |
| 看当前场景 / 迭代对图 | ✅ `get_viewport_screenshot` | — |

**一句话总结**：高层工具管"拿东西和看东西"，bpy 管"做东西"。专家工作流的骨架是 bpy，高层工具是素材和眼睛。

---

## 7. 下一步

- 文档已落地，可直接当建模时的函数速查表用。
- 想试真实项目的话，告诉我目标（角色 / 场景 / 道具 / 可导出给游戏或 3D 打印），我按第 3 节工作流顺序一步步用 `execute_blender_code` + `get_viewport_screenshot` 迭代给你看。
- 若要启用 AI 文生模型（Hyper3D/Hunyuan3D），需先配对应 API key（当前大概率未配，回退 bpy 完全够用）。
