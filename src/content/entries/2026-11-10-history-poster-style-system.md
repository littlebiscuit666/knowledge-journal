---
title: 「历史谜局」海报视觉体系：历史事件 × 艺术风格
date: 2026-11-10
category: 提示词
tags: [历史谜局, 海报设计, 提示词工程]
---

给「历史谜局」项目定的设计原则：**不做千篇一律的历史海报**，而是让每种历史事件配对最合适的艺术风格，365 天不重样，但布局永远长了一张「同一个网站的脸」。

## 八种风格速查（附可直接复用的提示词）

| 风格 | 适用事件 |
|------|---------|
| 历史胶片纪实 | 柏林墙、冷战、20 世纪大事 |
| 艺术电影海报 | 有深刻社会意义的戏剧性事件 |
| 古典铜版画 | 大航海、工业革命、科学发现 |
| 古典油画 | 文艺复兴、王朝、重大发现 |
| 瑞士现代主义 | 现代科技、思想变革 |
| 复古未来主义 | 登月、太空竞赛、早期计算机 |
| 日本浮世绘 | 日本史、江户、东亚交流 |
| 中世纪手稿 | 中世纪、宗教艺术、神秘历史 |

### 历史胶片纪实（Analog Documentary）

```text
1980s analog documentary photography, faded color film, heavy 35mm grain,
imperfect exposure, muted colors, authentic historical atmosphere,
candid composition, analog imperfections, archival photo aesthetic
```

### 艺术电影海报（Arthouse Cinema）

```text
arthouse cinema poster, poetic visual storytelling, restrained composition,
dramatic negative space, subtle symbolism, muted cinematic palette,
understated typography, emotionally evocative atmosphere, fine art film photography
```

### 古典铜版画（Copperplate Engraving）

```text
19th-century copperplate engraving, intricate etched linework, fine cross-hatching,
antique print texture, sepia ink, aged paper, historical book illustration,
museum-quality engraving
```

### 古典油画（Classical Oil Painting）

```text
classical European oil painting, dramatic chiaroscuro lighting, rich pigments,
visible brushstrokes, aged canvas texture, historical composition,
museum painting aesthetic, restrained elegant atmosphere
```

### 瑞士现代主义（Swiss Modernism）

```text
Swiss International Typographic Style, asymmetric grid layout,
bold oversized typography, geometric composition, restrained color palette,
strong negative space, editorial graphic design, clean visual hierarchy
```

### 复古未来主义（Retro Futurism）

```text
1960s retro futuristic space poster, vintage screen printing, limited color palette,
halftone texture, mid-century graphic design, optimistic space age aesthetic,
bold graphic shapes, nostalgic scientific illustration
```

### 日本浮世绘（Ukiyo-e）

```text
traditional Japanese ukiyo-e woodblock print, Edo-period illustration,
flat color blocks, expressive outlines, washi paper texture,
hand-printed imperfections, elegant historical composition
```

### 中世纪手稿（Illuminated Manuscript）

```text
medieval illuminated manuscript, antique parchment, hand-painted marginal illustrations,
gold leaf ornamentation, historical calligraphy, faded pigments,
intricate decorative borders, authentic manuscript texture
```

## 万能海报公式

$$\text{事件场景} + \text{艺术风格} + \text{视觉构图} + \text{年代质感} + \text{文字布局}$$

比堆砌 `masterpiece, best quality` 高效得多。五个维度里最关键的一条洞察：

> **一张海报只要一个视觉主角**——可以是一个翻越围墙的人、一只伸出的手、裂缝里透出的光。不要把所有历史细节塞进同一张画面。

例：柏林墙海报不用 `arthouse cinema poster` 这种泛词撑场面，而是写死 `one powerful human gesture as the visual focal point`。

## 工程决定：AI 不碰文字

- AI **只生成无文字的历史艺术底图**
- 标题、日期、名言、签名全部由网站 HTML/CSS 固定渲染，签名用固定艺术字体
- 最终海报由网页导出

为什么：① 字体/布局/签名跨 365 天完全一致，一眼认出同一个网站；② AI 写中文必出错，绕开。

## 品牌一致性原则

建立 8～12 种艺术风格轮换，但**标题位置、日期设计、艺术签名永远固定**。风格管「每天不一样」，布局管「一看就是你」。

另外两条红线：艺术底图要注明「艺术再现，非真实历史照片」；用真实档案照片必须核查版权。
