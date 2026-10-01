# Windows x64 build

MAD Toolbox 2.0.0 targets Windows 10 22H2 and Windows 11 on Intel/AMD x64
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
Bundled tools are grouped under the installation directory as follows:

```text
dependencies/
├── BBDown/BBDown.exe
├── Deno/deno.exe
├── FFmpeg/ffmpeg.exe
├── FFmpeg/ffprobe.exe
├── MediaInfo/mediainfo.exe
├── MediaInfo/LIBCURL.DLL
└── yt-dlp/yt-dlp.exe
```

Lite bundles no command-line tools and finds BBDown and the other programs from
WinGet/system and other known Windows installation locations, so those dependencies
must be installed separately. Lite also skips the WebView2 installation step and
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
and cargo checks, then `scripts/build/windows-tools.ps1` downloads and verifies
missing pinned artifacts for Full builds. Lite builds do not download
command-line tools. The output is a per-user bilingual NSIS installer. The Full
build machine needs network access when a pinned artifact or the WebView2
offline package is not already cached; this does not create a network
requirement for the shipped Full installer. Lite does not download or package
the WebView2 offline installer.

## CLI state and diagnostics

The Full package's bundled BBDown and the Lite package's WinGet BBDown are
launched directly from their executable directories. Later downloads use that
same executable and working directory, so BBDown reads `BBDown.data` exactly as
in the original CLI. GUI QR login uses
BBDown's official web endpoints only to complete that native data file from the
Cookie fields returned by Bilibili; it does not modify the BBDown binary,
or keep a second credential store.

MAD Toolbox does not encrypt or inject this native state and does not use
Credential Manager. Templates are ordinary WebView application data.
Exported task logs preserve original CLI output and may therefore contain
cookies, passwords, tokens, proxy credentials, URLs and local paths.

## Installer appearance and hooks

The NSIS wizard is branded and customizable:

- `scripts/build/installer-branding.ps1` regenerates the installer bitmaps
  (`src-tauri/icons/installer-header.bmp`, 300x114, and
  `src-tauri/icons/installer-sidebar.bmp`, 328x628, shown on the Welcome and
  Finish pages) from the app icon and the theme brand color. Re-run it after
  changing either, and keep the dimensions and 24-bit BMP format. Both are 2x
  supersampled: MUI2 stretches bitmaps onto DPI-scaled controls, so a 1x
  (150x57 / 164x314) bitmap blurs on any display above 100% scaling, while a
  2x source is downscaled everywhere. The header stays icon-only because the
  page title is NSIS-drawn text; bitmap text would be clipped by the control.
- `src-tauri/windows/installer-hooks.nsh` provides the official install and
  uninstall hook points (`NSIS_HOOK_PREINSTALL`, `NSIS_HOOK_POSTINSTALL`,
  `NSIS_HOOK_PREUNINSTALL`, `NSIS_HOOK_POSTUNINSTALL`). Keep hook bodies free
  of UI such as `MessageBox` so silent installs never block.
- Beyond these, the full NSIS template can be replaced
  (`bundle.windows.nsis.template`) and installer wording can be overridden per
  language (`customLanguageFiles`); see the
  [Windows Installer guide](https://v2.tauri.app/distribute/windows-installer/).

## Silent install and uninstall

The installer supports the standard NSIS switches, verified locally with a full
install/uninstall cycle (exit code 0 both ways):

```powershell
"MAD Toolbox_2.0.0_x64-setup.exe" /S                      # silent install
"MAD Toolbox_2.0.0_x64-setup.exe" /S /D=D:\Apps\MADToolbox # silent install, custom dir
                                                          # (/D must be last and unquoted)
& "$env:LOCALAPPDATA\Programs\MAD Toolbox\uninstall.exe" /S _?="$env:LOCALAPPDATA\Programs\MAD Toolbox"  # silent uninstall
```

Silent uninstall removes files, the Start Menu shortcut and the registry
entry; only `uninstall.exe` itself remains in the directory (NSIS cannot
delete the running uninstaller), which is standard NSIS behavior. Existing
installs are upgraded in place; the installer reuses the previous install
directory recorded in the registry.

## Microsoft Store

The Store does not host the binaries: a Win32 product ("EXE or MSI app" in
Partner Center) links to an installer you host yourself, and the Store
installs it silently. Submission requirements and how this project meets them:

| Requirement                              | Status                                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Silent install (`/S`)                    | Supported out of the box; enter `/S` as the installer parameter in Partner Center                                |
| Offline WebView2 install                 | Use the Full edition (it embeds the offline installer; Lite skips WebView2)                                      |
| Auto-update handling                     | The Tauri updater already ships (`tauri.updater.conf.json`, enabled when CI injects `TAURI_SIGNING_PRIVATE_KEY`) |
| Code signing                             | **Not yet done** — a paid code-signing certificate is required for submission                                    |
| Publisher name differs from product name | Derived publisher is `madproducer` (from the identifier); consider setting `bundle.publisher` explicitly         |

See the official [Microsoft Store guide](https://v2.tauri.app/distribute/microsoft-store/)
for the Partner Center flow. Package the Store build with
`tauri build --no-bundle` plus `tauri bundle --config` if Store-specific
settings ever need to diverge from the GitHub-distributed installers.

## Unsigned distribution

The installer does not require a paid code-signing certificate. An unsigned
build can be installed and used, but Microsoft Defender SmartScreen may show
an unknown-publisher warning. Users must inspect the download source and
explicitly choose to continue.
