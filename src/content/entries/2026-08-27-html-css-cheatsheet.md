---
title: "HTML 标签与 CSS 属性速查手册"
date: 2026-08-27
category: 技术
tags: [html, css, 前端, 速查, 日记归档]
draft: false
---

## 一、HTML 标签（固定的，浏览器认识的）

### 结构类
| 标签 | 作用 |
|------|------|
| `<html>` | 根元素 |
| `<head>` | 头部（放标题、样式、脚本） |
| `<body>` | 主体（页面内容） |
| `<div>` | 通用容器（最常用） |
| `<span>` | 行内容器 |
| `<header>` | 页头 |
| `<footer>` | 页脚 |
| `<nav>` | 导航栏 |
| `<section>` | 区块 |
| `<article>` | 文章 |
| `<aside>` | 侧边栏 |

### 文本类
| 标签 | 作用 |
|------|------|
| `<h1>`~`<h6>` | 标题（1最大，6最小） |
| `<p>` | 段落 |
| `<a>` | 链接 |
| `<strong>` | 加粗 |
| `<em>` | 斜体 |
| `<br>` | 换行 |
| `<hr>` | 分割线 |

### 列表类
| 标签 | 作用 |
|------|------|
| `<ul>` | 无序列表 |
| `<ol>` | 有序列表 |
| `<li>` | 列表项 |

### 媒体类
| 标签 | 作用 |
|------|------|
| `<img>` | 图片 |
| `<video>` | 视频 |
| `<audio>` | 音频 |
| `<canvas>` | 画布（JS 绑定） |

### 表单类
| 标签 | 作用 |
|------|------|
| `<form>` | 表单容器 |
| `<input>` | 输入框 |
| `<button>` | 按钮 |
| `<textarea>` | 多行输入 |
| `<select>` | 下拉选择 |
| `<option>` | 下拉选项 |

### 表格类
| 标签 | 作用 |
|------|------|
| `<table>` | 表格 |
| `<tr>` | 行 |
| `<td>` | 单元格 |
| `<th>` | 表头单元格 |

---

## 二、CSS 常用属性

### 尺寸
| 属性 | 作用 |
|------|------|
| `width` | 宽度 |
| `height` | 高度 |
| `max-width` | 最大宽度 |
| `min-height` | 最小高度 |

### 间距
| 属性 | 作用 |
|------|------|
| `padding` | 内边距（内容到边框） |
| `margin` | 外边距（边框到外部） |
| `gap` | 子元素间距 |

### 边框
| 属性 | 作用 |
|------|------|
| `border` | 边框 |
| `border-radius` | 圆角 |
| `border-width` | 边框粗细 |
| `border-color` | 边框颜色 |

### 背景
| 属性 | 作用 |
|------|------|
| `background` | 背景 |
| `background-color` | 背景颜色 |
| `background-image` | 背景图片 |
| `background-size` | 背景大小 |

### 文字
| 属性 | 作用 |
|------|------|
| `color` | 文字颜色 |
| `font-size` | 字体大小 |
| `font-weight` | 字体粗细 |
| `font-family` | 字体 |
| `text-align` | 对齐方式 |
| `text-decoration` | 装饰（删除线等） |
| `line-height` | 行高 |

### 布局
| 属性 | 作用 |
|------|------|
| `display` | 显示方式（block/inline/flex/grid） |
| `flex-direction` | 弹性布局方向 |
| `justify-content` | 主轴对齐 |
| `align-items` | 交叉轴对齐 |
| `grid-template-columns` | 网格列定义 |
| `position` | 定位方式 |
| `top`/`left`/`right`/`bottom` | 定位位置 |

### 阴影
| 属性 | 作用 |
|------|------|
| `box-shadow` | 盒子阴影 |
| `text-shadow` | 文字阴影 |

### 过渡和动画
| 属性 | 作用 |
|------|------|
| `transition` | 过渡效果 |
| `animation` | 动画 |
| `transform` | 变换（缩放、旋转、位移） |

### 可见性
| 属性 | 作用 |
|------|------|
| `display` | 显示/隐藏 |
| `visibility` | 可见性 |
| `opacity` | 透明度 |
| `overflow` | 溢出处理 |

---

## 三、核心概念

### 三件套分工
| 技术 | 负责 | 类比 |
|------|------|------|
| HTML | 结构和内容 | 房子的骨架 |
| CSS | 样式和布局 | 房子的装修 |
| JS | 行为和交互 | 房子的电器 |

### class 和 ID 的区别
| | ID | Class |
|---|---|---|
| 数量 | 每个页面只能有1个 | 可以有无数个 |
| 用途 | 精确找某一个元素 | 找一类元素 |
| 语法 | `#id` | `.class` |

### class 名字是随便取的
```html
<!-- 这些 class 名字都是我们自己编的 -->
<div class="card">这是卡片</div>
<div class="banana">这也是卡片</div>
```

效果来自 CSS 样式，不是来自名字。

### CSS 动画 vs JS 动画
| | CSS 动画 | JS/Canvas 动画 |
|---|---|---|
| 谁在算 | 浏览器帮你算 | 你自己算 |
| 运行位置 | 合成器线程（后台） | 主线程（前台） |
| JS 忙的时候 | 不受影响，继续播放 | 会卡顿 |
| 能做什么 | 位移、缩放、旋转、透明度 | 任何你算得出来的东西 |

---

## 四、记忆口诀

> **HTML 标签：div、p、a、img、input、ul/li、table**
> **CSS 属性：color、background、margin/padding、border、font、display、position**
> **HTML 搭骨架，CSS 穿衣服，JS 加动作**

---

## 五、参考文档

| 资源 | 地址 |
|------|------|
| MDN HTML 参考 | https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element |
| MDN CSS 参考 | https://developer.mozilla.org/zh-CN/docs/Web/CSS/Reference |
| MDN 学习区 | https://developer.mozilla.org/zh-CN/docs/Learn |
