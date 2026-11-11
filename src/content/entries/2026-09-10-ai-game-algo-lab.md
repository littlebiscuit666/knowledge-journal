---
title: "AI 游戏算法学习实验室：一天搭完六个模块"
date: 2026-09-10
category: 技术
tags: [游戏, 算法, 学习环境, 日记归档]
draft: false
---

> 日期：2026-09-10 ｜ 执行：ZCode
> 起因：看到咪咕互娱「AI 算法实习」JD（图像/音频检索、Agent 框架、多模态资产构建、PyTorch、算法工程化、C/C++），想系统学一遍这些算法在游戏里的应用
> 仓库：`D:\zcode-workspace\ai-game-lab\` ｜ 图片产物：`D:\zcode-workspace\images\2026-09-10\`
> 结论：**六个模块全部完成，每个都有讲义 + 可运行代码 + 本机实测数据** ✅

---

## 一、环境盘点与修复

| 项目 | 结果 |
|---|---|
| Python | 3.11.9（全局），torch 2.13、LangChain/LangGraph 1.x、open_clip、faiss、chromadb、whisper、librosa、gradio、fastapi 齐全 |
| GPU | Intel Arc 130T 16 GB，无 CUDA。发现 `Qwen3-TTS/.venv` 里 torch 是 `+xpu` 构建 → 把全局 torch 也换成 `+xpu`，**矩阵乘 fp32 快 6～7 倍、fp16 约 19 倍** |
| 云端 | 方舟 Agent Plan Small（**9/18 到期**）可用：`doubao-seed-2-1-turbo / 2-0-pro / 2-0-lite` 对话，`doubao-embedding-vision` 2048 维图文向量，`doubao-seedream-5-0-pro` 出图。SSO 又过期了，但 API Key 数据面正常 |
| 即梦 | 3.1 / 4.0 走 `~/volc_i2i/` 的 AK/SK 脚本，直接复用未改动 |
| 本地 | Ollama：llava、nomic-embed-text、chatmusician、qwen 系列 |

**环境改动 6 处**（均记录在开发文档第 3 节，附回滚命令）：transformers 4.40 → 5.6（原来 LLaMA-Factory 也是坏的，要求 ≥4.55）；torchvision 0.24 → 0.28（和 torch 2.13 配套）；torch/torchvision 换 `+xpu`；torchaudio 装回 2.11；新增 onnx；onnxruntime 1.18 → 1.29（NumPy 2 兼容）。

---

## 二、六个模块与关键实测

| 模块 | 做了什么 | 最重要的数字 / 结论 |
|---|---|---|
| **M2 图像检索**（JD 核心） | 68 张游戏资产库，CLIP@XPU / 方舟 embedding-vision / nomic 三条嵌入路线 + FAISS，评测 + Gradio | ark Recall@5 **0.98**；clip 翻译后 0.93、不翻译 **0.19**；nomic 两端统一英文后 0.39 → 0.97。**嵌入两端语言必须对齐** |
| **M5 Agent 框架**（JD 核心） | LangGraph 状态机：理解→检索→决策→即梦生成→质检→重试→**人工确认**→入库；另做 ReAct 对照 | 复用 7.3 s；生成+入库 80.8 s；同需求二次请求命中新资产 **12.6 s（闭环）**。ReAct 灵活但没给工具就不入库、不确认 |
| **M4 多模态生成** | seed/扩写参数实验、生产流水线（槽位模板 + 豆包/llava 双路质检）、即梦 4.0 角色一致性量化 | 同 seed 关扩写像素差 **0.00**；扩写会把「深色背景」改成白底；一致性 8 特征 × 4 场景 **100%**（肉眼复核）；llava 质检误判 |
| **M3 音频检索** | sfxr 式程序化合成 50 条音效 + Windows TTS 6 句台词；MFCC / CLAP / whisper 三路线 | 以音搜音 CLAP **1.00**、MFCC 0.81；以文搜音 CLAP 只有 **0.40**（合成音与真实录音的领域差，换提示词无效）；whisper 台词检索 1.00 |
| **M1 深度学习基础** | 即梦生成 60 张图标；训练循环、CNN 过拟合对照、CLIP 零样本/线性探针/少样本、从零实现 InfoNCE | 从头训 CNN 0.47；CLIP 零样本 **1.00**；每类 4 张线性探针 0.85；同架构换 InfoNCE 仍 0.40（**对比损失不是魔法，数据规模才是**）；冻结 ResNet18 + 对比投影后「没见过的说法」0.60 |
| **M6 工程化** | FastAPI 服务（缓存 / 批量 / 异步 Agent + 人工确认 API / metrics）、压测、ONNX 导出、评测报告、Streamlit | 缓存冷 580 → 热 3 ms；**锁粒度 bug 修两轮**：并发吞吐 1.8 → 8.4 req/s（ark）、0.5 → 2.7（clip）；批量 3.1×；onnxruntime 比 torch CPU 快 2.6× |

---

## 三、几个值得记住的教训

1. **零样本模型在分布外数据上静默失效**（M3 CLAP 0.40），唯一发现方式是有标签的评测集。
2. **加锁前先问"这段真的不能并发吗、锁里有没有慢 IO"**（M6），压测是唯一答案。
3. **不可逆操作（入库）前必须有人工闸门**（M5），Agent 设计原则。
4. **批量控风格时关掉即梦的提示词扩写**（M4），它会改写明确约束。
5. **打分器自己也要被测**：一致性 100% 太完美时要人工抽检 + 加负例（M4）。
6. **成本大头是出图**（今日 88 张占 95%），所以"检索优先、生成兜底"不只是快，还省钱。

---

## 四、踩坑记录（详见开发文档第 12 节，共 21 条）

- torch 2.13 ↔ torchvision 0.28 ↔ torchaudio 2.11 才配套；`+xpu` 构建同版本号直接换
- `HF_ENDPOINT=https://hf-mirror.com` 必须在 `import transformers` **之前**设，否则 CLAP 下载卡死
- transformers 5.x：CLAP `get_text_features` 返回对象，取 `.pooler_output`
- 方舟图片向量走 `/embeddings/multimodal`，`/embeddings` 只收字符串；模型名要带版本号；豆包默认开思考模式，`extra_body={"thinking":{"type":"disabled"}}` 省 80% 延迟
- whisper base 中文繁体 + 同音错字：`initial_prompt` 引导简体，错字要换 small
- `ollama list` 会挂起，用 `curl localhost:11434/api/tags`；grep 管道会缓冲后台日志
- PIL 默认字体无中文，拼图用 `msyh.ttc`

---

## 五、产物

**仓库** `D:\zcode-workspace\ai-game-lab\`
- `README.md` 路线图 + 环境清单 + 六模块状态
- `notes/` 六份讲义（原理 + 实验解读 + 各 10 道面试题 + 作业）
- `docs/开发文档.md` 14 节：全部命令、环境改动与回滚、每个函数的作用、踩坑
- `docs/评测报告.md` 全模块质量 / 性能 / 成本汇总（价格为占位假设）
- `common/` 方舟客户端（Key 从 `~/.arkcli/config.yaml` 读，不写死）、设备选择、即梦封装
- `module1–6/` 可运行代码 + 语料 + 索引 + 结果 JSON

**图片** `D:\zcode-workspace\images\2026-09-10\`：M2 图标 14 张 + 拼图、Agent 生成的闪电法杖 / 骷髅头盔、M4 参数实验 5 张 + 一致性 4 张 + 拼图、M1 数据集 60 张、M3 梅尔频谱图等，共 88 张出图 + 若干拼图

---

## 六、待办

- [ ] **9/18 前**决定方舟套餐是否续：到期后 ark 路线、豆包打标/质检/翻译失效；本地路线和即梦不受影响
- [ ] 按 README 顺序学：先读 M2、M5 讲义 + 跑 Gradio 和 Agent CLI，再 M4 → M3 → M1 → M6
- [ ] 各讲义末尾作业中最值得做的：M2 换 HNSW 看结果是否一致；M3 换 whisper small；M4 给一致性打分器加负例；M5 换 SqliteSaver 中途杀进程续跑；M6 给 lru_cache 加 TTL 并思考入库后缓存失效
- [ ] `eval_report.py` 的 `PRICE` 改成官方价目重跑
- [ ] （可选）`marker-pdf` / `spacy-huggingface-pipelines` 与 transformers 5 冲突，要用时单开 venv
