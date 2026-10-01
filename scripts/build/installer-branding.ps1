# Regenerates the NSIS installer bitmaps (src-tauri/icons/installer-*.bmp)
# from the app icon and the theme brand color in src/theme/colors.ts.
#
# MUI2 loads these with FitControl stretching onto DPI-scaled controls, so the
# canvases are 2x supersampled (all real-world DPIs then downscale instead of
# blurring an upscale). NSIS requires plain 24-bit BMPs; keep the control
# footprint (150x57 header, 164x314 sidebar at 96 DPI) and the 2x factor.
param(
  [string]$IconPath = "src-tauri\icons\128x128@2x.png"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetDirectoryName($PSScriptRoot))
[System.IO.Directory]::SetCurrentDirectory($ProjectRoot)
Add-Type -AssemblyName System.Drawing

$BrandBlue = [System.Drawing.Color]::FromArgb(0x0A, 0x84, 0xFF)
$InkColor = [System.Drawing.Color]::FromArgb(0x1D, 0x1D, 0x20)

$Header = @{ Path = "src-tauri\icons\installer-header.bmp"; Width = 300; Height = 114 }
$Sidebar = @{ Path = "src-tauri\icons\installer-sidebar.bmp"; Width = 328; Height = 628 }

function New-Canvas($Width, $Height, $Background) {
  $bitmap = New-Object System.Drawing.Bitmap $Width, $Height, ([System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
  $graphics.Clear($Background)
  return @{ Bitmap = $bitmap; Graphics = $graphics }
}

function Draw-Icon($Canvas, $Size, $X, $Y) {
  $icon = [System.Drawing.Image]::FromFile([System.IO.Path]::GetFullPath($IconPath))
  try {
    $rect = New-Object System.Drawing.Rectangle $X, $Y, $Size, $Size
    $Canvas.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $Canvas.Graphics.DrawImage($icon, $rect)
  } finally {
    $icon.Dispose()
  }
}

# Header: icon only, drawn towards the left with margins. The page title is
# NSIS-drawn text next to the control, so no bitmap text can ever be clipped.
$canvas = New-Canvas $Header.Width $Header.Height ([System.Drawing.Color]::White)
try {
  Draw-Icon $canvas 80 20 17
  $canvas.Bitmap.Save([System.IO.Path]::GetFullPath($Header.Path), [System.Drawing.Imaging.ImageFormat]::Bmp)
} finally {
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
}

# Sidebar: icon and wordmark centered with generous margins.
$canvas = New-Canvas $Sidebar.Width $Sidebar.Height $BrandBlue
try {
  Draw-Icon $canvas 168 80 152
  $font = New-Object System.Drawing.Font "Segoe UI Semibold", 26
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $canvas.Graphics.DrawString("MAD Toolbox", $font, [System.Drawing.Brushes]::White, [float]($Sidebar.Width / 2), 380, $format)
  $font.Dispose()
  $format.Dispose()
  $canvas.Bitmap.Save([System.IO.Path]::GetFullPath($Sidebar.Path), [System.Drawing.Imaging.ImageFormat]::Bmp)
} finally {
  $canvas.Graphics.Dispose()
  $canvas.Bitmap.Dispose()
}

Write-Host "Installer branding bitmaps written to src-tauri\icons."
