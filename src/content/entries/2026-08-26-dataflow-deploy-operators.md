---
title: "DataFlow（北大 DCAI）部署与算子使用总结"
date: 2026-08-26
category: 技术
tags: [dataflow, 数据清洗, llm, 日记归档]
draft: false
---

> 2026-08-26 | 从零克隆 → 装环境 → 踩坑复原 → 跑通算子 → 算子全景页
> 同日还克隆了 NousResearch/hermes-agent 源码（注意：hermes 是 **Nous Research** 开源的，不是 Codex，因 CLI 基准赢过 Codex 出名；本机 Hermes CLI 早就在用，克隆纯属读源码）

---

## 一、现在有什么（资产清单）

| 资产 | 位置 | 状态 |
|---|---|---|
| 主库 open-dataflow 1.0.10 | `D:\DataFlow\.venv`（Python 3.11，uv 建） | ✅ 可用 |
| 算子全景 HTML 页（171个算子，可搜索） | `D:\DataFlow\demo\dataflow_operators.html` | ✅ 双击即看 |
| 无 LLM 清洗 demo | `D:\DataFlow\demo\demo_nollm.py` | ✅ 跑通 |
| 5 个 DataFlow 技能（AI 代写管线用） | `~\.claude\skills\{core_text, generating-dataflow-pipeline, ...}` | ✅ 已挂载 |
| 三份源码 | `D:\DataFlow`、`D:\DataFlow-WebUI`、`D:\hermes-agent`(241M) | ✅ 浅克隆 |
| WebUI 可视化界面 | `D:\DataFlow-WebUI\dataflow_webui\`（release v1.0.0） | ⏸ 差最后一步 |

## 二、★ 坑大全（按疼痛等级排序）

### ★★★ `dataflow webui` 必须先激活 venv，裸跑会污染全局 Python！
- 根因：`cli_webui.py` 内部用 `os.system("python -m pip install -r requirements.txt")`，`python` 从 PATH 解析。裸 cmd 里 = 系统 Python311
- **事故实录**：2026-08-26 裸跑一次 → 全局被塞 ~80 个包，torch 2.13.0+cpu 被降到 2.9.1、numpy 2.2.6→1.26.4 等 7 个包被换版本
- **复原方法**（已全部复原）：
  - `pip install "torch==2.13.0" --index-url https://download.pytorch.org/whl/cpu`（+cpu 版只在 PyTorch 官方 CPU 源，走 7890 代理）
  - 其余包普通 `pip install pkg==原版本`；全局 open-dataflow 直接卸载
  - 残留：~70 个纯新增依赖包（ray/spacy/whylogs 等）留在全局未清理，乱卸可能误伤原有包，先不动
- **正确启动姿势**：
  ```cmd
  cd D:\DataFlow
  D:\DataFlow\.venv\Scripts\activate
  dataflow webui
  ```
  （交互提示一律直接回车；输入 y 会被当成目录名！）

### ★★ WebUI release v1.0.0 依赖清单漏包（发布质量问题）
- 缺 `fastapi-mcp` → 已补进 venv ✅
- 缺 `pkg_resources` → 需要 `pip install "setuptools<81"`（81+ 移除了 pkg_resources，老库 textstat 还在用）→ **未做，这就是最后一步**
- 补完后重跑：
  ```cmd
  dataflow webui --webui-path "D:\DataFlow-WebUI\dataflow_webui\releases\v1.0.0\DataFlow-WebUI-v1.0.0\backend"
  ```

### ★★ DataFlow-WebUI 仓库的 install.sh 在 Windows Git Bash 下是坏的
- 硬编码 `python3` → 撞上 Windows Store stub（静默 exit 49，`set -e` 下零报错退出）
- 后续 staging 检查在 Git Bash 也异常（"staged skill missing"）
- **绕过法**：直接跑生成器再手动复制技能（已这么做，5 个技能已就位）：
  ```bash
  python installers/generate_agent_assets.py --profile skills --agent claude --out <临时目录>
  cp -r <临时目录>/.claude/skills/* ~/.claude/skills/
  ```

### ★ 安装本身的小坑
- uv 自动选了 Python 3.13 → fasttext 无 wheel 编译炸 → **指定 `--python 3.11`**（官方测试 3.10/3.11/3.12）
- uv 建的 venv 没有 pip → `python -m ensurepip --upgrade` 补上（webui 流程需要）
- 周三克隆走镜像：`git clone https://gh-proxy.com/https://github.com/xxx.git`（现 7890 平日也开，可直连）

## 三、算子怎么用（精华版）

### 心智模型
```
input.jsonl（表格）→ [算子1]→[算子2]→[算子3] → cache/dataflow_cache_step_N.jsonl（每步留档可回溯）
```
每个算子 = Python 类：`__init__()` 收配置，`run(storage, input_key, output_key)` 读列→加工→写列/删行。

### 四大类（core_text 包 18 个 + 全库 171 个）
| 类 | 动词 | 代表 | 要 LLM |
|---|---|---|---|
| Generate 生成 | 造新内容 | PromptedGenerator | 要 |
| Filter 过滤 | 删行 | GeneralFilter | 可不要 |
| Refine 精炼 | 改列 | PandasOperator（纯规则）/ PromptedRefiner | 可不要 |
| Eval 评估 | 打分 | PromptedEvaluator | 要 |

领域包 14 个：general_text(43)、code(20)、reasoning(19)、text_sft(18)、text_pt(15)、text2sql(12)、knowledge_cleaning(8)、pdf2vqa(5)、agentic_rag(4)、conversations(4)、chemistry(2)、core_speech/vision(1)……全部见 HTML 页。

### 算子本质：类是壳，提示词是灵魂
- 规则型 = 纯 pandas/算法代码
- LLM 型 = 通用壳 + 提示词。提示词两个来源：
  1. 自己传：`PromptedGenerator(system_prompt="...")`（换 prompt = 换用途）
  2. 官方库：`dataflow\prompts\`（text2sql.py 9个、reasoning\math.py 9个、code.py 6个……全是写死的文本）
- serving 层与算子解耦，同一个算子随便换后端

### 接火山方舟（三处必填）
```python
from dataflow.serving import APILLMServing_request
llm = APILLMServing_request(
    api_url="https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    key_name_of_api_key="DF_API_KEY",   # 从这个环境变量读 key（set DF_API_KEY=xxx）
    model_name="doubao-seed-1.6",       # 默认 gpt-4o，用方舟必须改（ep-xxx 或模型名）
)
```

### 最小可跑示例（已验证）
见 `D:\DataFlow\demo\demo_nollm.py`：4 行脏数据 → PandasOperator（去重+剔短）→ 2 行，输出在 `cache/`。

## 四、以后怎么干活

1. **最省事**：直接跟 Claude 说需求（"把这批股评清洗成QA训练数据"），管线技能已挂载，会代写代跑
2. **看算子**：双击 `D:\DataFlow\demo\dataflow_operators.html`（搜索/分类/分包）
3. **读源码**：算子 `dataflow\operators\<包>\<类别>\*.py`；提示词 `dataflow\prompts\`
4. **起可视化**：先激活 venv 再 `dataflow webui`（坑见上文）

## 五、遗留事项

- [ ] WebUI 最后一步：`pip install "setuptools<81"` + `--webui-path` 重跑（或等官方修包）
- [ ] demo_llm.py（接方舟的生成 demo）还没写——key 用 `DF_API_KEY` 环境变量
- [ ] 全局 Python311 里 ~70 个 dataflow 残留依赖包未清理（不碍事，占磁盘）
- [ ] 官方 6 条成品管线（文本/推理/Text2SQL/知识库清洗/AgenticRAG/PDF2VQA）还没实战过
