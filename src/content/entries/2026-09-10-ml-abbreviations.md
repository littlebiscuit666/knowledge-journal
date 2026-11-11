---
title: "机器学习英文缩写速查表"
date: 2026-09-10
category: 技术
tags: [机器学习, 速查, 日记归档]
draft: false
---

> 配套《2026-09-10_机器学习错题本与知识梳理.md》使用。
> 收录刷题和笔记中出现过的全部英文缩写：**缩写 → 全称 → 中文**，按类别组织。★ = 一词多义，面试先问清是哪个。新缩写随错题持续追加。

---

## 一、模型与算法

| 缩写 | 全称 | 中文 | 备注 |
|---|---|---|---|
| LR ★ | Logistic Regression | 逻辑回归 | ⚠️ 另义 Linear Regression 线性回归，看上下文 |
| SVM | Support Vector Machine | 支持向量机 | 最大间隔 |
| KNN | K-Nearest Neighbors | K 近邻 | |
| NB | Naive Bayes | 朴素贝叶斯 | 生成模型 |
| GMM | Gaussian Mixture Model | 高斯混合模型 | 生成模型 |
| GDA | Gaussian Discriminant Analysis | 高斯判别分析 | 生成模型 |
| HMM | Hidden Markov Model | 隐马尔可夫模型 | 生成模型 |
| CRF | Conditional Random Field | 条件随机场 | 判别模型 |
| RF | Random Forest | 随机森林 | Bagging 家族 |
| AdaBoost | Adaptive Boosting | 自适应提升 | Boosting 家族 |
| GBDT | Gradient Boosting Decision Tree | 梯度提升决策树 | Boosting 家族 |
| XGBoost | eXtreme Gradient Boosting | 极端梯度提升 | GBDT 工程强化版 |
| LightGBM | Light Gradient Boosting Machine | 轻量梯度提升机 | Boosting 家族 |
| ID3 | Iterative Dichotomiser 3 | 迭代二分器（第三代） | 信息增益 |
| C4.5 | —（非缩写，ID3 的继任版本号） | — | 信息增益率 |
| CART | Classification And Regression Trees | 分类与回归树 | 基尼，严格二叉 |
| iForest | Isolation Forest | 孤立森林 | 异常检测 |
| LOF | Local Outlier Factor | 局部离群因子 | 异常检测 |
| Apriori | —（非缩写，取"先验原理"之意） | 先验关联规则算法 | 数据挖掘，无监督 |
| SMOTE | Synthetic Minority Over-sampling Technique | 合成少数类过采样技术 | 类别不平衡处理 |
| MF | Matrix Factorization | 矩阵分解 | 推荐系统 |
| CF | Collaborative Filtering | 协同过滤 | 推荐系统 |
| FM | Factorization Machines | 因子分解机 | 推荐系统 |
| FFM | Field-aware Factorization Machines | 场感知因子分解机 | 推荐系统 |
| DIN | Deep Interest Network | 深度兴趣网络 | 深度推荐 |

## 二、深度学习组件

| 缩写 | 全称 | 中文 | 备注 |
|---|---|---|---|
| ReLU | Rectified Linear Unit | 修正线性单元 | 有 Dying ReLU 问题 |
| Leaky ReLU | Leaky Rectified Linear Unit | 渗漏修正线性单元 | 负区间小斜率 |
| PReLU | Parametric Rectified Linear Unit | 参数化修正线性单元 | 斜率可学习 |
| ELU | Exponential Linear Unit | 指数线性单元 | |
| GELU | Gaussian Error Linear Unit | 高斯误差线性单元 | Transformer 默认 |
| BN | Batch Normalization | 批归一化 | 命门 = batch 小 |
| LN | Layer Normalization | 层归一化 | RNN/Transformer 用 |
| IN | Instance Normalization | 实例归一化 | 风格迁移 |
| GN | Group Normalization | 组归一化 | 小 batch 场景 |
| MLP | Multi-Layer Perceptron | 多层感知机 | |
| CNN | Convolutional Neural Network | 卷积神经网络 | |
| RNN | Recurrent Neural Network | 循环神经网络 | |
| LSTM | Long Short-Term Memory | 长短期记忆网络 | RNN 改进 |
| VAE | Variational Auto-Encoder | 变分自编码器 | 深度生成模型 |
| GAN | Generative Adversarial Network | 生成对抗网络 | 深度生成模型 |

## 三、元学习与前沿

| 缩写 | 全称 | 中文 | 备注 |
|---|---|---|---|
| MAML | Model-Agnostic Meta-Learning | 模型无关元学习 | 优化式元学习：学好初始化 |
| NAS | Neural Architecture Search | 神经架构搜索 | One-Shot NAS 用超网络 |
| N-way K-shot | N-way（类别数）× K-shot（每类样本数） | 少样本任务标准设定 | 非缩写但常考 |

## 四、降维与文本特征

| 缩写 | 全称 | 中文 | 备注 |
|---|---|---|---|
| PCA | Principal Component Analysis | 主成分分析 | 线性·无监督 |
| SVD | Singular Value Decomposition | 奇异值分解 | |
| ICA | Independent Component Analysis | 独立成分分析 | |
| LDA ★ | Linear Discriminant Analysis | 线性判别分析 | 监督降维/分类 |
| LDA ★ | Latent Dirichlet Allocation | 隐狄利克雷分布 | 文本主题模型（生成式） |
| KPCA | Kernel Principal Component Analysis | 核主成分分析 | 非线性 |
| LLE | Locally Linear Embedding | 局部线性嵌入 | 流形学习 |
| t-SNE | t-distributed Stochastic Neighbor Embedding | t 分布随机邻域嵌入 | 可视化常用 |
| UMAP | Uniform Manifold Approximation and Projection | 一致流形逼近与投影 | 流形学习 |
| TF-IDF | Term Frequency - Inverse Document Frequency | 词频-逆文档频率 | 文本向量化 |

## 五、训练与评估

| 缩写 | 全称 | 中文 | 备注 |
|---|---|---|---|
| SGD | Stochastic Gradient Descent | 随机梯度下降 | |
| ALS | Alternating Least Squares | 交替最小二乘 | MF 的解法之一 |
| EM | Expectation-Maximization | 期望最大化 | GMM 的解法 |
| MSE | Mean Squared Error | 均方误差 | 回归损失/CART 回归准则 |
| CV ★ | Cross Validation | 交叉验证 | ML 语境 |
| CV ★ | Computer Vision | 计算机视觉 | 图像语境 |
| VC维 | Vapnik-Chervonenkis dimension | VC 维 | 模型复杂度度量 |
| CCP | Cost-Complexity Pruning | 代价复杂度剪枝 | CART 后剪枝 |
| IV | Intrinsic Value | 固有值（分裂信息） | C4.5 增益率的分母 |
| He 初始化 | Kaiming Initialization | 凯明初始化 | 何恺明提出，配 ReLU |
| RBF | Radial Basis Function | 径向基函数（核） | SVM 常用核，映射到无穷维 |
| TensorFlow | Tensor + Flow（非缩写） | 张量流 | TF1=静态图/session；TF2=eager 动态图 |
| SSE | Sum of Squared Errors | 误差平方和（残差平方和，同 RSS） | 线性回归 |
| SST | Total Sum of Squares | 总平方和 | R² = 1 − SSE/SST |
| OLS | Ordinary Least Squares | 普通最小二乘 | 线性回归的标准解法 |
| R² | Coefficient of Determination | 决定系数（统计符号，非缩写） | Adjusted R² = 调整 R²，可能更小 |

---

## 六、部署与工程（MLOps）

| 缩写 | 全称 | 中文 | 备注 |
|---|---|---|---|
| ONNX | Open Neural Network Exchange | 开放神经网络交换格式 | 跨框架模型交换格式 |
| EP | Execution Provider | 执行提供者 | ONNX Runtime 后端：CUDA/TensorRT/OpenVINO |
| TensorRT | —（NVIDIA 产品名，非缩写） | NVIDIA 推理加速器 | GPU 图优化推理 |
| OpenVINO | Open Visual Inference and Neural Network Optimization | 开源推理与神经网络优化工具包 | Intel 硬件推理 |
| MLOps | Machine Learning Operations | 机器学习工程/运维 | 版本控制 + CI/CD + 监控 |
| DVC | Data Version Control | 数据版本控制 | 数据集版本管理工具 |
| lakeFS | —（产品名，非缩写） | 数据湖版本管理 | Git 式语义管理对象存储 |

---

## 七、一词多义对照表（★ 汇总，面试先问清是哪个）

| 缩写 | 含义 A | 含义 B | 判别技巧 |
|---|---|---|---|
| LDA | Linear Discriminant Analysis 线性判别（监督降维/分类） | Latent Dirichlet Allocation 隐狄利克雷（主题模型，生成式） | 聊降维/分类 = 前者；聊文本主题 = 后者 |
| LR | Logistic Regression 逻辑回归（分类） | Linear Regression 线性回归（回归） | 聊分类/分类器 = 前者；聊回归任务 = 后者 |
| CV | Cross Validation 交叉验证 | Computer Vision 计算机视觉 | 表格数据/调参语境 = 前者；图像语境 = 后者 |

---

*复习时通读一遍约 5 分钟；后续新缩写随时追加进对应分类。*
