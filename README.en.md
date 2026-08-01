<p align="center">
  <img src="assets/mad-toolbox-icon.png" width="128" alt="MAD Toolbox icon">
</p>

<h1 align="center">MAD Toolbox</h1>

<p align="center">
  Turn BBDown, yt-dlp, FFmpeg and MediaInfo command-line workflows into a clear desktop GUI.
</p>

<p align="center">
  <a href="README.md">简体中文</a> ·
  <a href="https://github.com/MAD-Producer/MAD-Toolbox/actions/workflows/check.yml"><img src="https://github.com/MAD-Producer/MAD-Toolbox/actions/workflows/check.yml/badge.svg" alt="Checks"></a> ·
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
</p>

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
  explicit HTTP/HTTPS/SOCKS proxy settings and advanced format controls.
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

### Full

The Full build bundles audited, version-pinned binaries for BBDown,
FFmpeg/ffprobe, MediaInfo CLI, yt-dlp and Deno. It needs no separate CLI
installation and uses the same GUI and adapter code as the Lite build.

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

## Development

macOS prerequisites:

- Apple Silicon Mac
- Node.js 22 or newer
- Rust toolchain
- Xcode Command Line Tools

Install JavaScript packages and run:

```bash
npm install
npm run tauri:dev
```

Create an Apple Silicon Lite build:

```bash
npm run tauri:build:lite
```

Verify every pinned Full artifact before packaging, then create the Full build:

```bash
npm run verify:bundled
npm run tauri:build:full
```

Windows x64 prerequisites:

- Windows 10 22H2 or Windows 11 x64
- Node.js 22 or newer
- Rust stable with the MSVC x64 target
- Visual Studio 2022 Build Tools with Desktop development with C++

Create Windows NSIS installers:

```powershell
npm run tauri:build:windows:lite
npm run tauri:build:windows:full
```

The preparation script downloads missing official sidecars, verifies both
archive and binary SHA-256 values, and packages them into the installer. The
same Full/Lite jobs are available in `.github/workflows/build-windows.yml`.

GitHub Actions can also build both Windows installers and Apple Silicon macOS
DMGs. Open **Actions → Build Windows x64 → Run workflow** or **Actions → Build
macOS Apple Silicon → Run workflow**. Both workflows also run on `v*` tags and
upload Full and Lite as separate artifacts with 30-day retention. The macOS
workflow uses an arm64 runner, runs the backend tests and pinned tool checks,
validates the resulting DMG, and includes a SHA-256 checksum.

More documentation:

- [Windows build, security and compatibility](docs/WINDOWS.md)
- [Lite dependency installation](docs/DEPENDENCIES.md)
- [Full build and redistribution policy](docs/FULL_BUILD.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

No paid Apple certificate is required for development. Release builds use a
free ad-hoc signature, so users may need to approve the app once in System
Settings > Privacy & Security.

No paid Windows certificate is required either. The generated NSIS installer
is usable without signing, but Windows SmartScreen may show an unknown
publisher warning; users must explicitly choose to continue.

## BBDown notice

BBDown is bundled because it is not available as a Homebrew formula. The
upstream repository was archived in May 2026 and is no longer maintained. This
project pins the upstream 1.6.3 Apple Silicon and Windows x64 releases and
preserves its original MIT license and author attribution.

Only download media that you own or are authorized to use. MAD Toolbox does
not bypass DRM.

## License

MAD Toolbox source code is licensed under the MIT License. Bundled tools keep
their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
submitting changes and report vulnerabilities according to
[SECURITY.md](SECURITY.md).
