---
title: "个人技术能力总结（简历底稿）"
date: 2026-08-23
category: 面试
tags: [面试, 简历, 日记归档]
draft: false
---

基于日常工作学习日记整理，用于简历撰写。

---

## 1. AI大模型部署与微调

- 在AutoDL云GPU服务器部署各类大模型（Qwen系列、SDXL等）
- 基于LoRA技术进行大模型/图像风格/角色微调，掌握完整闭环流程
- 使用vLLM/transformers进行大模型推理加速与服务部署
- 本地Intel XPU/GPU加速部署3D生成模型（Hunyuan3D-1/2）
- Qwen3 TTS语音合成本地推理方案，支持声音克隆和语音设计
- 能够独立解决训练过程中的常见问题：过拟合、架构不匹配、依赖冲突等
- 使用diffusers/kohya训练框架进行Stable Diffusion LoRA训练

## 2. AI生成内容（AIGC）

- Stable Diffusion/ComfyUI部署与文生图/图生图实战
- 角色LoRA训练与出图，掌握提示词工程和效果优化方法
- 火山引擎即梦绘图API调用与额度管理
- 熟练使用火山方舟arkcli工具链，支持模型推理、微调、部署全流程
- MiniMax mmx-cli使用，掌握文本、图像、视频、语音生成
- 完成古诗风格微调、漫画角色定制等多个特定领域AIGC项目落地

## 3. 后端开发

### Go语言REST API服务开发
- 纯Go标准库开发生产级REST API服务，仅依赖MySQL驱动，内存占用~20M
- 三层架构设计：main.go（骨架/配置/中间件）、handler.go（HTTP层）、store.go（数据层）
- 实现完整CRUD、分页搜索、API Key鉴权、优雅关闭等功能
- 本地开发 + 云服务器部署，git裸仓库实现push即部署，systemd守护进程化

### IoT数据流实时处理平台（个人项目）
- 从零设计实现物联网设备数据端到端实时处理链路
- **技术栈**：Kafka + Flink(Java) + MQTT + Docker Compose
- 多范式存储架构：同一份数据按查询模式分6库存储，各取所需
  - TDengine：时序数据存储，ClickHouse：OLAP分析，Redis：最新值缓存
  - Elasticsearch：日志搜索，MongoDB：原始报文，MySQL：元数据
- Java开发Flink实时计算作业：事件时间语义、水位线、窗口聚合、checkpoint容错
- 自研9个Python服务：设备模拟器、接入桥、多消费者并行消费
- Docker Compose容器编排，配置即代码，一键启停，10个容器全链路跑通
- 掌握分层问题排查方法论，独立解决第三方插件兼容性等疑难问题

## 4. 3D建模与设计

- Hunyuan3D-1/2本地XPU和云端部署，从图片生成3D白模GLB
- Blender MCP接入，掌握3D建模工具调用与工作流
- 文本/图片转3D模型全流程，支持Intel Arc GPU加速推理

## 5. 数据库与数据处理

- 掌握多种数据库：MySQL、Neo4j、MinIO、DuckDB、Redis、TDengine、ClickHouse、Elasticsearch、MongoDB
- Neo4j图数据库学习，Cypher查询与MySQL对比实践
- 数据湖基础实践：MinIO对象存储 + DuckDB数据分析
- 能够根据不同业务场景进行数据库选型
- Apache NiFi本地部署与可视化数据流开发
- LabelStudio视频标注，将数据集转换为YOLO训练格式

## 6. 工具与工作流搭建

- 各类开发工具私有化部署：WeKnora、Plane、Penpot、NiFi、LabelStudio等
- Hermes-Agent配置与使用，接入火山方舟模型
- Claude Code工具使用，掌握命令行AI辅助开发工作流
- yt-dlp音视频下载工具使用总结
- 编写自动化脚本，实现一键部署、训练、推理流程
- 强排错能力：能够独立解决各种网络、依赖、环境冲突问题

## 7. 服务器与运维

- AutoDL云GPU服务器使用，掌握文件管理、环境配置、SSH隧道端口转发
- 腾讯云/华为云服务器运维，能够独立部署VLESS+Reality+Cloudflare WARP代理服务
- Docker容器化部署，解决网络镜像、端口冲突等问题
- systemd服务配置，后端服务后台运行与监控
- 熟练掌握Linux命令行操作，shell脚本编写，环境变量配置

## 8. 知识图谱与知识库

- WeKnora本地Docker部署，构建个人知识库与Wiki
- 掌握Wiki生成与知识图谱（GraphRAG）原理与实践
- 导入文档生成知识库，能够排查API限流等问题
- Neo4j图数据库学习，实体关系建模与查询

## 9. AI视频制作

- 基于HyperFrames框架搭建AI日报视频自动化生产管线
- 实现带炫酷Shader转场、GSAP入场动画、底部实时字幕的专业视频
- 解决字幕时间轴对齐、排版、渲染问题，实现自动化字幕生成
- 使用MiniMax API生成语音、视频素材，掌握额度使用规则
- LabelStudio视频目标检测标注，转换为YOLO训练数据集
- ffmpeg视频处理与转码，掌握完整视频后期制作流程
