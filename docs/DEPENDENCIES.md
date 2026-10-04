# Dependency installation and independent releases

Application packages no longer bundle command-line tools or distinguish distribution editions.
Settings selects app-managed or system executables, with fallback when the preferred
source is unavailable. System installations are not overwritten or upgraded by Toolbox.
System install commands remain available when only an app-managed copy exists, so users
can install a system copy without removing the managed one first.

Dependency source preference, language and theme changes take effect and are saved
immediately. General settings shows its Save footer only when the output directory,
proxy or Cookie files have unsaved changes. Saving those fields preserves the current
language and dependency source preference.

## Current integration status

The unified packaging flow, source resolution, schema 1 manifest parsing and mirror
installation/update UI are implemented. The independent repository has a public Release
with ten ZIPs and `version.json`; the OpenList manifest endpoint has returned valid JSON.
Real installation checks and platform runtime validation are reported separately.

On 2026-10-03, the Windows backend downloaded the current MediaInfo ZIP (about 4 MB)
from the live share, verified its hash, extracted it, installed it into an isolated
temporary directory and confirmed that its installation record matches the latest package.
The full Rust test suite passes on Windows (23 tests; one live-CDN test is ignored by
default). The live-CDN test was also run explicitly, and TypeScript/i18n checks passed. Browser checks using
Tauri's IPC/event mocks cover dual-source buttons, managed-only updates, progress across
navigation, installation failure/retry and manifest failure recovery at widths 600/900/1280.
These checks do not install tools into the user's environment or validate macOS execution.

At startup and on Re-check, Toolbox fetches the latest manifest independently of local
tool detection. Only app-managed installation records are compared with the selected
package's filename and SHA-256, including same-version packaging fixes. Available updates
are announced once per app session and shown in Settings → Dependencies. System-only
installations do not produce mirror update reminders.

Each binary tool offers CDN installation alongside the system command option when a
system copy is missing. Settings shows only FFmpeg and excludes ffprobe from its status
cards and readiness counts. FFprobe is installed and updated with FFmpeg. Python and musicdl
offer system commands only. Download progress remains available when leaving and
returning to settings. A failed manifest check does not invalidate local dependencies.

Install actions appear in each tool's title row, before the source indicator. Cloud and
device icons distinguish app-managed and system sources; installation actions use cloud
download and terminal icons. Separate command hint cards are no longer displayed.

App-managed files belong under `<app data>/dependencies/<tool>/`, not inside the
application bundle. `ffmpeg` and `ffprobe` share one package directory. Toolbox's local
`installation.json` records its installed version, ZIP identity and relative executable
paths; this record is not the remote `version.json` schema.

The mirror command accepts a tool identifier and reads the current manifest in the
backend before installing. It downloads the selected ZIP from the dependency share
with the configured proxy, verifies SHA-256,
then extracts it into a temporary directory. Only archive boundaries and required files
are checked; installation does not run tools or parse their version output. FFmpeg requires
both executables, and macOS executable permissions are restored. `installation.json` is
reserved for Toolbox and must not be included in a dependency ZIP.

Replacement checks relevant queued/running tasks before downloading and again before
switching directories. BBDown login data is copied at the switch, not from an earlier
download-time snapshot. A failed switch restores the old directory; if restoration fails,
the old files are retained at the path reported in the error. This temporary recovery does
not expose historical dependency versions or a rollback feature. SHA-256 checks integrity,
not publisher identity; it is not a manifest-signing implementation.

The backend emits `dependency-download-progress` (`tool`, `received`, optional `total`)
and the existing `dependency-install-finished` event. Windows tests use tiny local ZIPs
and a loopback HTTP server for download, hash mismatch, archive/file checks, state
preservation and failed replacement. They do not verify real CDN assets or macOS runtime.

## Windows x64: system installation

```powershell
winget install --id nilaoda.BBDown -e
winget install --id Gyan.FFmpeg -e
winget install --id yt-dlp.yt-dlp -e
winget install --id MediaArea.MediaInfo -e
winget install --id DenoLand.Deno -e
```

Toolbox searches PATH and the supported WinGet, Scoop, Chocolatey, pipx and Python
locations. Restart the application when installation modifies PATH outside the known
locations. Missing WebView2 is installed using the bootstrapper; the application
installer no longer contains an offline runtime payload.

## macOS arm64: system installation

```sh
brew install ffmpeg yt-dlp media-info deno
dotnet tool install --global BBDown
```

BBDown's command requires an existing .NET SDK. Toolbox searches Homebrew locations,
PATH, `~/.local/bin` and `~/.dotnet/tools`. System BBDown is supported on macOS;
it is no longer restricted to an application-bundled executable.

## Python and musicdl

Python and musicdl remain system-only dependencies. Settings generates the existing
Python/pipx installation or repair command and opens a terminal to execute it.
Missing music dependencies do not disable video features.

Toolbox reuses a runnable Python 3.10+ interpreter with venv support and explicitly
passes it to pipx. If none is found, the installer selects Python 3.13. The interpreter
recorded in the musicdl launcher is authoritative. Failed imports are reported;
automatic repair is only offered for a confirmed pipx environment. Custom pipx
home and launcher directories are retained during repair.

## Independent dependency publication

Dependencies are published from
[MAD-Producer/mt_dependencies](https://github.com/MAD-Producer/mt_dependencies), whose
README is the authoritative contract for upstream sources, ZIP packaging, lightweight
verification, Release publication and OpenList configuration. Windows FFmpeg uses the
Gyan Release full static build; macOS uses the Martin Riedel arm64 release. The dependency
share is separate from the application update share:

- Application updates: `/sd/mt/latest.json`.
- Dependency manifest: `/sd/mt_dependencies/version.json`.

Schema 1 uses `platforms.windows-x64` and `platforms.macos-arm64`, each containing the
five binary packages. Each entry supplies `version`, `fileName`, `sha256`, `size` and
relative `executables`. Publisher provenance fields and `generatedAt` do not gate updates.

Release installers include the application version in their filenames. Nightly installers
also include the source commit prefix, so snapshots of the same version can be distinguished.
