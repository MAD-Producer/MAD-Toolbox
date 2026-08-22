<p align="center">
  <img src="src/assets/logo.png" width="128" alt="MAD Toolbox icon">
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

ENGLISH · [简体中文](README.zh.md)

## Features

- **Cross-platform support**: Compatible with Windows 10/11 and macOS
- **Intuitive and convenient tool operations**: Operate the built-in tools quickly through a modern UI design
- **Unified and efficient task management**: Purpose-designed task statuses, with unified scheduling and management in the Tasks page

Underlying tools:

- **BBDown**: Easily download Bilibili videos, with dedicated support for downloading audio, subtitles, covers, danmaku and other resources. (Actual download quality depends on the account login status)
- **yt-dlp**: Download media resources from YouTube and any other link supported by yt-dlp's parsing formats
- **FFmpeg**: Supports format conversion and remuxing of common media files, video/audio/subtitle stream extraction, ASS/SRT subtitles, GIF export, image sequences, plus advanced processing of bitrate, frame rate, scaling, cropping, rotation, speed, pixel formats and audio parameters.
- **musicdl**: Fetch streaming playback resources from major music platforms and download them for preview

> **Note**:
> Download specs, premium content, HDR, Dolby Vision and high-bitrate resources depend on the current logged-in account's membership, content and region permissions. "Highest quality" means the highest quality actually accessible to that account.

## Tech Stack

[![Tauri](https://img.shields.io/badge/Tauri-v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white&labelColor=24C8DB)](https://tauri.app/)
[![Chakra UI](https://img.shields.io/badge/Mantine_ui-v9-38B2AC?style=for-the-badge&logo=mantine&logoColor=white&labelColor=319795)](https://mantine.dev/)
[![Tabler Icons](https://img.shields.io/badge/Tabler_Icons-v3.44-066FD1?style=for-the-badge&logo=tablericons&logoColor=white&labelColor=1E2734)](https://tabler.io/icons)

## Getting Started

To get started with MAD Toolbox, simply download the latest release from [Releases](https://github.com/MAD-Producer/MAD-Toolbox/releases/).

MAD Toolbox currently supports the following platforms:

| Platform | OS Version | Architecture | Distribution Types |
| -------- | ---------- | ------------ | ------------------ |
| Windows  | 10+        | `x86_64`     | Full / Lite `.exe` |
| macOS    | 14+        | `aarch64`    | Full / Lite `.dmg` |

BBDown is bundled by default in both the FULL and LITE versions.

### Installing Third-party Dependencies

For the dependencies required to run MAD Toolbox, you can install them on your system yourself.

**Windows 10/11**

Make sure your system has the [winget](https://learn.microsoft.com/en-us/windows/package-manager/winget/) package manager.

```powershell
winget install --id Gyan.FFmpeg -e
winget install --id yt-dlp.yt-dlp -e
winget install --id MediaArea.MediaInfo -e
winget install --id DenoLand.Deno -e
```

**macOS**

```bash
brew install ffmpeg yt-dlp media-info deno
```

## Development & Contribution

> Please make sure your system has Node.js 22+, Rust stable and the native build tools for your platform.

First clone this project and install the frontend dependencies:

```bash
git clone git@github.com:Mad-Producer/MAD-Toolbox
npm ci
```

Run in development mode:

```bash
npm run tauri:dev
```

We warmly welcome contributions from every developer!

- Before getting started, please read our [Contributing Guide](https://github.com/MAD-Producer/MAD-Toolbox/blob/main/CONTRIBUTING.md)
- You can also read the project's [docs](https://github.com/MAD-Producer/MAD-Toolbox/blob/main/docs/) to understand the details and the overall roadmap
- Feel free to share your ideas via [Pull Request](https://github.com/MAD-Producer/MAD-Toolbox/pulls) or [GitHub Issues](https://github.com/MAD-Producer/MAD-Toolbox/issues)

### Developer Documentation

- [Windows compatibility, build and security notes](docs/WINDOWS.md)
- [Lite dependency installation](docs/DEPENDENCIES.md)
- [Full build packaging and redistribution policy](docs/FULL_BUILD.md)
- [Third-party notices and licenses](THIRD_PARTY_NOTICES.md)
- [Contributing](CONTRIBUTING.md)
- [Reporting security issues](SECURITY.md)

### Contributors

![Contributors](https://contrib.rocks/image?repo=MAD-Producer/MAD-Toolbox "Contributors")

## Copyright

Copyright © 2026 MAD Producer Studio.

**Note: MAD Toolbox is merely a GUI app developed for third-party tools and is intended for communication and learning purposes only. MAD Toolbox is not responsible for any copyright disputes arising from users' usage. Please use the third-party tools with caution, and do not privately redistribute or sell unauthorized material.**

## License

MAD Toolbox source code is licensed under the MIT License. All bundled tools retain their respective licenses, copyrights and attributions; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

<img src="src/assets/organization_logo.png" alt="MAD Toolbox" />
