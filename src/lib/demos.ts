/**
 * 特效演示注册表。
 * 新增 demo 的步骤：在 src/pages/demos/<slug>.astro 建页面，然后在这里加一行即可——
 * 索引页卡片和侧栏数量角标都会自动更新。
 */
export interface Demo {
  /** 页面路径 /demos/<slug>/ */
  slug: string;
  title: string;
  description: string;
  /** ISO 日期，用于倒序排列 */
  date: string;
  tags: string[];
  /**
   * 卡片顶部预览条的 CSS background 简写。
   * 用纯 CSS 意在还原效果神韵（索引页保持零 JS），与真实效果以页面为准。
   */
  preview: string;
}

const ALL_DEMOS: Demo[] = [
  {
    slug: 'pattern-waves',
    title: 'PatternWaves',
    description:
      'React Bits 开源组件：ogl 驱动的可交互波浪表面，点阵/等高线/字符雨六种预设切换，光标划过起涟漪、点击溅水花。附集成提示词全文中文翻译。',
    date: '2026-11-18',
    tags: ['react', 'webgl', 'ogl'],
    preview:
      'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.28) 45%, transparent 62%), radial-gradient(rgba(255,255,255,0.85) 1.2px, transparent 1.3px)',
  },
  {
    slug: 'circular-carousel',
    title: 'CircularCarousel',
    description:
      'React Bits 开源组件：纯 CSS 3D 的环形照片轮播，圆筒/环绕/摩天轮/全景四种形状，可抓取甩动带惯性，用站内素材做成了一圈会转的照片环。附集成提示词中文翻译。',
    date: '2026-11-18',
    tags: ['react', 'css3d', '轮播'],
    preview:
      'linear-gradient(90deg, transparent 8%, rgba(255,255,255,0.14) 16%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0.22) 50%, rgba(255,255,255,0.05) 70%, rgba(255,255,255,0.14) 84%, transparent 92%), linear-gradient(0deg, transparent 20%, rgba(255,255,255,0.10) 46%, rgba(255,255,255,0.28) 54%, rgba(255,255,255,0.10) 62%, transparent 88%)',
  },
  {
    slug: 'crystalized-ball',
    title: 'CrystalizedBall',
    description:
      'React Bits 开源组件：ogl 驱动的等离子水晶球，电弧缠绕边缘、上万尘埃粒子随光标打旋，点击摇晃球体，八种预设从等离子到深渊。附集成提示词中文翻译。',
    date: '2026-11-18',
    tags: ['react', 'webgl', 'ogl'],
    preview:
      'radial-gradient(circle at 50% 58%, rgba(255,255,255,0.95) 0%, rgba(242,91,208,0.55) 7%, rgba(242,91,208,0.18) 24%, transparent 44%)',
  },
];

export const DEMOS = ALL_DEMOS.sort((a, b) => b.date.localeCompare(a.date));
