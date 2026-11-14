---
title: "Hadoop 环境配置与常用命令"
date: 2026-09-03
category: 技术
tags: [hadoop, bigdata, 速查, 日记归档]
draft: false
---

## 一、核心配置文件

### 1. hadoop-env.sh — 全局开关

```bash
# JAVA_HOME 必须设置
export JAVA_HOME=/path/to/jdk

# Hadoop 安装目录
export HADOOP_HOME=/path/to/hadoop
export HADOOP_CONF_DIR=$HADOOP_HOME/etc/hadoop
```

**影响：** 所有 JVM 进程（ResourceManager、NodeManager、AppMaster、Container）都需要 JAVA_HOME

---

### 2. core-site.xml — HDFS 入口地址

```xml
<configuration>
    <!-- NameNode 地址 -->
    <property>
        <name>fs.defaultFS</name>
        <value>hdfs://localhost:9000</value>
    </property>
    <!-- 临时目录 -->
    <property>
        <name>hadoop.tmp.dir</name>
        <value>/path/to/hadoop/tmp</value>
    </property>
</configuration>
```

**影响：** 用户提交任务时，系统知道 NameNode 在哪

---

### 3. hdfs-site.xml — HDFS 存储细节

```xml
<configuration>
    <!-- 副本数，单机设 1，集群设 3 -->
    <property>
        <name>dfs.replication</name>
        <value>1</value>
    </property>
    <!-- NameNode 数据目录 -->
    <property>
        <name>dfs.namenode.name.dir</name>
        <value>file:///path/to/hadoop/data/namenode</value>
    </property>
    <!-- DataNode 数据目录 -->
    <property>
        <name>dfs.datanode.data.dir</name>
        <value>file:///path/to/hadoop/data/datanode</value>
    </property>
</configuration>
```

**影响：** Map Task 从 DataNode 读数据时，数据存几份、存在哪

---

### 4. mapred-site.xml — MapReduce 计算框架

```xml
<configuration>
    <!-- MapReduce 运行在 YARN 上 -->
    <property>
        <name>mapreduce.framework.name</name>
        <value>yarn</value>
    </property>
</configuration>
```

**影响：** AppMaster 启动后，知道要去 YARN 找 ResourceManager 要资源

---

### 5. yarn-site.xml — YARN 资源调度

```xml
<configuration>
    <!-- NodeManager 辅助服务 -->
    <property>
        <name>yarn.nodemanager.aux-services</name>
        <value>mapreduce_shuffle</value>
    </property>
    <!-- ResourceManager 地址 -->
    <property>
        <name>yarn.resourcemanager.hostname</name>
        <value>localhost</value>
    </property>
</configuration>
```

**影响：** ResourceManager 知道自己在哪，NodeManager 知道怎么跟 ResourceManager 通信

---

### 6. 环境变量（~/.bashrc 或 ~/.bash_profile）

```bash
export JAVA_HOME=/path/to/jdk
export HADOOP_HOME=/path/to/hadoop
export PATH=$PATH:$HADOOP_HOME/bin:$HADOOP_HOME/sbin
```

---

## 二、配置文件与组件对应关系

```
hadoop-env.sh     →  全局（JAVA_HOME）
core-site.xml     →  HDFS（NameNode 地址）
hdfs-site.xml     →  HDFS（副本数、数据目录）
mapred-site.xml   →  MapReduce（计算框架用 yarn）
yarn-site.xml     →  YARN（ResourceManager 地址）
```

| 场景 | 需要改哪些文件 |
|------|--------------|
| 只跑 HDFS | hadoop-env.sh + core-site.xml + hdfs-site.xml |
| 只跑本地 MapReduce | hadoop-env.sh + mapred-site.xml（设为 local） |
| 完整伪分布式 | 全部 5 个文件 |

---

## 三、HDFS 常用命令

```bash
# 创建目录
hadoop fs -mkdir /user/data

# 上传文件
hadoop fs -put localfile.txt /user/data/

# 下载文件
hadoop fs -get /user/data/localfile.txt ./

# 查看文件内容
hadoop fs -cat /user/data/localfile.txt

# 列出目录
hadoop fs -ls /user/data/

# 删除文件
hadoop fs -rm /user/data/localfile.txt

# 删除目录（递归）
hadoop fs -rm -r /user/data/

# 查看文件大小
hadoop fs -du -h /user/data/localfile.txt

# 复制文件
hadoop fs -cp /user/data/file1.txt /user/data/file2.txt

# 移动文件
hadoop fs -mv /user/data/file1.txt /user/data/archive/
```

---

## 四、HDFS 管理命令

```bash
# 格式化 NameNode（首次安装时执行一次，不可重复！）
hdfs namenode -format

# 启动 HDFS
start-dfs.sh

# 停止 HDFS
stop-dfs.sh

# 查看 HDFS 状态
hdfs dfsadmin -report

# 安全模式操作
hdfs dfsadmin -safemode enter    # 进入安全模式
hdfs dfsadmin -safemode leave    # 离开安全模式

# 检查文件系统
hdfs fsck / -files -blocks
```

---

## 五、YARN 常用命令

```bash
# 启动 YARN
start-yarn.sh

# 停止 YARN
stop-yarn.sh

# 查看 YARN 集群状态
yarn node -list         # 查看所有节点
yarn application -list  # 查看正在运行的任务

# 查看任务详情
yarn application -status <application_id>

# 杀掉任务
yarn application -kill <application_id>

# 查看日志
yarn logs -applicationId <application_id>
```

---

## 六、MapReduce 常用命令

```bash
# 运行 MapReduce 示例（词频统计）
hadoop jar $HADOOP_HOME/share/hadoop/mapreduce/hadoop-mapreduce-examples-*.jar wordcount /input /output

# 运行自定义 jar
hadoop jar myjob.jar com.example.MainClass /input /output

# 注意：输出目录必须不存在，否则报错
# 如果要重跑，先删除输出目录：
hadoop fs -rm -r /output
```

---

## 七、一键启停命令

```bash
# 启动所有（HDFS + YARN）
start-all.sh

# 停止所有
stop-all.sh

# 单独启动
start-dfs.sh       # 启动 HDFS（NameNode + DataNode）
start-yarn.sh      # 启动 YARN（ResourceManager + NodeManager）

# 单独停止
stop-dfs.sh
stop-yarn.sh
```

---

## 八、常用排查命令

```bash
# 查看进程是否启动
jps

# 预期输出（伪分布式）：
#   NameNode
#   DataNode
#   SecondaryNameNode
#   ResourceManager
#   NodeManager

# 查看日志
cat $HADOOP_HOME/logs/hadoop-*-namenode-*.log
cat $HADOOP_HOME/logs/hadoop-*-datanode-*.log
cat $HADOOP_HOME/logs/yarn-*-resourcemanager-*.log
cat $HADOOP_HOME/logs/yarn-*-nodemanager-*.log
```

---

## 九、MapReduce 执行流程

```
1. 用户提交任务 → core-site.xml 提供 NameNode 地址
2. ResourceManager 分配 Container 给 AppMaster → yarn-site.xml 提供 ResourceManager 地址
3. AppMaster 向 ResourceManager 申请资源 → mapred-site.xml 告诉 AppMaster 去哪找 ResourceManager
4. AppMaster 查 NameNode 拿数据位置 → hdfs-site.xml 提供数据存储信息
5. ResourceManager 把 Container 分配到数据所在节点
6. NodeManager 启动 Container，Map Task 读本地数据
7. Reduce Task 汇总结果，写回 HDFS
```
