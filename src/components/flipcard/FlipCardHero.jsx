import { useState } from 'react';
import FlipCard from './FlipCard';

const AXES = ['y', 'x'];
const AXIS_LABELS = { y: '竖翻', x: '顶翻' };

// 站内素材（public/images/2026-11），同源加载快，比组件默认的 Unsplash 在大陆靠谱
const ITEMS = [
  { src: '/images/2026-11/amber-egg.jpg', alt: '琥珀之卵', title: 'Amber Egg', subtitle: 'Elden Ring · AI 生图' },
  { src: '/images/2026-11/rennala.jpg', alt: '蕾娜菈', title: 'Rennala', subtitle: 'Elden Ring · AI 生图' },
  { src: '/images/2026-11/flux-dev-golden-retriever.png', alt: '金毛寻回犬', title: 'Golden', subtitle: 'FLUX Dev · ComfyUI' },
];

export default function FlipCardHero() {
  const [axis, setAxis] = useState('y');
  const [idx, setIdx] = useState(0);
  const item = ITEMS[idx];

  return (
    <div className="relative flex h-[65vh] min-h-[540px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#050507] text-white dark:border-slate-800">
      <div className="flex flex-col items-center px-4 pt-6 text-center">
        <p className="mb-2.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/70 backdrop-blur">
          React Bits · JavaScript + CSS · motion 弹簧驱动
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] md:text-4xl">
          FlipCard
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">
          一张会翻面的 3D 卡片：点一下翻过去，抓住拖拽能手动翻，快速一甩带着惯性落回最近的面，
          悬停时整卡朝光标倾斜、表面跟着光标起眩光。
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {AXES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setAxis(name)}
              className={`rounded-full border px-3 py-1.5 text-xs backdrop-blur transition-colors ${
                axis === name
                  ? 'border-white/70 bg-white/85 font-medium text-slate-900'
                  : 'border-white/25 bg-black/30 text-white/75 hover:border-white/50 hover:text-white'
              }`}
            >
              <span className="font-mono">{name}</span>
              <span className="ml-1.5 opacity-70">{AXIS_LABELS[name]}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIdx((idx + 1) % ITEMS.length)}
            className="rounded-full border border-white/25 bg-black/30 px-3 py-1.5 text-xs text-white/75 backdrop-blur transition-colors hover:border-white/50 hover:text-white"
          >
            换素材
            <span className="ml-1.5 opacity-70">{idx + 1}/{ITEMS.length}</span>
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-10">
        <FlipCard
          front={
            <img
              src={item.src}
              alt={item.alt}
              draggable={false}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          }
          back={
            <div
              style={{
                padding: 24,
                height: '100%',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>{item.title}</h3>
              <p style={{ margin: '8px 0 0', fontSize: 13, opacity: 0.75 }}>{item.subtitle}</p>
              <p style={{ marginTop: 'auto', fontSize: 12, lineHeight: 1.7, opacity: 0.55 }}>
                React Bits · FlipCard
                <br />
                点我 / 拖我 / 甩我翻回正面
              </p>
            </div>
          }
          axis={axis}
          width={250}
          height={330}
          radius={18}
          background="#18181b"
          color="#fafafa"
          glareOpacity={0.25}
          hoverScale={1.04}
          ariaLabel={`翻转卡片：${item.alt}`}
        />
      </div>
    </div>
  );
}
