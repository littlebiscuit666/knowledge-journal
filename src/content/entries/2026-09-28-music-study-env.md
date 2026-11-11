---
title: "音乐学习环境：Librosa + RecBole + UVR5 + 音色转换"
date: 2026-09-28
category: 技术
tags: [librosa, recbole, 音频, 日记归档]
draft: false
---

> 一句话:在 `D:\music-study-tuijian` 搭了一条完整学习线——音频分析(Librosa)→ 推荐系统(RecBole)→ 人声/分轨分离(UVR5)→ 同旋律换乐器(fluidsynth)。全部装在 D 盘,共约 7.5GB。

---

## 总览:装了什么、在哪

| 模块 | 路径 | 大小 | 用途 |
|------|------|------|------|
| 学习环境主目录 | `D:\music-study-tuijian\` | — | 所有东西都在这 |
| Python venv | `D:\music-study-tuijian\.venv\` | 1.5G | Python 3.11.9 |
| UVR5 人声分离 | `D:\music-study-tuijian\uvr5\UVR.exe` | 5.7G | Beta Roformer v5.6.1 + DirectML |
| FluidSynth 软波表 | `D:\music-study-tuijian\fluidsynth\bin\fluidsynth.exe` | 2.7M | MIDI 渲染成音频 |
| 音源 | `D:\music-study-tuijian\soundfonts\MS Basic.sf3` | 49M | GM 128 乐器,从 `D:\MuseScore\sound\` 拷的,零下载 |
| 使用手册 | `D:\music-study-tuijian\README.md` | — | 用法+踩坑全记录 |

下载量统计:全程实际只从外网下了 **RecBole 全家桶(约500MB,清华镜像)+ UVR 安装包(2.08GB,GitHub直连)+ FluidSynth(2.7MB)**,音源和 Demucs 模型都是本机现成资源复用。

---

## 1. Librosa + RecBole(Essentia 没装:Windows 无官方 wheel)

- **版本**:librosa 0.11.0 / recbole 1.2.1 / torch 2.14.0+cpu / numpy 1.26.4 / pandas 2.2.3
- **激活**:`source D:/music-study-tuijian/.venv/Scripts/activate`
- **三个兼容坑(重装必须重打,README 有现成命令)**:
  1. setuptools 降 <81(ray 2.6.3 要 pkg_resources,setuptools 81 起移除)
  2. numpy/pandas 锁 1.26.4/2.2.3(ray 2.6.3 用了 numpy 2 已删的 `np.bool8`)
  3. recbole 源码 11 处 `torch.load` 加 `weights_only=False`(torch 2.6 改默认值)
- **四个 demo(全部跑通验证)**:
  | 文件 | 内容 |
  |------|------|
  | `demo1_librosa_basics.py` | 合成 120BPM 音频→BPM/MFCC/Chroma/频谱图;可传自己 mp3 |
  | `demo2_recbole_basics.py` | ml-100k 训 BPR→手动出 Top-10(屏蔽已看+id还原 4 行是精髓) |
  | `demo3_own_music_dataset.py` | 造 2000 条试听 .inter→训 BPR→验证学会口味(pop党7/10命中) |
  | `demo4_instrument_swap.py` | 见第 3 节音色转换 |
- ml-100k 是 recbole **包内自带**(`.venv/Lib/site-packages/recbole/dataset_example/`),不联网

---

## 2. UVR5 人声分离(装 D 盘破解了"C盘强制")

- **版本**:Beta Roformer v5.6.1(2025-01-15 包,含 DirectML,支持 Arc 核显加速;注意 v5.6 是 2023 年的,我一开始看成 2026 发布,实际最近两年没正式新版)
- **安装**:安装器是 Inno Setup,用静默参数绕过 C 盘限制:
  ```
  UVR_1_15_25_22_30_BETA_full.exe /VERYSILENT /SUPPRESSMSGBOXES /NORESTART /DIR=D:\music-study-tuijian\uvr5
  ```
  官方说装副盘"可能不稳定",实测装完正常。2GB 安装包装完已删。
- **Roformer/MDX 引擎 = 二轨**(人声vs伴奏);多轨拆分用 **Demucs** 引擎
- **Demucs 模型手动移植(重点,以后照抄)**:
  - UVR 布局:`models\Demucs_Models\v3_v4_repo\` 放 `<uuid>.th` + `<模型名>.yaml` 成对文件
  - yaml 内容一行:`models: ['5c90dfd2']` ★用权重文件名的前 8 位(demucs LocalRepo 按 `-` 前半段索引)
  - **htdemucs_6s(6轨)没下载**——从 band-transcriber 的 torch 缓存直接移植:
    `C:\Users\yaya\.cache\torch\hub\checkpoints\5c90dfd2-34c22ccb.th`(55MB,和 UVR 官方 URL 逐字节同源)
  - 已用 demucs 库验证加载:BagOfModels,6 轨全出
  - 意外发现:**4 轨 htdemucs 安装器自带**(`955717e8-8726e21a.th` + `htdemucs.yaml` 就在 v3_v4_repo)
- **首次使用步骤**:开 UVR → Download Center 下 **MelBand Roformer**(人声最强,~几百MB)→ 处理设置确认 GPU Conversion 开(DirectML 走核显)
- 组合玩法:先 MelBand Roformer 扒人声 → 伴奏再丢 Demucs 拆 4/6 轨,两步质量全要

---

## 3. 音色转换:同一旋律换 128 种乐器(轻量路线)

- **原理**:音色转换 = 同一份音符(MIDI)+ 不同音源渲染。MIDI 只存音高/时机/力度,不含音色
- **素材现成**:band-transcriber 8/1 跑的产物 `D:\music\band-transcriber\bt-out\out\<声部>\<声部>.mid`(drums.mid 除外,通道10打击乐音色固定)
- **用法**:
  ```bash
  cd D:/music-study-tuijian
  .venv/Scripts/python.exe demo4_instrument_swap.py <旋律.mid>              # 8 种默认乐器
  .venv/Scripts/python.exe demo4_instrument_swap.py <旋律.mid> 小提琴,长笛  # 指定乐器
  ```
- **已生成成品**(当晚拿 vocals.mid 实测,263 秒旋律 × 8 乐器):
  `D:\music-study-tuijian\renders\vocals\` → piano/violin/cello/trumpet/flute/guitar/harmonica/accordion.wav(各44.7MB)
- **★fluidsynth 大坑**:`-F`(输出文件)是选项,必须放在 音源、MIDI 两个位置参数**之前**:
  ✅ `fluidsynth -ni -g 0.7 -F out.wav -r 44100 音源.sf3 输入.mid`
  ❌ 放后面 → 报 "illegal option" 且把 wav 路径误当输入文件;输出文件名用英文
- 加乐器:改 demo4 开头 `INSTRUMENTS` 字典,GM 编号 0-127
- 更真实的 AI 音色转换(保留滑音/颤音,如 AI 翻唱质感):DDSP(Magenta,轻)或 RVC(2-3GB),需要时再装

---

## 明天可以接着玩

1. UVR 里下 MelBand Roformer,跑一首真歌,听分离效果(记得开 GPU Conversion)
2. 分离出的伴奏/人声喂 `demo1` 提特征对比(鼓轨频谱质心明显高于贝斯轨,很直观)
3. `demo4` 换 bass.mid / guitar.mid 再渲染几批
4. 进阶:demo1 的 MFCC 聚类当"歌曲流派" + demo3 的 .inter = 内容+协同混合推荐

---

**关联项目**:band-transcriber(`D:\music\band-transcriber`,扒谱管线,和 UVR 共用 Demucs 引擎)| MuseScore(`D:\MuseScore`,音源来源)
**代理记录**:当晚 Clash(7890)没开,但 GitHub 直连下完了 2.08GB 安装包——GitHub release 不必默认走代理
