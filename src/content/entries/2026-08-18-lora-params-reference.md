---
title: "Qwen2.5-7B LoRA 微调可调参数大全"
date: 2026-08-18
category: 技术
tags: [lora, qwen, 微调, 日记归档]
draft: false
---

# Qwen2.5-7B LoRA 微调可调参数大全

我按 **6 大模块** 整理成表格，方便查阅。

---

## 一、模型加载参数

| 参数 | 推荐值 | 类型 | 说明 |
|------|--------|------|------|
| `torch_dtype` | `torch.bfloat16` | dtype | **⭐** 训练精度，bf16 最稳定 |
| `device_map` | `"cuda"` | str/dict | **⭐** 设备分配 |
| `attn_implementation` | `"flash_attention_2"` | str | **⭐** Attention 实现，速度与显存影响大 |
| `low_cpu_mem_usage` | `True` | bool | **⭐** 减少加载时 CPU 内存峰值 |
| `use_safetensors` | `True` | bool | 安全加载 |
| `trust_remote_code` | `False` | bool | 是否信任远程自定义代码 |
| `revision` | `"main"` | str | 模型版本（分支/tag/commit） |
| `load_in_4bit` | `False` | bool | 💡 QLoRA 用 |
| `load_in_8bit` | `False` | bool | 💡 8bit 加载 |
| `quantization_config` | `None` | BnbConfig | 💡 自定义量化配置 |
| `variant` | `None` | str | 加载特定精度版本 |

### `attn_implementation` 详细对比

| 取值 | 速度 | 显存 | 依赖 |
|------|------|------|------|
| `flash_attention_2` | 🟢 最快 | 🟢 最省 | 需安装 `flash-attn` |
| `sdpa` | 🟡 中等 | 🟡 中等 | PyTorch 2.0+ 内置 |
| `eager` | 🔴 最慢 | 🔴 最多 | 默认实现，调试用 |

---

## 二、Tokenizer 参数

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `use_fast` | `True` | **⭐** Rust 实现的快速 tokenizer |
| `padding_side` | `"right"` | **⭐** 训练用 right |
| `truncation_side` | `"right"` | 截断方向 |
| `model_max_length` | 训练时用 `max_length` | 最大长度限制 |
| `trust_remote_code` | `False` | 是否信任远程代码 |
| `revision` | `"main"` | 模型版本 |

---

## 三、LoRA 配置（`LoraConfig`）⭐⭐⭐

### 核心参数

| 参数 | 推荐值 | 取值范围 | 说明 |
|------|--------|---------|------|
| `r` | **32** | 4-128 | **⭐⭐** LoRA rank，越大表达越强 |
| `lora_alpha` | **64** | 1-256 | **⭐⭐** 缩放系数，建议 `alpha = 2r` |
| `lora_dropout` | **0.05** | 0-0.5 | **⭐** 防过拟合 |
| `bias` | `"none"` | 见下表 | bias 处理方式 |
| `task_type` | `"CAUSAL_LM"` | 任务类型 | **⭐** 当前任务类型 |
| `target_modules` | **全连接层 7 个** | 见下表 | **⭐⭐** 注入 LoRA 的层 |

### `r` 选择指南

| Rank | 7B 参数量 | 适用场景 |
|------|----------|---------|
| 8 | ~10M | 简单任务/小数据集/显存极紧 |
| 16 | ~20M | 常规任务 |
| **32** | **~40M** | **效果与效率甜点**（你选的） |
| 64 | ~80M | 复杂任务/显存充足 |
| 128 | ~160M | 接近全参数微调 |

### `bias` 选项

| 取值 | 含义 |
|------|------|
| `"none"` | 不训练 bias（默认推荐） |
| `"all"` | 训练所有 bias |
| `"lora_only"` | 只训练 LoRA 层内的 bias |

### `target_modules` 配置

| 写法 | 含义 | 参数量 |
|------|------|--------|
| `["q_proj", "v_proj"]` | 只训 Q/V | 最少 |
| `["q_proj", "k_proj", "v_proj", "o_proj"]` | 注意力层 | 中等 |
| `["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"]` | **全连接层** | 较多（你选的） |
| `"all-linear"` | **💡 所有 Linear 层**（推荐写法） | 最多 |

### 高级参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `init_lora_weights` | `True` | **⭐** 初始化方式：`True`/`"gaussian"`/`False`（继续训练时用）/`"loftq"` |
| `use_rslora` | `False` | 💡 Rank-Stabilized LoRA，缩放改为 `alpha/sqrt(r)` |
| `use_dora` | `False` | 💡 DoRA 变体，效果更好但慢 20% |
| `loftq_config` | `None` | 💡 与 4bit 量化配合的 LoftQ 初始化 |
| `layers_to_transform` | `None` | 💡 指定要 LoRA 的层（None=全部） |
| `layers_pattern` | `None` | 层名匹配模式 |
| `modules_to_save` | `None` | 💡 完全训练的层（耗显存，如 `embed_tokens`, `lm_head`） |
| `rank_pattern` | `{}` | 💡 不同层不同 rank |
| `alpha_pattern` | `{}` | 💡 不同层不同 alpha |

---

## 四、SFTConfig 训练参数 ⭐⭐⭐

### 🔹 输出与日志

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `output_dir` | `OUT` | **⭐** 模型保存路径 |
| `run_name` | `"libai-lora-v1"` | **⭐** 实验名（显示在进度条） |
| `overwrite_output_dir` | `False` | 是否覆盖已有输出 |
| `logging_dir` | `"./logs"` | tensorboard 日志目录 |
| `logging_steps` | **10** | **⭐** 每 N 步打印 loss |
| `log_level` | `"passive"` | 日志级别 |
| `disable_tqdm` | `False` | 是否禁用进度条 |
| `log_on_each_node` | `True` | 多机训练时每节点都打日志 |
| `report_to` | **`[]`** | **⭐** 上报工具：`[]`/`["wandb"]`/`["tensorboard"]`/`"all"` |

### 🔹 训练轮次与步数

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `num_train_epochs` | **3** | **⭐** 训练轮次 |
| `max_steps` | `-1` | **⭐** 最大步数（-1=用 epochs） |
| `per_device_train_batch_size` | **4** | **⭐** 每卡 batch |
| `per_device_eval_batch_size` | **4** | **⭐** 验证 batch |
| `gradient_accumulation_steps` | **4** | **⭐** 梯度累积（**等效 batch=16**） |
| `auto_find_batch_size` | `False` | 💡 自动找最大 batch |

### 🔹 学习率与优化器 ⭐⭐

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `learning_rate` | **1e-4** | **⭐⭐** 最关键参数 |
| `lr_scheduler_type` | **`"cosine"`** | **⭐** 调度器（见下表） |
| `warmup_ratio` | **0.03** | **⭐** 预热比例 |
| `warmup_steps` | `0` | 固定预热步数（与 warmup_ratio 二选一） |
| `min_lr_ratio` | `0.0` | 💡 最低学习率比例 |
| `weight_decay` | **0.0** | **⭐** L2 正则 |
| `adam_beta1` | `0.9` | Adam 参数 |
| `adam_beta2` | `0.999` | Adam 参数 |
| `adam_epsilon` | `1e-8` | Adam 参数 |
| `max_grad_norm` | **1.0** | **⭐** 梯度裁剪阈值 |
| `optim` | **`"adamw_torch"`** | **⭐** 优化器（见下表） |

#### `lr_scheduler_type` 选项

| 取值 | 特点 |
|------|------|
| `"cosine"` | **⭐ 余弦退火**，平滑下降，推荐 |
| `"cosine_with_restarts"` | 💡 余弦重启，多次重启 |
| `"linear"` | 线性衰减 |
| `"constant"` | 恒定学习率 |
| `"constant_with_warmup"` | 预热后恒定 |
| `"polynomial"` | 多项式 |
| `"inverse_sqrt"` | 倒数平方根 |

#### `optim` 选项

| 取值 | 显存 | 速度 | 说明 |
|------|------|------|------|
| `"adamw_torch"` | 中 | 中 | **⭐ 默认** |
| `"adamw_torch_fused"` | 中 | 🟢 快 | **💡 PyTorch 2.0+ 推荐** |
| `"paged_adamw_8bit"` | 🟢 省 | 中 | **💡 8bit Adam**，需 bitsandbytes |
| `"adafactor"` | 🟢 省 | 快 | 💡 显存更省，但可能略差 |
| `"sgd"` | 🔴 多 | 快 | 一般不用 |

#### 学习率速查表

| 场景 | 推荐 LR |
|------|---------|
| **LoRA 全连接层** | **1e-4 ~ 2e-4** |
| LoRA 仅 attention | 2e-4 ~ 5e-4 |
| QLoRA (4bit) | 1e-4 ~ 2e-4 |
| 全参数微调 | 1e-5 ~ 5e-5 |
| 继续微调 | 5e-5 ~ 1e-4 |

### 🔹 评估策略

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `eval_strategy` | **`"steps"`** | **⭐** `"no"`/`"steps"`/`"epoch"` |
| `eval_steps` | **100** | **⭐** 每 N 步评估（与 steps 策略配合） |
| `eval_delay` | `0` | 延迟开始评估的步数 |

### 🔹 保存策略

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `save_strategy` | **`"epoch"`** | **⭐** `"no"`/`"steps"`/`"epoch"` |
| `save_steps` | `500` | 每 N 步保存（与 steps 策略配合） |
| `save_total_limit` | **2** | **⭐** 最多保留几个 checkpoint |
| `save_safetensors` | `True` | **⭐** safetensors 格式 |
| `save_only_model` | `False` | 是否只保存模型 |

### 🔹 Checkpoint 恢复

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `resume_from_checkpoint` | `None` | **⭐** `True`（自动找最新）或指定路径 |
| `ignore_data_skip` | `False` | 恢复时是否跳过已处理数据 |

### 🔹 精度

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `bf16` | **True** | **⭐⭐** bf16 混合精度（推荐） |
| `fp16` | `False` | fp16（不太稳定） |
| `tf32` | `False` | 💡 Ampere GPU 可启用加速 |

### 🔹 显存优化

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `gradient_checkpointing` | **True** | **⭐⭐** 梯度检查点 |
| `gradient_checkpointing_kwargs` | `{"use_reentrant": False}` | 💡 PyTorch 2 推荐 |

### 🔹 数据处理

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `max_length` | **1024** | **⭐** 最大序列长度 |
| `packing` | **`False`** | **⭐** 是否打包 |
| `padding_free` | `False` | 💡 不 pad 的打包方式 |
| `dataset_text_field` | `"text"` | 纯文本数据字段名 |

#### `packing` 对比

| 取值 | 速度 | 显存 | 适用场景 |
|------|------|------|---------|
| `False` | 慢 | 多 | **⭐ 默认**，每个样本独立 padding |
| `True` | 🟢 快 3-5x | 🟢 省 | 短文本任务，推荐开启 |

### 🔹 数据采样

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `seed` | **42** | **⭐** 随机种子 |
| `data_seed` | `42` | 数据采样种子 |
| `shuffle` | **True** | **⭐** 是否打乱 |
| `dataloader_num_workers` | **2** | **⭐** 数据加载 worker 数 |
| `dataloader_pin_memory` | **True** | **⭐** 锁页内存（GPU 训练推荐） |
| `dataloader_drop_last` | `False` | 丢掉最后一个不完整 batch |
| `dataloader_persistent_workers` | `False` | worker 持续化 |

### 🔹 SFT 特有

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `completion_only_loss` | **True** | **⭐⭐⭐** 只对 completion 算 loss |
| `assistant_only_loss` | `False` | 💡 仅对 assistant 部分算 loss（chat 模板） |
| `neftune_noise_alpha` | `None` | 💡 NEFTune 加噪声提升效果 |

### 🔹 多机多卡

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `local_rank` | `-1` | 分布式 rank（自动设置） |
| `ddp_backend` | `"nccl"` | 分布式后端 |
| `ddp_find_unused_parameters` | `False` | DDP 找未用参数 |
| `deepspeed` | `None` | 💡 DeepSpeed 配置路径 |
| `fsdp` | `""` | FSDP 配置 |
| `fsdp_config` | `None` | FSDP 配置详情 |

### 🔹 上传 Hub

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `push_to_hub` | `False` | 上传 HuggingFace |
| `hub_model_id` | `None` | HF 模型 ID |
| `hub_token` | `None` | HF token |

---

## 五、SFTTrainer 参数

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| `model` | `model` | **⭐** 模型 |
| `args` | `cfg` | **⭐** 训练配置 |
| `train_dataset` | `train_ds` | **⭐** 训练集 |
| `eval_dataset` | `val_ds` | **⭐** 验证集 |
| `peft_config` | `peft_cfg` | **⭐** LoRA 配置 |
| `tokenizer` / `processing_class` | `tok` | **⭐** TRL 新版用 `processing_class` |
| `data_collator` | `None` | **⭐** 默认自动选 |
| `callbacks` | `[]` | 自定义回调，如 `EarlyStoppingCallback` |
| `compute_metrics` | `None` | 自定义评估指标 |

---

## 六、训练流程补充

| 方法 | 说明 |
|------|------|
| `trainer.train()` | 开始训练 |
| `trainer.train(resume_from_checkpoint=True)` | 从 checkpoint 恢复 |
| `trainer.evaluate()` | 手动触发评估 |
| `trainer.save_model(OUT)` | **⭐** 保存 LoRA adapter |
| `tok.save_pretrained(OUT)` | **⭐** 保存 tokenizer |
| `trainer.save_state()` | 保存训练状态（优化器、调度器） |
| `trainer.log()` | 记录最终指标 |
| `trainer.can_return_loss = True` | 是否返回 loss |

---

## 七、⭐ 推荐配置速查表（7B + 32G）

```python
MODEL_KWARGS = {
    "torch_dtype": torch.bfloat16,
    "device_map": "cuda",
    "attn_implementation": "flash_attention_2",
    "low_cpu_mem_usage": True,
}

LORA_CFG = {
    "r": 32, "lora_alpha": 64, "lora_dropout": 0.05,
    "bias": "none", "task_type": "CAUSAL_LM",
    "target_modules": "all-linear",
}

SFT_CFG = {
    # 输出
    "output_dir": OUT, "run_name": "libai-lora-v1",
    "logging_steps": 10, "report_to": [],
    # 轮次
    "num_train_epochs": 3,
    "per_device_train_batch_size": 2,
    "gradient_accumulation_steps": 8,           # 等效 batch = 16
    # 学习率
    "learning_rate": 1e-4, "lr_scheduler_type": "cosine",
    "warmup_ratio": 0.03, "weight_decay": 0.0,
    "max_grad_norm": 1.0, "optim": "adamw_torch_fused",
    # 评估保存
    "eval_strategy": "steps", "eval_steps": 100,
    "save_strategy": "epoch", "save_total_limit": 2,
    # 精度
    "bf16": True,
    # 显存
    "gradient_checkpointing": True,
    "gradient_checkpointing_kwargs": {"use_reentrant": False},
    # 数据
    "max_length": 1024, "packing": False,
    "seed": 42, "dataloader_num_workers": 2,
}
```

---

## 八、场景化调参模板

### 🔹 显存不够 OOM

| 参数 | 调整 |
|------|------|
| `per_device_train_batch_size` | 4 → **1** |
| `gradient_accumulation_steps` | 4 → **16**（保持等效 batch） |
| `max_length` | 1024 → **512** |
| `optim` | `adamw_torch` → **`paged_adamw_8bit`** |
| `gradient_checkpointing` | True → **True（已开）** |
| `r` | 32 → **16 或 8** |

### 🔹 想提速

| 参数 | 调整 |
|------|------|
| `packing` | False → **True** |
| `dataloader_num_workers` | 2 → **4-8** |
| `optim` | `adamw_torch` → **`adamw_torch_fused`** |
| `attn_implementation` | `sdpa` → **`flash_attention_2`** |
| `gradient_checkpointing` | True → **False（显存够的话）** |

### 🔹 防过拟合

| 参数 | 调整 |
|------|------|
| `num_train_epochs` | 3 → **2** |
| `lora_dropout` | 0.05 → **0.1** |
| `weight_decay` | 0.0 → **0.01** |
| `learning_rate` | 1e-4 → **5e-5** |
| `eval_steps` | 100 → **50**（频繁观察） |
| 配合 `EarlyStoppingCallback` | `early_stopping_patience=3` |

### 🔹 只想快速跑通流程

| 参数 | 调整 |
|------|------|
| `max_steps` | -1 → **20** |
| `eval_steps` | 100 → **10** |
| `save_strategy` | `"epoch"` → **`"no"`** |
| `logging_steps` | 10 → **1** |

---

需要我针对**某个具体场景**给出**完整可运行配置**吗？比如显存紧张版本、追求最佳效果版本、调试专用版本等。
