import { useState } from 'react';
import {
  AiChat02Icon,
  ChartAverageIcon,
  CodeIcon,
  CoffeeIcon,
  FireIcon,
  GemIcon,
  Layers01Icon,
  Settings02Icon,
  SparklesIcon,
  UserMultipleIcon
} from '@hugeicons/core-free-icons';
import BranchedMenu from './BranchedMenu';

// 菜单内容用站内真实导航：六个分类 + 特效演示 + 一个叶子「关于本站」，
// 比组件默认的 Getting started/Components 示例更有真实感
const ITEMS = [
  {
    label: '每日所学',
    children: [
      { value: 'prompts', label: '提示词', icon: AiChat02Icon },
      { value: 'tech', label: '技术', icon: CodeIcon },
      { value: 'interview', label: '面试', icon: UserMultipleIcon },
      { value: 'tools', label: '工具', icon: Settings02Icon },
      { value: 'finance', label: '金融', icon: ChartAverageIcon },
      { value: 'life', label: '生活', icon: CoffeeIcon }
    ]
  },
  {
    label: '特效演示',
    children: [
      { value: 'pattern-waves', label: 'PatternWaves', icon: FireIcon },
      { value: 'crystalized-ball', label: 'CrystalizedBall', icon: GemIcon },
      { value: 'circular-carousel', label: 'CircularCarousel', icon: Layers01Icon },
      { value: 'branched-menu', label: 'BranchedMenu', icon: SparklesIcon }
    ]
  },
  { value: 'about', label: '关于本站' }
];

// 四套配色实时切换：color 墨色 / accentColor 强调 / lineColor 树轨，走 CSS 变量即时生效
const THEMES = [
  { id: 'ink', label: '墨线', color: '#f5f5f5', accent: '#f5f5f5', line: '#3f3f46' },
  { id: 'moss', label: '苔绿', color: '#dbe4de', accent: '#6ee7b7', line: '#31413a' },
  { id: 'amber', label: '琥珀', color: '#f5f0e6', accent: '#fbbf24', line: '#443a26' },
  { id: 'peach', label: '桃粉', color: '#f5f5f5', accent: '#f25bd0', line: '#41304a' }
];

export default function BranchedMenuHero() {
  const [theme, setTheme] = useState(THEMES[0]);
  const [picked, setPicked] = useState(null);
  const [event, setEvent] = useState('还没点过——点左边菜单试试');

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-[#050507] text-white dark:border-slate-800">
      <div className="flex flex-col items-center px-4 pt-8 text-center">
        <p className="mb-2.5 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs tracking-wide text-white/70 backdrop-blur">
          React Bits · JavaScript + CSS · @hugeicons
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-white md:text-4xl">BranchedMenu</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80">
          树状分支导航菜单：展开目录时 SVG 分支线沿圆角弧生长，选中谁，强调线就沿树干滑到谁的行上。
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t)}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                theme.id === t.id
                  ? 'border-white/70 bg-white/85 font-medium text-slate-900'
                  : 'border-white/25 bg-black/30 text-white/75 hover:border-white/50 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center gap-6 px-6 py-10 md:flex-row md:items-start md:justify-center">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <BranchedMenu
            items={ITEMS}
            defaultOpen={[0, 1]}
            defaultActive="tech"
            onSelect={(value, item) => {
              setPicked({ value, label: item.label });
              setEvent(`onSelect → ${value}`);
            }}
            onToggle={(index, open) => setEvent(`onToggle → 区块 ${index} ${open ? '展开' : '折叠'}`)}
            color={theme.color}
            accentColor={theme.accent}
            lineColor={theme.line}
            width={240}
          />
        </div>
        <div className="w-full max-w-[240px] rounded-xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs uppercase tracking-wider text-white/50">回调状态</p>
          <p className="mt-4 text-xs text-white/50">最近选中</p>
          {picked ? (
            <p className="mt-1 font-mono text-sm text-white">
              {picked.label}
              <span className="ml-2 text-white/50">“{picked.value}”</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-white/40">—</p>
          )}
          <p className="mt-4 text-xs text-white/50">最近动作</p>
          <p className="mt-1 break-all font-mono text-xs text-white/80">{event}</p>
          <p className="mt-6 text-xs leading-relaxed text-white/40">
            叶子项（关于本站）点击即选中；带 children 的区块点击折叠/展开，折叠时强调线收起。
          </p>
        </div>
      </div>
    </div>
  );
}
