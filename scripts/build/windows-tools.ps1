param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Full", "Lite")]
  [string]$Edition
)

# Ensures the pinned Windows x64 sidecars exist in src-tauri/binaries (and
# src-tauri/resources for Full) and that every SHA-256 matches. Missing or
# outdated files are re-downloaded from the pinned upstream releases; nothing
# is downloaded when the local copies already verify. Compatible with Windows
# PowerShell 5.1.
#
# Only PowerShell language constructs and .NET APIs are used: cmdlets that
# live in importable modules (Get-FileHash, Invoke-WebRequest, Expand-Archive,
# Test-Path, ...) are not recognized when module loading is broken (for
# example when the parent process passed down a PowerShell 7 PSModulePath),
# while direct .NET calls keep working.
$ErrorActionPreference = "Stop"

# Windows PowerShell 5.1 does not always enable TLS 1.2 by default (required
# by GitHub); WebClient downloads honor this setting.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ProjectRoot = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetDirectoryName($PSScriptRoot))
$BinaryRoot = [System.IO.Path]::Combine($ProjectRoot, "src-tauri\binaries")
$ResourceRoot = [System.IO.Path]::Combine($ProjectRoot, "src-tauri\resources")
$Target = "x86_64-pc-windows-msvc"
$TemporaryRoot = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), ("mad-toolbox-windows-" + [guid]::NewGuid()))

function Get-FileSha256 {
  param([string]$Path)
  $Sha256 = [System.Security.Cryptography.SHA256]::Create()
  $Stream = [System.IO.File]::OpenRead($Path)
  try {
    $HashBytes = $Sha256.ComputeHash($Stream)
  }
  finally {
    $Stream.Dispose()
    $Sha256.Dispose()
  }
  return ([System.BitConverter]::ToString($HashBytes)).Replace("-", "").ToLowerInvariant()
}

function Assert-Hash {
  param([string]$Path, [string]$Expected)
  if (-not [System.IO.File]::Exists($Path)) {
    throw "Missing file: $Path"
  }
  $Actual = Get-FileSha256 -Path $Path
  if ($Actual -ne $Expected.ToLowerInvariant()) {
    throw "SHA256 mismatch for $Path. Expected $Expected, got $Actual"
  }
}

function Get-VerifiedFile {
  param(
    [string]$Url,
    [string]$Output,
    [string]$Sha256
  )
  $Client = [System.Net.WebClient]::new()
  try {
    # GitHub rejects requests without a User-Agent header.
    $Client.Headers.Add("User-Agent", "MAD-Toolbox-build")
    $Client.DownloadFile($Url, $Output)
  }
  finally {
    $Client.Dispose()
  }
  Assert-Hash -Path $Output -Expected $Sha256
}

function Expand-VerifiedArchive {
  param([string]$Archive, [string]$Destination)
  # ZipFile lives in System.IO.Compression.FileSystem, which PowerShell does
  # not reference by default; the assembly is loaded directly instead of
  # using Expand-Archive (Microsoft.PowerShell.Archive module).
  $null = [System.Reflection.Assembly]::Load("System.IO.Compression.FileSystem, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089")
  [System.IO.Compression.ZipFile]::ExtractToDirectory($Archive, $Destination)
}

function Install-VerifiedBinary {
  param(
    [string]$Destination,
    [string]$ExpectedBinarySha256,
    [scriptblock]$Acquire
  )
  if ([System.IO.File]::Exists($Destination)) {
    $Actual = Get-FileSha256 -Path $Destination
    if ($Actual -eq $ExpectedBinarySha256.ToLowerInvariant()) {
      return
    }
  }
  & $Acquire
  Assert-Hash -Path $Destination -Expected $ExpectedBinarySha256
}

$null = [System.IO.Directory]::CreateDirectory($BinaryRoot)
$null = [System.IO.Directory]::CreateDirectory($ResourceRoot)
$null = [System.IO.Directory]::CreateDirectory($TemporaryRoot)

try {
  $BbdownDestination = [System.IO.Path]::Combine($BinaryRoot, "BBDown-$Target.exe")
  Install-VerifiedBinary `
    -Destination $BbdownDestination `
    -ExpectedBinarySha256 "eb8b985af07c4757fa695204283208aee879bf79f6462a1d161e3a55b5a19cb1" `
    -Acquire {
    $Archive = [System.IO.Path]::Combine($TemporaryRoot, "bbdown.zip")
    $Expanded = [System.IO.Path]::Combine($TemporaryRoot, "bbdown")
    Get-VerifiedFile `
      -Url "https://github.com/nilaoda/BBDown/releases/download/1.6.3/BBDown_1.6.3_20240814_win-x64.zip" `
      -Output $Archive `
      -Sha256 "40f1e2af0d4e74df765c6f93d2e931f9bea201d5168d0bc62dc35a54b7e0ec02"
    Expand-VerifiedArchive -Archive $Archive -Destination $Expanded
    [System.IO.File]::Copy([System.IO.Path]::Combine($Expanded, "BBDown.exe"), $BbdownDestination, $true)
  }

  if ($Edition -eq "Full") {
    $FfmpegDestination = [System.IO.Path]::Combine($BinaryRoot, "ffmpeg-$Target.exe")
    $FfprobeDestination = [System.IO.Path]::Combine($BinaryRoot, "ffprobe-$Target.exe")
    $FfmpegValid = [System.IO.File]::Exists($FfmpegDestination) -and `
    ((Get-FileSha256 -Path $FfmpegDestination) -eq "6099366f31293cdc6c283ea44ffb32f07e3139cd0caf6d0db652a7d064d089cb")
    $FfprobeValid = [System.IO.File]::Exists($FfprobeDestination) -and `
    ((Get-FileSha256 -Path $FfprobeDestination) -eq "4c2f730969c9551aec21c5ca07eb73f63bb0920204c9cd6c9a6e7be6be0458d2")
    if (-not ($FfmpegValid -and $FfprobeValid)) {
      $Archive = [System.IO.Path]::Combine($TemporaryRoot, "ffmpeg.zip")
      $Expanded = [System.IO.Path]::Combine($TemporaryRoot, "ffmpeg")
      # BtbN removes ordinary daily builds after 14 days. Pin the latest
      # month-end build instead; upstream retains those builds for two years.
      Get-VerifiedFile `
        -Url "https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-2026-07-31-14-10/ffmpeg-n8.1.2-34-g9b6c8969e0-win64-lgpl-8.1.zip" `
        -Output $Archive `
        -Sha256 "089e4169e93b2b3f3acbfced3c0704d24276a225641bdda04d796d28b07a2a38"
      Expand-VerifiedArchive -Archive $Archive -Destination $Expanded
      $Bins = [System.IO.Directory]::GetFiles($Expanded, "ffmpeg.exe", [System.IO.SearchOption]::AllDirectories)
      $Probes = [System.IO.Directory]::GetFiles($Expanded, "ffprobe.exe", [System.IO.SearchOption]::AllDirectories)
      if ($Bins.Length -eq 0 -or $Probes.Length -eq 0) {
        throw "FFmpeg archive does not contain ffmpeg.exe and ffprobe.exe"
      }
      [System.IO.File]::Copy($Bins[0], $FfmpegDestination, $true)
      [System.IO.File]::Copy($Probes[0], $FfprobeDestination, $true)
    }
    Assert-Hash -Path $FfmpegDestination -Expected "6099366f31293cdc6c283ea44ffb32f07e3139cd0caf6d0db652a7d064d089cb"
    Assert-Hash -Path $FfprobeDestination -Expected "4c2f730969c9551aec21c5ca07eb73f63bb0920204c9cd6c9a6e7be6be0458d2"

    $YtDlpDestination = [System.IO.Path]::Combine($BinaryRoot, "yt-dlp-$Target.exe")
    Install-VerifiedBinary `
      -Destination $YtDlpDestination `
      -ExpectedBinarySha256 "52fe3c26dcf71fbdc85b528589020bb0b8e383155cfa81b64dd447bbe35e24b8" `
      -Acquire {
      Get-VerifiedFile `
        -Url "https://github.com/yt-dlp/yt-dlp/releases/download/2026.07.04/yt-dlp.exe" `
        -Output $YtDlpDestination `
        -Sha256 "52fe3c26dcf71fbdc85b528589020bb0b8e383155cfa81b64dd447bbe35e24b8"
    }

    $DenoDestination = [System.IO.Path]::Combine($BinaryRoot, "deno-$Target.exe")
    Install-VerifiedBinary `
      -Destination $DenoDestination `
      -ExpectedBinarySha256 "4a2757fe99afc2c62c46500c8221cfa0189ac4bfb7064141875ad9c0f04b60ef" `
      -Acquire {
      $Archive = [System.IO.Path]::Combine($TemporaryRoot, "deno.zip")
      $Expanded = [System.IO.Path]::Combine($TemporaryRoot, "deno")
      Get-VerifiedFile `
        -Url "https://github.com/denoland/deno/releases/download/v2.9.4/deno-x86_64-pc-windows-msvc.zip" `
        -Output $Archive `
        -Sha256 "68ed08b05c56cf887e9aa509947dc3f468f7e12f47a13e5c1abd51d46d1453ef"
      Expand-VerifiedArchive -Archive $Archive -Destination $Expanded
      [System.IO.File]::Copy([System.IO.Path]::Combine($Expanded, "deno.exe"), $DenoDestination, $true)
    }

    $MediaInfoDestination = [System.IO.Path]::Combine($BinaryRoot, "mediainfo-$Target.exe")
    $LibcurlDestination = [System.IO.Path]::Combine($ResourceRoot, "MediaInfo-LIBCURL.DLL")
    $MediaInfoValid = [System.IO.File]::Exists($MediaInfoDestination) -and `
    ((Get-FileSha256 -Path $MediaInfoDestination) -eq "30f2828a45a1895b033c3cd7784581033327e7b393033c55f4a03bb15cab0d89")
    $LibcurlValid = [System.IO.File]::Exists($LibcurlDestination) -and `
    ((Get-FileSha256 -Path $LibcurlDestination) -eq "22b972f008ab8bb5bc225889a8be60683b2bf7546b8e0d699b5b4186bdbb7cc1")
    if (-not ($MediaInfoValid -and $LibcurlValid)) {
      $Archive = [System.IO.Path]::Combine($TemporaryRoot, "mediainfo.zip")
      $Expanded = [System.IO.Path]::Combine($TemporaryRoot, "mediainfo")
      Get-VerifiedFile `
        -Url "https://mediaarea.net/download/binary/mediainfo/26.05/MediaInfo_CLI_26.05_Windows_x64.zip" `
        -Output $Archive `
        -Sha256 "f7f80620ce6d14f4995f0de6f98e3ef18ad29496db01899571152ee3311229f9"
      Expand-VerifiedArchive -Archive $Archive -Destination $Expanded
      [System.IO.File]::Copy([System.IO.Path]::Combine($Expanded, "MediaInfo.exe"), $MediaInfoDestination, $true)
      [System.IO.File]::Copy([System.IO.Path]::Combine($Expanded, "LIBCURL.DLL"), $LibcurlDestination, $true)
    }
    Assert-Hash -Path $MediaInfoDestination -Expected "30f2828a45a1895b033c3cd7784581033327e7b393033c55f4a03bb15cab0d89"
    Assert-Hash -Path $LibcurlDestination -Expected "22b972f008ab8bb5bc225889a8be60683b2bf7546b8e0d699b5b4186bdbb7cc1"
  }

  [Console]::WriteLine("Windows $Edition sidecars are present and verified for $Target.")
}
finally {
  if ([System.IO.Directory]::Exists($TemporaryRoot)) {
    [System.IO.Directory]::Delete($TemporaryRoot, $true)
  }
}
