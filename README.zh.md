<p align="center">
  <img src="src/assets/logo.png" width="128" alt="MAD Toolbox 图标">
</p>

<h1 align="center">MAD Toolbox</h1>
<center>
[![Test Build](https://img.shields.io/github/actions/workflow/status/MAD-Producer/MAD-Toolbox/check.yml?label=test%20build&logo=github&style=for-the-badge)](https://github.com/MAD-Producer/MAD-Toolbox/blob/main/.github/workflows/check.yml)
![Downloads](https://img.shields.io/github/downloads/MAD-Producer/MAD-Toolbox/total?logo=github&style=for-the-badge)
![Stars](https://img.shields.io/github/stars/MAD-Producer/MAD-Toolbox?style=for-the-badge)
[![Deepwiki](https://img.shields.io/badge/Ask-DeepWiki-20B2AA?logo=&style=for-the-badge)](https://deepwiki.com/MAD-Producer/MAD-Toolbox)
</center>

---

<p align="center"><strong><em>"There are many toolboxes, but this one is for you, MADer."</em></strong></p>

---

[ENGLISH](README.md) · 简体中文

## 功能特性

- **跨平台支持**： 兼容 Windows 10/11 和 MacOS
- **直观便捷的工具操作**：通过现代的UI设计让用户快速操作内置工具
- **统一高效的任务管理**：自主设计任务状态并在任务页面统一调度和管理

底层调用工具：

- **BBDown**：便捷下载 Bilibili 视频，还支持专门下载音频，字幕，封面和弹幕等资源。（实际下载规格由账号登录状态决定）
- **yt-dlp**：支持YouTube和其他所有符合 yt-dlp 解析格式的链接的媒体资源下载
- **FFmpeg**：支持常见媒体文件的格式转换、重新封装、
  视频/音频/字幕抽流、ASS/SRT、GIF导出、序列帧以及码率、帧率、尺寸、裁切、
  旋转、速度、像素格式和音频参数的高级处理。
- **musicdl**：获取各大音乐平台的流媒体播放资源并下载试听

> **注意**：
> 下载规格、会员内容、HDR、杜比视界和高码率资源取决于当前登录账号的会员、内容及地区权限。“最高规格”指该账号实际能够访问的最高规格。

## 技术栈

[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white&labelColor=24C8DB)](https://tauri.app/)
[![Matine](https://img.shields.io/badge/Mantine_ui-v9-38B2AC?style=for-the-badge&logo=mantine&logoColor=white&labelColor=319795)](https://mantine.dev/)
[![Tabler Icons](https://img.shields.io/badge/Tabler_Icons-v3.44-066FD1?style=for-the-badge&logo=tablericons&logoColor=white&labelColor=1E2734)](https://tabler.io/icons)

## 开始使用

开始使用 MAD Toolbox，只需在 [Release](https://github.com/MAD-Producer/MAD-Toolbox/releases/) 下载最新发行版即可。

MAD Toolbox 目前支持以下平台：

| 平台    | 系统版本  | 架构      | 提供的分发类型         |
| ------- | --------- | --------- | ---------------------- |
| Windows | 10 及以上 | `x86_64`  | Full版 / Lite版 `.exe` |
| macOS   | 14 及以上 | `aarch64` | Full版 / Lite版 `.exe` |     |

其中 BBDown 默认内置于FULL版本和LITE版。

### 第三方依赖下载

对于 MAD Toolbox 运行时所需要的依赖，您可以通过自主在系统安装获得。

**Windows 10/11**

请确保您的系统含有 [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) 包管理工具。

```powershell
winget install --id Gyan.FFmpeg -e
winget install --id yt-dlp.yt-dlp -e
winget install --id MediaArea.MediaInfo -e
winget install --id DenoLand.Deno -e
```

**MacOS**

```bash
brew install ffmpeg yt-dlp media-info deno
```

## 开发与贡献

> 请首先确保系统含有 Node.js 22+、Rust stable 和对应平台的原生构建工具。

首先克隆本项目并安装前端依赖：

```bash
git clone git@github.com:Mad-Producer/MAD-Toolbox
npm ci
```

使用开发模式运行：

```bash
npm run tauri:dev
```

我们热烈欢迎每一位开发者的贡献！

- 在开始前，请先阅读我们的 [贡献指南](https://github.com/MAD-Producer/MAD-Toolbox/blob/main/CONTRIBUTING.md)
- 此外，你可以阅读项目的 [docs 文档](https://github.com/MAD-Producer/MAD-Toolbox/blob/main/docs/)来理解相关细节和项目的整体规划
- 欢迎通过 [Pull Request](https://github.com/MAD-Producer/MAD-Toolbox/pulls) 或 [GitHub Issues](https://github.com/MAD-Producer/MAD-Toolbox/issues) 分享您的想法。

### 开发文档

- [Windows 兼容性、构建与安全说明](docs/WINDOWS.md)
- [Lite 版依赖安装](docs/DEPENDENCIES.md)
- [Full 版打包和再分发规则](docs/FULL_BUILD.md)
- [第三方软件署名和许可证](THIRD_PARTY_NOTICES.md)
- [参与贡献](CONTRIBUTING.md)
- [安全问题报告](SECURITY.md)

### 贡献者

![贡献者](https://contrib.rocks/image?repo=MAD-Producer/MAD-Toolbox "贡献者")

## 版权声明

版权所有 © 2026 MAD Producer Studio.

**注意：MAD ToolBox 仅仅是为第三方工具开发的GUI APP，仅供交流学习使用，用户在使用过程的造成的版权纠纷均不由 MAD Toolbox 承担责任。请谨慎使用相关第三方工具，请勿私自转发或售卖未经授权的资料。**

## 许可证

MAD Toolbox 源代码使用 MIT License。所有内置工具保留各自的许可证、
版权和署名，详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

<img src="src/assets/organization_logo.png" alt="MAD Toolbox" />
