# Dependency installation

## macOS Lite build

BBDown is already included. Install all other dependencies:

```bash
brew install ffmpeg yt-dlp media-info deno
```

MAD Toolbox searches `/opt/homebrew/bin`, `/usr/local/bin` and the process
`PATH`. Finder-launched applications therefore still find Apple Silicon
Homebrew tools.

Official pages:

- FFmpeg current Homebrew build: https://formulae.brew.sh/formula/ffmpeg
- FFmpeg 7: https://formulae.brew.sh/formula/ffmpeg%407
- FFmpeg 6: https://formulae.brew.sh/formula/ffmpeg%406
- FFmpeg 5: https://formulae.brew.sh/formula/ffmpeg%405
- FFmpeg source and historical releases: https://ffmpeg.org/download.html
- yt-dlp: https://github.com/yt-dlp/yt-dlp/releases
- MediaInfo CLI: https://mediaarea.net/MediaInfo/Download/Mac_OS
- Deno: https://docs.deno.com/runtime/getting_started/installation/

## Windows x64 Lite build

BBDown is already included. On Windows 10 22H2 or Windows 11 x64, install the
remaining tools with WinGet:

```powershell
winget install --id Gyan.FFmpeg -e
winget install --id yt-dlp.yt-dlp -e
winget install --id MediaArea.MediaInfo.CLI -e
winget install --id DenoLand.Deno -e
```

MAD Toolbox searches the inherited `PATH`, WindowsApps, WinGet Links, Scoop and
Chocolatey locations, pipx locations and user Python directories. Use Settings
to choose whether bundled or system tools are preferred.

The Windows Lite installer does not install WebView2. It uses the system
WebView2 Runtime, which is normally present on Windows 10 22H2 and Windows 11;
install the runtime separately if it is missing. Use the Full installer when a
network-free WebView2 installation is required.

Official or project-designated release pages:

- FFmpeg official build index: https://ffmpeg.org/download.html
- Gyan Windows builds: https://www.gyan.dev/ffmpeg/builds/
- BtbN Windows builds: https://github.com/BtbN/FFmpeg-Builds/releases
- yt-dlp: https://github.com/yt-dlp/yt-dlp/releases
- MediaInfo CLI: https://mediaarea.net/MediaInfo/Download/Windows
- Deno: https://github.com/denoland/deno/releases

Windows binaries may also be selected from a local folder in the GUI.

## Windows x64 Full build

The Full installer contains pinned x64 builds of BBDown, FFmpeg/ffprobe,
MediaInfo CLI, yt-dlp and Deno. No commands above are required. Its exact
downloads, archive and executable SHA-256 values are recorded in
`third_party/windows-sources.json`. The Windows Full installer also embeds the
WebView2 offline installer, so installing and launching it does not require an
internet connection. Network access is still required for network-video tasks
themselves.

The current FFmpeg sidecars use BtbN's LGPL static Windows x64 build. This
keeps GPL and nonfree components out of the distributed package. The exact
FFmpeg source revision and the BtbN build-recipe snapshot are included in the
installer to satisfy source and attribution obligations.

Python and musicdl remain external in both modes:

```powershell
winget install --id Python.Python.3.13 -e
py -m pip install --user pipx
py -m pipx ensurepath
py -m pipx install musicdl
```
