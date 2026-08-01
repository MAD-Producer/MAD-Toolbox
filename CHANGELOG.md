# Changelog

All notable changes to MAD Toolbox are documented here.

## 0.5.8 - 2026-08-01

- Fixed BBDown login synchronization with standalone CLI installations on
  macOS and Windows. When a user CLI with a native `BBDown.data` is found,
  the GUI now invokes that exact executable and shares its session file.
- Added discovery of common per-user tool directories, including
  `Documents/apps/ffmpeg`, so GUI launches from Finder use the same `bbdown`
  command that works in a terminal.
- Added regression coverage for distinguishing a complete native session from
  an incomplete QR-login ticket file.

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
