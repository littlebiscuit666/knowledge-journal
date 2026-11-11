---
title: "Penpot 设计师工作流与函数映射"
date: 2026-08-14
category: 工具
tags: [penpot, mcp, 设计, 日记归档]
draft: false
---

> 整理日期：2026-08-14
> 以「专业设计师真实工作流」为主线，把 Penpot MCP（`execute_code`）里对应的对象/函数串起来。
> 心智模型：**`penpotUtils` 负责查找/遍历/定位（优先用，别自己写循环）；`shape` 自身方法负责改它自己；`penpot` 负责全局 + 工厂。**
> 配套见 [[2026-08-14_Claude-Code工具与操作清单]]。

---

## 一图看懂整体顺序

> **getPages → shapeStructure（看）→ 建颜色/token（立规矩）→ 创建画板+元素（画）→ addFlexLayout（排）→ fills/strokes（打扮）→ 文本 → 组件化（存）→ export_shape（验收）→ generateStyle（出码）**

---

## 阶段 0：摸清现状（看项目）

设计师打开项目第一件事是「先看有什么」，不是上来就画。

| 做什么 | 函数 / 对象 |
|---|---|
| 看有哪些页面 | `penpotUtils.getPages()` |
| 按名/ID 取页面 | `getPageByName(name)` / `getPageById(id)` |
| 看当前页结构 | `penpotUtils.shapeStructure(penpot.root, 3)` |
| 看某画板/选中内部结构 | `penpotUtils.shapeStructure(shape)` |
| 按条件找单个元素 | `penpotUtils.findShape(predicate)` |
| 批量找元素 | `penpotUtils.findShapes(predicate)` |
| 按 ID 找 | `penpotUtils.findShapeById(id)` |
| 拿用户当前选中 | `penpot.selection`（取到后**立刻存进 `storage`**） |

> 约定：`penpot.root` 只是当前页；跨页要先确定页面。

---

## 阶段 1：搭设计系统（组件库 + token）

专业设计师先立「规矩」再画图。

### 颜色 / 字体
```js
const color = penpot.library.local.createColor();
color.name = 'Brand Primary';
color.color = '#0066FF';            // 大写 hex

const typo = penpot.library.local.createTypography();
typo.name = 'Heading Large';
// 继续设 typo 的字号/字重/行高等…
```

### 设计 Token（统一管理色值/尺寸）
```js
const catalog = penpot.library.local.tokens;
const set = catalog.addSet({name: 'core'});
if (!set.active) set.toggleActive();

const tok = set.addToken({type: "color", name: "color.primary", value: "#0066FF"});
// 引用其它 token：value: "{color.primary}"

penpotUtils.tokenOverview();        // 查看现有 token 全貌
shape.applyToken(tok, ["fill"]);    // 应用到 shape（异步，~100ms 后生效）
shape.tokens;                       // 查 shape 上绑了哪些 token

// 移除 token：直接设属性即可自动解绑
shape.fills = [{ fillColor: "#000000", fillOpacity: 1 }];
```

---

## 阶段 2：创建画板 + 元素（画）

| 做什么 | 方法 |
|---|---|
| 拿当前选中作为容器 | `penpot.selection[0]` |
| 创建画板/矩形/文本等 | `penpot` 工厂方法（见 `penpot_api_info`） |
| 加子元素 | `parent.appendChild(shape)` / `parent.insertChild(i, shape)` |
| 复制现有元素 | `shape.clone()`（连同子元素、位置） |
| 相对父级定位 | `penpotUtils.setParentXY(shape, parentX, parentY)` |
| 绝对定位 | 直接 `shape.x = ..; shape.y = ..` |
| 改尺寸 | `shape.resize(w, h)`（`width/height/bounds` 只读） |
| 删除 | `shape.remove()` |

> ⚠️ `parentX/parentY/width/height/bounds` 都是只读；改尺寸只能 `resize()`。

---

## 阶段 3：排版布局（Flex / Grid）

一行行手摆坐标迟早乱，设计师会先上布局系统。

### Flex（容器已有子元素时，**必须用这版**，否则子元素顺序会乱）
```js
penpotUtils.addFlexLayout(container, "row");   // row/column/row-reverse/column-reverse
container.flex.rowGap = 16;
container.flex.columnGap = 16;
container.flex.justifyContent = "center";
container.flex.alignItems = "center";
container.flex.topPadding = 24;                 // 也可 rightPadding/verticalPadding/horizontalPadding

// 单个孩子在布局里的边距/填充/尺寸
shape.layoutChild.horizontalMargin = 12;
shape.layoutChild.verticalSizing = "fill";      // fix | auto | fill
```

### Grid
```js
container.addGridLayout();
container.grid.rows = 3;
container.grid.columns = 4;
container.grid.appendChild(shape, row, col);    // 行列从 1 开始
shape.layoutCell.row = 2;                       // 事后改定位
```

### 自动尺寸（让容器自适应内容）
- `verticalSizing / horizontalSizing`：`"fix" | "auto" | "fill"`
- 想容器跟着内容走 → 设 `auto`

> 布局系统会覆盖手动 x/y，**先确认容器有没有布局再动手摆孩子**。

---

## 阶段 4：调样式（打扮）

| 做什么 | 方法 / 属性 |
|---|---|
| 填充 | `shape.fills = [{ fillColor: "#FF5533", fillOpacity: 1 }]` |
| 无填充（透明） | `shape.fills = []` |
| 描边 | `shape.strokes = [...]` |
| 阴影 | `shape.shadows = [...]` |
| 圆角 | `shape.borderRadius`，或 `borderRadiusTopLeft` 等单独设 |
| 透明度/混合/旋转 | `shape.opacity` / `shape.blendMode` / `shape.rotation` |
| 隐藏/锁定 | `shape.hidden` / `shape.blocked` |
| 翻转 | `shape.flipX` / `shape.flipY` |
| z 层级 | `bringToFront()` / `sendToBack()` / `bringForward()` / `sendBackward()` / `setParentIndex(i)` |

> ⚠️ fills/strokes/shadows **数组内容只读，只能整体替换**；颜色用大写 hex。

---

## 阶段 5：文本

```js
text.characters = "标题";
text.fontSize = 24;
text.align = "center";
// resize() 会把 growType 变 fixed，要自动撑开就得重设：
text.growType = "auto-width";            // 或 "auto-height"

// 一次性套字体
const font = penpot.fonts.findByName("Laila");
font.applyToText(text, variant);
// 查可用字重
font.variants.map(v => v.fontWeight);

// 局部样式（TextRange）
const range = text.getRange(0, 3);
font.applyToRange(range, variant);
```

> 别拿 Text 元素去重复 shape 名字——UI 里本就显示名字，等于多余标注。

---

## 阶段 6：组件化 + 变体（存可复用件）

做好的按钮/卡片存成组件，以后拖出来用。

### 创建/使用组件
```js
const comp = penpot.library.local.createComponent([shape1, shape2]);
comp.name = "按钮";

const inst = comp.instance();             // 拖一个实例到画布
inst.detach();                            // 解除关联，独立改（否则部分改动不生效）
inst.component();                         // 反查实例来自哪个组件
```

### 变体（同组件多状态，如 Type=Primary/Secondary）
```js
// 把多个主实例合成变体组
const vc = penpot.createVariantFromComponents([mainA, mainB]);

const vs = vc.variants;                   // Variants 对象
vs.renameProperty(0, "Type");             // 改属性名
vs.addProperty();                         // 加新轴
comp.setVariantProperty(0, "Primary");    // 给某变体赋值

// 实例上切换变体
inst.switchVariant(0, "Secondary");
```

---

## 阶段 7：验收 + 出码

| 做什么 | 工具 / 函数 |
|---|---|
| 导出看效果 | MCP 工具 `export_shape`（shapeId / `'selection'` / `'page'`，PNG/SVG） |
| 校验孩子是否溢出容器 | `penpotUtils.analyzeDescendants(board, evaluator)` + `isContainedIn()` |
| 批量自动修正 | `analyzeDescendants` 里返回「修正函数」，再统一执行 |
| 导出 CSS | `penpot.generateStyle(shapes, {type:"css", withChildren:true})` |
| 导出 HTML/SVG | `penpot.generateMarkup(...)` |

### analyzeDescendants 典型用法（批量找问题 + 修正）
```js
const fixes = penpotUtils.analyzeDescendants(board, (root, shape) => {
  const xMod = shape.parentX % 4;
  if (xMod !== 0) {
    return () => penpotUtils.setParentXY(shape, Math.round(shape.parentX/4)*4, shape.parentY);
  }
});
fixes.forEach(f => f.result());          // 统一应用
```

---

## 三大对象速记卡

| 对象 | 定位 | 高频 API |
|---|---|---|
| **`penpot`** | 全局 + 工厂 | `root`、`selection`、`library`、`fonts`、`generateStyle/Markup`、`createVariantFromComponents` |
| **`penpotUtils`** | 查找/遍历/定位（优先用） | `getPages`、`shapeStructure`、`findShape(s)`、`setParentXY`、`isContainedIn`、`analyzeDescendants`、`addFlexLayout`、`tokenOverview` |
| **`storage`** | 跨调用存中间结果 | 自由挂属性，存选区/工具函数，下次接着用 |

---

## 易踩坑备忘

1. **`addFlexLayout` vs `board.addFlexLayout()`**：容器已有子元素时只能用 `penpotUtils.addFlexLayout(container, dir)`，否则子元素会被乱序。
2. **数组只读**：fills/strokes/shadows 改动要整体替换数组，不能改单个元素。
3. **resize 会重置 growType**：文本自动撑开后要重新设 `growType`。
4. **选区易变**：拿到 `penpot.selection` 立刻拷进 `storage`，别假设它不变。
5. **组件实例改动**：部分操作（如删孩子）要先 `detach()` 才生效。
6. **颜色格式**：大写 hex（`#FF5533`）。
7. **布局覆盖手动坐标**：有布局时别直接摆孩子 x/y，改 gap/padding/margin。
8. **token 异步生效**：应用后约 100ms 才反映到属性，读前可短暂 sleep。
9. **图片**：图片现在嵌在 `Fill.fillImage` 里，不是独立的 `image` type（那已是 legacy）。
