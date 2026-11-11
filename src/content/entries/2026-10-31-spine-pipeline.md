---
title: "Spine 动画管线跑通：一张立绘到可动骨骼动画"
date: 2026-10-31
category: 技术
tags: [spine, 2d动画, 骨骼, 日记归档]
draft: false
---

> 日期:2026-10-31
> 产物:`D:\spine-test\girl1\`(preview.html 双击可看 idle/walk 动画)
> 技能:spine-animation(`C:\Users\yaya\.claude\skills\spine-animation`,GitHub 浅克隆,代理 7890 才能拉)

## 一、做了什么

目标:验证"单张 2D 立绘 → Spine 骨骼动画"全链路可行性(为游戏素材管线探路)。

素材:AI 生成的银发紫裙少女立绘(白底、双臂张开、全身站姿)。

**最终结果:idle(呼吸微摆)+ walk(交替迈步+摆臂)动画在浏览器 Spine Web Player 里播放成功**,12 部件 / 14 骨骼。

## 二、关键教训(最重要部分)

### ❌ 生成模型拆件此路不通(省配额警示)
- MiniMax image-01 的 `--subject-ref type=character` **做不了拆件**,三次尝试全失败:
  - gen1:布局标准但角色走样严重(长发→短发、裙子全错)
  - gen2:角色还原好,但**必定混入一个完整立绘**,散件还残缺
  - gen3:二段式(拿 gen2 裁出的干净站姿当新参考)依然混完整立绘
- 结论:该模型对"完整角色"的执念绕不过去,别再抽卡浪费配额
- Gemini 的图像编辑大概率能行(skill 原生方案),免费 key 在 aistudio 可领;但本次未用

### ✅ 可行方案:本地切割(零成本、还原度 100%)
```
白底立绘 → OpenCV 提取 alpha(阈值235+形态学清理)
        → 坐标网格叠加(给 AI 自己看坐标定位切割线)
        → 多边形 + 种子点连通域过滤切件(12件)
        → 件坐标天然已知,跳过 SIFT 定位
        → build_spine_json.py(config 命名对齐技能预设)
        → make_atlas.py → generate_spine_player.py → preview.html
```

切件原则(接缝隐形的关键):
- 关节处横切:颈下 y=335、袖口内缘、裙摆下 y=600 起、膝盖 y=775
- 相邻件重叠 20px,绘制顺序后画的盖前面 → 接缝藏在袖口/裙摆/领口下
- 种子点过滤防止头发丝误入部件(种子点务必落在部件实心处,有次落空导致切出空件)
- 骨骼命名必须对齐技能预设:`left-upper-arm` / `left-lower-leg` 等,idle/walk 生成器靠名字识别骨骼,一行 `"animations": ["idle","walk"]` 自动出两套动画

### 坐标换算(每次都要用)
```
spine_x = pixel_x - 图宽/2        # x 居中
spine_y = 图高 - pixel_y          # y 翻转成向上
骨骼位置 = 子关节世界坐标 - 父骨骼世界坐标(相对量)
部件偏移 = 部件图中心 - 所挂骨骼坐标
```

## 三、skill 用了哪些

| 脚本 | 用途 | 是否用了 |
|---|---|---|
| build_spine_json.py | 骨骼配置→Spine 4.2 JSON(内含6套预设动画) | ✅ 核心 |
| make_atlas.py | 散件打包图集 | ✅ |
| generate_spine_player.py | 生成 HTML 预览 | ✅ |
| split_character.py | Gemini 拆件 | ❌ 无 key,MiniMax 替不了 |
| position_parts.py | SIFT 定位+遮挡排序 | ❌ 切割即定位,跳过 |
| reskin-app、demo、docs | 换皮工具/示例 | ❌ 未动 |

真正卡脖子的是前半段(拆件+定位),自写 `cut_parts.py` 替代;后半段三脚本无缝接上,因为**骨骼命名和坐标规范严格按 SKILL.md 来**。

## 四、已知瑕疵(v1 水平)

1. 腿大幅摆动时裙摆下缘露平直接缝(大腿件顶部带了条裙摆像素跟着转)
2. 颈部/袖口切缝静止时隐形,大角度运动才可能露馅
3. 飘带是刚性的,没做摆动物理(给飘带骨骼补关键帧即可)
4. 部件边缘有轻微白边(JPG 源白底渗色),浅色预览背景规避

## 五、Godot 接入(下一步)

`girl1.json/.atlas/.png` 是标准 Spine 4.2 数据,HTML 只是预览载体。三条路:

1. **官方 spine-godot 插件**:坑 = 官方支持滞后(文档在 Godot 4.4.1 附近,4.5/4.6 还在开发),本机 Godot 4.7.2 大概率无预编译包;且商用需 Spine 编辑器许可证
2. **离线烘培成原生 AnimationPlayer(推荐)**:写转换器解析 JSON → Godot 场景(每部件 Sprite2D+AtlasTexture)+ 30fps 采样骨骼曲线成关键帧轨道。零依赖、任意版本、无许可问题
3. GDScript 迷你运行时:运行时读 JSON 逐帧算,工程量大,暂不取

## 六、复用模板

下次给任意 2D 角色(游戏立绘/漫画角色)做骨骼动画,模板全在 `D:\spine-test\girl1\`:
- `prep_grid.py` — alpha 提取+坐标网格
- `cut_parts.py` — 多边形+种子点切件(改 PARTS 字典的坐标和种子点即可换角色)
- `config_girl1.json` — 骨骼配置模板(改坐标偏移)

记忆已存:spine-animation-pipeline(含"MiniMax 拆件不可行"结论)。
