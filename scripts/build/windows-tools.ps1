param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Full")]
  [string]$Edition
)

# Ensures the pinned Windows Full x64 sidecars exist in src-tauri/binaries (and
# src-tauri/resources). third_party/windows-sources.json is the single source
# of truth for artifact URLs and SHA-256 values: missing or outdated files are
# re-downloaded from the pinned upstream releases, and nothing is downloaded
# when the local copies already match. Compatible with Windows PowerShell 5.1.
#
# Only PowerShell language constructs and .NET APIs are used: cmdlets that
# live in importable modules (Get-FileHash, Invoke-WebRequest, Expand-Archive,
# ConvertFrom-Json, Test-Path, ...) are not recognized when module loading is
# broken (for example when the parent process passed down a PowerShell 7
# PSModulePath), while direct .NET calls keep working.
$ErrorActionPreference = "Stop"

# Windows PowerShell 5.1 does not always enable TLS 1.2 by default (required
# by GitHub); WebClient downloads honor this setting.
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ProjectRoot = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetDirectoryName($PSScriptRoot))
$BinaryRoot = [System.IO.Path]::Combine($ProjectRoot, "src-tauri\binaries")
$ResourceRoot = [System.IO.Path]::Combine($ProjectRoot, "src-tauri\resources")
$Target = "x86_64-pc-windows-msvc"
$TemporaryRoot = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), ("mad-toolbox-windows-" + [guid]::NewGuid()))

# JavaScriptSerializer instead of ConvertFrom-Json for the module-loading
# reason documented above.
$null = [System.Reflection.Assembly]::Load("System.Web.Extensions, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35")
$Manifest = [System.Web.Script.Serialization.JavaScriptSerializer]::new().DeserializeObject(
  [System.IO.File]::ReadAllText([System.IO.Path]::Combine($ProjectRoot, "third_party\windows-sources.json")))

function Get-PinnedTool {
  param([string]$Name)
  foreach ($Tool in @($Manifest["tools"])) {
    if ($Tool["name"] -eq $Name) {
      return $Tool
    }
  }
  throw "third_party/windows-sources.json has no entry for '$Name'."
}

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

function Test-FileHash {
  param([string]$Path, [string]$Expected)
  return ((Get-FileSha256 -Path $Path) -eq $Expected.ToLowerInvariant())
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
  if ([System.IO.File]::Exists($Destination) -and
    (Test-FileHash -Path $Destination -Expected $ExpectedBinarySha256)) {
    return
  }
  & $Acquire
  Assert-Hash -Path $Destination -Expected $ExpectedBinarySha256
}

$null = [System.IO.Directory]::CreateDirectory($BinaryRoot)
$null = [System.IO.Directory]::CreateDirectory($ResourceRoot)
$null = [System.IO.Directory]::CreateDirectory($TemporaryRoot)

try {
  if ($Edition -eq "Full") {
    $Bbdown = Get-PinnedTool "BBDown"
    $BbdownDestination = [System.IO.Path]::Combine($BinaryRoot, "BBDown-$Target.exe")
    Install-VerifiedBinary `
      -Destination $BbdownDestination `
      -ExpectedBinarySha256 $Bbdown["binarySha256"] `
      -Acquire {
      $Archive = [System.IO.Path]::Combine($TemporaryRoot, "bbdown.zip")
      $Expanded = [System.IO.Path]::Combine($TemporaryRoot, "bbdown")
      Get-VerifiedFile `
        -Url $Bbdown["artifactUrl"] `
        -Output $Archive `
        -Sha256 $Bbdown["artifactSha256"]
      Expand-VerifiedArchive -Archive $Archive -Destination $Expanded
      [System.IO.File]::Copy([System.IO.Path]::Combine($Expanded, "BBDown.exe"), $BbdownDestination, $true)
    }

    $Ffmpeg = Get-PinnedTool "FFmpeg and ffprobe"
    $FfmpegDestination = [System.IO.Path]::Combine($BinaryRoot, "ffmpeg-$Target.exe")
    $FfprobeDestination = [System.IO.Path]::Combine($BinaryRoot, "ffprobe-$Target.exe")
    $FfmpegValid = [System.IO.File]::Exists($FfmpegDestination) -and `
    (Test-FileHash -Path $FfmpegDestination -Expected $Ffmpeg["binarySha256"]["ffmpeg"])
    $FfprobeValid = [System.IO.File]::Exists($FfprobeDestination) -and `
    (Test-FileHash -Path $FfprobeDestination -Expected $Ffmpeg["binarySha256"]["ffprobe"])
    if (-not ($FfmpegValid -and $FfprobeValid)) {
      $Archive = [System.IO.Path]::Combine($TemporaryRoot, "ffmpeg.zip")
      $Expanded = [System.IO.Path]::Combine($TemporaryRoot, "ffmpeg")
      # BtbN removes ordinary daily builds after 14 days. Pin the latest
      # month-end build instead; upstream retains those builds for two years.
      Get-VerifiedFile `
        -Url $Ffmpeg["artifactUrl"] `
        -Output $Archive `
        -Sha256 $Ffmpeg["artifactSha256"]
      Expand-VerifiedArchive -Archive $Archive -Destination $Expanded
      $Bins = [System.IO.Directory]::GetFiles($Expanded, "ffmpeg.exe", [System.IO.SearchOption]::AllDirectories)
      $Probes = [System.IO.Directory]::GetFiles($Expanded, "ffprobe.exe", [System.IO.SearchOption]::AllDirectories)
      if ($Bins.Length -eq 0 -or $Probes.Length -eq 0) {
        throw "FFmpeg archive does not contain ffmpeg.exe and ffprobe.exe"
      }
      [System.IO.File]::Copy($Bins[0], $FfmpegDestination, $true)
      [System.IO.File]::Copy($Probes[0], $FfprobeDestination, $true)
    }
    Assert-Hash -Path $FfmpegDestination -Expected $Ffmpeg["binarySha256"]["ffmpeg"]
    Assert-Hash -Path $FfprobeDestination -Expected $Ffmpeg["binarySha256"]["ffprobe"]

    $YtDlp = Get-PinnedTool "yt-dlp"
    $YtDlpDestination = [System.IO.Path]::Combine($BinaryRoot, "yt-dlp-$Target.exe")
    Install-VerifiedBinary `
      -Destination $YtDlpDestination `
      -ExpectedBinarySha256 $YtDlp["binarySha256"] `
      -Acquire {
      Get-VerifiedFile `
        -Url $YtDlp["artifactUrl"] `
        -Output $YtDlpDestination `
        -Sha256 $YtDlp["artifactSha256"]
    }

    $Deno = Get-PinnedTool "Deno"
    $DenoDestination = [System.IO.Path]::Combine($BinaryRoot, "deno-$Target.exe")
    Install-VerifiedBinary `
      -Destination $DenoDestination `
      -ExpectedBinarySha256 $Deno["binarySha256"] `
      -Acquire {
      $Archive = [System.IO.Path]::Combine($TemporaryRoot, "deno.zip")
      $Expanded = [System.IO.Path]::Combine($TemporaryRoot, "deno")
      Get-VerifiedFile `
        -Url $Deno["artifactUrl"] `
        -Output $Archive `
        -Sha256 $Deno["artifactSha256"]
      Expand-VerifiedArchive -Archive $Archive -Destination $Expanded
      [System.IO.File]::Copy([System.IO.Path]::Combine($Expanded, "deno.exe"), $DenoDestination, $true)
    }

    $MediaInfo = Get-PinnedTool "MediaInfo CLI"
    $MediaInfoDestination = [System.IO.Path]::Combine($BinaryRoot, "mediainfo-$Target.exe")
    $LibcurlDestination = [System.IO.Path]::Combine($ResourceRoot, "MediaInfo-LIBCURL.DLL")
    $MediaInfoValid = [System.IO.File]::Exists($MediaInfoDestination) -and `
    (Test-FileHash -Path $MediaInfoDestination -Expected $MediaInfo["binarySha256"]["mediainfo"])
    $LibcurlValid = [System.IO.File]::Exists($LibcurlDestination) -and `
    (Test-FileHash -Path $LibcurlDestination -Expected $MediaInfo["binarySha256"]["libcurl"])
    if (-not ($MediaInfoValid -and $LibcurlValid)) {
      $Archive = [System.IO.Path]::Combine($TemporaryRoot, "mediainfo.zip")
      $Expanded = [System.IO.Path]::Combine($TemporaryRoot, "mediainfo")
      Get-VerifiedFile `
        -Url $MediaInfo["artifactUrl"] `
        -Output $Archive `
        -Sha256 $MediaInfo["artifactSha256"]
      Expand-VerifiedArchive -Archive $Archive -Destination $Expanded
      [System.IO.File]::Copy([System.IO.Path]::Combine($Expanded, "MediaInfo.exe"), $MediaInfoDestination, $true)
      [System.IO.File]::Copy([System.IO.Path]::Combine($Expanded, "LIBCURL.DLL"), $LibcurlDestination, $true)
    }
    Assert-Hash -Path $MediaInfoDestination -Expected $MediaInfo["binarySha256"]["mediainfo"]
    Assert-Hash -Path $LibcurlDestination -Expected $MediaInfo["binarySha256"]["libcurl"]
  }

  [Console]::WriteLine("Windows $Edition packaging dependencies are present and verified for $Target.")
}
finally {
  if ([System.IO.Directory]::Exists($TemporaryRoot)) {
    [System.IO.Directory]::Delete($TemporaryRoot, $true)
  }
}
