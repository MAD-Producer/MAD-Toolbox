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

## Unified installer

The installer contains no command-line dependencies. System tools installed
with WinGet and other supported locations remain usable. App-managed tools
are resolved from the application data directory, not the installation directory;
Settings supports CDN installation and independent updates for app-managed binary tools;
system tools remain available but are not upgraded by Toolbox.

The NSIS configuration uses WebView2's download bootstrapper. Existing WebView2
is reused; a missing runtime requires network access during installation.

Build on Windows x64:

```powershell
npm ci
npm run tauri:build
```

Use `npm run tauri:build -- win` to select the Windows flow explicitly.
The entry runs TypeScript and cargo preflights, then invokes
`scripts/build/windows.ps1` with `src-tauri/tauri.windows.conf.json`.
No tool download or source-archive packaging runs as part of this build.

## CLI state and diagnostics

The selected app-managed or system BBDown is launched directly from its
executable directory. Later downloads use that
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

The installer uses the standard NSIS switches. A complete install/uninstall
cycle for the unified package still needs platform validation:

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
| WebView2 installation                    | Downloads the bootstrapper if needed; an offline runtime installer is not bundled                                |
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
