---
title: "Python 数据处理岗面试总结：pandas + MySQL"
date: 2026-09-28
category: 面试
tags: [pandas, mysql, 面试, 日记归档]
draft: false
---

日期：2026-09-28

---

# 第一部分 pandas / DataFrame 函数速查

## 一、读写 / 创建

| 函数/写法 | 作用 | 例子 |
|---|---|---|
| pd.read_csv('a.csv') | 读CSV（Excel用read_excel） | pd.read_csv('a.csv', chunksize=100000) |
| pd.DataFrame(dict) | 用字典建表 | pd.DataFrame({'name':['张三'],'age':[20]}) |
| pd.concat([df1,df2]) | 拼接多个表 | axis=0上下堆 / axis=1左右拼 |
| df.to_csv('out.csv') | 写出 | index=False 去掉行号 |
| df.to_excel('out.xlsx') | 写Excel | |

## 二、查看 / 摸底（数据清洗第一步必提）

| 函数 | 作用 | 看什么 |
|---|---|---|
| df.head(n) | 前n行（默认5） | 数据长啥样 |
| df.tail(n) | 后n行 | |
| df.shape | (行数, 列数) | 数据规模 |
| df.info() | 每列类型+非空数量 | 谁有缺失、类型对不对 |
| df.describe() | 计数/均值/标准差/min/四分位/max | 异常值、量纲 |
| df.dtypes | 各列数据类型 | |
| df.columns / df.index | 列名 / 行索引 | |
| df['age'].value_counts() | 每个值出现多少次 | 类别分布/找脏数据 |
| df['age'].unique() | 所有不同值 | |
| df['age'].nunique() | 不同值个数 | |
| df.isnull().sum() | 每列缺失多少（isna 同义） | |

## 三、选数据（高频考点：loc vs iloc）

| 写法 | 作用 | 例子 |
|---|---|---|
| df['name'] | 取一列 → Series | |
| df[['name','age']] | 取多列 → DataFrame | |
| df[df['age']>18] | 条件筛选（方包里放布尔Series） | |
| df[(df.age>18)&(df.city=='北京')] | 多条件：& 且、\| 或，条件必须加括号 | |
| df.loc[行,列] | 按标签/条件选（含右端） | df.loc[df.age>18,'name'] |
| df.iloc[行,列] | 按整数位置选（左闭右开） | df.iloc[0:3, 0:2] |
| df.at[行标签,列标签] | 定位单个值（快） | |
| df.iat[3,1] | 按整数位置取单个值 | |
| df.set_index('name') | 把某列设为行索引 | |
| df.reset_index(drop=True) | 索引还原成普通列 | drop=True 不保留旧索引 |

记忆：loc = Location 标签；iloc = integer 位置。

## 四、增删列 / 清洗

| 函数 | 作用 | 例子 |
|---|---|---|
| df['新列']=值/数组 | 新增一列 | df['year']=2026 |
| df.drop('col', axis=1) | 删列（axis=0删行） | df.drop(['a','b'], axis=1) |
| df.rename(columns={'旧':'新'}) | 改列名 | |
| df.drop_duplicates() | 去重 | |
| df.dropna() | 删缺失行 | |
| df.fillna(值) | 填缺失 | |
| df.replace('?', np.nan) | 值替换（可传字典批量） | |
| df['age'].astype(int) | 类型转换 | 字符串转数值 |
| pd.to_datetime(df['dt']) | 转时间类型 | |
| df['dt'].dt.year / .dt.month | 从时间取年/月（dt访问器） | |
| df['name'].str.strip() | 字符串方法（str访问器，去空格） | |
| df['name'].str.contains('北京') | 是否包含，返回布尔，常配筛选 | |
| df['name'].str.split(',') | 字符串切分 | |
| df.clip(lower, upper) | 截断（异常值盖帽） | |

## 五、处理函数 map / apply

| 函数 | 作用对象 | 作用 | 例子 |
|---|---|---|---|
| Series.map(字典或函数) | 一列 | 值映射/逐个处理 | df['sex'].map({'男':1,'女':0}) |
| Series.apply(函数) | 一列 | 同map，适合复杂函数 | |
| DataFrame.apply(函数, axis=0) | 整张表 | 按行或按列批量处理 | df.apply(lambda x: x.max()-x.min()) |
| df.map(函数)（旧版applymap） | 整张表 | 逐个元素处理 | df.map(lambda x: x*2) |
| np.where(条件, a, b) | 数组 | 向量化if-else（推荐，快） | np.where(df.age>18,'成年','未成年') |

重点：能用列向量化运算（df['a']+df['b']）或 np.where 就别用 apply，apply 本质是循环，慢。

## 六、排序 / 去重排名

| 函数 | 作用 |
|---|---|
| df.sort_values('age') | 按列排序；ascending=False 降序；多列传列表 |
| df.sort_index() | 按索引排序 |
| df['age'].rank() | 排名（method='min'并列 / 'dense'不跳号） |
| df.nlargest(n, 'age') | 最大前n行（nsmallest 最小） |
| df.sample(n=5) / frac=0.1 | 随机抽样（frac=比例） |

## 七、分组 / 合并 / 变形（数据岗核心）

| 函数 | 作用 |
|---|---|
| df.groupby('dept')['salary'].mean() | 分组聚合 |
| df.groupby('dept').agg({'salary':'sum','age':'mean'}) | 一次多种聚合（agg可传列表） |
| df.groupby(...).transform('mean') | 分组结果展回原行数（组内占比必用） |
| df.pivot_table(index,columns,values,aggfunc) | 数据透视（长表变宽） |
| df.melt(id_vars, value_vars) | 逆透视（宽表变长） |
| pd.merge(df1,df2,on='id',how='inner') | 按键关连（SQL join） |
| df1.join(df2) | 按索引关联 |
| pd.concat([df1,df2], axis=0) | axis=0上下堆叠 / axis=1左右拼 |

groupby 铁律：SELECT 里的列要么在 groupby 里，要么套聚合——和 SQL 完全一样。

## 八、统计计算

| 函数 | 作用 | 函数 | 作用 |
|---|---|---|---|
| df.mean() | 均值 | df.sum() | 求和 |
| df.median() | 中位数 | df.std() / df.var() | 标准差/方差 |
| df.min()/max() | 最小/最大 | df.count() | 非空个数 |
| df.corr() | 列间相关系数矩阵 | df.cov() | 协方差 |
| df['age'].quantile(0.25) | 分位数 | df.cumsum() | 累加 |
| df['age'].value_counts(normalize=True) | 各类占比 | | |
| df['age'].isin([1,2,3]) | 在不在清单里（等价SQL的IN） | | |
| df['age'].between(18,30) | 区间判断 | df.duplicated() | 是否重复 |

## 九、Series 专属（一维：带索引的一列）

s.index / s.values / s.name；s.value_counts()、s.unique()、s.map()、s.apply()、s.str.*、s.dt.*、s.describe()、s.sort_values()、s.clip()、s.fillna()、s.isnull()。

记忆：DataFrame 是表，取一列就是 Series。

## 十、必懂的"关键字"（函数参数，常被追问）

| 参数 | 用在哪 | 含义 |
|---|---|---|
| axis | drop/apply/concat等 | 0或'index'=沿行方向（对每列算）；1或'columns'=沿列方向（对每行算）。drop删列写 axis=1 |
| inplace | 几乎所有修改函数 | True=直接改原表返回None；False(默认)=返回新表。推荐 df=df.xxx() |
| how | merge / dropna | merge: inner/left/right/outer；dropna: 'any'任一缺就删 / 'all'全缺才删 |
| subset | drop_duplicates/dropna | 指定按哪些列判断 |
| keep | drop_duplicates | 'first'(默认)/'last'/False全删 |
| on / left_on / right_on | merge | 关联键；两边键名不同时用 left_on + right_on |
| ascending | sort_values | True升序(默认)/False降序，可传列表对应多列 |
| na_position | rank/sort | 缺失值放 'first' 还是 'last' |
| method | rank | 'average'(默认)/'min'(并列跳号)/'dense'(不跳号)/'first' |
| chunksize | read_csv | 分块读取行数，大文件装不进内存时用 |
| sep / encoding | read_csv | sep分隔符；encoding='gbk' 读中文CSV防乱码 |
| nrows | read_csv | 只读前n行，先看数据结构 |
| thresh | dropna | 至少有n个非空值才保留 |
| ignore_index | concat | True时拼完重新编号0,1,2... |

## pandas 记忆优先级

- 必会手写：read_csv、info/describe/isnull、布尔筛选、loc/iloc、fillna、drop_duplicates、groupby+agg、merge、sort_values、map
- 理解会说：axis、inplace、how、keep 四个参数
- 进阶加分：transform（组内计算）、chunksize（大文件）、pivot_table/melt

---

# 第二部分 MySQL 面试八股

## 一、主键 vs 唯一键

| | 主键 Primary Key | 唯一键 Unique Key |
|---|---|---|
| NULL | 不能 | 可以有一个 |
| 数量 | 每表1个 | 可以多个 |
| 索引类型 | 聚簇索引（叶子存整行） | 二级索引（叶子存主键，需回表） |
| 联合 | 可多列组成联合主键 | |

## 二、InnoDB vs MyISAM

| 特性 | InnoDB | MyISAM |
|---|---|---|
| 事务 | 支持 | 不支持 |
| 锁 | 行级锁 | 表锁 |
| 外键 | 支持 | 不支持 |
| 崩溃恢复 | 强 | 弱 |
| 版本 | 5.5起默认 | 5.5之前默认 |

现在基本都用 InnoDB。

## 三、索引

### B+树 vs B树
- B+树：数据只在叶子节点，叶子用链表相连，适合范围查询；非叶子节点不存数据，树更矮，IO更少
- B树：每个节点都存数据，不适合范围扫描

### 聚簇索引 vs 非聚簇索引
- 聚簇索引：叶子存整行数据，一张表只有一个（主键）
- 非聚簇索引（二级索引）：叶子存主键值 → 查到主键再回聚簇索引取整行 = 回表
- 覆盖索引：要查的列全在索引里，不用回表

### 联合索引与最左前缀
联合索引 (a,b,c)：

| 条件 | 是否命中 |
|---|---|
| a=1 AND b=2 AND c=3 | 全部命中 |
| a=1 AND b=2 | 命中 a,b |
| a=1 | 命中 a |
| b=2 | 失效（跳过a） |
| a=1 AND c=3 | 只命中a |

### 索引失效场景
1. 对索引列做函数：WHERE YEAR(create_time)=2024
2. 隐式类型转换：WHERE phone = 13800000000（phone是varchar）
3. LIKE 以 % 开头：WHERE name LIKE '%三'
4. 联合索引不走最左前缀
5. OR 连接非索引列

记忆：列名左边干干净净——函数(列) 改成 列=函数(值)。

### EXPLAIN
重点看：
- type：ALL(全表扫描) < index < range < ref < const
- key：实际用了哪个索引
- rows：预估扫描行数
- Extra：Using index(覆盖索引) / Using filesort(额外排序)

### DESCRIBE 的 Key 列
- PRI = 主键；UNI = 唯一索引；MUL = 普通索引（索引值允许重复）
- 看到 MUL 说明索引已存在，不是"不能加索引"
- int(11) 的 11 是显示宽度（已废弃），int 恒4字节约±21亿

## 四、事务

### ACID
- A 原子性：要么全做要么全不做
- C 一致性：事务前后数据一致
- I 隔离性：事务之间互不干扰
- D 持久性：提交后永久保存

### 手动事务
```sql
START TRANSACTION;
UPDATE account SET balance = balance - 100 WHERE name = 'A';
UPDATE account SET balance = balance + 100 WHERE name = 'B';
COMMIT;      -- 出错则 ROLLBACK;
```

## 五、隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 |
|---|---|---|---|
| READ UNCOMMITTED 读未提交 | 有 | 有 | 有 |
| READ COMMITTED 读已提交(RC) | 无 | 有 | 有 |
| REPEATABLE READ 可重复读(RR) | 无 | 无 | 有（InnoDB用MVCC+间隙锁基本解决） |
| SERIALIZABLE 串行化 | 无 | 无 | 无 |

InnoDB 默认：RR。

- 脏读：读到别人没提交的数据
- 不可重复读：同一行的值变了（别人UPDATE）
- 幻读：多出/少了行（别人INSERT/DELETE）
- RC vs RR：RC 每条SQL都看最新（直播）；RR 第一眼什么样后面都一样（拍照）

## 六、SQL 执行顺序（别名/HAVING 坑的根源）

```
FROM → WHERE → GROUP BY → SELECT → HAVING → ORDER BY
```

- WHERE 执行时别名还没产生 → WHERE 不能用列别名
- 聚合函数不能放 WHERE，只能放 HAVING
- HAVING 执行时别名已产生 → HAVING 可以用别名

## 七、高频查询写法

### 窗口函数：rank 三兄弟
```sql
row_number() over (partition by dept order by salary desc) -- 1,2,3,4 不并列
rank()       over (partition by dept order by salary desc) -- 1,2,2,4 并列跳号
dense_rank() over (partition by dept order by salary desc) -- 1,2,2,3 并列不跳号
```
每组Top1：外包一层 where rn = 1。

### 条件计数
```sql
SUM(CASE WHEN 条件 THEN 1 ELSE 0 END)
COUNT(col)   -- NULL不计入
COUNT(*)     -- 所有行都计入
```

### JOIN
- INNER JOIN：两边都匹配才留（90%场景）
- LEFT JOIN：左表全留，右表没匹配填NULL（找"没下单的用户"用 is null）
- CROSS JOIN：笛卡尔积，配合LEFT JOIN补齐"全组合"

### 日期/空值函数
```sql
DATE_SUB('2019-07-27', INTERVAL 30 DAY)      -- 往前30天
DATE_ADD('2019-07-27', INTERVAL 30 DAY)      -- 往后30天
DATEDIFF('2019-07-27','2019-06-27')          -- 相差30天（前减后）
COALESCE(NULL, NULL, 3, 5)                   -- 第一个非NULL：3
IFNULL(NULL, '默认值')                        -- 两个参数
```

### 子查询三种形状
- 标量子查询：返回1行1列（一个值），可放 SELECT 后
- 列子查询：返回一列多行，放 WHERE IN 后
- 表子查询：返回临时表，放 FROM 后（必须起别名）

### UNION
- UNION 去重；UNION ALL 不去重、更快
- 规则：列数相同、类型兼容，列名以第一个SELECT为准

## 八、DDL / DML / DCL / TCL

| 类别 | 作用 | 关键字 |
|---|---|---|
| DDL 管结构 | CREATE, ALTER, DROP, TRUNCATE |
| DML 管数据 | SELECT, INSERT, UPDATE, DELETE |
| DCL 管权限 | GRANT, REVOKE |
| TCL 管事务 | COMMIT, ROLLBACK, SAVEPOINT |

---

# 第三部分 scikit-learn 随机森林（附树规则解释）

## 一、最简单代码（10行核心）

```python
from sklearn.ensemble import RandomForestClassifier
from sklearn.datasets import load_iris

iris = load_iris()                          # 数据：4个特征，3种花

clf = RandomForestClassifier(n_estimators=3, max_depth=2, random_state=42)
clf.fit(iris.data, iris.target)             # 训练（一行）

print(clf.predict([[5.1, 3.5, 1.4, 0.2]]))  # 预测：[0]
print(clf.score(iris.data, iris.target))    # 准确率
```

关键参数：
- n_estimators：森林里有几棵树（实际常用100）
- max_depth：每棵树最大深度，防过拟合
- random_state：固定随机种子，结果可复现

## 二、导出树规则的语法（核心：export_text）

```python
from sklearn.tree import export_text

for i, tree in enumerate(clf.estimators_):       # estimators_ 是所有树的列表
    print(f"===== 第{i}棵树 =====")
    print(export_text(tree, feature_names=list(iris.feature_names)))
```

- clf.estimators_：森林里每一棵单独的决策树，按它遍历
- export_text(某棵树, feature_names=特征名列表)：打印成文字规则
- 不加 feature_names 显示 X[0]/X[1]，加了才显示真实特征名

## 三、真实输出的规则怎么读

```
|--- petal width (cm) <= 0.70
|   |--- class: 0.0          ← 花瓣宽≤0.7 → 类别0
|--- petal width (cm) >  0.70
|   |--- petal width (cm) <= 1.55
|   |   |--- class: 1.0      ← 0.7<宽≤1.55 → 类别1
|   |--- petal width (cm) >  1.55
|   |   |--- class: 2.0      ← 宽>1.55 → 类别2
```

从上往下走 if-else，缩进越深条件越细，末端 class 就是叶子预测的类别。
3棵树规则不一样（随机森林每棵树看不同特征/样本），最后投票决定结果。

## 四、另外两种"解释"语法

特征重要性（面试更常问）：
```python
clf.feature_importances_
dict(zip(iris.feature_names, clf.feature_importances_))  # 配特征名看
```

画成树图（适合汇报）：
```python
from sklearn.tree import plot_tree
import matplotlib.pyplot as plt
plot_tree(clf.estimators_[0], feature_names=iris.feature_names,
          class_names=iris.target_names, filled=True)
plt.show()
```

一句话记忆：森林 = RandomForestClassifier().fit()；看单棵规则 = estimators_[i] + export_text(..., feature_names=...)；看整体特征贡献 = feature_importances_。
