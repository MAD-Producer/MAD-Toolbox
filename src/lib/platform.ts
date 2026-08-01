export const isWindows =
  typeof navigator !== "undefined" &&
  /Windows/i.test(navigator.userAgent);

export const platformLabel = isWindows ? "Windows x64" : "Apple Silicon";
export const fileManagerName = isWindows ? "文件资源管理器" : "Finder";
export const defaultOutputPlaceholder = isWindows
  ? "C:\\Users\\name\\Downloads"
  : "/Users/name/Downloads";
export const mediaOutputPlaceholder = isWindows
  ? "C:\\Users\\name\\Videos\\Output"
  : "/Users/name/Movies/Output";

export const liteInstallCommand = isWindows
  ? "winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements; winget install --id yt-dlp.yt-dlp -e --accept-package-agreements --accept-source-agreements; winget install --id MediaArea.MediaInfo.CLI -e --accept-package-agreements --accept-source-agreements; winget install --id DenoLand.Deno -e --accept-package-agreements --accept-source-agreements"
  : "brew install ffmpeg yt-dlp media-info deno";

export const musicdlInstallCommand = isWindows
  ? "winget install --id Python.Python.3.13 -e --accept-package-agreements --accept-source-agreements; py -m pip install --user --upgrade pipx; py -m pipx ensurepath; py -m pipx install musicdl"
  : "brew install python pipx && pipx ensurepath && pipx install musicdl";

export const pipCommand = isWindows ? "py -m pip" : "python3 -m pip";
