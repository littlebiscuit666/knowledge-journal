## 集成 React Bits 的 <PatternWaves /> 组件

你将帮助我把一个开源 React 组件集成到现有应用中。

### 组件：PatternWaves
### 变体：JavaScript + CSS
### 依赖：ogl

---

### 用法示例
```jsx
import PatternWaves from './PatternWaves';

<div style={{ width: '100%', height: '600px', position: 'relative' }}>
  <PatternWaves
    preset="silk"
    color="#ffffff"
    backgroundColor="#000000"
    fade="edges"
    interactive
    cursorSize={50}
    cursorStrength={0.6}
  />
</div>
```

### Props
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| preset | 'silk' \| 'ocean' \| 'pond' \| 'lines' \| 'terminal' \| 'mesh' | 'silk' | 完整的初始外观。下方每个图案/波形/光照属性传入时都会覆盖预设值。 |
| pattern | 'dot' \| 'square' \| 'plus' \| 'line' \| 'glyph' | 来自预设 | 绘制表面的标记。line 是流动的等高线，glyph 按亮度挑选字符。 |
| wave | 'silk' \| 'swell' \| 'ripple' | 来自预设 | 运动表面的形态。silk 是垂坠的布料褶皱，swell 是平行的滚动波，ripple 是从屏幕外传来的环形波。 |
| color | string | '#ffffff' | 图案的唯一颜色。阴影、中间调和高光都由它派生。比背景更深的颜色会像墨水一样印出来。 |
| backgroundColor | string | '#000000' | 图案背后的颜色。传 transparent 可透出页面。 |
| spacing | number | 来自预设 | 标记之间的距离（CSS 像素）。值越小打印越细腻。 |
| markSize | number | 来自预设 | 最大标记占间距的比例。 |
| depth | number | 来自预设 | 表面的高度。越深的表面阴影越强，波峰处的标记抬升越明显。 |
| light | number | 来自预设 | 掠过波浪的光的角度（度），范围 -90 到 90。0 正对褶皱打光，数值越大越斜。 |
| shine | number | 来自预设 | 表面捕捉光线处闪光的强度。 |
| contrast | number | 来自预设 | 安静的阴影与受光区域之间的反差。 |
| speed | number | 来自预设 | 表面运动速度。0 时冻结（光标涟漪仍然有效）。 |
| scale | number | 来自预设 | 波浪的尺寸。值越大形态越宽缓。 |
| direction | number | 来自预设 | 波浪行进方向（度）。光会随它一起转向。 |
| opacity | number | 1 | 图案整体不透明度，0 到 1。 |
| fade | 'edges' \| 'center' \| 'bottom' \| 'top' \| 'none' | 'edges' | 图案向背景淡出的方向。center 让中间保持平静以便放标题，bottom/top 向对应边缘淡出。 |
| fadeSize | number | 0.5 | 淡出的范围，0.05 到 1。 |
| characters | string | '.:-=+*#%@' | glyph 图案使用的字符，从最亮到最密排列。 |
| interactive | boolean | true | 允许光标扰动表面。移动会留下捕捉光线的涟漪尾迹，点击会溅起水花。 |
| cursorSize | number | 50 | 光标推动的表面区域半径（CSS 像素）。 |
| cursorStrength | number | 0.6 | 光标推动表面的力度，0 到 1。 |
| intro | boolean | true | 挂载时标记从中心淡入，随后表面隆起、光扫过表面。 |
| paused | boolean | false | 冻结表面。光标涟漪继续生效。 |
| className | string | '' | 根元素的额外类名。 |
| style | CSSProperties | - | 根元素的内联样式。 |

### 组件完整源码
（此处粘贴 PatternWaves.jsx 源码，代码无需翻译）

### 组件 CSS
```css
.pattern-waves {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
```

### 集成步骤
1. 安装列出的依赖。
2. 把组件源码复制到项目的合适目录。
3. 在引入组件的同时引入 CSS 文件。
4. 以上面的用法示例为起点导入并渲染组件。
5. 根据具体场景调整 props —— 全部可用选项见上方 Props 表。

### 更多 React Bits 资源
reactbits.dev 的完整组件索引见 https://reactbits.dev/llms.txt —— 如果这个组件不合适或项目需要更多素材，可以抓取该文件。
