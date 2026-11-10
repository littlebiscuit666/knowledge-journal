# 每日所学 — 知识记录站 设计文档

日期：2026-11-10
状态：已批准（用户口头确认方案 A + 图片支持）

## 目标

一个公开博客式的个人知识记录网站：用户每天把学到的知识（含提示词类内容）告诉 Claude，
由 Claude 整理成 Markdown 推送到 GitHub，Vercel 自动构建部署。站点展示时间线、分类筛选、
带分级标题和图片的完整文章。

## 非目标（v1 不做）

- 网页端编辑器 / 登录认证（内容公开，写作走 Claude + git）
- 搜索、打卡热力图（未选，留作以后加）
- 评论系统
- 自定义域名（先用 `xxx.vercel.app`，以后要绑随时可加）

## 技术栈

- **Astro 5** + **Tailwind CSS 4**（via `@tailwindcss/vite`）
- 内容：Astro Content Collections（`src/content/entries/*.md`），Zod schema 校验
- 部署：GitHub → Vercel 自动构建（零数据库，纯静态）
- 仓库：`littlebiscuit666/knowledge-journal`，本地 `D:\knowledge-journal`

## 内容模型

每个知识点一个文件，文件名 `<date>-<slug>.md`：

```yaml
---
title: string            # 必填
date: date               # 必填，时间线分组依据
category: enum           # 必填：提示词 | 技术 | 工具 | 金融 | 生活（可扩展，改 schema 即可）
tags: string[]           # 可选，自由标签
draft: boolean           # 默认 false；true 时构建跳过、不上线
---
```

正文 Markdown，支持分级标题（## / ###）、代码块高亮、图片。
图片放 `public/images/<YYYY-MM>/`，正文引用 `/images/<YYYY-MM>/xxx.png`。

「杂」的处理：颗粒度是「条」不是「天」——一天多个文件，时间线按天归组。
分类是每条记录的单值属性，Claude 代为判断归类，用户可随时要求改。

## 页面

| 路由 | 内容 |
|------|------|
| `/` | 时间线：按天分组倒序，每条卡片显示分类徽章 + 标签 + 正文渲染；侧栏分类筛选 |
| `/entries/[slug]/` | 单条完整页（直接 getStaticPaths 全量生成，数量小无需分页） |
| `/category/[category]/` | 单分类列表，同时间线样式 |
| `/rss.xml` | RSS 订阅 |

条目直接整篇渲染在时间线里（个人日志的阅读习惯），文章页供单独分享链接。

## 视觉方向

浅色为主的干净阅读风，中文排版友好（正文 16-17px、行距宽松、代码块高亮），
系统偏好深色时跟随（CSS `prefers-color-scheme`），顶部站点名「每日所学」。
具体视觉在实现时按 frontend-design 技能打磨。

## 日常写作流

用户说「记一条：XXX」（可附图）→ Claude 写 md + 归档图片 → 本地 `npm run build` 验证
（schema 校验 + 链接检查）→ git push → Vercel 自动部署（约 1 分钟）。

## 错误处理

- frontmatter 字段错误 / category 拼错 → 构建期 Zod 校验直接报错，push 前拦截
- `draft: true` 条目不出现在任何页面和 RSS
- 内部链接失效 → 构建期 Astro 报错（严格模式）

## 测试策略

- 每次 push 前 `npm run build` 通过（覆盖 schema 校验 + 死链 + 全页面生成）
- 新增条目后用浏览器截图抽查渲染效果（图片、代码块、标题层级）
- 部署后 curl 首页 + RSS 确认 200
