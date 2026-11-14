---
title: "每日所学知识站上线复盘"
date: 2026-11-10
category: 技术
tags: [astro, vercel, 建站, 日记归档]
draft: false
---

日期：2026-11-10

## 今天干了什么

从一句「我想做一个记录每天学到的知识的网站」出发，走完 brainstorm → 设计文档 → 实施计划 → 内联执行 → 部署上线全流程，约 1 小时交付。

- **线上地址**：https://journal.fanyihong.work（大陆直连主域名）/ https://knowledge-journal.vercel.app（备用，需代理）
- **仓库**：github.com/littlebiscuit666/knowledge-journal（main）
- **本地**：D:\knowledge-journal
- **技术栈**：Astro 5 + Tailwind CSS 4 + @tailwindcss/typography，纯静态，零数据库，Vercel 免费托管

## 产品形态

- **「一天多事，一事一文」**：每个知识点一个 md 文件（解决「每天东西很杂」），时间线按天归组
- frontmatter：title / date / category（提示词|技术|工具|金融|生活）/ tags / draft
- 页面：时间线首页（侧栏分类筛选）+ 文章页 + 分类页 + RSS
- 深浅双主题跟随系统，中文排版，代码高亮
- **日常动线**：说「记一条：XXX」（可带图）→ Claude 总结提炼 → 写 md → npm run build 校验 → push → Vercel 自动部署（约 1 分钟）→ 上线

## 已录入内容（3 条提示词 + 2 条示例）

1. 「历史谜局」海报视觉体系：8 艺术风格 × 历史事件 + 万能公式 + 「AI 只画底图，文字归 CSS」铁律
2. GitHub 风格落地页规范（暗色皮肤）：深空黑 + 极光光斑 + 光纤生命线 + Bento 活界面
3. Kaggle 控制台风格仪表盘规范（亮色皮肤）：与上一条凑成明暗两套方法论

## 踩坑记录（按顺序）

| 坑 | 现象 | 解法 |
|----|------|------|
| Vercel token 过期 | `vercel whoami` 报 invalid token | `vercel login` 重新授权 |
| 账号没绑 GitHub 登录 | `vercel link` 报 "need Login Connection" | 先 CLI 手动部署兜底，后补绑 |
| **GitHub App 根本没装** | github.com/settings/installations 里没有 Vercel 应用 | https://github.com/apps/vercel/installations/new 手动安装 → `vercel git connect` 成功 |
| **vercel.app 被墙** | 不挂 VPN 打不开（DNS 污染+SNI 阻断） | 解法=绑自定义域名（进行中，见下） |
| npm audit 7 漏洞警告 | 全来自开发工具链 | 静态站不打包上线，忽略 |
| curl 验证 000 | vercel.app 直连不通 | 一切验证走 Clash 代理 `curl -x http://127.0.0.1:7890` |

## 质量验证手段（可复用）

- Zod 负向测试：故意把 category 写错 → 构建必须报 `invalid-content-entry-data` → 改回 → 通过
- 目检：dev server + Chrome DevTools MCP 截图，浅色/深色/文章页各一张
- 部署验收：curl 首页 + RSS 双 200；`vercel ls` 看部署是否由 git push 触发

## 已完成：大陆直连（绑自定义域名）✅

原理：GFW 封的是 `*.vercel.app` 这个域名本身，自有域名 CNAME 到 `cname.vercel-dns.com` 指向 Vercel 边缘节点，大陆可直连（无需备案）。

已执行：`vercel domains add journal.fanyihong.work`（自动挂到链接项目）→ DNSPod 加 CNAME 记录 `journal → cname.vercel-dns.com` → Vercel 自动签发证书 → 强制真实 IP 直连测试 200 ✅ → astro.config.mjs 的 `site` 切到新域名。

注意：本机 Clash 开 fake-ip 模式时，`nslookup` 走 198.18.0.2 会截胡报错，测试真实解析要指定权威 DNS（`nslookup journal.fanyihong.work spica.dnspod.net`）。

## 相关记忆索引

- project_knowledge_journal.md（站点维护）
- project_history_mystery.md（历史谜局项目，海报体系来源）
