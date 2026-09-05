# Full build policy

The macOS Full build uses `src-tauri/tauri.full.conf.json`. The Windows Full
build uses `src-tauri/tauri.windows.full.conf.json`.

Required macOS architecture-suffixed files:

```text
src-tauri/binaries/BBDown-aarch64-apple-darwin
src-tauri/binaries/ffmpeg-aarch64-apple-darwin
src-tauri/binaries/ffprobe-aarch64-apple-darwin
src-tauri/binaries/mediainfo-aarch64-apple-darwin
src-tauri/binaries/yt-dlp-aarch64-apple-darwin
src-tauri/binaries/deno-aarch64-apple-darwin
```

Required Windows x64 architecture-suffixed files:

```text
src-tauri/binaries/BBDown-x86_64-pc-windows-msvc.exe
src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe
src-tauri/binaries/ffprobe-x86_64-pc-windows-msvc.exe
src-tauri/binaries/mediainfo-x86_64-pc-windows-msvc.exe
src-tauri/binaries/yt-dlp-x86_64-pc-windows-msvc.exe
src-tauri/binaries/deno-x86_64-pc-windows-msvc.exe
src-tauri/resources/MediaInfo-LIBCURL.DLL
```

Every tool must be version-pinned in `third_party/sources.json` or
`third_party/windows-sources.json`, accompanied by its exact license files and
verified with SHA-256 before packaging.

For FFmpeg, publish the corresponding source revision, build scripts,
configure flags and configure output. Never package an `--enable-nonfree`
build.

The macOS tool pack and reproducible arm64 build procedure are pinned in
`third_party/sources.json` and `third_party/build/`. The bundled macOS BBDown
binary is the official, unmodified release. For GUI QR login, MAD Toolbox
follows BBDown's official web endpoints, reads the complete Cookie fields from
the poll response, validates the account, and writes the same native
`BBDown.data` format. Normal downloads invoke BBDown unchanged.
The pinned FFmpeg source archive remains in the repository and is published as
a separate release asset instead of being copied into the macOS Full bundle.

The Windows tool pack is pinned in `third_party/windows-sources.json`.
`scripts/build/windows-tools.ps1 -Edition Full` downloads missing official
artifacts and verifies archive and binary hashes; the build entry
(`npm run tauri:build:full`, which dispatches to `scripts/build/windows.ps1`)
runs it automatically before packaging. The exact FFmpeg source revision and
BtbN build-recipe snapshot under `third_party/source_archives/` are published
as separate release assets instead of being copied into the Windows installer.
The installed executables are grouped under `dependencies/<tool>/`; FFmpeg and
ffprobe share `dependencies/FFmpeg`, and MediaInfo's `LIBCURL.DLL` stays beside
`mediainfo.exe` in `dependencies/MediaInfo`.

macOS Full sidecars remain as a flat list in `Contents/MacOS`. Apple treats that
as a code location and requires code items to be placed directly in it instead
of custom subdirectories. `scripts/build/macos.sh` also restores the verified
BBDown and yt-dlp files there before resealing the application bundle.

The Windows Full NSIS configuration uses WebView2's `offlineInstaller` mode, so
the WebView2 runtime is embedded in the installer instead of being fetched from
the internet during installation. The Windows Lite installer uses
`src-tauri/tauri.windows.lite.conf.json`, contains no command-line sidecars, and
sets WebView2's `skip` mode so it does not show a setup dialog or carry the
offline runtime payload. Lite therefore requires BBDown and the other tools to
be installed with WinGet, plus the system WebView2 Runtime. Full and Lite share
the same application code; runtime tool-source settings decide whether bundled
or system executables are used.
