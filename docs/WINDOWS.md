# Windows x64 build

MAD Toolbox 0.5.8 targets Windows 10 22H2 and Windows 11 on Intel/AMD x64
processors (`x86_64-pc-windows-msvc`). ARM64 and 32-bit x86 installers are not
currently produced.

## Feature parity

The Windows GUI uses the same pages and command-generation model as macOS:

- original BBDown CLI login/download behavior and advanced parameters;
- yt-dlp connectivity testing, global-proxy guidance, explicit proxy and
  advanced parameters;
- file/folder media probing, Premiere-compatible smart MP4 workflow,
  remuxing, stream extraction, ASS/SRT subtitle extraction, professional
  FFmpeg controls and directory task queues;
- optional external Python/musicdl integration;
- plain multi-template storage, restoration of the last settings, task
  cancellation that survives page navigation and per-task original log export.

Long FFmpeg jobs have no five-minute execution limit. They run until the
process exits or the user cancels the task. musicdl search has a separate
30-minute safety timeout.

## Full and Lite installers

Full bundles BBDown, FFmpeg/ffprobe, MediaInfo CLI, yt-dlp and Deno. Lite
bundles BBDown and finds the other programs from WinGet/system and other known
Windows installation locations. Settings allows either installer to prefer a
newer system version.

Prepare and build:

```powershell
npm install
npm run tauri:build:windows:lite
npm run tauri:build:windows:full
```

The scripts download only missing artifacts and verify pinned SHA-256 values.
The output is a per-user bilingual NSIS installer.

## CLI state and diagnostics

If a standalone `BBDown` is found in the user's normal tool directories and it
already has a native login file, MAD Toolbox invokes that exact executable.
This means `BBDown login` followed by `BBDown <url>` in a terminal and the GUI
share the same `BBDown.data` on macOS and Windows. Otherwise the bundled
BBDown is copied to the per-user application data directory at first use, with
its native `BBDown.data` kept beside that runtime copy. A legacy file beside
an older bundled executable is migrated once when the new location is empty.
Running QR login again lets BBDown overwrite the active file with the newly
returned session, exactly as its original CLI does.

MAD Toolbox does not parse, encrypt or inject this native state and does not
use Credential Manager. Templates are ordinary WebView application data.
Exported task logs preserve original CLI output and may therefore contain
cookies, passwords, tokens, proxy credentials, URLs and local paths.

## Unsigned distribution

The installer does not require a paid code-signing certificate. An unsigned
build can be installed and used, but Microsoft Defender SmartScreen may show
an unknown-publisher warning. Users must inspect the download source and
explicitly choose to continue.
