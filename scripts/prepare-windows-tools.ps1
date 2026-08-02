param(
  [ValidateSet("Full", "Lite")]
  [string]$Edition = "Full"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BinaryRoot = Join-Path $ProjectRoot "src-tauri\binaries"
$ResourceRoot = Join-Path $ProjectRoot "src-tauri\resources"
$Target = "x86_64-pc-windows-msvc"
$TemporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("mad-toolbox-windows-" + [guid]::NewGuid())

function Assert-Hash {
  param([string]$Path, [string]$Expected)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Missing file: $Path"
  }
  $Actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($Actual -ne $Expected.ToLowerInvariant()) {
    throw "SHA256 mismatch for $Path. Expected $Expected, got $Actual"
  }
}

function Get-VerifiedFile {
  param(
    [string]$Url,
    [string]$Output,
    [string]$Sha256,
    [hashtable]$Headers = @{}
  )
  Invoke-WebRequest -Uri $Url -OutFile $Output -Headers $Headers -UseBasicParsing
  Assert-Hash -Path $Output -Expected $Sha256
}

function Expand-VerifiedArchive {
  param([string]$Archive, [string]$Destination)
  New-Item -ItemType Directory -Path $Destination -Force | Out-Null
  Expand-Archive -LiteralPath $Archive -DestinationPath $Destination -Force
}

function Install-VerifiedBinary {
  param(
    [string]$Destination,
    [string]$ExpectedBinarySha256,
    [scriptblock]$Acquire
  )
  if (Test-Path -LiteralPath $Destination -PathType Leaf) {
    $Actual = (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($Actual -eq $ExpectedBinarySha256.ToLowerInvariant()) {
      return
    }
  }
  & $Acquire
  Assert-Hash -Path $Destination -Expected $ExpectedBinarySha256
}

New-Item -ItemType Directory -Path $BinaryRoot -Force | Out-Null
New-Item -ItemType Directory -Path $ResourceRoot -Force | Out-Null
New-Item -ItemType Directory -Path $TemporaryRoot -Force | Out-Null

try {
  $BbdownDestination = Join-Path $BinaryRoot "BBDown-$Target.exe"
  Install-VerifiedBinary `
    -Destination $BbdownDestination `
    -ExpectedBinarySha256 "eb8b985af07c4757fa695204283208aee879bf79f6462a1d161e3a55b5a19cb1" `
    -Acquire {
      $Archive = Join-Path $TemporaryRoot "bbdown.zip"
      $Expanded = Join-Path $TemporaryRoot "bbdown"
      Get-VerifiedFile `
        -Url "https://github.com/nilaoda/BBDown/releases/download/1.6.3/BBDown_1.6.3_20240814_win-x64.zip" `
        -Output $Archive `
        -Sha256 "40f1e2af0d4e74df765c6f93d2e931f9bea201d5168d0bc62dc35a54b7e0ec02"
      Expand-VerifiedArchive -Archive $Archive -Destination $Expanded
      Copy-Item -LiteralPath (Join-Path $Expanded "BBDown.exe") -Destination $BbdownDestination -Force
    }

  if ($Edition -eq "Full") {
    $FfmpegDestination = Join-Path $BinaryRoot "ffmpeg-$Target.exe"
    $FfprobeDestination = Join-Path $BinaryRoot "ffprobe-$Target.exe"
    $FfmpegValid = (Test-Path -LiteralPath $FfmpegDestination -PathType Leaf) -and `
      ((Get-FileHash -LiteralPath $FfmpegDestination -Algorithm SHA256).Hash.ToLowerInvariant() -eq "0df0daa264f1c6a6dd6e41a0b931b58050726194ee25c18f5e31843545e70e46")
    $FfprobeValid = (Test-Path -LiteralPath $FfprobeDestination -PathType Leaf) -and `
      ((Get-FileHash -LiteralPath $FfprobeDestination -Algorithm SHA256).Hash.ToLowerInvariant() -eq "4a745d4c13cc672b4c84f80cb4fa4af1c32f189d02ef500d076161e06a27d20e")
    if (-not ($FfmpegValid -and $FfprobeValid)) {
      $Archive = Join-Path $TemporaryRoot "ffmpeg.zip"
      $Expanded = Join-Path $TemporaryRoot "ffmpeg"
      $Headers = @{
        Accept = "application/octet-stream"
        "X-GitHub-Api-Version" = "2022-11-28"
      }
      Get-VerifiedFile `
        -Url "https://api.github.com/repos/BtbN/FFmpeg-Builds/releases/assets/498933268" `
        -Output $Archive `
        -Sha256 "53f717ef88d5073c06fb57531af5be7fb6a0703cf1ef4d067a47b169ab9c9d3b" `
        -Headers $Headers
      Expand-VerifiedArchive -Archive $Archive -Destination $Expanded
      $Bin = Get-ChildItem -LiteralPath $Expanded -Filter "ffmpeg.exe" -File -Recurse | Select-Object -First 1
      $Probe = Get-ChildItem -LiteralPath $Expanded -Filter "ffprobe.exe" -File -Recurse | Select-Object -First 1
      if ($null -eq $Bin -or $null -eq $Probe) {
        throw "FFmpeg archive does not contain ffmpeg.exe and ffprobe.exe"
      }
      Copy-Item -LiteralPath $Bin.FullName -Destination $FfmpegDestination -Force
      Copy-Item -LiteralPath $Probe.FullName -Destination $FfprobeDestination -Force
    }
    Assert-Hash -Path $FfmpegDestination -Expected "0df0daa264f1c6a6dd6e41a0b931b58050726194ee25c18f5e31843545e70e46"
    Assert-Hash -Path $FfprobeDestination -Expected "4a745d4c13cc672b4c84f80cb4fa4af1c32f189d02ef500d076161e06a27d20e"

    $YtDlpDestination = Join-Path $BinaryRoot "yt-dlp-$Target.exe"
    Install-VerifiedBinary `
      -Destination $YtDlpDestination `
      -ExpectedBinarySha256 "52fe3c26dcf71fbdc85b528589020bb0b8e383155cfa81b64dd447bbe35e24b8" `
      -Acquire {
        Get-VerifiedFile `
          -Url "https://github.com/yt-dlp/yt-dlp/releases/download/2026.07.04/yt-dlp.exe" `
          -Output $YtDlpDestination `
          -Sha256 "52fe3c26dcf71fbdc85b528589020bb0b8e383155cfa81b64dd447bbe35e24b8"
      }

    $DenoDestination = Join-Path $BinaryRoot "deno-$Target.exe"
    Install-VerifiedBinary `
      -Destination $DenoDestination `
      -ExpectedBinarySha256 "4a2757fe99afc2c62c46500c8221cfa0189ac4bfb7064141875ad9c0f04b60ef" `
      -Acquire {
        $Archive = Join-Path $TemporaryRoot "deno.zip"
        $Expanded = Join-Path $TemporaryRoot "deno"
        Get-VerifiedFile `
          -Url "https://github.com/denoland/deno/releases/download/v2.9.4/deno-x86_64-pc-windows-msvc.zip" `
          -Output $Archive `
          -Sha256 "68ed08b05c56cf887e9aa509947dc3f468f7e12f47a13e5c1abd51d46d1453ef"
        Expand-VerifiedArchive -Archive $Archive -Destination $Expanded
        Copy-Item -LiteralPath (Join-Path $Expanded "deno.exe") -Destination $DenoDestination -Force
      }

    $MediaInfoDestination = Join-Path $BinaryRoot "mediainfo-$Target.exe"
    $LibcurlDestination = Join-Path $ResourceRoot "MediaInfo-LIBCURL.DLL"
    $MediaInfoValid = (Test-Path -LiteralPath $MediaInfoDestination -PathType Leaf) -and `
      ((Get-FileHash -LiteralPath $MediaInfoDestination -Algorithm SHA256).Hash.ToLowerInvariant() -eq "30f2828a45a1895b033c3cd7784581033327e7b393033c55f4a03bb15cab0d89")
    $LibcurlValid = (Test-Path -LiteralPath $LibcurlDestination -PathType Leaf) -and `
      ((Get-FileHash -LiteralPath $LibcurlDestination -Algorithm SHA256).Hash.ToLowerInvariant() -eq "22b972f008ab8bb5bc225889a8be60683b2bf7546b8e0d699b5b4186bdbb7cc1")
    if (-not ($MediaInfoValid -and $LibcurlValid)) {
      $Archive = Join-Path $TemporaryRoot "mediainfo.zip"
      $Expanded = Join-Path $TemporaryRoot "mediainfo"
      Get-VerifiedFile `
        -Url "https://mediaarea.net/download/binary/mediainfo/26.05/MediaInfo_CLI_26.05_Windows_x64.zip" `
        -Output $Archive `
        -Sha256 "f7f80620ce6d14f4995f0de6f98e3ef18ad29496db01899571152ee3311229f9"
      Expand-VerifiedArchive -Archive $Archive -Destination $Expanded
      Copy-Item -LiteralPath (Join-Path $Expanded "MediaInfo.exe") -Destination $MediaInfoDestination -Force
      Copy-Item -LiteralPath (Join-Path $Expanded "LIBCURL.DLL") -Destination $LibcurlDestination -Force
    }
    Assert-Hash -Path $MediaInfoDestination -Expected "30f2828a45a1895b033c3cd7784581033327e7b393033c55f4a03bb15cab0d89"
    Assert-Hash -Path $LibcurlDestination -Expected "22b972f008ab8bb5bc225889a8be60683b2bf7546b8e0d699b5b4186bdbb7cc1"
  }

  Write-Host "Windows $Edition sidecars are present and verified for $Target."
}
finally {
  if (Test-Path -LiteralPath $TemporaryRoot) {
    Remove-Item -LiteralPath $TemporaryRoot -Recurse -Force
  }
}
