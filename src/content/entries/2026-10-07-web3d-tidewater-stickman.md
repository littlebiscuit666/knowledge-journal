---
title: "Web3D 学习记录：Tidewater 海岛钓鱼 & 火柴人骑士"
date: 2026-10-07
category: 技术
tags: [web3d, webgpu, threejs, 日记归档]
draft: false
---

日期：2026-10-07

本机环境：
- CPU：Intel Core Ultra 5 225H（14 核，Arrow Lake）
- GPU：Intel Arc 130T（16GB，Xe2 架构核显，非老款 HD/UHD 核显）
- 内存：32GB
- 系统：Windows 11（26200）

---

## 一、Tidewater：浏览器海岛钓鱼游戏（自研 WebGPU 引擎）

### 1. 项目信息
- 仓库：https://github.com/dgreenheck/tidewater
- 在线试玩：https://dgreenheck.github.io/tidewater/
- 协议：MIT
- 2026-09-23 创建，截至今天约 1139 star / 249 fork
- 主语言 JavaScript（约 3.4MB），Vite 本地开发（npm run dev → 127.0.0.1:5189）
- 项目描述 "Coastal town built with Opus 5.5"：整个游戏主要借助 Claude Opus 5.5 写出

### 2. 最硬核的点
不使用 Three.js / Unity / Unreal 等任何现成 3D 框架，直接基于 WebGPU + WGSL
自己写了一个小型渲染引擎。

### 3. 玩法
- 第一人称海岛钓鱼：码头、沙滩、自己的船上都能抛竿
- 18 种加勒比海鱼；咬钩取决于水域（浅滩/码头/礁石区/海湾/深海）、水深、时间
- 溜鱼机制：鱼线张力保持在绿色区间，鱼冲刺时放线
- 渔获卡片、钓鱼日志、冷藏箱
- 经济系统：鱼卖给鱼摊 Joe；在 Marta 船具店买线、轮、竿、大油箱/鱼舱、探鱼器、夜钓灯
- 船烧柴油；可在甲板/驾驶舱走动；首次引导、小地图；进度存浏览器本地

### 4. 渲染技术（图形学经典话题集中展示）
- 海洋：四阶级联 FFT 海浪（Tessendorf 谱）、白沫、碎浪、沙滩浅水回流(swash)模拟、
  船尾航迹、海底焦散、水面/水下分屏视角、出水后镜头水滴
- 天空：物理大气散射（Hillaire 2020）、日月星空、体积云、云影、雾霾、
  丁达尔光、带遮挡的镜头光晕
- 世界：小岛、渔村、码头、珊瑚礁、热带植物、鸟、螃蟹、会跃出水面的座头鲸
- 光照/后处理：级联阴影+接触硬化半影、GTAO、时域超分(TAAU)、Bloom、
  自动曝光、运动模糊；夜晚灯笼/窗/船灯 + 手电筒
- 音频：CC0 实地录音的位置音效，浪声与每条碎浪同步

### 5. 运行门槛
- 需要支持 WebGPU 的浏览器（新版 Chrome/Edge/Safari）和不错的 GPU
- 目标：Apple M5 Pro 上 2560×1267 @60fps；慢机器动态降分辨率
- 首次打开编译几百个 shader，可能等 1 分钟以上，之后有缓存
- 本机 Arc 130T + 32GB 实测可玩（已成功钓上一条鱼）

### 6. 代码结构
src/engine（自研引擎）、ocean、sky、world、post、game、player、audio、ui

### 7. 意义
一个人 + AI，两周，无框架，在浏览器做出近 3A 画质 demo。
FFT 海浪、大气散射、级联阴影都是图形学/面试经典话题，源码可作教材。

---

## 二、火柴人骑士项目（Three.js 框架）

路径：D:\gemini-workspace\stickman-knight-3d
操作：WASD 移动 / J 攻击 / 鼠标右键拖拽环视 / 滚轮缩放

### 1. 怎么启动（纯静态项目，无 package.json，不用 npm）
```sh
cd /d/gemini-workspace/stickman-knight-3d
python -m http.server 8777
```
浏览器打开 http://localhost:8777

不能直接双击 index.html：file:// 协议的 CORS 策略会拒绝加载 .glb 模型。

### 2. 为什么用 Python"启动"JS 项目
- Python 没有运行游戏，只是充当静态文件服务器（标准库模块 http.server，
  在 Python 安装目录 Lib\http\server.py，项目里没有任何 Python 文件）
- 真正执行 JS 的是浏览器 V8 引擎，画 3D 的是 WebGL
- 比喻：Python 是快递员/快递柜，只负责按 URL 路径取文件原样转发；
  浏览器是演员+舞台
- 链路：浏览器请求 localhost:8777 → Python 找硬盘文件 → 原样回传 →
  浏览器执行渲染
- 日志行含义："GET /stickman_scene.glb HTTP/1.1" 200 = 取该文件成功

### 3. 素材清单（浏览器实际请求的全部文件）
1. index.html（1.5KB）：网页骨架，两个 div（#app 画布挂载点、#hint 操作提示）
   + CSS；含 importmap 导入映射（给模块起外号）和 main.js 点火标签
2. main.js（9KB）：全部游戏逻辑（场景/灯光/地面/石头/加载模型/动画/移动/相机/剑光）
3. lib/three.module.js（约1.2MB）：Three.js 引擎本体
4. lib/GLTFLoader.js：解析 glb/gltf 的插件
5. lib/environments/RoomEnvironment.js：虚拟摄影棚环境贴图，
   给金属材质提供反射（否则金属渲染成黑色）
6. utils/BufferGeometryUtils.js：几何工具，被 GLTFLoader.js 第68行依赖
   （依赖的依赖，浏览器自动连带加载）
7. stickman_scene.glb（885KB）：Blender 导出的模型（网格+骨骼+动画+材质）

注意：本项目没有 png/jpg 图片，外部素材实际只有一个 glb。
颜色靠代码与 glb 内材质参数，剑辉光是 glb 内自发光材质。

### 4. importmap 的作用（index.html 31-39行）
代码写 import ... from 'three' → 实际加载 ./lib/three.module.js；
'three/addons/loaders/GLTFLoader.js' → ./lib/GLTFLoader.js。
无需 npm install 即可使用 Three.js 官方写法。

---

## 三、glb 里的动画 & 与键盘的绑定

### 1. 动画在 glb 里存的是什么
不是视频/图片，是骨骼关键帧数字数据：
- 哪根骨头（如 thigh.L 左大腿）
- 什么时间点（秒）
- 位移 / 旋转(四元数) / 缩放
概念示例：
  thigh.L：t=0.00 旋转0° → t=0.12 旋转30° → t=0.25 旋转0° → …
27 个通道，5.62 秒动画数据量仅几 KB。

播放时：
1. AnimationMixer 按当前时间在关键帧间插值，算出每根骨头此刻的精确变换
2. 骨头摆好姿势
3. 蒙皮网格按权重（顶点受哪些骨头影响）在 GPU 上跟着变形
模型只存一份，动画是"摆骨头的指令"，远比 MP4/PNG 序列帧省资源。

### 2. 键盘绑定动画的真实链路
键盘不直接绑动画，中间隔一层"状态"：
按键 → 记录按键状态 → 每帧判断状态选动作 → mixer 播放

对应代码：
1. main.js 142-147行 键盘监听只记账：keys[e.code] = true/false
2. 82-110行 glb 加载后，把 gltf.animations[0]（5.62秒整条）按帧区间切三段：
   - idle：帧 1-49（0-2秒，站立呼吸，循环）
   - walk：帧 49-98（2-4秒，走路，循环）
   - attack：帧 101-136（4.17-5.63秒，劈砍，单次）
   每段用 mixer.clipAction 创建动作播放器
3. 每帧 tick()（222-249行）：
   - 查 WASD → moving 真/假
   - J 键按下瞬间 → tryAttack()（153行），attacking=true 播 attack；
     动作播完触发 finished 事件（115行），自动回 idle/walk
   - 状态选动作：moving且未攻击→walk；站立未攻击→idle；
     攻击中→attack（锁定，WASD 被 !attacking 忽略）
4. 258行 mixer.update(dt)：把选中动作真正应用到模型
5. fadeTo() 用 0.18 秒 crossFade 混合，切换不生硬

要点：
- J 键 = 一次"事件" → 播一次性攻击
- WASD = 持续"状态" → idle/walk 之间切
- 手指动作经"状态机"翻译成骑士动作

---

## 四、游戏中骨骼动画的三种载体（对比）

1. 骨骼动画数据（FBX/glTF，主流）：模型+骨架+关键帧，GPU 实时蒙皮；
   文件小、可混合/换装、任意视角清晰
2. MP4 视频：仅开场 CG/过场/游戏内屏幕；是平板画面，不能交互、不能换角度
3. PNG 序列帧：2D 游戏/UI 动效/粒子/远处 billboard（Tidewater 远处树 impostor
   类似此思路）；占资源大（多帧×多朝向），换角度穿帮

角色动画工作流：建模 → 绑骨(rigging) → 刷权重 → K帧/动捕 → glTF 导出
（不是渲染成视频输出）

镜头水渍原理（后期特效，非建模）：摄像机前叠水滴贴图 + 折射 shader 让
水滴后画面变形，出水后渐隐。

---

## 五、Blender 建模学习路线（备忘）

1. 装 Blender（免费开源；Cycles 支持 Intel oneAPI，Arc 可加速）
2. Blender Guru 甜甜圈教程（B站有中字），走通建模→材质→灯光→渲染全流程
3. 练习顺序：杯子碗 → 桌椅 → 刀剑斧 → 木桶木箱 → 低模小房子
4. 核心概念：顶点/边/面/法线；挤出/环切/倒角/实体化；
   Subdivision 修改器；UV 展开；PBR 材质（颜色/粗糙度/金属度）
5. 游戏方向：低模拓扑 → glTF 导出 → 放进 Three.js/WebGPU（会编程是优势）

---

## 六、常用操作备忘

- 火柴人项目启动：
  cd /d/gemini-workspace/stickman-knight-3d && python -m http.server 8777
- 改模型后：Blender 重新导出 glb（覆盖 stickman_scene.glb），
  浏览器 Ctrl+F5 强刷，代码无需改动
- 导出前建议隐藏/排除工作室地板、灯光、相机等非角色对象，保持 glb 干净
- Tidewater 设置面板 H：可调时间/天气/海况，开关体积云等特效观察帧率变化；
  C 键潜水；P 拍照模式

---

## 七、K 帧与动作数据密度（补充）

- K 帧 = Key 帧：在某些时刻给骨头姿势打关键标记，中间过渡帧由软件自动插值
- 手 K 动画只打"关键姿势"：如挥手 1 秒(24帧)只需约 3 个关键帧，中间自动补
  "24帧里6个关键帧"是手 K 的典型密度，帧少反而好编辑
- Mixamo 动作帧很密：来自动作捕捉(mocap)，真人动捕每帧烘焙一个关键帧，
  24fps 即每秒24帧/骨，真实但难改
- 动捕帧太密的处理：
  1. 精简关键帧 Decimate Keyframes（如每5帧留1帧，动画基本不变）
  2. 在 NLA 里整条移动/缩放片段时长
- NLA（非线性动画）：像视频剪辑软件，把 idle/walk/attack 当素材条排列拼接，
  是合成 GameClips 的工具

---

## 八、做游戏的免费软件与素材全家桶

目标游戏构想：塔防 + 角色探索双线游戏
（参考：The Riftbreaker 银河破裂者、Moonlighter 夜勤人）
核心循环一句话："外出探索获得 X，回家用 X 建塔，守住夜袭后开放下一块区域。"

### 1. 游戏引擎
- Godot 4（首推）：免费开源 MIT，无收入分成；GDScript 语法像 Python，
  也支持 C#；2D/3D 都行；UI/动画/寻路/粒子内置
- Unity 个人版：收入低于 10 万美元免费；Asset Store 素材最多；
  但安装笨重、对新手偏重
- Three.js：可做游戏但存档/寻路/背包UI都要自造轮子，适合学习不适合快速成品

### 2. 3D 模型素材（多为 CC0）
- Kenney.nl：CC0 独立游戏素材之王，低模城市/自然/道具/UI/音效大包，首推
- Quaternius：CC0 低模角色和动画（怪物、英雄）
- KayKit：CC0 低模冒险者/地牢/僵尸包
- Poly Pizza：CC0/CC-BY 模型站（Google Poly 遗产）
- Sketchfab：按 Downloadable + CC0 筛选
- Mixamo：上千免费角色动作（Adobe 服务，下载 FBX 需用 Blender 转 glb）

### 3. 贴图材质 / HDRI
- ambientCG.com：CC0 PBR 材质
- Poly Haven：CC0 PBR 材质 + HDRI 环境光（Tidewater 也用它）

### 4. 2D / UI / 图标
- Kenney UI 包：整套按钮/面板/图标
- game-icons.net：CC-BY 黑白线图标（道具/技能栏）
- Krita：免费绘画软件（画图标/贴图）
- Photopea：网页版图片编辑（免安装）

### 5. 音效音乐
- Freesound.org：CC0 实地音效（注意看单个文件授权）
- Kenney Audio、Pixabay：CC0/免费音效音乐
- jsfxr：网页一键生成 8-bit 音效
- Kevin MacLeod（incompetech）：CC-BY 免费配乐
- Audacity：免费音频剪辑软件

### 6. 字体
- Google Fonts：OFL 协议免费；思源系列中文友好

### 7. 其他工具
- Tiled：免费 2D 地图编辑器
- Laigter：免费给 2D 图自动生成法线贴图（2D 打出 3D 光照感）
- Blender：建模/动画/FBX→glb 转换（本机在 D:\blender\blender.exe，5.0.1）
- Git + GitHub：代码版本管理
- AI 出图（即梦/MiniMax）：适合概念图和风格参考，注意全套风格统一

### 8. 授权三档（必记）
- CC0：随便用，首选
- CC-BY：免费但要在游戏 Credits 鸣谢署名
- 带 NC（非商业）：学习可以，商用/卖游戏不可用，避开

### 9. 游戏最小技术骨架（Godot）
- 塔防线：网格建造系统 + 敌人路径(Navigation 寻路/A*) + 波次管理器 +
  塔的目标选择与攻击 + 金币经济
- 探索线：角色控制器 + 交互系统(宝箱/奇观) + 背包道具 + 小地图/战争迷雾
- 两线挂钩：探索宝藏 → 解锁新塔/科技；守住基地 → 解锁新区域

### 10. 起步路径
1. 先定 2D 俯视角（出活快）还是 3D 低模（延续 Blender/火柴人积累）
2. 跑 Godot 官方"第一个 2D/3D 游戏"教程（B站有中字，2-3小时）
3. 最小原型：放一个塔 + 怪沿路径走 + 塔打怪；再加角色开宝箱；最后合并
4. 素材先用 Kenney 占位，玩法跑通后再定制美术
