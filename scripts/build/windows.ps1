param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Full", "Lite")]
  [string]$Edition,
  [string]$TauriArgsJson = "[]"
)

# Windows packaging entry. Runs on Windows PowerShell 5.1; PowerShell 7 is not
# required. Invoked by scripts/build/build.js, which already ran the TypeScript
# and cargo preflight checks. Like windows-tools.ps1, this script sticks to
# PowerShell language constructs and .NET APIs because cmdlets from importable
# modules (ConvertFrom-Json, Split-Path, Set-Location, ...) are unavailable
# when module loading is broken.
$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetDirectoryName($PSScriptRoot))
[System.IO.Directory]::SetCurrentDirectory($ProjectRoot)

& ([System.IO.Path]::Combine($PSScriptRoot, "windows-tools.ps1")) -Edition $Edition

# The tauri arguments are a JSON array of strings. JavaScriptSerializer is
# used instead of ConvertFrom-Json (Microsoft.PowerShell.Utility cmdlet), and
# Windows PowerShell 5.1 pipes a deserialized array through as a single
# object instead of enumerating it, so collect the entries explicitly.
$null = [System.Reflection.Assembly]::Load("System.Web.Extensions, Version=4.0.0.0, Culture=neutral, PublicKeyToken=31bf3856ad364e35")
$TauriArgs = @()
$ParsedArgs = [System.Web.Script.Serialization.JavaScriptSerializer]::new().DeserializeObject($TauriArgsJson)
if ($null -ne $ParsedArgs) {
  foreach ($Item in @($ParsedArgs)) {
    if ($null -ne $Item) { $TauriArgs += [string]$Item }
  }
}

$Config = if ($Edition -eq "Full") {
  "src-tauri\tauri.windows.full.conf.json"
} else {
  "src-tauri\tauri.windows.lite.conf.json"
}

# CI 注入 TAURI_SIGNING_PRIVATE_KEY 时追加 updater overlay，产出 NSIS 安装包的
# .sig 签名；本地无密钥的普通构建完全不受影响
if (-not [string]::IsNullOrEmpty($env:TAURI_SIGNING_PRIVATE_KEY)) {
  npx tauri build --target x86_64-pc-windows-msvc --config $Config --config src-tauri\tauri.updater.conf.json @TauriArgs
} else {
  npx tauri build --target x86_64-pc-windows-msvc --config $Config @TauriArgs
}
if ($LASTEXITCODE -ne 0) { throw "Tauri build failed" }
