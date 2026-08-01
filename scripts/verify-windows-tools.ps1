param(
  [ValidateSet("Full", "Lite")]
  [string]$Edition = "Full"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BinaryRoot = Join-Path $ProjectRoot "src-tauri\binaries"
$ResourceRoot = Join-Path $ProjectRoot "src-tauri\resources"
$Target = "x86_64-pc-windows-msvc"

$Files = @(
  [pscustomobject]@{
    Name = "BBDown-$Target.exe"
    Sha256 = "eb8b985af07c4757fa695204283208aee879bf79f6462a1d161e3a55b5a19cb1"
  }
)
if ($Edition -eq "Full") {
  $Files += @(
    [pscustomobject]@{
      Name = "ffmpeg-$Target.exe"
      Sha256 = "6099366f31293cdc6c283ea44ffb32f07e3139cd0caf6d0db652a7d064d089cb"
    },
    [pscustomobject]@{
      Name = "ffprobe-$Target.exe"
      Sha256 = "4c2f730969c9551aec21c5ca07eb73f63bb0920204c9cd6c9a6e7be6be0458d2"
    },
    [pscustomobject]@{
      Name = "mediainfo-$Target.exe"
      Sha256 = "30f2828a45a1895b033c3cd7784581033327e7b393033c55f4a03bb15cab0d89"
    },
    [pscustomobject]@{
      Name = "yt-dlp-$Target.exe"
      Sha256 = "52fe3c26dcf71fbdc85b528589020bb0b8e383155cfa81b64dd447bbe35e24b8"
    },
    [pscustomobject]@{
      Name = "deno-$Target.exe"
      Sha256 = "4a2757fe99afc2c62c46500c8221cfa0189ac4bfb7064141875ad9c0f04b60ef"
    }
  )
}

foreach ($Entry in $Files) {
  $Path = Join-Path $BinaryRoot $Entry.Name
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Missing Windows sidecar: $Path"
  }
  $Actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($Actual -ne $Entry.Sha256) {
    throw "SHA256 mismatch for $Path"
  }
}

if ($Edition -eq "Full") {
  $Libcurl = Join-Path $ResourceRoot "MediaInfo-LIBCURL.DLL"
  $Actual = (Get-FileHash -LiteralPath $Libcurl -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($Actual -ne "22b972f008ab8bb5bc225889a8be60683b2bf7546b8e0d699b5b4186bdbb7cc1") {
    throw "SHA256 mismatch for $Libcurl"
  }
}

Write-Host "Verified Windows $Edition files for $Target."
