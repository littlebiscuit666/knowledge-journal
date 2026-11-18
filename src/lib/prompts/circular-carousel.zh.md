## 集成 React Bits 的 <CircularCarousel /> 组件

你将帮助我把一个开源 React 组件集成到现有应用中。

### 组件：CircularCarousel
### 变体：JavaScript + CSS
### 依赖：无（纯 CSS 3D 变换）

---

### 用法示例
```jsx
import CircularCarousel from './CircularCarousel';

const items = [
  { src: '/images/valley.jpg', alt: 'Mist drifting through a valley', title: 'Valley', subtitle: 'Landscape' },
  { src: '/images/portrait.jpg', alt: 'A studio portrait', title: 'Portrait', subtitle: 'Studio' },
  { src: '/images/towers.jpg', alt: 'Glass towers from street level', title: 'Towers', subtitle: 'Architecture' }
];

<div style={{ width: '100%', height: '560px', position: 'relative' }}>
  <CircularCarousel
    items={items}
    preset="cylinder"
    intro="rise"
    cardWidth={220}
    aspectRatio={1}
    speed={14}
    captions
  />
</div>
```

### Props
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| items | Array<{ src: string; alt?: string; title?: string; subtitle?: string }> | 10 张示例照片 | 环绕排列的图片。alt 文本会播报给屏幕阅读器，title 和可选 subtitle 由字幕展示。传入一张等长的新列表会让每张卡片交叉淡入为新图片。 |
| preset | 'cylinder' \| 'orbit' \| 'wheel' \| 'panorama' | 'cylinder' | 环的形状。cylinder 卡片朝外，orbit 让每张卡片都转向你，wheel 上下旋转，panorama 把相机放进环内。 |
| intro | 'assemble' | 'rise' | 'spin' | 'none' | 'rise' | 图片加载完成后的入场动画。assemble 让卡片从更大的环滑入归位，rise 让卡片逐张从画面边缘滑入，spin 快速旋转一圈后落定。 |
| cardWidth | number | 220 | 卡片宽度（px）。整个环会在需要时缩小以适配容器。 |
| aspectRatio | number | 1 | 卡片宽除以高。图片会被裁切填充。 |
| gap | number | 25 | 相邻卡片的间距（px）。 |
| curve | number | 来自预设 | 卡片弯曲贴合环的程度，0 全平到 1 完全包裹。orbit 忽略此项。 |
| tilt | number | 来自预设 | 相机角度（度）。负值向下俯视环。 |
| perspective | number | 来自预设 | 相机距离（px）。数值越小景深越夸张。panorama 自行设定，因为相机就在中心。 |
| autoplay | 'drift' | 'step' | 'off' | 'drift' | drift 让环持续转动，step 一次移动一张并落定在上面，off 只在你操作时才动。 |
| speed | number | 14 | drift 模式的转速（度/秒）。 |
| interval | number | 3 | step 模式两次移动之间的秒数。 |
| direction | 'left' | 'right' | 'left' | 前排卡片行进的方向。甩动环会把它改成你甩的方向。在 wheel 上，left 表示向上。 |
| draggable | boolean | true | 允许用鼠标、手指或横向触控板滚动抓住并甩动环。 |
| momentum | number | 0.6 | 甩出后惯性滑行多久才 blend 回自动播放速度，0 到 1。 |
| snap | boolean | true | 环每次静止时落定到某张卡片上。 |
| pauseOnHover | boolean | true | 指针悬停时让环缓缓停下。 |
| focusOnClick | boolean | true | 点击卡片把它转到正前方。 |
| parallax | number | 0.3 | 相机朝指针方向倾斜的程度，0 到 1。 |
| stretch | number | 0.5 | 环高速旋转时向外膨胀的程度，0 到 1。 |
| depthFade | number | 0.55 | 卡片转向远处时向 fadeColor 淡出的强度，0 到 1。 |
| fadeColor | string | '#000000' | 远处卡片淡向的颜色。与轮播背后的背景色保持一致。 |
| innerShade | number | 0.6 | 从环背面看到的内侧面的亮度，0 到 1。 |
| cornerRadius | number | 12 | 卡片圆角半径（px）。 |
| captions | boolean | false | 在环下方显示正前方卡片的标题、副标题和位置序号。 |
| onChange | (index: number) => void | - | 有不同卡片转到正前方时调用。 |
| onItemClick | (item, index: number) => void | - | 点击卡片或在轮播上按 Enter 时调用。 |
| className | string | '' | 容器的额外类名。 |
| style | CSSProperties | - | 容器的内联样式。 |

### 组件完整源码
（此处粘贴 CircularCarousel.jsx 源码，代码无需翻译）

### 组件 CSS
```css
.circular-carousel {
  --cc-fade: #000000;
  --cc-radius: 12px;
  --cc-inner: 0.4;
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  outline: none;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.circular-carousel[data-axis='x'] {
  touch-action: pan-x;
}

.circular-carousel[data-draggable] {
  cursor: grab;
}

.circular-carousel[data-dragging] {
  cursor: grabbing;
}

.circular-carousel:focus-visible {
  box-shadow: inset 0 0 0 2px rgba(128, 128, 140, 0.55);
}

.circular-carousel__view {
  position: absolute;
  inset: 0;
}

.circular-carousel[data-shape='wheel'] .circular-carousel__view {
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000000 18%, #000000 82%, transparent);
  mask-image: linear-gradient(to bottom, transparent, #000000 18%, #000000 82%, transparent);
}

.circular-carousel[data-shape='panorama'] .circular-carousel__view {
  -webkit-mask-image: linear-gradient(to right, transparent, #000000 12%, #000000 88%, transparent);
  mask-image: linear-gradient(to right, transparent, #000000 12%, #000000 88%, transparent);
}

.circular-carousel__stage {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.45s ease;
}

.circular-carousel[data-ready] .circular-carousel__stage {
  opacity: 1;
}

.circular-carousel__camera,
.circular-carousel__ring,
.circular-carousel__card {
  width: 0;
  height: 0;
  transform-style: preserve-3d;
}

.circular-carousel__camera {
  position: relative;
}

.circular-carousel__ring,
.circular-carousel__card {
  position: absolute;
  left: 0;
  top: 0;
}

.circular-carousel__tile {
  position: absolute;
  outline: 1px solid transparent;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.circular-carousel__frame {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  overflow: hidden;
}

.circular-carousel__photo {
  position: absolute;
  display: block;
  max-width: none;
  object-fit: cover;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.circular-carousel__photo--leaving {
  animation: circular-carousel-leave 700ms cubic-bezier(0.33, 1, 0.68, 1) both;
}

.circular-carousel__shade,
.circular-carousel__inner {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.circular-carousel__shade {
  background: var(--cc-fade);
  opacity: var(--cc-depth, 0);
}

.circular-carousel__inner {
  background: #000000;
  opacity: var(--cc-inner);
}

.circular-carousel__caption {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 0 16px;
  color: inherit;
  text-align: center;
  pointer-events: none;
  animation: circular-carousel-reveal 900ms ease both;
}

.circular-carousel__title {
  display: flex;
  max-width: 100%;
  flex-direction: column;
  align-items: center;
  font-size: 15px;
  font-weight: 500;
  line-height: 1.35;
  animation: circular-carousel-title 520ms cubic-bezier(0.22, 1, 0.36, 1);
}

.circular-carousel__subtitle {
  font-weight: 400;
  opacity: 0.6;
}

.circular-carousel__count {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  opacity: 0.5;
}

.circular-carousel__slash {
  opacity: 0.6;
}

.circular-carousel__digits {
  display: inline-flex;
}

.circular-carousel__digit {
  display: inline-block;
  height: 1em;
  overflow: hidden;
}

.circular-carousel__reel {
  display: flex;
  flex-direction: column;
  transition: transform 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.circular-carousel__reel > span {
  height: 1em;
}

.circular-carousel__live {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

@keyframes circular-carousel-title {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes circular-carousel-leave {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes circular-carousel-reveal {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .circular-carousel__stage,
  .circular-carousel__reel {
    transition: none;
  }

  .circular-carousel__caption,
  .circular-carousel__title {
    animation: none;
  }
}
```

### 集成步骤
1. 安装列出的依赖（本组件无外部依赖）。
2. 把组件源码复制到项目的合适目录。
3. 在引入组件的同时引入 CSS 文件。
4. 以上面的用法示例为起点导入并渲染组件。
5. 根据具体场景调整 props —— 全部可用选项见上方 Props 表。

### 更多 React Bits 资源
reactbits.dev 的完整组件索引见 https://reactbits.dev/llms.txt —— 如果这个组件不合适或项目需要更多素材，可以抓取该文件。
