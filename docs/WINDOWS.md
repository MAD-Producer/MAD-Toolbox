# Windows x64 build

MAD Toolbox 2.1.0 targets Windows 10 22H2 and Windows 11 on Intel/AMD x64
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

### Automated Store updates

The release build first publishes a public GitHub prerelease, after all Windows
and macOS assets have been uploaded. The existing formal release stays latest
while the new version is being reviewed by Microsoft Store. Rebuilding an
already formal release does not demote it to a prerelease.

`.github/workflows/publish-microsoft-store.yml` checks the highest published
`vX.Y.Z` version, including prereleases, every six hours at 00:07, 06:07, 12:07
and 18:07 UTC
(02:07, 08:07, 14:07 and 20:07 in Beijing). GitHub may delay or drop scheduled
runs under load; these are planned times, not guaranteed execution times.
It runs independently of the release build, so OpenList's 30-minute cache does
not hold up GitHub publishing.
The workflow must be on the default branch for scheduled runs to execute.
Drafts, nightly releases and suffixed beta/RC tags are ignored. The script lists
releases rather than using GitHub's latest-release endpoint, which excludes
prereleases.

Configure these repository Actions secrets:

- `STORE_APP_ID`: the application's Partner Center product ID.
- `STORE_SELLER_ID`: the account's Seller ID.
- `STORE_TENANT_ID`: the associated Microsoft Entra tenant ID.
- `STORE_CLIENT_ID`: the Entra application's client ID.
- `STORE_CLIENT_SECRET`: its client secret value.

The Entra application must be associated with Partner Center and have the
Manager role. The Store product must already have an x64 EXE package configured;
its languages, silent-install parameters and other package settings are preserved.

Keep the latest-only OpenList `/mt` mount unchanged. Create a separate GitHub
Releases mount `/mt_store` for `MAD-Producer/MAD-Toolbox`, enable all versions,
and share it under the ID `mt_store` without a password or expiry. Installer
URLs have the form
`https://openlist.frameneo.com/sd/mt_store/v2.1.0/MAD.Toolbox_2.1.0_x64-setup.exe`.
Keep the referenced GitHub releases and installer assets available and unchanged.
The all-versions mount must expose the public prerelease to Microsoft Store;
the latest-only `/mt` mount continues to expose only the formal release, without
changing application update URLs or parsing logic.

Only the unified `MAD.Toolbox_<version>_x64-setup.exe` is submitted. Releases
without that asset (including the existing FULL/LITE releases) are skipped.
The mirror check uses HEAD, checks the response type and advertised size, and
does not download the installer. A missing mirror waits for the next scheduled run.

The script follows the official
[MSI/EXE submission API](https://learn.microsoft.com/en-us/windows/apps/publish/store-submission-api):
update the existing package, commit it, check processing readiness, and submit.
It saves a small `microsoft-store-submission.json` asset on the corresponding
GitHub Release with the package URL and submission ID. This persists prepared
packages and submitted updates across runs without committing state to the repository.
When the submission API confirms `PUBLISHED`, the script also saves that terminal
status and promotes the corresponding GitHub prerelease to a formal release,
explicitly setting it as latest. Later runs skip further Store status queries
for the same release. If GitHub promotion fails, the next run retries promotion
from the saved status without submitting to Microsoft Store again.
Do not delete this asset while the workflow is managing the submission.

Windows and macOS become formally available together after this confirmation.
Until then the public prerelease remains directly downloadable on GitHub, but
is not advertised through `/mt/latest.json`. OpenList cache refresh and Store
client propagation can still create a short delay; this is not an atomic
cross-platform publication. A rejected submission or unavailable status leaves
the version as a prerelease. If Microsoft keeps returning HTTP 5xx, automatic
promotion cannot proceed until its API confirms publication.

Before submission, the workflow fills each existing listing language's `whatsNew`
field from the GitHub Release's Markdown bullet items, which the release workflow
generates from the version's CHANGELOG section. Download tables and introductory
text are excluded. The same original notes are used in every listing language;
no automatic translation is performed. Notes over the Store's 1,500-character
limit are truncated with an ellipsis; absent change items leave existing notes
unchanged. This intentionally replaces any manually entered `whatsNew`, using
a field-only metadata PATCH that preserves descriptions, screenshots, pricing
and other listing settings. Metadata processing resumes on the next run if needed.

The submission API submits the **entire current draft**, not just the package
and `whatsNew`. Manually saved description or other draft changes are therefore
included in certification when the workflow submits a new version. Runs that
skip a version or only check an active submission do not submit those changes.

Manual runs default to `dry_run=true`, which performs read-only checks. Set it
to false to submit immediately. An active submission is left to finish; an
already published version is skipped. Rejected submissions fail the workflow
instead of being resubmitted automatically: read the Partner Center certification
report, fix the cause, then run manually with `dry_run=false` and
`retry_failed=true`. Submission success means accepted for certification,
not that the update is already live. Package processing is checked once per run
and resumed on the next run if necessary; no runner waits through certification.
If the package URL already matches but its submission record is missing, the
workflow reports `untracked-package` without submitting again. Inspect Partner
Center before using the same manual retry option to resume an untracked draft.

An HTTP 5xx response from the submission-status endpoint reports
`status-unavailable` with a warning instead of failing the run. It does not mean
the submission was rejected or published: the workflow leaves the draft and
submission record unchanged and checks again on the next run, even when
`retry_failed=true`. Inspect Partner Center if this persists. Authentication,
permission errors, other API failures and confirmed rejection still fail the run.
Dry runs never persist a published status or otherwise change release assets.

Run the focused script tests with:

```powershell
node --test scripts/release/microsoft-store.test.js
```

## Unsigned distribution

The installer does not require a paid code-signing certificate. An unsigned
build can be installed and used, but Microsoft Defender SmartScreen may show
an unknown-publisher warning. Users must inspect the download source and
explicitly choose to continue.
