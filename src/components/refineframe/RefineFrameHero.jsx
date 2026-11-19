import { useEffect, useState } from 'react';
import RefineFrame from './RefineFrame';

const STAGES = [
  { key: 'queued', label: '排队中' },
  { key: 'generating', label: '生成中' },
  { key: 'refining', label: '精修中' },
  { key: 'complete', label: '完成' },
  { key: 'error', label: '失败' },
];

const LABELS = { queued: '排队中', generating: '生成中', refining: '精修中', complete: '完成', error: '失败' };

// 站内素材（public/images/2026-11）：本身就是 FLUX / ComfyUI 出的图，和组件主题绝配
const IMAGES = [
  { src: '/images/2026-11/flux-dev-fp8-cyberpunk.png', alt: '赛博朋克街景' },
  { src: '/images/2026-11/hound-knight.jpg', alt: '犬骑士' },
  { src: '/images/2026-11/comfyui-fp8-coffee.png', alt: '一杯咖啡' },
];

// 自动循环的五阶段序列（毫秒），失败停留一会让重试按钮露脸，再回排队
const SEQ = [
  ['queued', 900],
  ['generating', 1700],
  ['refining', 1400],
  ['complete', 2600],
  ['error', 1800],
];

export default function RefineFrameHero() {
  const [status, setStatus] = useState('generating');
  const [auto, setAuto] = useState(true);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!auto) return undefined;
    let stop = false;
    let timer;
    const run = i => {
      if (stop) return;
      const [s, ms] = SEQ[i % SEQ.length];
      setStatus(s);
      timer = setTimeout(() => run(i + 1), ms);
    };
    run(0);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [auto]);

  const img = IMAGES[idx];

  return (
    <div className="relative flex h-[65vh] min-h-[560px] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#050507] text-white dark:border-slate-800">
      <div className="flex flex-col items-center px-4 pt-6 text-center">
        <p className="mb-2.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/70 backdrop-blur">
          React Bits · JavaScript + CSS · canvas 马赛克揭示
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.6)] md:text-4xl">
          RefineFrame
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">
          AI 出图风格的媒体进度框：图像以马赛克从粗到细逐行揭示，配五阶段状态 chip、
          扫描光带与失败重试。正在自动循环播放，也可以手动点阶段看单帧。
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                setAuto(false);
                setStatus(s.key);
              }}
              className={`rounded-full border px-3 py-1.5 text-xs backdrop-blur transition-colors ${
                status === s.key
                  ? 'border-white/70 bg-white/85 font-medium text-slate-900'
                  : 'border-white/25 bg-black/30 text-white/75 hover:border-white/50 hover:text-white'
              }`}
            >
              <span className="font-mono">{s.key}</span>
              <span className="ml-1.5 opacity-70">{s.label}</span>
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => setAuto((v) => !v)}
            className={`rounded-full border px-3 py-1.5 text-xs backdrop-blur transition-colors ${
              auto
                ? 'border-white/70 bg-white/85 font-medium text-slate-900'
                : 'border-white/25 bg-black/30 text-white/75 hover:border-white/50 hover:text-white'
            }`}
          >
            {auto ? '⏸ 暂停自动' : '▶ 自动播放'}
          </button>
          <button
            type="button"
            onClick={() => setIdx((idx + 1) % IMAGES.length)}
            className="rounded-full border border-white/25 bg-black/30 px-3 py-1.5 text-xs text-white/75 backdrop-blur transition-colors hover:border-white/50 hover:text-white"
          >
            换素材
            <span className="ml-1.5 opacity-70">{idx + 1}/{IMAGES.length}</span>
          </button>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-8">
        <RefineFrame
          status={status}
          aspectRatio="16 / 9"
          width={480}
          radius={18}
          background="#18181b"
          color="#fafafa"
          stageDuration={420}
          labels={LABELS}
          retryLabel="重试"
          onRetry={() => setStatus('queued')}
        >
          <img src={img.src} alt={img.alt} crossOrigin="anonymous" />
        </RefineFrame>
      </div>
    </div>
  );
}
