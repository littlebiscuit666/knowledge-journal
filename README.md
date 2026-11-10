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
