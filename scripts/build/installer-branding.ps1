# Regenerates the NSIS installer bitmaps (src-tauri/icons/installer-*.bmp)
# by rasterizing the vector logo (assets\logo.svg) with Edge headless, then
# converting the screenshots to plain 24-bit BMPs.
#
# MUI2 loads these with FitControl stretching onto DPI-scaled controls, so the
# canvases are 2x supersampled (all real-world DPIs then downscale instead of
# blurring an upscale). NSIS requires plain 24-bit BMPs; keep the control
# footprint (150x57 header, 164x314 sidebar at 96 DPI) and the 2x factor.
# The header stays icon-only because the page title is NSIS-drawn text; bitmap
# text would be clipped by the control.
param(
  [string]$SvgPath = "assets\logo.svg"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetDirectoryName($PSScriptRoot))
[System.IO.Directory]::SetCurrentDirectory($ProjectRoot)
Add-Type -AssemblyName System.Drawing

$Browser = @(
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $Browser) { throw "Neither Microsoft Edge nor Google Chrome was found; one of them is required to rasterize the SVG logo." }

$SvgUri = [System.Uri]::new([System.IO.Path]::GetFullPath($SvgPath)).AbsoluteUri
$WorkDir = Join-Path $env:TEMP "installer-branding"
if (Test-Path $WorkDir) { Remove-Item $WorkDir -Recurse -Force }
$null = New-Item $WorkDir -ItemType Directory

function New-BrandingBitmap($Name, $Width, $Height, $Css, $Body, $BmpPath) {
  $htmlPath = Join-Path $WorkDir "$Name.html"
  $pngPath = Join-Path $WorkDir "$Name.png"
  "<!doctype html><meta charset=`"utf-8`"><style>html,body{margin:0;padding:0}$Css</style>$Body" |
    Set-Content $htmlPath -Encoding UTF8

  $null = Start-Process -FilePath $Browser -Wait -PassThru -ArgumentList @(
    "--headless=new", "--disable-gpu", "--hide-scrollbars",
    "--no-first-run", "--no-default-browser-check",
    "--user-data-dir=`"$WorkDir\profile`"",
    "--window-size=$Width,$Height",
    "--screenshot=`"$pngPath`"",
    "`"$([System.Uri]::new($htmlPath).AbsoluteUri)`""
  )
  if (-not (Test-Path $pngPath)) { throw "The browser did not produce $pngPath" }
  $image = [System.Drawing.Image]::FromFile($pngPath)
  try {
    if ($image.Width -ne $Width -or $image.Height -ne $Height) {
      throw "$Name screenshot is $($image.Width)x$($image.Height), expected ${Width}x${Height}"
    }
  } finally { $image.Dispose() }

  $png = [System.Drawing.Image]::FromFile($pngPath)
  try {
    $bmp = New-Object System.Drawing.Bitmap $png.Width, $png.Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.DrawImage($png, 0, 0, $png.Width, $png.Height)
    $graphics.Dispose()
    $bmp.Save([System.IO.Path]::GetFullPath($BmpPath), [System.Drawing.Imaging.ImageFormat]::Bmp)
    $bmp.Dispose()
  } finally { $png.Dispose() }
}

# Header: brand blue matching the sidebar, icon plus a stacked two-line
# wordmark towards the left; the page title is NSIS-drawn text next to the
# control, so no bitmap text can ever be clipped.
New-BrandingBitmap "installer-header" 300 114 `
  "body{width:300px;height:114px;background:#0a84ff;overflow:hidden}.wrap{display:flex;align-items:center;gap:22px;height:100%;padding-left:20px}.wrap img{width:80px;height:80px;display:block}.wrap .word{font-family:'Segoe UI',sans-serif;font-weight:600;font-size:42px;line-height:1.14;letter-spacing:1px;color:#fff}" `
  "<div class=`"wrap`"><img src=`"$SvgUri`"><div class=`"word`">MAD<br>Toolbox</div></div>" `
  "src-tauri\icons\installer-header.bmp"

# Sidebar: icon and a small letter-spaced wordmark as one optically centered group.
New-BrandingBitmap "installer-sidebar" 328 628 `
  "body{position:relative;width:328px;height:628px;background:#0a84ff;overflow:hidden}.lockup{position:absolute;top:45%;left:0;width:100%;transform:translateY(-50%);display:flex;flex-direction:column;align-items:center;gap:40px}.lockup img{width:176px;height:176px;display:block}.lockup .word{font-family:'Segoe UI',sans-serif;font-weight:600;font-size:34px;line-height:1;letter-spacing:1px;color:#fff}" `
  "<div class=`"lockup`"><img src=`"$SvgUri`"><div class=`"word`">MAD Toolbox</div></div>" `
  "src-tauri\icons\installer-sidebar.bmp"

Remove-Item $WorkDir -Recurse -Force
Write-Host "Installer branding bitmaps written to src-tauri\icons."
