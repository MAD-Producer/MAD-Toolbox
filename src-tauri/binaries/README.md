# Bundled CLI binaries

The Lite build always includes BBDown and resolves other tools from the system.

Only the self-built FFmpeg/ffprobe pair (`ffmpeg-aarch64-apple-darwin`,
`ffprobe-aarch64-apple-darwin`) is committed to the repository. Every other
sidecar is fetched from its pinned upstream release and SHA-256-verified on
demand by `scripts/build/windows-tools.ps1` and `scripts/build/macos-tools.sh`.

Required Apple Silicon filenames:

```text
BBDown-aarch64-apple-darwin
ffmpeg-aarch64-apple-darwin
ffprobe-aarch64-apple-darwin
mediainfo-aarch64-apple-darwin
yt-dlp-aarch64-apple-darwin
deno-aarch64-apple-darwin
```

Required Windows x64 filenames:

```text
BBDown-x86_64-pc-windows-msvc.exe
ffmpeg-x86_64-pc-windows-msvc.exe
ffprobe-x86_64-pc-windows-msvc.exe
mediainfo-x86_64-pc-windows-msvc.exe
yt-dlp-x86_64-pc-windows-msvc.exe
deno-x86_64-pc-windows-msvc.exe
```

Binary provenance and checksums are recorded in `third_party/sources.json`
and `third_party/windows-sources.json`. Do not commit downloaded binaries or
archives.
