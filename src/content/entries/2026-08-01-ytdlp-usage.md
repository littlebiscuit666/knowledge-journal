---
title: "yt-dlp 用法和参数总结"
date: 2026-08-01
category: 工具
tags: [yt-dlp, 下载, 速查, 日记归档]
draft: false
---

## 1. yt-dlp 能下载什么

yt-dlp 是命令行音视频下载工具，主要用于下载网页播放器能公开加载的媒体资源。

常见可下载内容：

- 视频：YouTube、Bilibili、TikTok、Twitter/X、Vimeo、Twitch 等
- 音频：SoundCloud、Bandcamp、播客、网页内嵌音频等
- 播放列表：频道、合集、歌单、课程列表等
- 附加资源：字幕、封面图、缩略图、章节、元数据
- 某些站点的特殊媒体：例如 MuseScore 的播放音频或预览资源

它通常不能绕过：

- 登录限制
- 会员限制
- DRM 加密
- 网站强反爬
- 作者关闭下载权限
- 账号本身没有权限访问的内容

## 2. 基本命令格式

你的 yt-dlp 位置：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" "网址"
```

PowerShell 里建议始终把网址放在引号里，避免网址中的 `?`、`&` 被命令行误解析。

## 3. 先检查能不能下载

下载前先列出可用格式：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -F "网址"
```

如果能列出格式，说明大概率可以下载。

如果报错，例如：

```text
HTTP Error 403: Forbidden
Login required
Unsupported URL
DRM protected
```

说明这个链接可能需要登录、权限、浏览器 cookies，或者根本不适合用 yt-dlp 下载。

## 4. 常用下载命令

直接下载最佳质量：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" "网址"
```

指定保存目录：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -P "$env:USERPROFILE\Downloads\Videos" "网址"
```

指定文件名模板：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -o "%(title)s [%(id)s].%(ext)s" "网址"
```

指定保存目录和文件名：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -P "$env:USERPROFILE\Downloads\Videos" -o "%(title)s [%(id)s].%(ext)s" "网址"
```

## 5. 只下载音频

只提取音频：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -x "网址"
```

转成 MP3：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -x --audio-format mp3 "网址"
```

转成 M4A：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -x --audio-format m4a "网址"
```

注意：音频转换需要 ffmpeg。你这台机器检测到已经有 ffmpeg。

## 6. 选择清晰度或格式

列格式：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -F "网址"
```

下载某个格式编号：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -f 格式编号 "网址"
```

下载最佳视频加最佳音频：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -f "bv*+ba/b" "网址"
```

限制最高 1080p：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -S "res:1080" "网址"
```

限制最高 720p：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -S "res:720" "网址"
```

## 7. 字幕和封面

下载字幕：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --write-subs "网址"
```

下载自动字幕：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --write-auto-subs "网址"
```

指定字幕语言：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --write-subs --sub-langs zh,en "网址"
```

下载封面图：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --write-thumbnail "网址"
```

## 8. 播放列表

下载整个播放列表：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" "播放列表网址"
```

只下载播放列表中的前 5 个：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --playlist-items 1-5 "播放列表网址"
```

跳过已经下载过的内容：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --download-archive archive.txt "播放列表网址"
```

## 9. 登录和 cookies

有些内容需要登录才能访问，可以尝试读取浏览器 cookies：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --cookies-from-browser chrome "网址"
```

或：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --cookies-from-browser edge "网址"
```

如果浏览器 cookies 读取失败，可以用浏览器扩展导出 `cookies.txt`，然后：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --cookies "C:\Users\yaya\Downloads\cookies.txt" "网址"
```

注意：cookies 相当于你的登录凭证，不要随便发给别人。

## 10. 浏览器指纹模拟

有些网站会拒绝普通命令行请求，可以尝试模拟 Chrome：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --impersonate chrome "网址"
```

配合 cookies：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --impersonate chrome --cookies "C:\Users\yaya\Downloads\cookies.txt" "网址"
```

## 11. 代理

使用代理：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --proxy "http://127.0.0.1:7890" "网址"
```

禁用代理：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --proxy= "网址"
```

## 12. 排错命令

查看详细错误：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --verbose -F "网址"
```

查看版本：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" --version
```

更新 yt-dlp：

```powershell
& "C:\Users\yaya\Downloads\yt-dlp.exe" -U
```

## 13. 这次 MuseScore 链接的测试结论

测试链接：

```text
https://musescore.com/user/21773001/scores/6837262
```

测试结果：

- 普通方式：网页请求返回 `HTTP Error 403: Forbidden`
- 禁用代理后：仍然 `403 Forbidden`
- 加 `--impersonate chrome`：网页能访问，但 JSON 元数据接口仍然 `403 Forbidden`
- 加 Chrome cookies：读取 cookies 时遇到 Windows DPAPI 解密失败
- 你的 yt-dlp 版本较新：`2026.07.04`
- 你的 ffmpeg/ffprobe 已安装

结论：

这个 MuseScore 链接不是简单参数问题，而是 MuseScore 对接口访问做了限制。yt-dlp 只能下载你账号本来有权限访问、且网站允许播放器公开加载的媒体资源，不能绕过会员、作者权限或站点限制。

## 14. 推荐排错流程

遇到新链接时按这个顺序试：

```powershell
# 1. 先看格式
& "C:\Users\yaya\Downloads\yt-dlp.exe" -F "网址"

# 2. 如果被拒，尝试浏览器指纹
& "C:\Users\yaya\Downloads\yt-dlp.exe" --impersonate chrome -F "网址"

# 3. 如果需要登录，尝试 cookies
& "C:\Users\yaya\Downloads\yt-dlp.exe" --impersonate chrome --cookies "C:\Users\yaya\Downloads\cookies.txt" -F "网址"

# 4. 如果能列格式，再下载
& "C:\Users\yaya\Downloads\yt-dlp.exe" --impersonate chrome --cookies "C:\Users\yaya\Downloads\cookies.txt" -P "$env:USERPROFILE\Downloads\Videos" "网址"

# 5. 如果还失败，输出详细日志
& "C:\Users\yaya\Downloads\yt-dlp.exe" --verbose -F "网址"
```

