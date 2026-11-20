import { useState } from 'react';
import AeroShards from './AeroShards';

const PLACEMENTS = ['full', 'left', 'right', 'center'];
const PLACEMENT_LABELS = {
  full: '全景',
  left: '左侧',
  right: '右侧',
  center: '环心',
};

const MATERIALS = ['glass', 'chrome'];
const MATERIAL_LABELS = {
  glass: '厚玻璃',
  chrome: '镀铬',
};

const MARKERS = ['plus', 'dots', 'none'];
const MARKER_LABELS = {
  plus: '十字标',
  dots: '圆点标',
  none: '无标记',
};

export default function AeroShardsHero() {
  const [placement, setPlacement] = useState('full');
  const [material, setMaterial] = useState('glass');
  const [markers, setMarkers] = useState('plus');
  const [webgpuError, setWebgpuError] = useState(null);

  return (
    <div className="relative h-[65vh] min-h-[440px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#0b0910] dark:border-slate-800">
      {webgpuError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-lg font-semibold text-white/90">此浏览器不支持 WebGPU</p>
          <p className="max-w-md text-sm leading-relaxed text-white/60">
            AeroShards 用 WebGPU + WGSL 着色器渲染，需要较新版本的 Chrome/Edge。
            当前环境无法初始化 GPU 实例：{String(webgpuError)}
          </p>
        </div>
      ) : (
        <AeroShards
          placement={placement}
          material={material}
          markers={markers}
          shardColor="#896ABD"
          accentColor="#A855F7"
          count={1300}
          depthOfField={0.75}
          vignette={0.3}
          mouseInteraction
          pulseOnClick
          holdToGather
          onError={setWebgpuError}
        />
      )}
      <div className="pointer-events-none absolute inset-x-0 top-10 flex flex-col items-center px-4 text-center">
        <p className="mb-3 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/70 backdrop-blur">
          React Bits · JavaScript + CSS · vgpu (WebGPU)
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] md:text-5xl">
          AeroShards
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/80 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)] md:text-base">
          丝绸般的玻璃碎片飘带层层流过景深：光标掠过时拨开碎片，点击放出涟漪光环翻转碎片，按住会把碎片聚成漩涡、松手炸开。
        </p>
      </div>
      <div className="absolute bottom-5 left-1/2 flex max-w-[92%] -translate-x-1/2 flex-col items-center gap-2 px-4">
        <div className="flex flex-wrap justify-center gap-2">
          {PLACEMENTS.map((name) => (
            <ChipButton key={name} active={placement === name} label={name} zh={PLACEMENT_LABELS[name]} onClick={() => setPlacement(name)} />
          ))}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {MATERIALS.map((name) => (
            <ChipButton key={name} active={material === name} label={name} zh={MATERIAL_LABELS[name]} onClick={() => setMaterial(name)} />
          ))}
          {MARKERS.map((name) => (
            <ChipButton key={name} active={markers === name} label={`markers:${name}`} zh={MARKER_LABELS[name]} onClick={() => setMarkers(name)} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChipButton({ active, label, zh, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pointer-events-auto rounded-full border px-3 py-1.5 text-xs backdrop-blur transition-colors ${
        active
          ? 'border-white/70 bg-white/85 font-medium text-slate-900'
          : 'border-white/25 bg-black/30 text-white/75 hover:border-white/50 hover:text-white'
      }`}
    >
      <span className="font-mono">{label}</span>
      <span className="ml-1.5 opacity-70">{zh}</span>
    </button>
  );
}
