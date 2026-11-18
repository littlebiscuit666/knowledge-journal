## 集成 React Bits 的 <CrystalizedBall /> 组件

你将帮助我把一个开源 React 组件集成到现有应用中。

### 组件：CrystalizedBall
### 变体：JavaScript + CSS
### 依赖：ogl

---

### 用法示例
```jsx
import CrystalizedBall from './CrystalizedBall';

<div style={{ width: '100%', height: '600px', position: 'relative' }}>
  <CrystalizedBall
    preset="plasma"
    color="#F25BD0"
    size={0.7}
    crackle={0.85}
    fill={0.5}
    interactive
    hoverStrength={0.7}
  />
</div>
```

### Props
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| preset | 'plasma' \| 'aurora' \| 'nebula' \| 'ember' \| 'frost' \| 'solar' \| 'eclipse' \| 'abyss' | 'plasma' | 完整的初始外观，含颜色。任何标记「来自预设」的属性传入时都会覆盖预设值。 |
| color | string | 来自预设 | 球的唯一颜色。白热的边缘、辉光与耀斑、尘埃色调、火花和雾霭都由它派生。 |
| theme | 'dark' \| 'light' | 'dark' | 球所处的背景。dark 把球渲染成发光体；light 以清爽的墨线描绘，边缘核心白热。 |
| size | number | 0.7 | 球的直径，占容器较小边的比例。 |
| strands | number | 来自预设 | 编绕在边缘上的电弧线条数，1 到 8。 |
| crackle | number | 来自预设 | 线条弯折与抖动的程度。低值安静地嗡鸣，高值噼啪作响。 |
| flares | number | 来自预设 | 辉光从边缘向外舔舐的幅度，以缓慢移动的耀斑形式呈现。 |
| glow | number | 来自预设 | 边缘周围光环的强度。 |
| sparks | number | 来自预设 | 小电弧沿边缘内侧放电的频率。0 关闭。 |
| particleCount | number | 来自预设 | 球内尘埃粒子的数量，最多 40000。 |
| fill | number | 来自预设 | 球的填充程度。低值让尘埃沉在底部，高值让它浮到顶部。 |
| motion | 'rise' \| 'fall' \| 'drift' \| 'orbit' | 来自预设 | 尘埃的运动方式。rise 像余烬般上浮，fall 像雪一样飘落，drift 随意游移，orbit 绕小圈循环。 |
| particleShape | 'square' \| 'round' | 来自预设 | 清晰的方形像素或柔和的圆点。 |
| depth | number | 来自预设 | 深度线索的强度。球后部的尘埃更小更暗。 |
| sway | number | 来自预设 | 尘埃在玻璃球内来回摆动的幅度，展现其纵深。 |
| twinkle | number | 来自预设 | 尘埃闪烁明灭的程度。 |
| haze | number | 来自预设 | 汇聚在尘埃下方和玻璃内侧的辉光强度。 |
| speed | number | 1 | 边缘、耀斑和火花的动画速度。 |
| dustSpeed | number | 来自预设 | 尘埃的动画速度。 |
| interactive | boolean | true | 允许光标触碰球。边缘朝光标方向发热并扬起耀斑，尘埃在其尾迹中打旋、转向，点击会摇晃球体。 |
| hoverStrength | number | 0.7 | 球对光标的反应强度，0 到 1。 |
| intro | boolean | true | 挂载时边缘通电亮起，尘埃从球底向上点亮。 |
| paused | boolean | false | 冻结动画。尘埃仍可被搅动。 |
| className | string | '' | 根元素的额外类名。 |
| style | CSSProperties | - | 根元素的内联样式。 |

### 组件完整源码
（此处粘贴 CrystalizedBall.jsx 源码，代码无需翻译）

### 组件 CSS
```css
.crystalized-ball {
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
