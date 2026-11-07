# Windows x64 build

MAD Toolbox 2.1.2 targets Windows 10 22H2 and Windows 11 on Intel/AMD x64
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
  Finish pages) by rasterizing the vector logo `assets/logo.svg` with Edge or
  Chrome headless at the final pixel sizes. Both use the brand blue with the
  icon; the header adds a stacked two-line "MAD Toolbox" wordmark. Re-run it
  after changing the logo or a lockup, and keep the dimensions and 24-bit BMP
  format. Both are 2x supersampled: MUI2 stretches bitmaps onto DPI-scaled
  controls, so a 1x (150x57 / 164x314) bitmap blurs on any display above 100%
  scaling, while a 2x source is downscaled everywhere. The page title is
  NSIS-drawn text and is never part of the bitmaps.
- `src-tauri/windows/installer-hooks.nsh` provides the official install and
  uninstall hook points (`NSIS_HOOK_PREINSTALL`, `NSIS_HOOK_POSTINSTALL`,
  `NSIS_HOOK_PREUNINSTALL`, `NSIS_HOOK_POSTUNINSTALL`). Keep hook bodies free
  of UI such as `MessageBox` so silent installs never block. The file also
  carries the bilingual privacy-policy strings consumed by the installer's
  privacy page.
- `src-tauri/windows/installer.nsi` is the full NSIS template, vendored from
  tauri-bundler (@tauri-apps/cli v2.11.4). Local changes: `ShowInstDetails
show`; runtime GDI HALFTONE re-stretching of the header and welcome/finish
  bitmaps (the built-in scaling is nearest-neighbor and jagged above 100%
  DPI); and the privacy policy page replacing the optional license page. On
  every @tauri-apps/cli upgrade, re-sync the file from upstream and re-apply
  these changes; installer wording can also be overridden per language
  (`customLanguageFiles`), see the
  [Windows Installer guide](https://v2.tauri.app/distribute/windows-installer/).

## Privacy policy page

After the Welcome page the installer shows the privacy policy and requires
selecting "I accept" before Next is enabled (MUI2 radio buttons). The policy
is shown in Chinese or English following the installer language. The page is
skipped for passive (`/P`) and silent (`/S`) installs, so in-app updates and
Microsoft Store installations never block on it.

The policy text has a single source: `src/data/privacy.ts` in the
madtool-box-site website repository. Regenerate the installer's RTF copies
after changing it, and commit them:

```powershell
node scripts/build/privacy-rtf.mjs   # writes src-tauri/windows/licenses/privacy-*.rtf
```

## Silent install and uninstall

The installer uses the standard NSIS switches. A complete install/uninstall
cycle for the unified package still needs platform validation:

```powershell
"MAD Toolbox_2.1.0_x64-setup.exe" /S                      # silent install
"MAD Toolbox_2.1.0_x64-setup.exe" /S /D=D:\Apps\MADToolbox # silent install, custom dir
                                                          # (/D must be last and unquoted)
& "$env:LOCALAPPDATA\Programs\MAD Toolbox\uninstall.exe" /S _?="$env:LOCALAPPDATA\Programs\MAD Toolbox"  # silent uninstall
```

Silent uninstall removes files, the Start Menu shortcut and the registry
entry; only `uninstall.exe` itself remains in the directory (NSIS cannot
delete the running uninstaller), which is standard NSIS behavior. Existing
installs are upgraded in place; the installer reuses the previous install
directory recorded in the registry.

## GitHub Releases

`.github/workflows/publish-release-assets.yml` builds the Windows and macOS
packages and publishes a formal GitHub Release after all assets have been uploaded.
A draft holds the assets during upload; publication clears the prerelease flag
and marks the release as latest. Microsoft Store submission and review are no
longer part of the release process.

## Unsigned distribution

The installer does not require a paid code-signing certificate. An unsigned
build can be installed and used, but Microsoft Defender SmartScreen may show
an unknown-publisher warning. Users must inspect the download source and
explicitly choose to continue.
