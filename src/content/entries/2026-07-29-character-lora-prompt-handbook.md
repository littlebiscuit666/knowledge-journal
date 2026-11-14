---
title: "角色 LoRA 出图提示词手册（9 角色配方）"
date: 2026-07-29
category: 技术
tags: [lora, 提示词, sdxl, 日记归档]
draft: false
---

> 配合 kohya SDXL 角色 LoRA 使用,已覆盖 **9 个角色**:feiying / ruanmei(2026-07-28) + feicui / haiseyin / liuying / robin / tingyun / xiadie / xiaoba(2026-07-29)
> 底模:Animagine XL 3.1 ｜ 推理框架:diffusers
> 更新:2026-07-29

---

## 一、三条铁律(先记住这三条就够了)

1. **触发词永远放 prompt 最前面**
   - feiying 用 `feiying_char`,ruanmei 用 `ruanmei_char`
   - 训练时 `keep_tokens=1` 把它锁在 caption 首位,推理时也要在最前,权重才稳

2. **用 Danbooru 标签风格,不要写自然语言**
   - ✅ `1girl, pink hair, short hair, animal ears, sitting, smile`
   - ❌ `a girl with pink short hair and animal ears sitting and smiling`
   - 逗号分隔的短标签,每个标签描述一个属性

3. **末尾加质量标签**
   - `masterpiece, best quality`(Animagine 系标配,提升整体画质)

---

## 二、Prompt 公式

```
<触发词>, <人物固定特征>, <构图/视角>, <动作/表情>, <场景/背景>, masterpiece, best quality
```

**顺序即权重**:越靠前的标签影响越大 → 触发词和角色固定特征放最前,场景背景放靠后。

> 💡 **固定特征要不要写?** 即使 LoRA 已学会角色,显式写出关键特征(发色/瞳色/服饰)能**显著提升一致性**,尤其在换场景/换姿势时。推荐写。

---

## 三、LoRA 强度(scale)怎么调

LoRA 对画面的影响由 `scale` 控制(= `alpha/dim × 传入系数`,本 LoRA 内置 `alpha/dim=0.5`):

| scale | 效果 | 何时用 |
|---|---|---|
| **0.6 – 0.8** | 偏弱,底模风格更多 | 想要更自然/更多样化,或感觉画面"死板"(过拟合) |
| **1.0** | 训练等效强度(默认) | **推荐起点** |
| **1.2 – 1.5** | 偏强 | 角色不够像、特征飘时 |
| **2.0** | 全强度(最大还原) | 要求最高还原度,但易过拟合(道具复现死板) |

> 经验:先 scale=1.0 出一张看,不像就 +0.2 逐步加;画面僵硬就 -0.2。

---

## 四、feiying 提示词

### 角色固定特征(速查)
`pink hair, short fluffy hair, long animal ears, purple eyes, red hair bow, flower hair ornament, white collared shirt, red bowtie, black choker, black pleated skirt, black-and-red outfit, waist charm, black boots`

### 现成 prompt(直接复制)

**① 标准肖像(正面/微笑)**
```
feiying_char, 1girl, solo, pink hair, short fluffy hair, long animal ears, purple eyes, red hair bow, white collared shirt, red bowtie, black pleated skirt, portrait, front view, looking at viewer, cheerful smile, bright room, masterpiece, best quality
```

**② 半身/手举起**
```
feiying_char, 1girl, solo, pink hair, short fluffy hair, long animal ears, purple eyes, red hair bow, flower hair ornament, white collared shirt, red bowtie, upper body, hand raised, playful expression, studio background, masterpiece, best quality
```

**③ 全身站姿**
```
feiying_char, 1girl, solo, pink hair, short fluffy hair, long animal ears, purple eyes, black pleated skirt, black boots, waist charm, full body, standing, hand on hip, three-quarter view, simple background, masterpiece, best quality
```

**④ 特写/眨眼**
```
feiying_char, 1girl, solo, pink hair, purple eyes, long animal ears, red hair bow, close-up, wink, cheerful expression, bokeh background, masterpiece, best quality
```

**⑤ 户外樱花**
```
feiying_char, 1girl, solo, pink hair, short fluffy hair, long animal ears, purple eyes, white collared shirt, red bowtie, black pleated skirt, outdoor, cherry blossoms, sunlight, wind, looking away, peaceful, masterpiece, best quality
```

---

## 五、ruanmei 提示词

### 角色固定特征(速查)
`long wavy dark brown hair, teal eyes, pale skin, hair ornament, hairpin, earrings, black gloves, long gloves, choker, qipao-inspired dress, teal dress, gold trim, detached sleeves, high heels`

### 现成 prompt(直接复制)

**① 标准肖像(优雅/正面)**
```
ruanmei_char, 1girl, solo, long wavy dark brown hair, teal eyes, pale skin, hair ornament, hairpin, earrings, qipao-inspired dress, gold trim, detached sleeves, portrait, front view, calm smile, elegant, simple background, masterpiece, best quality
```

**② 全身坐姿(卡牌立绘风)**
```
ruanmei_char, 1girl, solo, long wavy dark brown hair, teal eyes, pale skin, black gloves, long gloves, choker, qipao-inspired dress, detached sleeves, high heels, full body, sitting, crossed legs, card illustration, room background, mist, masterpiece, best quality
```

**③ 半身/手放下**
```
ruanmei_char, 1girl, solo, long wavy dark brown hair, teal eyes, hairpin, earrings, qipao-inspired dress, upper body, hand down, gentle smile, studio background, masterpiece, best quality
```

**④ 特写/平静表情**
```
ruanmei_char, 1girl, solo, long wavy dark brown hair, teal eyes, pale skin, hair ornament, close-up, calm expression, looking at viewer, soft lighting, masterpiece, best quality
```

**⑤ 户外/月夜**
```
ruanmei_char, 1girl, solo, long wavy dark brown hair, teal eyes, qipao-inspired dress, detached sleeves, outdoor, night, moonlight, traditional architecture, standing, wind, masterpiece, best quality
```

---

## 六、2026-07-29 批量训练的新角色(7 个)

> 与 feiying/ruanmei 同配方(dim32/alpha16, Animagine XL 3.1),写法一致:**触发词首位 + 固定特征 + 构图/动作/场景 + `masterpiece, best quality`**。权重文件在 AutoDL `output/`(6006 下载),每角色 5 个:`<角色>-v1.safetensors`(final) + ep11/12/13/14。

### feicui(魔女帽 · 粉紫卷发)
**触发词**:`feicui_char`
**固定特征速查**:`long wavy hair, pink hair, purple hair, blue eyes, pale skin, mature female, witch hat, wide-brimmed hat, blue butterfly ornament, feather ornament, black gloves, choker, earrings, asymmetrical dress, black dress, blue dress, diamond pattern, thigh slit, high heels`
**现成 prompt**:
- 肖像:`feicui_char, 1girl, solo, long wavy hair, pink hair, blue eyes, witch hat, wide-brimmed hat, blue butterfly ornament, asymmetrical dress, portrait, front view, confident smile, simple background, masterpiece, best quality`
- 全身立绘:`feicui_char, 1girl, solo, pink hair, witch hat, black dress, diamond pattern, thigh slit, high heels, full body, standing, card illustration, masterpiece, best quality`
> 训练图含卡牌边框/蛇/多人(`card frame, snake, extra characters`),单角色出图把这些加进负面词。

### haiseyin(深海 · 蓝紫渐变发)
**触发词**:`haiseyin_char, haiseyin_outfit`(**两个都要**)
**固定特征速查**:`long hair, dark purple hair, blue-violet gradient hair, purple eyes, hair ornament, blue ribbon, purple ribbon, black lace sleeves, translucent sleeves, dark bodice, blue accents, white frilled skirt, patterned thighhighs, blue high heels`
**现成 prompt**:
- 肖像:`haiseyin_char, haiseyin_outfit, 1girl, solo, blue-violet gradient hair, purple eyes, translucent sleeves, white frilled skirt, upper body, front view, calm expression, simple background, masterpiece, best quality`
- 全身:`haiseyin_char, haiseyin_outfit, 1girl, solo, full body, floating, ocean, coral, jellyfish, masterpiece, best quality`
> 21 图训练(数据最多),还原通常最稳;两个触发词缺一不可。

### liuying(流萤 · 银发双马尾 · 机甲)
**触发词**:`liuying_char`
**固定特征速查**:`silver hair, grey hair, long hair, gradient eyes, blue eyes, pink eyes, hair ribbon, white headband, futuristic outfit, black jacket, white jacket, green skirt, short skirt, black thighhighs, white gloves, boots, teal accents`
**现成 prompt**:
- 肖像:`liuying_char, 1girl, solo, silver hair, gradient eyes, white headband, futuristic outfit, green skirt, upper body, front view, determined expression, hand on chest, simple background, masterpiece, best quality`
- 战斗全身:`liuying_char, 1girl, solo, silver hair, futuristic outfit, full body, action pose, mechanical weapon, mecha, fire, complex background, masterpiece, best quality`
> 机甲/武器/火焰(`mechanical weapon, mecha, fire`)是可选战斗元素,日常出图可去掉。

### robin(知更鸟 · 光环羽耳 · 歌姬)
**触发词**:`robin_char`
**固定特征速查**:`pale purple hair, blue hair, long wavy hair, green eyes, halo, feather hair ornament, wing ears, purple dress, white dress, asymmetrical dress, fur trim, white fur shawl, bare shoulders, choker, gold ornament, star ornament, high heels`
**现成 prompt**:
- 肖像:`robin_char, 1girl, solo, pale purple hair, blue hair, green eyes, halo, wing ears, asymmetrical dress, white fur shawl, upper body, singing, reaching, simple background, masterpiece, best quality`
- 舞台全身:`robin_char, 1girl, solo, pale purple hair, halo, wing ears, purple dress, full body, stage, gramophone horn, bird, masterpiece, best quality`
> `halo` + `wing ears` 是辨识度关键,必带。

### tingyun(停云 · 狐耳多尾 · ⚠️两套衣服切换)
**触发词**:`tingyun_char` + 衣服词(下面二选一)
**公共特征**:`fox ears, brown hair, long hair, red streaked hair, green eyes, hair ornament, red ribbon`

**🅰 浮玄套装** `tingyun_fugue_outfit`(多尾礼服),追加:`fox tail, multiple tails, black dress, red trim, gold trim, wide sleeves, detached sleeves, layered skirt, high heels`
`tingyun_char, tingyun_fugue_outfit, 1girl, fox ears, multiple tails, brown hair, red streaked hair, green eyes, black dress, gold trim, full body, floating, lotus, water, looking at viewer, masterpiece, best quality`

**🅱 默认套装** `tingyun_default_outfit`(折扇和服),追加:`folding fan, ornate dress, red dress, brown dress, white sleeves, bare shoulders`
`tingyun_char, tingyun_default_outfit, 1girl, fox ears, brown hair, green eyes, folding fan, ornate dress, white sleeves, upper body, wink, cherry blossoms, looking at viewer, masterpiece, best quality`
> 切衣服只换 `tingyun_fugue_outfit` ↔ `tingyun_default_outfit` 这一个词;fugue 套才是多尾(`multiple tails`)。

### xiadie(翡蝶 · 蝴蝶元素 · 超长发)
**触发词**:`xiadie_char`
**固定特征速查**:`pale purple hair, very long hair, flowing hair, purple eyes, butterfly hair ornament, butterfly motif, purple dress, white dress, layered dress, asymmetrical dress, bare shoulders, high heels`
**现成 prompt**:
- 肖像:`xiadie_char, 1girl, solo, pale purple hair, very long hair, purple eyes, butterfly hair ornament, layered dress, bare shoulders, upper body, elegant, hand on chest, simple background, masterpiece, best quality`
- 回眸全身:`xiadie_char, 1girl, solo, full body, looking back, butterflies, crescent ornament, transparent background, masterpiece, best quality`
> `butterfly motif`(服饰纹样) ≠ `butterflies`(飞舞真蝶),可分别控制。

### xiaoba(小巴 · 猫咪吉祥物 · ⚠️非人形)
**触发词**:`xiaoba_char`
**固定特征速查**:`cat, mascot character, chibi, round body, white body, blue bow, hair bow, blue tail, black eyes, eye highlights, pink blush, simple face, paws`
**现成 prompt**:
- 标准:`xiaoba_char, solo, cat, mascot character, chibi, round body, white body, blue bow, blue tail, paws, sitting, front view, white background, masterpiece, best quality`
- 表情变体:`xiaoba_char, solo, cat, mascot character, chibi, happy, pink blush, simple background, masterpiece, best quality`
> ⚠️ 不要加 `1girl`,xiaoba 是猫吉祥物;`simple background`/`white background` 最还原训练集。

---

## 七、负面提示词模板(通用)

放进 `negative_prompt`,排除低质和崩坏:

```
lowres, bad anatomy, bad hands, bad feet, extra digits, fewer digits, missing fingers, mutated hands, deformed, disfigured, ugly, bad proportions, extra limbs, clone face, long neck, blurry, jpeg artifacts, watermark, text, signature, artist name, worst quality, low quality
```

> 想要更干净的画面可追加:`nsfw, gore, blood`(按需)。

---

## 八、推荐出图参数

| 参数 | 推荐值 | 说明 |
|---|---|---|
| **分辨率** | 1024×1024(方) / 832×1216(竖) / 1216×832(横) | SDXL 原生 1024 量级,横竖用接近 1M 像素的比例 |
| **steps** | 25 – 30 | 28 是性价比之选 |
| **guidance_scale (CFG)** | **5.0 – 7.0** | Animagine 推荐 5-7,太高会过饱和/崩 |
| **sampler** | Euler a / DPM++ 2M Karras | 都很稳 |
| **seed** | 固定一个(如 42) | 同 seed + 同 prompt = 可复现,方便对比调参 |

---

## 九、diffusers 加载代码(最小可用)

```python
import torch
from diffusers import StableDiffusionXLPipeline

BASE = "/path/to/animagine-xl-3.1"          # diffusers 目录版底模
LORA = "/path/to/feiying-v1-000014.safetensors"   # 或 ruanmei-v1-*.safetensors

pipe = StableDiffusionXLPipeline.from_pretrained(BASE, torch_dtype=torch.bfloat16).to("cuda")
pipe.load_lora_weights(LORA)

prompt = "feiying_char, 1girl, solo, pink hair, purple eyes, long animal ears, portrait, front view, smile, masterpiece, best quality"
neg   = "lowres, bad anatomy, bad hands, extra digits, deformed, blurry, watermark, text, worst quality, low quality"

g = torch.Generator("cuda").manual_seed(42)
img = pipe(
    prompt, negative_prompt=neg,
    num_inference_steps=28, guidance_scale=5.0,
    height=1024, width=1024, generator=g,
    cross_attention_kwargs={"scale": 1.0},    # ← LoRA 强度,调这里
).images[0]
img.save("out.png")
```

> ⚠️ 推理环境要 `pip install peft`(diffusers 加载 LoRA 的底层),且 `transformers<5`(避 5.x 重命名 CLIPTextModel 模块致 TE LoRA 注入失败)。

---

## 十、常见问题排查

| 现象 | 原因 / 解法 |
|---|---|
| **角色不像** | ① scale 提到 1.5;② 确认触发词在 prompt 首位;③ 显式写上发色/瞳色/服饰等固定特征标签 |
| **画面死板、训练集道具乱入(过拟合)** | scale 降到 0.6–0.8;或换更早的 epoch(如 ep12 代替 final) |
| **多余肢体/手崩** | 加强负面词(`extra digits, mutated hands, bad hands`);提高 steps 到 30 |
| **风格太"底模"、角色特征弱** | scale 提高;特征标签往前放 |
| **颜色/服饰飘** | 把关键特征标签重复一次(如 `pink hair, pink hair`),或提高其权重 `(pink hair:1.2)` |
| **换姿势就崩** | LoRA 对姿势泛化有限,多用动作标签训练时没见过的姿势会不稳;优先用训练集出现过的构图 |

---

## 附:换新角色时改什么

复用本手册,只改:
1. **触发词**(如新角色 `xxx_char`)→ prompt 首位 + 放进固定特征段
2. **固定特征段** → 从该角色训练 caption 里提取(发色/瞳色/服饰)
3. **LoRA 文件路径** → 指向新角色的 `.safetensors`

其余公式、参数、负面词模板通用。

---

*Animagine XL 3.1 偏好简洁的 Danbooru 标签 + 质量后缀,不要堆太长的自然语言描述。多试几个 seed,同一个 prompt 不同 seed效果差异很大。*
