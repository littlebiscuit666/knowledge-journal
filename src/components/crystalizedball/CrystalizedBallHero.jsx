import { useState } from 'react';
import CrystalizedBall from './CrystalizedBall';

const PRESETS = ['plasma', 'aurora', 'nebula', 'ember', 'frost', 'solar', 'eclipse', 'abyss'];

const PRESET_LABELS = {
  plasma: '等离子',
  aurora: '极光',
  nebula: '星云',
  ember: '余烬',
  frost: '霜华',
  solar: '骄阳',
  eclipse: '月食',
  abyss: '深渊',
};

export default function CrystalizedBallHero() {
  const [preset, setPreset] = useState('plasma');

  return (
    <div className="relative h-[65vh] min-h-[440px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#050507] dark:border-slate-800">
      <CrystalizedBall preset={preset} theme="dark" size={0.62} interactive hoverStrength={0.7} />
      <div className="pointer-events-none absolute inset-x-0 top-10 flex flex-col items-center px-4 text-center">
        <p className="mb-3 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/70 backdrop-blur">
          React Bits · JavaScript + CSS · ogl
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] md:text-5xl">
          CrystalizedBall
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)] md:text-base">
          一颗封存了闪电与尘埃的水晶球：电弧缠绕边缘，光标掠过时尘埃打旋、边缘朝你发热，点击摇晃球体。
        </p>
      </div>
      <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-wrap justify-center gap-2 px-4">
        {PRESETS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setPreset(name)}
            className={`pointer-events-auto rounded-full border px-3 py-1.5 text-xs backdrop-blur transition-colors ${
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
  );
}
