# Changelog

All notable changes to MAD Toolbox are documented here.

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
