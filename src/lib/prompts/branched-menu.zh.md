## 集成 React Bits 的 <BranchedMenu /> 组件

你将帮助我把一个开源 React 组件集成到现有应用中。

### 组件：BranchedMenu
### 变体：JavaScript + CSS
### 依赖：@hugeicons/react @hugeicons/core-free-icons

---

### 用法示例
```jsx
import { Download04Icon, Rocket01Icon, Settings02Icon } from '@hugeicons/core-free-icons';
import BranchedMenu from './BranchedMenu';

<BranchedMenu
  items={[
    {
      label: 'Getting started',
      children: [
        { value: 'install', label: 'Installation', icon: Download04Icon },
        { value: 'quick', label: 'Quick start', icon: Rocket01Icon },
        { value: 'config', label: 'Configuration', icon: Settings02Icon }
      ]
    },
    { label: 'Components', children: [{ value: 'buttons', label: 'Buttons' }, { value: 'overlays', label: 'Overlays' }] }
  ]}
  defaultOpen={[0]}
  defaultActive="quick"
  onSelect={(value, item) => navigate(value)}
  color="#f5f5f5"
  accentColor="#f5f5f5"
  lineColor="#3f3f46"
  width={240}
  rowHeight={36}
  indent={40}
  trunk={14}
  radius={10}
  lineWidth={1.5}
  fontSize={14}
  drawDuration={400}
  foldDuration={300}
/>
```

### Props
| 属性 | 类型 | 默认值 | 说明 |
|------|------|---------|------|
| items | BranchedMenuItem[] | DEFAULT_ITEMS | 区块列表：label 加 children（value、label、icon），或带 value 的叶子。带 children 的区块可折叠；叶子点击即选中。 |
| defaultOpen | number \| number[] | 0 | 初始展开的区块序号（可传数组展开多个），-1 表示全部收起。 |
| defaultActive | string | "" | 初始选中的值。留空则自动选中第一个已展开区块的第一个子项。 |
| onSelect | (value, item) => void | - | 某个子项或叶子被选中时调用。 |
| onToggle | (index, open) => void | - | 某个区块被折叠或展开时调用。 |
| color | string | "#f5f5f5" | 墨色。线条与未选中文字由它和透明混出。 |
| accentColor | string | "#f5f5f5" | 强调色。选中行的分支线、选中的标题与左侧指示标记都用它。 |
| lineColor | string | "#3f3f46" | 树轨、树干与分支的颜色。用纯色，所以线条接口处不会叠深。 |
| width | number | 240 | 菜单允许的最大宽度（px）。实际会收缩到内容宽度。 |
| rowHeight | number | 36 | 子项行高（px）。 |
| indent | number | 40 | 子行文字起点（px）。分支线终点略靠前一点。 |
| trunk | number | 14 | 树干线的 x 坐标（px）。 |
| radius | number | 10 | 每条分支拐弯处的圆角半径（px）。 |
| lineWidth | number | 1.5 | 线条描边宽度。 |
| fontSize | number | 14 | 子项字号（px）。区块标题比它大 1px。 |
| drawDuration | number | 400 | 强调线沿树干走到选中行的时间（ms）。 |
| foldDuration | number | 300 | 区块折叠/展开的时间（ms）。 |
| className | string | "" | nav 根元素的额外类名。 |

### 组件完整源码
（此处粘贴 BranchedMenu.jsx 源码，代码无需翻译）

### 组件 CSS
```css
.branched-menu {
  --bm-w: 240px;
  --bm-ink: #f5f5f5;
  --bm-accent: #f5f5f5;
  --bm-line: #3f3f46;
  --bm-font: 14px;
  --bm-row: 36px;
  --bm-indent: 40px;
  --bm-line-w: 1.5;
  --bm-draw: 400ms;
  --bm-fold: 300ms;
  --bm-ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --bm-muted: color-mix(in srgb, var(--bm-ink) 55%, transparent);

  position: relative;
  display: flex;
  flex-direction: column;
  width: fit-content;
  max-width: min(var(--bm-w), 100%);
  padding-left: 14px;
  color: var(--bm-ink);
  font-family: inherit;
  font-size: var(--bm-font);
  line-height: 1.2;
}

.branched-menu::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 0;
  left: 0;
  width: 2px;
  border-radius: 1px;
  background: linear-gradient(to bottom, var(--bm-line) 0%, var(--bm-line) 55%, transparent 100%);
}

.branched-menu__marker {
  position: absolute;
  top: -1px;
  left: 0;
  z-index: 1;
  width: 2px;
  height: 16px;
  border-radius: 1px;
  background: var(--bm-accent);
  opacity: 0;
  transition:
    top 220ms var(--bm-ease-out),
    opacity 150ms ease;
}

.branched-menu__marker[data-on] {
  opacity: 1;
}

.branched-menu__section {
  display: flex;
  flex-direction: column;
}

.branched-menu__head {
  display: block;
  margin: 0;
  padding: 9px 0;
  border: 0;
  background: none;
  color: var(--bm-muted);
  font: inherit;
  font-size: calc(var(--bm-font) + 1px);
  font-weight: 500;
  text-align: left;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: color 200ms ease;
}

.branched-menu__section[data-open] .branched-menu__head,
.branched-menu__head[data-active] {
  color: var(--bm-ink);
}

@media (hover: hover) and (pointer: fine) {
  .branched-menu__head:hover {
    color: var(--bm-ink);
  }
}

.branched-menu__body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--bm-fold) var(--bm-ease-out);
}

.branched-menu__section[data-open] .branched-menu__body {
  grid-template-rows: 1fr;
}

.branched-menu__fold {
  min-height: 0;
  overflow: hidden;
}

.branched-menu__tree {
  position: relative;
  padding: 6px 0;
  box-sizing: border-box;
}

.branched-menu__lines {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease;
}

.branched-menu__section[data-open] .branched-menu__lines {
  opacity: 1;
  transition: opacity 250ms ease 100ms;
}

.branched-menu__base,
.branched-menu__reach {
  fill: none;
  stroke-width: var(--bm-line-w);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.branched-menu__base {
  stroke: var(--bm-line);
}

.branched-menu__reach {
  stroke: var(--bm-accent);
  transition: stroke-dashoffset var(--bm-draw) var(--bm-ease-out);
}

.branched-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  height: var(--bm-row);
  margin: 0;
  padding: 0 0 0 var(--bm-indent);
  border: 0;
  background: none;
  color: var(--bm-muted);
  font: inherit;
  text-align: left;
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  transition: color 200ms ease;
}

@media (hover: hover) and (pointer: fine) {
  .branched-menu__item:hover {
    color: var(--bm-ink);
  }
}

.branched-menu__item[data-active] {
  color: var(--bm-accent);
  font-weight: 500;
}

.branched-menu__icon {
  display: inline-flex;
  flex: none;
}

.branched-menu__label {
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .branched-menu__marker {
    transition: opacity 150ms ease;
  }

  .branched-menu__body {
    transition: none;
  }

  .branched-menu__reach {
    transition: none;
  }
}
```

### 集成步骤
1. 安装列出的依赖（`npm i @hugeicons/react @hugeicons/core-free-icons`）。
2. 把组件源码复制到项目的合适目录。
3. 在引入组件的同时引入 CSS 文件。
4. 以上面的用法示例为起点导入并渲染组件。
5. 根据具体场景调整 props —— 全部可用选项见上方 Props 表。

### 更多 React Bits 资源
reactbits.dev 的完整组件索引见 https://reactbits.dev/llms.txt —— 如果这个组件不合适或项目需要更多素材，可以抓取该文件。
