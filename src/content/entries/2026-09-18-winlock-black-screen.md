---
title: "Win+L 锁屏后黑屏无法唤醒排查记录"
date: 2026-09-18
category: 技术
tags: [windows, 排查, 驱动, 日记归档]
draft: false
---

> 日期：2026-09-18
> 机器：Lenovo 笔记本，Intel Arc 130T 核显 (16GB)，Windows 11 家庭中文版 25H2 (build 26200)

## 现象

按 Win+L 锁屏（或屏幕关闭）后黑屏，怎么按键盘鼠标都无反应，只能长按电源键强制断电，重新开机才恢复。近 30 天发生 2 次：

- **9/14 16:29** 强制断电一次
- **9/18 16:03** 强制断电一次（即本次排查的触发）

## 排查过程与证据（系统日志）

用 PowerShell 拉 System 事件日志 + 电源配置，关键证据：

1. **9/18 时间线**：15:56:15 Kernel-Power 506 进入现代待机(S0) → 之后 7 分钟整机**零日志**（不是屏幕黑了机器活着，是整机彻底挂死）→ 16:03:10 强制断电重启（Kernel-Power 41 关键错误）
2. **9/14 时间线**：16:19 进待机 → 16:27:37 出现 507 开始唤醒（Intel Wi-Fi 驱动 Netwaw18 恢复到一半）→ 70 秒后整机死亡 → 强制断电
3. 14 天里待机/唤醒循环 193 次都正常，只有 2 次挂死 → **偶发的现代待机唤醒路径挂死**
4. 无 WHEA 硬件错误、无 Display 4101（显卡 TDR）记录 → 硬件无异常证据
5. 本机只有 S0 现代待机（无传统 S3），快速启动开启（每天早上开机都是 hiberboot）

**结论：不是"启动不了"，是锁屏进待机后，唤醒流程整机挂死。**

## 嫌疑排序

| 排序 | 嫌疑 | 理由 |
|---|---|---|
| ① | Intel Arc 130T 核显驱动 32.0.101.**7026**（2025-08）过老 | 落后 Intel 官方最新 13 个月；唤醒恢复显示就是核显驱动的活 |
| ② | GameViewer 虚拟显示适配器 | 远程串流软件装的虚拟显卡，会劫持显示路径；其服务近 3 天崩了 2 次 |
| ③ | 快速启动开启 | 每天开机=从休眠恢复，陈旧驱动状态累积 |

> 注：联想驱动管家显示"无需更新"是因为它对比的基准是**联想原厂认证版本**（恰好就是 7026），不代表 Intel 官方最新版。OEM 认证驱动普遍滞后。

## 已完成的操作

1. ✅ **关闭快速启动 + 休眠**：管理员 PowerShell 执行 `powercfg /h off`
   - 已用 `powercfg -a` 验证：休眠"尚未启用"、快速启动"不可用"
   - 附带收益：`hiberfil.sys`（~42G）删除，C 盘多出约 42G（C 盘清理清单最大项完成）
2. ✅ **用 Intel Driver & Support Assistant (DSA) 更新驱动**，已装完 4 个：
   - Intel Wireless Wi-Fi Drivers 24.70.0（9/14 挂死前最后的日志正是 Wi-Fi 驱动，次要嫌疑）
   - Intel Wireless Bluetooth Drivers 24.70.0
   - Intel Connectivity Performance Suite (ICPS/ICM)
   - Intel NPU Driver 32.0.100.5540
3. ✅ **Intel Arc Graphics 101.8991**（2026-08-24 签名）：已安装并重启生效
   - 17:08 重启后验证：`Win32_VideoController` 显示 32.0.101.8991（原 7026）
   - Wi-Fi 7 BE201 24.70.0.3、蓝牙 24.70.0.4 一并确认
   - 附：DSA 下载目录在隐藏位置 `C:\ProgramData\Intel\DSA\Downloads`

## 待办

- [x] Arc 显卡驱动 101.8991 下载完成后安装（安装时屏幕闪黑正常），装完重启
- [x] 重启后验证版本：已确认 32.0.101.8991 生效（2026-09-18 17:08 重启）
- [ ] GameViewer 近期不用就卸载（或设备管理器禁用其虚拟显示适配器；另发现其虚拟输入设备 gvinput Device 也在）
- [ ] 观察几天，看锁屏黑屏是否复发（复发处置见下一节）

## 如果还复发怎么办

1. 黑屏时按 **Win+Ctrl+Shift+B**（重启显卡驱动，成功会"哔"一声）：
   - 有哔声 = 只有显示层挂了 → 指向虚拟显示器/显卡驱动残留问题
   - 无反应 = 整机挂死 → 继续往下查（BIOS/固件层）
2. 复发后拉日志对比：
   ```powershell
   # 看最近一次进/出待机记录（506=进, 507=出，卡死时通常只有506没有507）
   Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-Kernel-Power'; Id=506,507} -MaxEvents 20
   # 看强制断电记录
   Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Microsoft-Windows-Kernel-Power'; Id=41} -MaxEvents 5
   ```
3. 下一层排查手段（需管理员）：`powercfg /sleepstudy` 生成待机报告 HTML；查联想官网 BIOS 更新（固件也修 S0 待机问题）

## 与本案无关的噪音（不用管）

- 每次开机都有 BitLocker-Driver 24641 错误：正常开机日也有，TPM/VBS 噪音
- 9/17 有 Windows Update 事件 20（某更新安装失败）：黑屏问题 9/14 已出现，非该补丁引起
- Schannel 36882 错误：某应用的证书协商失败，与待机无关
