---
title: "Espanso 全局 AI 编程问答助手配置总结"
date: 2026-09-04
category: 工具
tags: [espanso, 效率工具, ai, 日记归档]
draft: false
---

> 日期：2026-09-04
> 需求：在任意可输入文字的地方（不限于 IDE），复制编程题目/问题后触发 AI 解答，结果直接插入当前光标处。

## 最终效果

```
1. 复制题目/问题到剪贴板 (Ctrl+C)
2. 在任意输入框输入 !!ai
3. 等几秒，AI 解答自动打入当前光标处
```

- 主触发词：`!!ai`，备用触发词：`!!ask`（效果相同）
- AI 返回结构：思路分析 → 完整代码 → 关键点说明
- 全程不切窗口：Espanso 是系统级后台进程，全局监听键盘，脚本后台执行完直接注入文字

## 文件位置

| 文件 | 路径 |
|------|------|
| 触发配置 | `C:\Users\yaya\AppData\Roaming\espanso\match\ai_complete.yml` |
| Python 脚本 | `C:\Users\yaya\AppData\Roaming\espanso\scripts\ai_complete.py` |
| Espanso 主配置 | `C:\Users\yaya\AppData\Roaming\espanso\config\default.yml` |
| 运行日志（排错看这里） | `C:\Users\yaya\AppData\Local\espanso\espanso.log` |

Python 用的是系统全局 Python311：`C:\Users\yaya\AppData\Local\Programs\Python\Python311\python.exe`（requests 库已装）。

## 配置要点

**ai_complete.yml 核心格式**（Espanso v2 的 script 扩展）：

```yaml
matches:
  - trigger: "!!ai"
    replace: "{{output}}"
    vars:
      - name: output
        type: script
        params:
          args:                      # ★ 只有 args，没有 cmd 参数
            - "C:\\...\\python.exe"  # 第一个元素就是可执行文件
            - "C:\\...\\ai_complete.py"
```

**ai_complete.py 可调项**：

- `API_KEY`：DeepSeek 的 key（已填）
- `MODEL`：默认 `deepseek-chat`；难题可换 `deepseek-reasoner`（更深思考但更慢）
- `SYSTEM_PROMPT`：当前为"编程问答助手"人设（思路+代码+关键点），想改行为改这里
- API 超时 120s，`max_tokens` 4096

## 踩过的坑（按顺序）

### 坑 1：os error 193「不是有效的 Win32 应用程序」
- **现象**：触发 `!!ai` 报渲染错误
- **原因**：Espanso v2 的 `script` 扩展**没有 `cmd` 参数**，只有 `args`，且 `args[0]` 就是可执行文件。错误写法 `cmd: python` + `args: [脚本.py]` 导致 Espanso 把 `.py` 文件直接当 exe 执行
- **修复**：`args` 列表第一个元素放 python.exe 完整路径，第二个元素放脚本路径

### 坑 2：deepseek-coder 模型不存在
- **原因**：`deepseek-coder` 已下线，DeepSeek API 现在只有 `deepseek-chat` 和 `deepseek-reasoner`
- **修复**：MODEL 改为 `deepseek-chat`

### 坑 3：剪贴板中文 UnicodeDecodeError
- **现象**：Espanso 已能调起脚本，但日志报 `'utf-8' codec can't decode byte 0xb8`
- **原因**：中文 Windows 上 PowerShell 的 stdout 是 **GBK 编码**，脚本里 `subprocess.run(..., encoding="utf-8")` 强制按 UTF-8 解码，遇到中文剪贴板内容直接炸
- **修复**：彻底抛弃 PowerShell，改用 Python 自带的 **tkinter** 读剪贴板（`tk.Tk().withdraw()` + `clipboard_get()`），天然支持 Unicode，零依赖零编码坑

### 坑 4（预防性）：requests 版本警告污染 stderr
- **原因**：`RequestsDependencyWarning: urllib3/chardet doesn't match` 会在 stderr 打警告
- **修复**：脚本开头 `warnings.filterwarnings("ignore")`

## 其他备忘

- Espanso 检测到 yml 配置变化会**自动重载**（日志可见 "worker requested a restart"），改配置一般不用手动重启；实在没反应就托盘右键 → Restart
- 改 `.py` 脚本不用重载——每次触发都是重新执行脚本
- 脚本输出用 `sys.stdout.write()`（不带末尾换行），Espanso 按 UTF-8 读 stdout，脚本开头 `sys.stdout.reconfigure(encoding="utf-8")` 防中文乱码
- 排错套路：直接命令行跑 `python.exe ai_complete.py` 看报错 + 看 `espanso.log` 尾部
