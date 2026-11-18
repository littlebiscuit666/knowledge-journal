import { useState } from 'react';
import CircularCarousel from './CircularCarousel';

const PRESETS = ['cylinder', 'orbit', 'wheel', 'panorama'];

const PRESET_LABELS = {
  cylinder: '圆筒',
  orbit: '环绕',
  wheel: '摩天轮',
  panorama: '全景',
};

// 站内素材（public/images/2026-11），同源加载快，比组件默认的 Unsplash 在大陆靠谱
const ITEMS = [
  { src: '/images/2026-11/amber-egg.jpg', alt: '琥珀之卵', title: 'Amber Egg', subtitle: 'Elden Ring' },
  { src: '/images/2026-11/caria-apparition.jpg', alt: '卡利亚显形', title: 'Apparition', subtitle: 'Fantasy' },
  { src: '/images/2026-11/hound-knight.jpg', alt: '犬骑士', title: 'Hound Knight', subtitle: 'Fantasy' },
  { src: '/images/2026-11/rennala-moonlight.jpg', alt: '满月月光大剑', title: 'Moonlight', subtitle: 'Elden Ring' },
  { src: '/images/2026-11/rennala.jpg', alt: '蕾娜菈', title: 'Rennala', subtitle: 'Elden Ring' },
  { src: '/images/2026-11/sigmara.jpg', alt: '西格玛拉', title: 'Sigmara', subtitle: 'Character' },
  { src: '/images/2026-11/flux-dev-golden-retriever.png', alt: '金毛寻回犬', title: 'Golden', subtitle: 'FLUX Dev' },
  { src: '/images/2026-11/flux-dev-fp8-cyberpunk.png', alt: '赛博朋克街景', title: 'Cyberpunk', subtitle: 'FLUX FP8' },
  { src: '/images/2026-11/comfyui-fp8-coffee.png', alt: '一杯咖啡', title: 'Coffee', subtitle: 'ComfyUI' },
  { src: '/images/2026-11/dog.jpg', alt: '小狗', title: 'Doggo', subtitle: 'Life' },
];

export default function CircularCarouselHero() {
  const [preset, setPreset] = useState('cylinder');

  return (
    <div className="relative h-[65vh] min-h-[480px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#050507] text-white dark:border-slate-800">
      <CircularCarousel
        items={ITEMS}
        preset={preset}
        intro="rise"
        cardWidth={220}
        aspectRatio={1}
        speed={14}
        captions
        fadeColor="#050507"
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center px-4 pt-6 text-center">
        <p className="mb-2.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/70 backdrop-blur">
          React Bits · JavaScript + CSS · 站内素材
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] md:text-4xl">
          CircularCarousel
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">
          一圈会转的 3D 照片环：抓住甩一下会带着惯性滑行，点卡片把它转到正前方。
        </p>
        <div className="pointer-events-auto mt-3 flex flex-wrap justify-center gap-2">
          {PRESETS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setPreset(name)}
              className={`rounded-full border px-3 py-1.5 text-xs backdrop-blur transition-colors ${
                preset === name
                  ? 'border-white/70 bg-white/85 font-medium text-slate-900'
                  : 'border-white/25 bg-black/30 text-white/75 hover:border-white/50 hover:text-white'
              }`}
            >
              <span className="font-mono">{name}</span>
              <span className="ml-1.5 opacity-70">{PRESET_LABELS[name]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
