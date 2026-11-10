# 每日所学（知识记录站）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭一个 Astro 5 + Tailwind 4 纯静态知识记录站：时间线首页、文章页、分类页、RSS，推 GitHub 后 Vercel 自动部署。

**Architecture:** 内容为 Astro Content Collections（每个知识点一个 md 文件，Zod schema 校验），页面全部静态生成，无数据库。布局组件（BaseLayout）→ 条目组件（EntryCard）→ 三个页面 + RSS 的单向依赖。

**Tech Stack:** Astro 5、Tailwind CSS 4（`@tailwindcss/vite`）、`@tailwindcss/typography`、`@astrojs/rss`、GitHub + Vercel。

**Spec:** `docs/superpowers/specs/2026-11-10-knowledge-journal-design.md`

## Global Constraints

- 站点标题：`每日所学`；副标语：`记录每天学到的知识`
- 分类枚举（精确值）：`提示词 | 技术 | 工具 | 金融 | 生活`
- frontmatter 必填：`title`、`date`、`category`；可选：`tags`（默认 `[]`）、`draft`（默认 `false`）
- `draft: true` 的条目不出现在任何页面、分类页、RSS，也没有文章页路由
- 界面文案全部中文；深色模式跟随系统（Tailwind `dark:` 默认即 `prefers-color-scheme`，零配置）
- 包管理：npm；仓库远端：`littlebiscuit666/knowledge-journal`（gh 已登录该账号）
- Vercel CLI 已登录（账号 `yihongfan924-9352`）
- 注意：`npm install` 按用户偏好交给用户在终端跑，执行时用 `!` 前缀方式给出命令

---

### Task 1: 项目骨架与构建链路

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `.gitignore`, `public/favicon.svg`
- Create: `src/styles/global.css`, `src/pages/index.astro`（临时占位，Task 3 重写）
- Test: `npm run build` 产出 `dist/index.html`

**Interfaces:**
- Produces: 可运行的 Astro 项目；后续所有任务依赖 `npm run build` 验证；`global.css` 会被 BaseLayout 引用

- [ ] **Step 1: 写入骨架文件**

`package.json`：

```json
{
  "name": "knowledge-journal",
  "type": "module",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview"
  },
  "dependencies": {
    "@astrojs/rss": "^4.0.11",
    "@tailwindcss/typography": "^0.5.15",
    "@tailwindcss/vite": "^4.1.0",
    "astro": "^5.7.0",
    "tailwindcss": "^4.1.0"
  }
}
```

`astro.config.mjs`：

```js
// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Task 5 部署后如实际域名不同，回来改成真实 URL（RSS 必需）
  site: 'https://knowledge-journal.vercel.app',
  vite: {
    plugins: [tailwindcss()],
  },
});
```

`tsconfig.json`：

```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist"]
}
```

`.gitignore`：

```
node_modules/
dist/
.astro/
.DS_Store
```

`public/favicon.svg`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#2563eb"/>
  <path d="M30 28h28M30 42h40M30 56h40M30 70h22" stroke="#fff" stroke-width="7" stroke-linecap="round" fill="none"/>
</svg>
```

`src/styles/global.css`：

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@theme {
  --font-sans: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif;
}
```

`src/pages/index.astro`（临时占位）：

```astro
---
---
<html lang="zh-CN">
  <head><meta charset="utf-8" /><title>每日所学</title></head>
  <body><h1>每日所学</h1></body>
</html>
```

- [ ] **Step 2: 安装依赖（交给用户跑）**

在会话里给用户命令，让用户以 `!` 前缀执行：

```
! cd /d/knowledge-journal && npm install
```

等用户跑完、`node_modules` 出现后再继续。

- [ ] **Step 3: 构建验证**

Run: `cd /d/knowledge-journal && npm run build`
Expected: 退出码 0，`dist/index.html` 存在。Tailwind/TYpography 插件报错会在这里暴露。

- [ ] **Step 4: Commit**

```bash
cd /d/knowledge-journal
git add -A && git commit -m "chore: Astro+Tailwind 项目骨架"
```

---

### Task 2: 内容模型与数据层

**Files:**
- Create: `src/content.config.ts`, `src/lib/entries.ts`
- Create: `src/content/entries/2026-11-10-hello-world.md`, `src/content/entries/2026-11-10-comfyui-prompt.md`
- Create: `public/images/2026-11/demo-timeline.svg`（演示图片流）

**Interfaces:**
- Produces（后续所有页面依赖，精确签名）:
  - `CATEGORIES: readonly ['提示词','技术','工具','金融','生活']`
  - `getPublishedEntries(): Promise<CollectionEntry<'entries'>[]>` — 过滤 draft、按日期倒序
  - `formatDate(date: Date): string` — 中文「2026年11月10日 星期二」格式
  - `groupByDate(entries): [string, CollectionEntry<'entries'>[]][]` — 按 `YYYY-MM-DD` 分组，保持传入顺序
  - collection 名 `entries`；条目路由 id = 文件名去扩展名

- [ ] **Step 1: 写 content.config.ts**

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const entries = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/entries' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    category: z.enum(['提示词', '技术', '工具', '金融', '生活']),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { entries };
```

- [ ] **Step 2: 写 src/lib/entries.ts**

```ts
import { getCollection, type CollectionEntry } from 'astro:content';

export const CATEGORIES = ['提示词', '技术', '工具', '金融', '生活'] as const;
export type Category = (typeof CATEGORIES)[number];

export type Entry = CollectionEntry<'entries'>;

/** 全部已发布条目（过滤 draft），按日期倒序 */
export async function getPublishedEntries(): Promise<Entry[]> {
  const all = await getCollection('entries', ({ data }) => !data.draft);
  return all.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** 「2026年11月10日 星期二」 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date);
}

/** 按 YYYY-MM-DD 分组；要求传入已排序数组，保持顺序 */
export function groupByDate(entries: Entry[]): [string, Entry[]][] {
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = e.data.date.toISOString().slice(0, 10);
    const list = map.get(key);
    if (list) list.push(e);
    else map.set(key, [e]);
  }
  return [...map.entries()];
}
```

- [ ] **Step 3: 写两条示例条目（覆盖：分级标题、代码块、图片、标签）**

`src/content/entries/2026-11-10-hello-world.md`：

```markdown
---
title: 知识记录站开张：第一条
date: 2026-11-10
category: 生活
tags: [meta]
---

这里是「每日所学」的第一条记录。以后每天学到的东西都记在这里。

## 这站怎么用

- 时间线按天分组，最新的在最上面
- 左侧可以按分类筛选
- 每条都是独立页面，可以单独分享链接

## 格式都支持什么

### 分级标题

像这样一级一级往下组织内容，再杂的知识也能理顺。

### 代码块

```python
def learn(something):
    return f"今天学了 {something}"
```

### 图片

![演示图片：时间线示意](/images/2026-11/demo-timeline.svg)
```

`src/content/entries/2026-11-10-comfyui-prompt.md`：

```markdown
---
title: 提示词示例：让出图更稳定的负面词
date: 2026-11-10
category: 提示词
tags: [comfyui, stable-diffusion]
---

出图人物崩坏时，往负面提示词里加这组：

```text
lowres, bad anatomy, bad hands, extra fingers, worst quality, jpeg artifacts
```

## 为什么有效

- `bad anatomy` 直接对准肢体崩坏的高发区
- 质量类词（`worst quality` 等）在多数 SDXL 模型上都认识
- 记住：负面词不是越多越好，堆太多会互相干扰
```

- [ ] **Step 4: 写演示图片**

`public/images/2026-11/demo-timeline.svg`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160">
  <rect width="400" height="160" rx="8" fill="#eff6ff"/>
  <line x1="40" y1="30" x2="40" y2="130" stroke="#2563eb" stroke-width="3"/>
  <circle cx="40" cy="40" r="6" fill="#2563eb"/>
  <circle cx="40" cy="80" r="6" fill="#60a5fa"/>
  <circle cx="40" cy="120" r="6" fill="#93c5fd"/>
  <rect x="60" y="28" width="280" height="24" rx="6" fill="#fff"/>
  <rect x="60" y="68" width="240" height="24" rx="6" fill="#fff"/>
  <rect x="60" y="108" width="260" height="24" rx="6" fill="#fff"/>
</svg>
```

- [ ] **Step 5: 构建验证（含 schema 负向测试）**

Run: `cd /d/knowledge-journal && npm run build`
Expected: 通过。

负向测试：把 `hello-world.md` 的 `category: 生活` 临时改成 `category: 美食`，再跑 `npm run build`。
Expected: **构建失败**，报错信息包含 `Invalid input`（证明 Zod 枚举校验生效）。改回 `生活`，再跑一次确认通过。

- [ ] **Step 6: Commit**

```bash
cd /d/knowledge-journal
git add -A && git commit -m "feat: 内容模型 + 数据层 + 示例条目"
```

---

### Task 3: 布局、条目组件与时间线首页

**Files:**
- Create: `src/layouts/BaseLayout.astro`, `src/components/EntryCard.astro`
- Modify: `src/pages/index.astro`（重写占位版）

**Interfaces:**
- Consumes: Task 2 的 `getPublishedEntries` / `formatDate` / `groupByDate` / `CATEGORIES`；`astro:content` 的 `render`
- Produces:
  - `BaseLayout` props: `{ title: string; description?: string }`，插槽为页面主体
  - `EntryCard` props: `{ entry: Entry }`

- [ ] **Step 1: 写 BaseLayout.astro**

```astro
---
import '../styles/global.css';

interface Props {
  title: string;
  description?: string;
}

const { title, description = '记录每天学到的知识' } = Astro.props;
---

<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <meta name="generator" content={Astro.generator} />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>{title}</title>
  </head>
  <body class="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
    <header class="border-b border-slate-200 dark:border-slate-800">
      <div class="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <a href="/" class="text-xl font-bold tracking-tight hover:text-blue-600 dark:hover:text-blue-400">
          每日所学
        </a>
        <a
          href="/rss.xml"
          class="rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        >
          RSS
        </a>
      </div>
    </header>
    <main class="mx-auto max-w-5xl px-4 py-8">
      <slot />
    </main>
    <footer class="border-t border-slate-200 py-6 text-center text-sm text-slate-400 dark:border-slate-800 dark:text-slate-500">
      每日所学 · 用 Astro + Vercel 搭建
    </footer>
  </body>
</html>
```

- [ ] **Step 2: 写 EntryCard.astro**

```astro
---
import { render } from 'astro:content';
import type { Entry } from '../lib/entries';

interface Props {
  entry: Entry;
}

const { entry } = Astro.props;
const { Content } = await render(entry);
---

<article class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
  <div class="mb-4 flex flex-wrap items-center gap-2">
    <span
      class="rounded-full bg-blue-100 px-3 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
    >
      {entry.data.category}
    </span>
    <a
      href={`/entries/${entry.id}/`}
      class="text-sm text-slate-400 underline-offset-2 hover:underline dark:text-slate-500"
    >
      {entry.data.title}
    </a>
    {
      entry.data.tags.length > 0 && (
        <span class="ml-auto flex gap-1.5">
          {entry.data.tags.map((tag) => (
            <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              #{tag}
            </span>
          ))}
        </span>
      )
    }
  </div>
  <div class="prose prose-slate dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-pre:bg-slate-950">
    <Content />
  </div>
</article>
```

- [ ] **Step 3: 重写 index.astro（时间线 + 侧栏分类）**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import EntryCard from '../components/EntryCard.astro';
import { CATEGORIES, formatDate, getPublishedEntries, groupByDate } from '../lib/entries';

const entries = await getPublishedEntries();
const days = groupByDate(entries);
const counts = Object.fromEntries(
  CATEGORIES.map((c) => [c, entries.filter((e) => e.data.category === c).length]),
);
---

<BaseLayout title="每日所学 · 记录每天学到的知识">
  <div class="flex flex-col gap-8 md:flex-row-reverse">
    <aside class="md:w-48 md:shrink-0">
      <nav class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 class="mb-2 text-sm font-semibold text-slate-400 dark:text-slate-500">分类</h2>
        <ul class="space-y-1 text-sm">
          <li>
            <a href="/" class="flex justify-between rounded px-2 py-1 font-medium text-blue-600 dark:text-blue-400">
              <span>全部</span><span>{entries.length}</span>
            </a>
          </li>
          {
            CATEGORIES.map((c) => (
              <li>
                <a
                  href={`/category/${c}/`}
                  class="flex justify-between rounded px-2 py-1 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <span>{c}</span>
                  <span class="text-slate-400 dark:text-slate-500">{counts[c]}</span>
                </a>
              </li>
            ))
          }
        </ul>
      </nav>
    </aside>
    <div class="min-w-0 flex-1 space-y-10">
      {
        days.length === 0 && (
          <p class="text-center text-slate-400 dark:text-slate-500">还没有记录，从今天开始吧。</p>
        )
      }
      {
        days.map(([day, dayEntries]) => (
          <section class="space-y-4">
            <h2 class="text-lg font-bold">{formatDate(dayEntries[0].data.date)}</h2>
            {dayEntries.map((entry) => <EntryCard entry={entry} />)}
          </section>
        ))
      }
    </div>
  </div>
</BaseLayout>
```

- [ ] **Step 4: 构建验证 + 目检**

Run: `cd /d/knowledge-journal && npm run build`
Expected: 通过，`dist/index.html` 包含「每日所学」和「知识记录站开张」字样（`grep` 确认）。

用 `npm run dev` 起本地服务（后台），截图检查浅色/深色渲染、中文排版；看完关掉。

- [ ] **Step 5: Commit**

```bash
cd /d/knowledge-journal
git add -A && git commit -m "feat: 布局、条目组件与时间线首页"
```

---

### Task 4: 文章页、分类页与 RSS

**Files:**
- Create: `src/pages/entries/[id].astro`, `src/pages/category/[category].astro`, `src/pages/rss.xml.js`

**Interfaces:**
- Consumes: `getPublishedEntries` / `CATEGORIES` / `formatDate` / `Entry`、`EntryCard`、`BaseLayout`
- Produces: 路由 `/entries/<id>/`、`/category/<分类>/`、`/rss.xml`（draft 条目无路由）

- [ ] **Step 1: 写 entries/[id].astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import { formatDate, getPublishedEntries } from '../../lib/entries';
import { render } from 'astro:content';

export async function getStaticPaths() {
  const entries = await getPublishedEntries();
  return entries.map((entry) => ({ params: { id: entry.id }, props: { entry } }));
}

const { entry } = Astro.props;
const { Content } = await render(entry);
---

<BaseLayout title={`${entry.data.title} · 每日所学`} description={entry.data.title}>
  <div class="mx-auto max-w-3xl">
    <a
      href="/"
      class="mb-6 inline-block text-sm text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400"
    >
      ← 回时间线
    </a>
    <h1 class="mb-2 text-3xl font-bold">{entry.data.title}</h1>
    <p class="mb-8 flex gap-3 text-sm text-slate-400 dark:text-slate-500">
      <span>{entry.data.category}</span>
      <span>{formatDate(entry.data.date)}</span>
    </p>
    <div class="prose prose-slate dark:prose-invert max-w-none prose-pre:bg-slate-950">
      <Content />
    </div>
  </div>
</BaseLayout>
```

- [ ] **Step 2: 写 category/[category].astro**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import EntryCard from '../../components/EntryCard.astro';
import { CATEGORIES, formatDate, getPublishedEntries, groupByDate, type Category } from '../../lib/entries';

export async function getStaticPaths() {
  return CATEGORIES.map((category) => ({ params: { category } }));
}

const { category } = Astro.params as { category: Category };
const entries = (await getPublishedEntries()).filter((e) => e.data.category === category);
const days = groupByDate(entries);
---

<BaseLayout title={`${category} · 每日所学`}>
  <div class="mx-auto max-w-3xl">
    <a href="/" class="mb-6 inline-block text-sm text-slate-400 hover:text-blue-600 dark:text-slate-500">← 回时间线</a>
    <h1 class="mb-8 text-2xl font-bold">{category} <span class="text-base font-normal text-slate-400">{entries.length} 条</span></h1>
    <div class="space-y-10">
      {
        days.length === 0 && (
          <p class="text-center text-slate-400 dark:text-slate-500">这个分类下还没有记录。</p>
        )
      }
      {
        days.map(([, dayEntries]) => (
          <section class="space-y-4">
            <h2 class="text-lg font-bold">{formatDate(dayEntries[0].data.date)}</h2>
            {dayEntries.map((entry) => <EntryCard entry={entry} />)}
          </section>
        ))
      }
    </div>
  </div>
</BaseLayout>
```

- [ ] **Step 3: 写 rss.xml.js**

```js
import rss from '@astrojs/rss';
import { getPublishedEntries } from '../lib/entries';

export async function GET(context) {
  const entries = await getPublishedEntries();
  return rss({
    title: '每日所学',
    description: '记录每天学到的知识',
    site: context.site,
    items: entries.map((e) => ({
      title: e.data.title,
      pubDate: e.data.date,
      link: `/entries/${e.id}/`,
      categories: e.data.tags,
    })),
  });
}
```

- [ ] **Step 4: 构建验证**

Run: `cd /d/knowledge-journal && npm run build`
Expected: 通过，且以下都存在：

```bash
ls dist/entries/2026-11-10-hello-world/index.html
ls dist/category/ 2>/dev/null || ls "dist/category"
ls dist/rss.xml
```

（中文分类目录名会以 URL 编码形式落盘，如 `%E6%8A%80%E6%9C%AF`，属正常。）

- [ ] **Step 5: Commit**

```bash
cd /d/knowledge-journal
git add -A && git commit -m "feat: 文章页、分类页与 RSS"
```

---

### Task 5: GitHub 推送与 Vercel 部署

**Files:**
- Create: 无新代码文件
- Modify: `astro.config.mjs`（如实际域名 ≠ 占位值，改 `site` 后重新部署）

- [ ] **Step 1: 创建 GitHub 仓库并推送**

```bash
cd /d/knowledge-journal
gh repo create littlebiscuit666/knowledge-journal --public --source . --push
```

Expected: 仓库创建成功、main 分支已推送。

- [ ] **Step 2: Vercel 关联与首次部署**

```bash
cd /d/knowledge-journal
vercel link --yes --project knowledge-journal
vercel git connect --yes 2>/dev/null || true   # 若此命令不可用，fallback：让用户在 dashboard 导入一次
vercel deploy --prod --yes
```

Expected: 部署成功，输出生产域名（形如 `knowledge-journal-xxx.vercel.app`）。

- [ ] **Step 3: 校准 site 并确认自动部署链路**

拿实际域名：
- 若 ≠ `https://knowledge-journal.vercel.app`：改 `astro.config.mjs` 的 `site`，commit + push
- push 后等约 1-2 分钟，`vercel ls` 应看到由 git 触发的新部署（证明 GitHub→Vercel 自动部署已通）
- 若 `vercel git connect` 不可用且 dashboard 未导入：请用户在 vercel.com 上 Import Git Repository 一次性点完，之后 push 即自动部署

- [ ] **Step 4: 线上验收**

```bash
curl -s -o /dev/null -w "%{http_code}" "https://<实际域名>/"
curl -s -o /dev/null -w "%{http_code}" "https://<实际域名>/rss.xml"
```

Expected: 都是 `200`。浏览器打开首页截图终检（浅色 + 深色各一张）。

---

### Task 6: 仓库 README（日常写作手册）

**Files:**
- Create: `README.md`

- [ ] **Step 1: 写 README.md**

````markdown
# 每日所学

记录每天学到的知识的个人站点。Astro 5 + Tailwind 4，纯静态，部署在 Vercel。

## 日常怎么记（推荐方式）

直接告诉 Claude「记一条：今天学了 XXX」（要带图就把图发给它），
Claude 负责：写 md → 归档图片 → 本地构建验证 → push → 自动上线。

## 手动添加一条

1. 在 `src/content/entries/` 新建 `YYYY-MM-DD-slug.md`
2. 头部字段：

```yaml
---
title: 标题
date: 2026-11-10
category: 技术   # 提示词 / 技术 / 工具 / 金融 / 生活
tags: [任意, 标签]
draft: false     # true 则不上线
---
```

3. 正文随意用 Markdown；图片放 `public/images/YYYY-MM/`，正文里 `/images/YYYY-MM/xxx.png` 引用
4. `npm run build` 通过后 push，Vercel 自动部署

## 本地开发

```bash
npm install
npm run dev      # 本地预览
npm run build    # 构建到 dist/
```
````

- [ ] **Step 2: Commit + push**

```bash
cd /d/knowledge-journal
git add README.md && git commit -m "docs: README 写作手册"
git push
```

Expected: push 触发一次 Vercel 自动部署（成功即闭环最终验证）。
