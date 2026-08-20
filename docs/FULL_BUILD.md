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
`third_party/sources.json` and `third_party/build/`. `scripts/build/macos-tools.sh`
fetches missing or outdated upstream sidecars (BBDown, MediaInfo, yt-dlp, Deno)
from the pinned releases and verifies every SHA-256; only the self-built
FFmpeg/ffprobe pair is committed under `src-tauri/binaries/`. The bundled macOS
BBDown binary is the official, unmodified release. For GUI QR login, MAD Toolbox
follows BBDown's official web endpoints, reads the complete Cookie fields from
the poll response, validates the account, and writes the same native
`BBDown.data` format. Normal downloads invoke BBDown unchanged.

The Windows tool pack is pinned in `third_party/windows-sources.json`.
`scripts/build/windows-tools.ps1 -Edition Full` downloads missing official
artifacts and verifies archive and binary hashes; the build entry
(`npm run tauri:build:full`, which dispatches to `scripts/build/windows.ps1`)
runs it automatically before packaging. The exact
FFmpeg source revision and BtbN build-recipe snapshot under
`third_party/source_archives/` are copied into the Windows installer.

The Windows Full NSIS configuration uses WebView2's `offlineInstaller` mode, so
the WebView2 runtime is embedded in the installer instead of being fetched from
the internet during installation. The Windows Lite installer uses
`src-tauri/tauri.windows.lite.conf.json`, contains BBDown only, and sets
WebView2's `skip` mode so it does not show a setup dialog or carry the offline
runtime payload. Lite therefore requires the system WebView2 Runtime. Full and
Lite share the same application code; runtime tool-source settings decide
whether bundled or system executables are used.
