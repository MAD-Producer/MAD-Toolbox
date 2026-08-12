# Changelog

All notable changes to MAD Toolbox are documented here.

## 0.5.12 - Pre-release (2026-08-12)

- 移除设置中的自定义 Logo 功能，应用界面统一使用正式图标，避免只修改局部界面而造成误解。
- 增加 yt-dlp 的浏览器 Cookie 失败兜底：先执行无 Cookie 请求，只有检测到需要登录或人机验证时，才在同一任务中使用所选浏览器 Cookie 自动重试。
- 修复 Windows Lite 安装包的 WebView2 setup 流程：Lite 不再内置或启动 WebView2 安装器，使用系统已有 Runtime；Full 继续保留离线安装能力。

## 0.5.11 - Pre-release (2026-08-11)

- Added an explicit browser Cookie selector for YouTube downloads, including
  Windows Edge/Chrome presets and custom browser profiles. This makes the
  `Sign in to confirm you're not a bot` recovery path visible in the normal
  download workflow without storing Cookie values in MAD Toolbox.
- Made YouTube connectivity checks resolve `curl` through the application PATH
  on every supported platform instead of relying on a fixed Unix path.
- Tightened tag-build validation: Windows and macOS release builds now run the
  frontend formatting check, and Windows packaging verifies that exactly one
  installer was produced for each edition.
- Pinned the Windows FFmpeg LGPL asset to a dated BtbN build so the Full
  installer remains reproducible when the upstream rolling `latest` release
  rotates its assets.
- Changed Windows NSIS bundles to embed the WebView2 offline installer, so the
  Full installer can be installed and launched without network access.

## 0.5.10 - 2026-08-03

- Fixed audio extraction defaults: Opus/MP3 and other codecs are no longer
  blindly copied into incompatible M4A/WAV/FLAC/OGG containers.
- Fixed all-stream MP4/MOV conversion and remuxing so text subtitles use the
  compatible `mov_text` encoder instead of failing automatic encoder selection.
- Rechecked PR-compatible conversion, stream extraction, subtitle extraction,
  thumbnails, GIFs and image-sequence output against the bundled FFmpeg 8.1.2.

## 0.5.9 - 2026-08-02

- Run the bundled BBDown directly from its own application directory so its
  native `BBDown.data` and login overwrite behavior remain untouched. The GUI
  no longer copies BBDown or migrates data from any other installation.
- Restored the official, unmodified BBDown 1.6.3 binary. GUI QR login follows
  BBDown's official web endpoints, keeps the complete Cookie fields returned by
  Bilibili, validates the account, and writes the native `BBDown.data` format;
  normal downloads still invoke BBDown unchanged.

## 0.5.8 - 2026-08-01

- Fixed bundled BBDown login state on macOS and Windows when an older GUI left
  a temporary QR ticket in `BBDown.data`. The bundled runtime now keeps one
  native BBDown state directory and lets BBDown recreate that file normally.
- Added a small login-state indicator without parsing or storing credentials in
  the GUI.

## 0.5.7 - 2026-08-01

- Fixed bundled BBDown login state on macOS and Windows by running it from a
  writable app-data directory, keeping `BBDown.data` beside the executable as
  expected by the original CLI, and allowing a new QR login to replace the
  previous session.
- Added live login-state feedback so a failed BBDown account check is not
  mistaken for a successful local-cookie load.

## 0.5.6 - 2026-08-01

- Updated the pinned Windows Full FFmpeg asset and executable checksums after
  the previous BtbN release asset was retired.

## 0.5.5 - 2026-08-01

- Simplified BBDown defaults so a normal download runs as `BBDown <link>` and
  information lookup runs as `BBDown <link> --only-show-info`.
- Stopped adding output, FFmpeg, encoding and subtitle flags unless the user
  explicitly selects them.

## 0.5.4 - 2026-08-01

- Removed the custom BBDown authentication gate, credential parsing, storage
  and injection; BBDown now manages its native `BBDown.data` beside the
  executable according to its original CLI behavior.
- Changed setting templates to ordinary WebView local storage and task exports
  to preserve CLI output as-is instead of encrypting or redacting it.
- Hid the Windows application console and all directly launched background
  tool windows.
- Removed the terminal-style log page and added direct per-task log export.
- Expanded Premiere Pro compatibility handling for common video containers,
  lossless/lossy audio and text subtitle files.
- Fixed PowerShell 5-compatible WinGet and pipx installation guidance and
  added WinGet/Python user-install discovery paths.

## 0.5.0 - 2026-07-29

- Added Windows 10 22H2 and Windows 11 x64 support.
- Added reproducible Windows Full and Lite NSIS packaging.
- Added pinned Windows x64 BBDown, FFmpeg/ffprobe, MediaInfo, yt-dlp and Deno
  acquisition with archive and binary SHA-256 verification.
- Added Windows system/custom tool discovery, hardware encoder detection,
  Credential Manager integration and encrypted template storage.
- Added Windows diagnostic ZIP generation, platform-specific paths, Explorer
  directory selection and WinGet installation guidance.
- Added Windows Full/Lite CI builds while retaining Apple Silicon macOS
  support and feature parity.
