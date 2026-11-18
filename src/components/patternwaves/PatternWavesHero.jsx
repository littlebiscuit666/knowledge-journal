import { useState } from 'react';
import PatternWaves from './PatternWaves';

const PRESETS = ['silk', 'ocean', 'pond', 'lines', 'terminal', 'mesh'];

const PRESET_LABELS = {
  silk: '丝绸',
  ocean: '海洋',
  pond: '涟漪',
  lines: '等高线',
  terminal: '终端',
  mesh: '网格',
};

export default function PatternWavesHero() {
  const [preset, setPreset] = useState('silk');

  return (
    <div className="relative h-[65vh] min-h-[440px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#050507] dark:border-slate-800">
      <PatternWaves
        preset={preset}
        color="#ffffff"
        backgroundColor="#050507"
        fade="edges"
        interactive
        cursorSize={50}
        cursorStrength={0.6}
      />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
        <p className="mb-3 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/70 backdrop-blur">
          React Bits · JavaScript + CSS · ogl
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] md:text-5xl">
          PatternWaves
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/80 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)] md:text-base">
          一块会呼吸的波浪表面：光标划过留下涟漪，点击溅起水花。
          本页顶部就是实时效果，下方收录完整集成提示词（中文翻译）。
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
