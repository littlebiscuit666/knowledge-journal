## 集成 React Bits 的 <FlipCard /> 组件

你将帮助我把一个开源 React 组件集成到现有应用中。

### 组件：FlipCard
### 变体：JavaScript + CSS
### 依赖：motion

---

### 用法示例
```jsx
import FlipCard from './FlipCard';

<FlipCard
  front={<img src="/landscape.jpg" alt="Wooded landscape" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
  back={
    <div style={{ padding: 24 }}>
      <h3>Wooded Landscape</h3>
      <p>17th century · Rijksmuseum</p>
    </div>
  }
  axis="y"
  flipOnClick
  draggable
  dragDistance={0}
  tilt
  tiltMax={12}
  glare
  glareOpacity={0.22}
  hoverScale={1.03}
  perspective={1100}
  stiffness={170}
  damping={20}
  width={300}
  height={400}
  radius={22}
  background="#27272a"
  color="#f5f5f5"
  shadow
  shadowColor="#000000"
  shadowOpacity={0.45}
  onFlipChange={flipped => console.log(flipped)}
/>
```

### Props
| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| front | ReactNode | null | 正面内容。 |
| back | ReactNode | null | 背面内容。 |
| flipped | boolean | - | 受控状态：true 显示背面。不传则由卡片自己管理状态。 |
| defaultFlipped | boolean | false | 初始就停在背面。 |
| onFlipChange | (flipped: boolean) => void | - | 点击、拖拽、甩动或按键落在另一面上时触发。 |
| axis | 'y' \| 'x' | 'y' | y 让卡片左右翻面、水平方向拖拽；x 让卡片从顶上翻过去、垂直方向拖拽。 |
| flipOnClick | boolean | true | 按下后没有移动就翻面。 |
| draggable | boolean | true | 可以用手拖动翻卡。松手时弹回最近的面，并带上甩动的速度。 |
| dragDistance | number | 0 | 半圈需要的拖拽像素。0 时取卡片宽度（x 轴时取高度）。 |
| tilt | boolean | true | 悬停时卡片朝光标方向倾斜。 |
| tiltMax | number | 12 | 最大倾角（度）。 |
| glare | boolean | true | 跟随光标的柔和光泽。 |
| glareOpacity | number | 0.22 | 光泽中心点的强度。 |
| hoverScale | number | 1.03 | 悬停或按住时抬起的缩放。 |
| perspective | number | 1100 | 观察距离（px），越小越夸张。 |
| stiffness | number | 170 | 翻面弹簧的刚度。 |
| damping | number | 20 | 翻面弹簧的阻尼，越低过冲越多。 |
| width | number | 300 | 卡片宽度（px），上限为父容器宽度。 |
| height | number | 400 | 卡片高度（px）。 |
| radius | number | 22 | 圆角半径（px）。 |
| background | string | '#27272a' | 两个面的底色。 |
| color | string | '#f5f5f5' | 两个面的文字颜色。 |
| shadow | boolean | true | 卡片下方的柔和阴影，翻到侧面时会收窄。 |
| shadowColor | string | '#000000' | 阴影颜色。 |
| shadowOpacity | number | 0.45 | 阴影强度。 |
| disabled | boolean | false | 变暗、变平且不可交互。 |
| ariaLabel | string | 'Flip card' | 无障碍名称，当前在正面还是背面通过 aria-pressed 播报。 |
| className | string | '' | 根元素的额外类名。 |

### 组件完整源码
```jsx
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform
} from 'motion/react';

import './FlipCard.css';

const SLOP = { fine: 4, coarse: 8 };
const TILT_SPRING = { stiffness: 240, damping: 24, mass: 0.6 };
const LIFT_SPRING = { stiffness: 320, damping: 26 };
const FLING = 0.16;
const HISTORY_MS = 90;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const snap = deg => Math.round(deg / 180) * 180;
const isBack = deg => Math.abs(Math.round(deg / 180)) % 2 === 1;

export default function FlipCard({
  front = null,
  back = null,
  flipped,
  defaultFlipped = false,
  onFlipChange,
  axis = 'y',
  flipOnClick = true,
  draggable = true,
  dragDistance = 0,
  tilt = true,
  tiltMax = 12,
  glare = true,
  glareOpacity = 0.22,
  hoverScale = 1.03,
  perspective = 1100,
  stiffness = 170,
  damping = 20,
  width = 300,
  height = 400,
  radius = 22,
  background = '#27272a',
  color = '#f5f5f5',
  shadow = true,
  shadowColor = '#000000',
  shadowOpacity = 0.45,
  disabled = false,
  ariaLabel = 'Flip card',
  className = ''
}) {
  const reduce = useReducedMotion();
  const controlled = flipped !== undefined;
  const [inner, setInner] = useState(defaultFlipped);
  const [dragging, setDragging] = useState(false);
  const shown = controlled ? flipped : inner;
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const rootRef = useRef(null);
  const grip = useRef(null);
  const spin = useRef(null);
  const target = useRef(shown ? 180 : 0);

  const turn = useMotionValue(shown ? 180 : 0);
  const tiltX = useSpring(0, TILT_SPRING);
  const tiltY = useSpring(0, TILT_SPRING);
  const lift = useSpring(1, LIFT_SPRING);
  const sheen = useSpring(0, LIFT_SPRING);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);

  const sumX = useTransform([turn, tiltX], ([t, x]) => t + x);
  const sumY = useTransform([turn, tiltY], ([t, y]) => t + y);
  const turnY = useMotionTemplate`perspective(${perspective}px) scale(${lift}) rotateX(${tiltX}deg) rotateY(${sumY}deg)`;
  const turnX = useMotionTemplate`perspective(${perspective}px) scale(${lift}) rotateY(${tiltY}deg) rotateX(${sumX}deg)`;
  const facing = useTransform(turn, t => Math.abs(Math.cos((t * Math.PI) / 180)));
  const spread = useTransform(facing, f => 0.08 + 0.92 * f);
  const shade = useTransform(facing, f => 0.1 + 0.9 * f * f);
  const gxPct = useMotionTemplate`${gx}%`;
  const gyPct = useMotionTemplate`${gy}%`;

  const settle = (to, velocity, instant) => {
    spin.current?.stop();
    target.current = to;
    if (instant || reduce) turn.jump(to);
    else spin.current = animate(turn, to, { type: 'spring', stiffness, damping, velocity, restDelta: 0.05 });
    const next = isBack(to);
    if (next === shownRef.current) return;
    shownRef.current = next;
    if (!controlled) setInner(next);
    onFlipChange?.(next);
  };
  const flip = instant => {
    const base = snap(turn.get());
    settle(isBack(base) ? base - 180 : base + 180, 0, instant);
  };
  const rest = () => {
    tiltX.set(0);
    tiltY.set(0);
    sheen.set(0);
    lift.set(1);
  };

  useEffect(() => {
    if (!controlled || isBack(target.current) === flipped) return;
    const base = target.current;
    spin.current?.stop();
    target.current = isBack(base) ? base - 180 : base + 180;
    if (reduce) turn.jump(target.current);
    else spin.current = animate(turn, target.current, { type: 'spring', stiffness, damping, restDelta: 0.05 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flipped]);
  useEffect(() => () => spin.current?.stop(), []);
  useEffect(() => {
    if (disabled) rest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

  const onPointerDown = e => {
    if (disabled || e.button !== 0 || grip.current) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    spin.current?.stop();
    grip.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      base: turn.get(),
      moved: false,
      slop: e.pointerType === 'touch' ? SLOP.coarse : SLOP.fine,
      hist: []
    };
    if (!reduce) lift.set(hoverScale);
  };
  const onPointerMove = e => {
    const g = grip.current;
    if (g && g.id === e.pointerId) {
      const d = axis === 'x' ? e.clientY - g.y : e.clientX - g.x;
      if (!g.moved) {
        if (Math.abs(d) < g.slop || !draggable || reduce) return;
        g.moved = true;
        setDragging(true);
        tiltX.set(0);
        tiltY.set(0);
        sheen.set(0);
      }
      const span = dragDistance > 0 ? dragDistance : axis === 'x' ? height : width;
      const deg = g.base + (axis === 'x' ? -1 : 1) * (d / span) * 180;
      turn.set(deg);
      const now = performance.now();
      g.hist.push({ t: now, v: deg });
      while (g.hist.length > 2 && now - g.hist[0].t > HISTORY_MS) g.hist.shift();
      return;
    }
    if (!tilt || reduce || disabled || e.pointerType === 'touch') return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = clamp((e.clientX - r.left) / r.width, 0, 1);
    const py = clamp((e.clientY - r.top) / r.height, 0, 1);
    tiltX.set((0.5 - py) * 2 * tiltMax);
    tiltY.set((px - 0.5) * 2 * tiltMax);
    gx.set(px * 100);
    gy.set(py * 100);
    sheen.set(1);
  };
  const release = (e, cancelled) => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setDragging(false);
    if (e.pointerType === 'touch' || !rootRef.current?.matches(':hover')) rest();
    if (!g.moved) {
      if (!cancelled && flipOnClick) flip(false);
      else settle(target.current, 0, false);
      return;
    }
    const here = turn.get();
    let velocity = 0;
    const a = g.hist[0];
    const b = g.hist[g.hist.length - 1];
    if (!cancelled && a && b && b.t > a.t && performance.now() - b.t < 60)
      velocity = ((b.v - a.v) / (b.t - a.t)) * 1000;
    const to = cancelled ? snap(g.base) : clamp(snap(here + velocity * FLING), snap(here) - 180, snap(here) + 180);
    settle(to, velocity, false);
  };
  const onKeyDown = e => {
    if (disabled || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    if (!e.repeat) flip(true);
  };
  const onClick = e => {
    if (!disabled && e.detail === 0) flip(true);
  };

  const rotorStyle = {
    transform: axis === 'x' ? turnX : turnY,
    '--fc-gx': gxPct,
    '--fc-gy': gyPct,
    '--fc-sheen': sheen
  };

  return (
    <div
      ref={rootRef}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-pressed={shown}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={`flip-card${className ? ` ${className}` : ''}`}
      data-axis={axis}
      data-draggable={draggable && !disabled && !reduce ? '' : undefined}
      data-dragging={dragging ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      data-fade={reduce ? (shown ? 'back' : 'front') : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={e => release(e, false)}
      onPointerCancel={e => release(e, true)}
      onLostPointerCapture={e => release(e, true)}
      onPointerEnter={e => {
        if (!reduce && !disabled && e.pointerType !== 'touch') lift.set(hoverScale);
      }}
      onPointerLeave={() => {
        if (!grip.current) rest();
      }}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onDragStart={e => e.preventDefault()}
      style={{
        '--fc-w': `${width}px`,
        '--fc-h': `${height}px`,
        '--fc-radius': `${radius}px`,
        '--fc-bg': background,
        '--fc-ink': color,
        '--fc-shadow': shadowColor,
        '--fc-shadow-o': shadowOpacity,
        '--fc-glare': glareOpacity
      }}
    >
      {shadow ? (
        <motion.span
          className="flip-card__shadow"
          aria-hidden="true"
          style={axis === 'x' ? { scaleY: spread, opacity: shade } : { scaleX: spread, opacity: shade }}
        />
      ) : null}
      <motion.div className="flip-card__rotor" style={reduce ? undefined : rotorStyle}>
        <div className="flip-card__face flip-card__face--front" aria-hidden={shown} inert={shown}>
          {front}
          {glare ? <span className="flip-card__glare" aria-hidden="true" /> : null}
        </div>
        <div className="flip-card__face flip-card__face--back" aria-hidden={!shown} inert={!shown}>
          {back}
          {glare ? <span className="flip-card__glare" aria-hidden="true" /> : null}
        </div>
      </motion.div>
    </div>
  );
}
```

### 组件 CSS
```css
.flip-card {
  --fc-w: 300px;
  --fc-h: 400px;
  --fc-radius: 22px;
  --fc-bg: #27272a;
  --fc-ink: #f5f5f5;
  --fc-shadow: #000000;
  --fc-shadow-o: 0.45;
  --fc-glare: 0.22;

  position: relative;
  display: inline-block;
  width: var(--fc-w);
  max-width: 100%;
  height: var(--fc-h);
  border-radius: var(--fc-radius);
  outline: none;
  cursor: pointer;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: pan-y;
}

.flip-card[data-axis='x'] {
  touch-action: pan-x;
}

.flip-card[data-draggable] {
  cursor: grab;
}

.flip-card[data-dragging] {
  cursor: grabbing;
}

.flip-card[data-disabled] {
  cursor: default;
  opacity: 0.6;
}

.flip-card__shadow {
  position: absolute;
  inset: 12% 9% -5%;
  border-radius: var(--fc-radius);
  background: color-mix(in srgb, var(--fc-shadow) calc(var(--fc-shadow-o) * 100%), transparent);
  filter: blur(22px);
  pointer-events: none;
}

.flip-card__rotor {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
}

.flip-card__face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: var(--fc-radius);
  background: var(--fc-bg);
  color: var(--fc-ink);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.flip-card__face img {
  -webkit-user-drag: none;
}

.flip-card__face--back {
  transform: rotateY(180deg);
}

.flip-card[data-axis='x'] .flip-card__face--back {
  transform: rotateX(180deg);
}

.flip-card__glare {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle farthest-side at var(--fc-gx, 50%) var(--fc-gy, 50%),
    rgba(255, 255, 255, var(--fc-glare)) 0%,
    rgba(255, 255, 255, calc(var(--fc-glare) * 0.76)) 12%,
    rgba(255, 255, 255, calc(var(--fc-glare) * 0.5)) 26%,
    rgba(255, 255, 255, calc(var(--fc-glare) * 0.28)) 42%,
    rgba(255, 255, 255, calc(var(--fc-glare) * 0.12)) 60%,
    rgba(255, 255, 255, calc(var(--fc-glare) * 0.04)) 78%,
    rgba(255, 255, 255, 0) 100%
  );
  opacity: var(--fc-sheen, 0);
  pointer-events: none;
}

.flip-card[data-fade] .flip-card__face {
  transform: none;
  opacity: 0;
  backface-visibility: visible;
  -webkit-backface-visibility: visible;
  transition: opacity 200ms ease;
}

.flip-card[data-fade='front'] .flip-card__face--front,
.flip-card[data-fade='back'] .flip-card__face--back {
  opacity: 1;
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
