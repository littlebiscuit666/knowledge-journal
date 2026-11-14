---
title: "Qwen2.5-0.5B LoRA 实践成功总结（AutoDL 4080S）"
date: 2026-06-21
category: 技术
tags: [lora, qwen, autodl, 日记归档]
draft: false
---

## 1. 环境与模型

- 机器: NVIDIA GeForce RTX 4080 SUPER (1 张)
- Python: conda 环境下 Python 3.10
- 基座模型目录: /root/models/Qwen2.5-0.5B-Instruct
- LoRA 输出目录: /root/lora_output/qwen2.5-0.5b-lora

## 2. 关键安装命令

先安装聊天和推理常用依赖:

```bash
pip install -q addict accelerate sentencepiece
pip install -q "transformers==4.41.2"
```

安装 LoRA 训练依赖:

```bash
pip install -q "peft==0.11.1" "datasets==2.20.0" "trl==0.9.6" "bitsandbytes==0.43.1"
```

检查依赖是否就绪:

```bash
python - <<'PY'
import importlib.util
mods=['torch','transformers','peft','datasets','trl','accelerate','bitsandbytes']
for m in mods:
    print(f"{m}:", 'OK' if importlib.util.find_spec(m) else 'MISSING')
PY
```

## 3. 模型下载与验证命令

下载模型:

```bash
modelscope download --model Qwen/Qwen2.5-0.5B-Instruct --local_dir ./models/Qwen2.5-0.5B-Instruct
```

验证关键文件:

```bash
ls -lah /root/models/Qwen2.5-0.5B-Instruct
du -sh /root/models/Qwen2.5-0.5B-Instruct
find /root/models/Qwen2.5-0.5B-Instruct -maxdepth 2 -type f | grep -E "model\.safetensors|config\.json|tokenizer\.json"
```

## 4. 数据格式 (JSONL)

训练文件: /root/lora_data/train.jsonl

每行一条 JSON，字段建议为:

- instruction
- input
- output

示例:

```json
{"instruction":"你是谁？","input":"","output":"我是一个用于演示 LoRA 微调流程的助手。"}
{"instruction":"把下面句子翻译成英文","input":"今天天气很好。","output":"The weather is very nice today."}
{"instruction":"写一个简短标题","input":"一款便携、续航长、适合学生的学习平板","output":"学生党高续航学习平板"}
```

## 5. 训练脚本说明 (lora_train.py)

脚本路径: /root/lora_train.py

核心做法:

1. 读取 JSONL 数据并格式化为 Qwen 对话模板文本。
2. 用 AutoModelForCausalLM 加载基座模型。
3. 通过 PEFT 的 LoraConfig 注入 LoRA 层。
4. 使用 TRL 的 SFTTrainer 完成监督微调。
5. 保存 adapter 到输出目录。

关键 LoRA 配置:

- r: 16
- lora_alpha: 32
- lora_dropout: 0.05
- target_modules: q_proj, k_proj, v_proj, o_proj, up_proj, down_proj, gate_proj

## 6. 成功训练命令

你本次跑通的是非 4bit 路径 (最稳):

```bash
python /root/lora_train.py \
  --model-dir /root/models/Qwen2.5-0.5B-Instruct \
  --train-file /root/lora_data/train.jsonl \
  --output-dir /root/lora_output/qwen2.5-0.5b-lora \
  --num-train-epochs 3 \
  --per-device-train-batch-size 2 \
  --gradient-accumulation-steps 8 \
  --max-seq-length 512 \
  --no-use-4bit
```

本次结果要点:

- train_loss: 1.2009
- epoch: 3.0
- 训练完成并保存成功

## 7. 对话验证命令

LoRA 推理脚本路径: /root/lora_chat.py

运行:

```bash
python /root/lora_chat.py \
  --base-model-dir /root/models/Qwen2.5-0.5B-Instruct \
  --adapter-dir /root/lora_output/qwen2.5-0.5b-lora
```

## 8. 踩坑与解决经验

### 坑 1: transformers 版本过新导致 torch 被禁用

现象:

- 报错提示 PyTorch >= 2.4 required，但本机是 torch 2.1.2+cu118

解决:

- 固定 transformers 到 4.41.2

### 坑 2: 4bit bitsandbytes 加载时报 .to 不支持

现象:

- ValueError: .to is not supported for 4-bit or 8-bit bitsandbytes models

解决:

- 先使用 --no-use-4bit 路径跑通训练
- 脚本里增加了兼容逻辑，遇到该报错可自动回退普通 LoRA

### 坑 3: SFTTrainer 的 dataset_text_field warning

现象:

- 提示会覆盖 SFTConfig 中同名字段

结论:

- 警告而非错误，可正常训练

## 9. 推荐下一步

1. 先把 train.jsonl 扩充到 100-1000 条再训练，观察 loss 和效果变化。
2. 固定一组评测问题，分别测试基座模型和 LoRA 模型，做 A/B 对比。
3. 效果稳定后再尝试 4bit 路径优化显存占用和训练速度。
