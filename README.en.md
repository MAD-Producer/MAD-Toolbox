<p align="center">
  <img src="assets/mad-toolbox-icon.png" width="128" alt="MAD Toolbox icon">
</p>

<h1 align="center">MAD Toolbox</h1>

<p align="center">
  <a href="README.md">简体中文</a> ·
  <a href="https://github.com/MAD-Producer/MAD-Toolbox/actions/workflows/check.yml"><img src="https://github.com/MAD-Producer/MAD-Toolbox/actions/workflows/check.yml/badge.svg?branch=main" alt="Checks"></a> ·
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
</p>

<p align="center"><strong><em>"There are many toolboxes, but this one is for you, MADer."</em></strong></p>

MAD Toolbox is an open-source Windows and macOS GUI for BBDown, yt-dlp,
FFmpeg, MediaInfo and an optional external musicdl installation. Supported
targets are Windows 10 22H2/Windows 11 x64 (`x86_64-pc-windows-msvc`) and
Apple Silicon macOS 12 or newer.

The application turns form values into argument arrays, runs the selected CLI
without a shell, and streams its original stdout and stderr into per-task logs
that can be exported from Task Center.

## Features

- BBDown Bilibili downloads that follow the original CLI behavior, with
  beginner presets and advanced CLI parameters.
- yt-dlp downloads with YouTube reachability testing, global-proxy guidance,
  explicit HTTP/HTTPS/SOCKS proxy settings, browser-Cookie fallback and
  advanced format controls.
- FFmpeg media processing with drag-and-drop files or folders, localized
  MediaInfo inspection, remuxing, stream extraction, ASS/SRT subtitles,
  conversion, bitrate/frame-rate/scaling controls, GIFs and image sequences.
- Premiere Pro compatibility for common video containers, lossless/lossy
  audio and text subtitle files, with stream copy whenever possible.
- Persistent last-used settings and multiple plain templates per feature.
- Background jobs that survive page navigation, cancellation and original
  per-task log export.
- Full and Lite distributions with bundled/system executable selection.

QR login uses BBDown's native session behavior and enables the download
qualities available to the current account. Users may also provide a Cookie
through BBDown's own `--cookie` option.
Available quality, premium content, HDR, Dolby Vision and high-bitrate streams
depend on the logged-in Bilibili account's membership, content and region
permissions. "Highest quality" means the highest quality available to that
account.

A saved default output directory can be selected in Settings and is applied to
BBDown, yt-dlp, FFmpeg and musicdl tasks unless a task overrides it.

The media page includes a beginner-friendly intelligent Premiere Pro workflow
and professional FFmpeg controls for codecs, bitrate/CRF, frame rate, scaling,
cropping, rotation, speed, pixel formats, audio bitrate/sample rate/channels,
loudness normalization, GIF creation and image-sequence export. Output
directories can be selected in Windows Explorer or Finder.

The intelligent Premiere Pro workflow prefers MP4 for H.264 and HEVC sources,
copying compatible streams whenever possible. It falls back to MOV for codecs
such as ProRes or when a high-quality compatibility transcode is required.

## Distribution modes

### Lite

The Lite build always includes BBDown. On macOS, install the remaining
dependencies with Homebrew:

```bash
brew install ffmpeg yt-dlp media-info deno
```

On Windows, use the official download links shown in Settings or install the
tools with WinGet:

```powershell
winget install --id Gyan.FFmpeg -e
winget install --id yt-dlp.yt-dlp -e
winget install --id MediaArea.MediaInfo.CLI -e
winget install --id DenoLand.Deno -e
```

The Windows Lite installer does not embed or launch a WebView2 installer. It
uses the system WebView2 Runtime, which is normally available on Windows 10
22H2 and Windows 11. If the runtime is missing, install it separately or use
the Full build, which includes the offline installer.

### Full

The Full build bundles audited, version-pinned binaries for BBDown,
FFmpeg/ffprobe, MediaInfo CLI, yt-dlp and Deno. It needs no separate CLI
installation, and the Windows installer also embeds the WebView2 offline
installer. Once downloaded, the Windows Full installer and application startup
do not require an internet connection. It uses the same GUI and adapter code as
the Lite build.

musicdl is deliberately excluded from both distributions because upstream
prohibits bundling without explicit permission. Python 3 is also an external
prerequisite. Install both with:

```bash
brew install python pipx
pipx ensurepath
pipx install musicdl
```

On Windows:

```powershell
winget install --id Python.Python.3.13 -e
py -m pip install --user pipx
py -m pipx ensurepath
py -m pipx install musicdl
```

For mainland-China networks, the GUI provides copyable USTC and TUNA PyPI
mirror commands plus a command to restore the official PyPI source.

After installation, restart or use the music page's dependency refresh button.
The GUI supports keyword search with native result selection, playlist URLs,
all music source names and all advanced musicdl CLI JSON options.

## Local development and building from source

Node.js 22, Rust stable and the native build tools for the current platform are required.

**Apple Silicon macOS:**

```bash
npm ci
npm run tauri:dev
```

Create Apple Silicon macOS installers:

```bash
npm run tauri:build:lite
npm run tauri:build:full
```

**Windows x64:**

```powershell
npm ci
npm run tauri:dev
```

Create Windows installers:

```powershell
npm run tauri:build:windows:lite
npm run tauri:build:windows:full
```

The Windows build scripts verify the BBDown binary distributed with the
repository. Full builds also download and verify the remaining Windows
sidecars, then produce a bilingual NSIS installer. Unsigned installers may
trigger a SmartScreen "unknown publisher" warning.

GitHub Actions can run Full/Lite builds for Windows and Apple Silicon macOS
manually or when a `v*` tag is pushed. Build artifacts are retained for 30 days.
See the documents below for detailed build and verification rules.

## Documentation

- [Windows build, security and compatibility](docs/WINDOWS.md)
- [Lite dependency installation](docs/DEPENDENCIES.md)
- [Full build and redistribution policy](docs/FULL_BUILD.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [Contributing](CONTRIBUTING.md)
- [Reporting security issues](SECURITY.md)

## License

MAD Toolbox source code is licensed under the MIT License. Bundled tools keep
their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
submitting changes and report vulnerabilities according to
[SECURITY.md](SECURITY.md).
