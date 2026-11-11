---
title: "Mexico Racer 墨西哥赛车游戏开发总结"
date: 2026-09-08
category: 生活
tags: [游戏, webgl, 全ai生成, 日记归档]
draft: false
---

> 2026-09-08 一天完成的浏览器 3D 竞速游戏（类地平线5）
> 项目位置：`D:\mexico-racer` · 详细踩坑记录见项目内 `DEVLOG.md`

## 怎么启动

**双击 `D:\mexico-racer\start.bat`** 就行——它会自动起本地服务器并打开浏览器。

- 手动方式：`cd D:\mexico-racer\public && python -m http.server 8891`，浏览器开 `http://localhost:8891`
- URL 参数：`?debug=1`（FPS/遥测面板）、`?low=1`（低配模式）、`?seed=12345`（换赛道布局）
- 必须走 http 服务器，**直接双击 index.html 打不开**（ES module 的 CORS 限制）

## 操作

| 按键 | 功能 |
|---|---|
| WASD / 方向键 | 驾驶 |
| Space | 漂移（漂移会攒氮气） |
| Shift | 氮气加速（放氮气，极速295km/h） |
| R | 复位回赛道 |

玩法：3圈竞速，4辆AI对手（橡皮筋难度），结算名次/圈速。

## 游戏构成

- **Three.js 真3D世界**：程序化闭合环线赛道（每次可换seed）、起伏地形、火山远景、天空盒
- **5辆车全是真3D模型**：火山方舟 Seed3D 2.0 图生3D（拿即梦生成的车图当输入），Blender 减面到5万面/2.7MB GLB
- **植被/建筑/拱门/广告牌**：即梦3.1文生图 → 洋红底 → 区域生长抠图 → billboard面片
- **音效**：WebAudio 纯合成（引擎转速/轮胎摩擦/氮气），零音频素材
- **所有素材有canvas程序化兜底**：任何图片缺失游戏照样能跑（先兜底后替换）

## AI 素材管线（想换素材看这里）

```bash
# 1. 改 D:\mexico-racer\scripts\asset_manifest.py 里的提示词
# 2. 批量生图（串行，即梦账号并发上限极低）
python scripts/batch_gen.py --only palm,rock
# 3. 画廊过目: assets/gallery/index.html，满意后抠图裁剪
python scripts/postprocess.py
# 4. 生成3D车模（~6.5分钟/辆，30000 tokens）
python scripts/seed3d_batch.py
# 5. Blender减面转GLB：D:\blender，管线代码见 DEVLOG.md
```

## 关键踩坑（换项目也用得上）

1. **即梦并发上限极低**：第3个任务就50430，且SDK对这类错误是抛异常不是返回错误码 → 必须串行+正则从异常抽code重试
2. **抠图别用固定色阈值**：生图的"纯色背景"经常出渐变/影棚红，正解是从四边种子做**区域生长**（邻居颜色连续就吸收，能吃掉渐变和投影）
3. **路面标线别烘进纹理**（会出斜线+阴影），用几何条带画线
4. **three.js r180+ 拆成两个文件**：three.module.js + three.core.js 都要拷，缺一个=模块图静默白屏无报错
5. **GLTFLoader 有相对路径依赖**：必须保持 `lib/loaders/` + `lib/utils/` 目录层级
6. **Seed3D 每辆模型朝向不一致**：逐车数值检测车尾位置（Y±两端顶部顶点高度对比），决定要不要补180°翻转
7. **地形和路面同高会 z-fighting**：路面抬高0.1m + 开 logarithmicDepthBuffer
8. **远程控制浏览器测试游戏**：后台标签 rAF 停转画面全黑，截图前必须 bringToFront

## 未来可扩展

- 换赛道：`?seed=` 传新种子即可（`config.js` 里 TRACK_SEED）
- 新赛道素材：改 manifest 提示词重新生成
- 手柄支持、计时赛/淘汰赛模式、更多天气（提示词换"雨天黄昏"整套素材重出）
- 多人：静态页没后端，可以接 WebSocket

## Git

项目已 git 初始化（main 分支）。`assets/seed3d/`（777MB原始OBJ）和 `node_modules/` 已 ignore；生成图、GLB成品、全部源码入库。
