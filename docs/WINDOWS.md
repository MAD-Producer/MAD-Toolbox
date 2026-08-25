# Windows x64 build

MAD Toolbox 1.0.1 targets Windows 10 22H2 and Windows 11 on Intel/AMD x64
processors (`x86_64-pc-windows-msvc`). ARM64 and 32-bit x86 installers are not
currently produced.

## Feature parity

The Windows GUI uses the same pages and command-generation model as macOS:

- original BBDown CLI login/download behavior and advanced parameters;
- yt-dlp downloads with explicit proxy settings and advanced parameters;
- file/folder media probing, Premiere-compatible smart MP4 workflow,
  remuxing, stream extraction, ASS/SRT subtitle extraction, professional
  FFmpeg controls and directory task queues;
- optional external Python/musicdl integration;
- plain multi-template storage, restoration of the last settings, task
  cancellation that survives page navigation and per-task original log export.

Long FFmpeg jobs have no five-minute execution limit. They run until the
process exits or the user cancels the task. musicdl search has a separate
30-minute safety timeout.

## Local development

Install Node.js 22 or newer, Rust stable with the MSVC x64 target, and Visual
Studio 2022 Build Tools with the **Desktop development with C++** workload.
From the repository root, run:

```powershell
npm ci
npm run tauri:dev
```

## Full and Lite installers

Full bundles BBDown, FFmpeg/ffprobe, MediaInfo CLI, yt-dlp and Deno, and embeds
the WebView2 offline installer. After the Full installer has been downloaded,
installation and application startup do not require an internet connection.
Lite bundles BBDown and finds the other programs from WinGet/system and other
known Windows installation locations, so Lite still requires those dependencies
to be installed separately. Lite also skips the WebView2 installation step and
uses the system WebView2 Runtime, so it does not show a WebView2 setup dialog or
carry the Full installer's offline runtime payload. Windows 10 22H2 and Windows
11 normally include the runtime; if it is missing, install it separately or use
Full. Settings allows either installer to prefer a newer system version.

Prepare and build:

```powershell
npm ci
npm run tauri:build:lite
npm run tauri:build:full
```

The package scripts select the Windows x64 build flow on a Windows x64 host;
append `-- win` (for example `npm run tauri:build:lite -- win`) to pin the
target explicitly. The flow runs on Windows PowerShell 5.1, which ships with
Windows, so PowerShell 7 is not required. Every build first runs the TypeScript
and cargo checks, then `scripts/build/windows-tools.ps1` downloads only missing
artifacts and verifies pinned SHA-256
values. The output is a per-user bilingual NSIS installer. The build machine
needs network access when a pinned artifact or the Full-only WebView2 offline
package is not already cached; this does not create a network requirement for
the shipped Full installer. Lite does not download or package the WebView2
offline installer.

## CLI state and diagnostics

The bundled BBDown is launched directly from the directory shipped inside the
application. Later downloads use that same executable and working directory,
so BBDown reads `BBDown.data` exactly as in the original CLI. GUI QR login uses
BBDown's official web endpoints only to complete that native data file from the
Cookie fields returned by Bilibili; it does not modify the BBDown binary,
launch a separately installed BBDown, or keep a second credential store.

MAD Toolbox does not encrypt or inject this native state and does not use
Credential Manager. Templates are ordinary WebView application data.
Exported task logs preserve original CLI output and may therefore contain
cookies, passwords, tokens, proxy credentials, URLs and local paths.

## Unsigned distribution

The installer does not require a paid code-signing certificate. An unsigned
build can be installed and used, but Microsoft Defender SmartScreen may show
an unknown-publisher warning. Users must inspect the download source and
explicitly choose to continue.
