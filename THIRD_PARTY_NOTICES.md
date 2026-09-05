# Third-Party Notices

MAD Toolbox invokes the following independent command-line programs. Each
program remains under its own license.

## BBDown

- Project: BBDown
- Author: nilaoda and contributors
- Copyright: Copyright (c) 2020 nilaoda
- Version: 1.6.3 (2024-08-14)
- License: MIT
- Archived upstream: https://github.com/nilaoda/BBDown
- Official release: https://github.com/nilaoda/BBDown/releases/tag/1.6.3

The complete license is included at
`third_party/licenses/BBDown-MIT.txt`. MAD Toolbox is not affiliated with or
endorsed by the original BBDown author.

## FFmpeg and ffprobe

- Project: FFmpeg
- Website: https://ffmpeg.org/
- macOS version: 8.1.2
- Windows version: n8.1.2-34-g9b6c8969e0 (2026-07-31)
- License: LGPL-2.1-or-later (macOS) / LGPL-3.0-or-later (Windows build)
- macOS source: https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz
- Windows source: https://github.com/FFmpeg/FFmpeg/archive/9b6c8969e05b4f0b29f0f85cd501be6b3e582e6b.tar.gz
- Windows build recipe: https://github.com/BtbN/FFmpeg-Builds/archive/a99e8230eae00d1cee38f23076a7a1f55cd984e2.tar.gz

Both Full binaries were built without `--enable-gpl` or `--enable-nonfree`.
The macOS build links only to macOS system libraries and frameworks. Its source
archive is available through the link above and as a separate release asset.
The Windows x64 build is the BtbN FFmpeg-Builds LGPL static distribution. Its exact
FFmpeg source and BtbN build recipe are available through the links above and
as separate release assets. Binary and source checksums are recorded in
`third_party/windows-sources.json`; that metadata and the LGPL texts remain
included with the application.

The BtbN build recipe is Copyright 2020-2021 BtbN and licensed under MIT. Its
license is included at `third_party/licenses/BtbN-FFmpeg-Builds-MIT.txt`.

## yt-dlp and yt-dlp-ejs

- Project: yt-dlp
- Website: https://github.com/yt-dlp/yt-dlp
- Version: 2026.07.04
- Primary license: Unlicense

Official standalone executables contain additional components under their own
licenses. The selected release's `THIRD_PARTY_LICENSES.txt` is distributed
unchanged in the Full application.

## MediaInfo

- Project: MediaInfo
- Website: https://mediaarea.net/MediaInfo
- Version: 26.05
- Copyright: Copyright (c) 2002-2026 MediaArea.net SARL
- License: BSD-style two-clause license with alternate licensing options

Binary redistribution must reproduce the copyright notice, conditions and
disclaimer from the selected source release.

The official Windows CLI package also includes libcurl. curl and libcurl are
Copyright (c) 1996-2026 Daniel Stenberg and contributors and use the curl
license, reproduced at `third_party/licenses/curl.txt`.

## Deno

- Project: Deno
- Website: https://deno.com/
- Version: 2.9.4
- License: MIT and applicable third-party component licenses

Deno is needed for full current YouTube support in yt-dlp.

## musicdl (optional external dependency)

- Project: musicdl
- Author: Zhenchao Jin / CharlesPikachu and contributors
- Copyright: Copyright (c) 2018-2026 CharlesPikachu
- Website: https://github.com/CharlesPikachu/musicdl
- License: PolyForm Noncommercial License 1.0.0

musicdl is not distributed, copied or bundled with MAD Toolbox. The music
download page is disabled until the user independently installs musicdl.
MAD Toolbox calls the documented public Python API of that external
installation. Use is subject to musicdl's noncommercial license, upstream
disclaimer and the terms and copyright rules of each music service.
