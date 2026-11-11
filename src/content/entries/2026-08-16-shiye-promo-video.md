---
title: "拾野 SHIYE 宣传片制作记录"
date: 2026-08-16
category: 生活
tags: [宣传片, ai视频, 项目, 日记归档]
draft: false
---

> 制作日期：2026-08-16  
> 项目目录：`C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集`  
> 品牌定位：小批量、短保、自然发酵的东方发酵饮示范品牌

## 一、最终完成内容

本次围绕“拾野 SHIYE”完成了两支竖版宣传片，并逐步加入女性旁白、背景音乐、产品结尾卡、字幕和品牌角标。

### 1. 创始人版本（32 秒）

最终文件：

`C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\01_视频\shiye_founder_female_final_bgm_v4_branded.mp4`

主要特征：

- 1080×1920，9:16 竖屏，30fps
- 女性创始人第一人称旁白
- Suno BGM，经过人声侧链避让
- 第 28 秒切换到产品结尾卡
- 左上角透明品牌组合标识，在结尾卡前淡出
- 原旁白没有变速、变调或裁切

### 2. 新版产品宣传片（34.7 秒）

当前推荐文件：

`C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\01_视频\shiye_new_promo_subtitled_brandname_masked.mp4`

无字幕基础版本：

`C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\01_视频\shiye_new_promo_generated.mp4`

主要特征：

- 1080×1920，9:16 竖屏，30fps
- 9 个镜头，单镜头约 4.3 秒
- 缓慢推拉（Ken Burns）和 0.5 秒淡化转场
- 新版连续女性旁白，原速 31.52 秒
- Suno BGM，较高存在感并自动避让人声
- 小号米白字幕位于屏幕底部
- 左上角透明“徽标＋拾野＋SHIYE”品牌组合标识
- 结尾使用产品定版图

## 二、旁白制作

### 使用方案

- 项目：`D:\Python_workspace_311\自主学习2\Qwen3-TTS`
- 模型：`Qwen3-TTS-12Hz-1.7B-CustomVoice`
- 设备：Intel Arc 130T，PyTorch XPU
- 音色：`Serena`
- 语言：`Chinese`
- 推理：`device_map="xpu"`、`dtype=torch.bfloat16`、`attn_implementation="sdpa"`
- 建议采样参数：`temperature=0.85`、`top_p=0.95`、`max_new_tokens=1024`

情绪指令：

> 自然、克制、温暖的成年女性品牌旁白。语速平稳、清晰、连贯，停顿短而自然，不要广告播音腔；像创始人在安静讲述产品，语气真诚、有生活感，结尾轻声坚定。

### 创始人版本文案

> 三年前，我离开城市，回到山里。做了十年研发，见过几百种配方，我却越来越相信，真正好的味道，不该靠复杂的添加来完成。于是，我把糙米、葛根和紫苏交给时间，让它们慢慢发酵，安静地变成一瓶还活着的饮品。拾野，用时间代替防腐剂。

音频文件：

`C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\01_视频\shiye_founder_female_voice_v2.mp3`

原始时长约 30.72 秒。整段一次生成，没有拆句拼接，也没有后期变速。

### 新版产品宣传片文案

> 山里的清晨，总是比城市慢一些。糙米沿着梯田成熟，紫苏在风里留下清香。我们把这些简单的原料交给陶缸，也交给时间。七百二十个小时，让每一次发酵自然呼吸。不靠复杂的添加，也不为更长的保质期牺牲鲜活。拾野，一瓶来自山野的东方发酵饮。用时间，代替防腐剂。

音频文件：

`C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\01_视频\shiye_new_promo_voice.wav`

原始时长约 31.52 秒，没有变速或变调。

## 三、BGM

原始 Suno 音乐：

`C:\Users\yaya\Downloads\Untitled.mp3`

参数：

- 原始时长约 59.81 秒
- 48kHz、立体声
- 平均音量约 −16 dB，峰值约 −1.1 dB

32 秒截取版：

`C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\01_视频\shiye_bgm_32s.mp3`

处理方式：

- 开头淡入 0.8 秒
- 结尾淡出 1.5 秒
- BGM 最终基础混音系数约 `0.565`
- 通过 sidechain compressor 在旁白出现时自动降低音乐
- 侧链参考参数：threshold `0.02`、ratio `8`、attack `20ms`、release `500ms`

## 四、新生成与使用的图片素材

### 新生成图片

1. 原料静物：糙米、葛根、紫苏

   `C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\02_图片\shiye_ingredients_generated.png`

2. 慢发酵陶缸

   `C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\02_图片\shiye_fermentation_generated.png`

3. 产品倒入陶杯

   `C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\02_图片\shiye_pour_generated.png`

4. 产品结尾卡

   `C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\02_图片\shiye_end_card_v1.png`

结尾卡文字：

> 拾野，用时间代替防腐剂

### 主要原始图片

- `shiye_rice_terraces_nowm.png`：梯田
- `shiye_perilla_fields_nowm.png`：紫苏田
- `shiye_farmer_hands_nowm.png`：农人双手
- `shiye_popup_store_nowm.png`：陶缸／快闪空间
- `shiye_founder_mountain_female_nowm.png`：女性创始人山间背影
- `shiye_bottle_amber_nowm.png`：琥珀色产品瓶

以上文件均位于：

`C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\02_图片`

## 五、字幕

字幕文件：

`C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\01_视频\shiye_new_promo_subtitles.srt`

最终样式：

- 字体：华文中宋（STZhongsong）
- 字号：13（ASS/FFmpeg 样式值）
- 字色：米白 `#F4F1E8`
- 深色描边：墨色 `#1C2B22`
- 底部居中，MarginV 约 32
- 轻微阴影，避免遮挡画面
- 结尾卡期间不重复显示字幕

## 六、品牌角标

原始品牌资源：

- `04_LOGO\拾野_logo_emblem.svg`
- `04_LOGO\拾野_logo_lockup.svg`
- `04_LOGO\拾野_logo_monochrome.svg`
- `04_LOGO\shiye_emblem_highres.png`

为视频构建的透明横版角标：

`C:\Users\yaya\Pictures\workbuddy-picture\拾野_成品合集\04_LOGO\shiye_logo_lockup_video.png`

角标内容：

- 左侧正式徽标
- 华文中宋艺术字“拾野”
- 拉开字距的“SHIYE”
- 小标语“俯身 · 拾起山野本味”

视频中处理：

- 放置于左上角，约 430px 宽
- 使用 PNG 透明蒙版，不使用显眼白底
- 增加轻柔暗色投影，适应复杂背景
- 在产品结尾卡出现前淡出

## 七、关键技术与经验

### 1. TTS

- 长文整段生成比逐句生成更连贯，声线与情绪更一致。
- 必须显式限制 `max_new_tokens`，否则异常停止条件可能导致生成长期不返回。
- XPU 运行需要沙箱外权限；模型加载后显存占用约 3.9GB。
- `flash-attn` 未安装不会阻止推理，XPU 使用 `sdpa`。
- SoX 缺失提示不影响 Qwen3-TTS 生成 WAV。

### 2. 音频

- 不应为了对齐画面直接改变语速或音调。
- 若必须调整时长，应优先改画面长度、停顿或文案；必要时使用保持音调的 Rubber Band／atempo。
- 混音时旁白要分成两路：一路作为侧链控制信号，一路进入最终混音，避免 FFmpeg 自动补入旧音轨。

### 3. 视频

- 静态图片使用缓慢 zoompan 可以获得稳定的纪录片式运动感。
- 转场保持在 0.5 秒左右，避免过度花哨。
- 产品结尾卡建议至少停留 3–4 秒。
- 视频左上角角标应使用透明蒙版和轻影，不宜使用大面积白色底板。

### 4. 画面逻辑

- 发酵液应表现为少量细小气泡，不能像煮沸。
- 倒杯镜头的倾斜标签不适合长时间展示，宜作为短动作镜头。
- 产品主体、标签、徽标及“拾野／SHIYE”字样需要重点校验。

## 八、品牌视觉速查

- 苔绿：`#2F5D4E`
- 陶土橙：`#C8743C`
- 米白：`#F4F1E8`
- 墨色：`#1C2B22`
- 主张：**用时间代替防腐剂**
- 品牌表达：自然、克制、温暖、真实、手作、反效率

## 九、后续可继续优化

- 对字幕时间点进行逐字听校，使字幕与旁白更加精确同步。
- 将重点静态镜头升级为 AI 图生视频，增加真实植物风动、液体流动和人物动作。
- 为短视频平台输出无字幕版、字幕版和 15 秒精简版。
- 增加真实环境音：风声、谷物摩擦、陶缸轻响、倒液声。
- 对新生成的倒杯镜头进行标签精修，确保倾斜状态下品牌文字仍完全准确。

