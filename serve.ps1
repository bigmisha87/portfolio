# =====================================================================
#  Misha Graphics - tiny local web server (no Python / Node needed).
#  Serves this folder over http://localhost:<port> using only PowerShell,
#  so the Studio can run in a secure context and save your files.
#  Launched by Start-Studio.bat. Close the window to stop the server.
# =====================================================================
param([int]$Port = 8080, [string]$Root = $PSScriptRoot)

$ErrorActionPreference = "Stop"
if (-not $Root) { $Root = (Get-Location).Path }
$rootFull = [System.IO.Path]::GetFullPath($Root)

$mime = @{
  ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8";
  ".js"="text/javascript; charset=utf-8"; ".mjs"="text/javascript; charset=utf-8";
  ".css"="text/css; charset=utf-8"; ".json"="application/json; charset=utf-8";
  ".svg"="image/svg+xml"; ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg";
  ".gif"="image/gif"; ".webp"="image/webp"; ".avif"="image/avif"; ".ico"="image/x-icon";
  ".mp4"="video/mp4"; ".webm"="video/webm"; ".mov"="video/quicktime"; ".m4v"="video/mp4";
  ".woff"="font/woff"; ".woff2"="font/woff2"; ".ttf"="font/ttf"; ".otf"="font/otf";
  ".txt"="text/plain; charset=utf-8"; ".md"="text/plain; charset=utf-8"; ".webmanifest"="application/manifest+json"
}

try {
  $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "  Could not start on port $Port (it may already be in use)." -ForegroundColor Yellow
  Write-Host "  Close any other server window and run Start-Studio again."
  Write-Host ""
  Read-Host "Press Enter to close"
  exit 1
}

Write-Host ""
Write-Host "  Misha Graphics - local server is running." -ForegroundColor Green
Write-Host "  Studio:  http://localhost:$Port/studio.html"
Write-Host "  Site:    http://localhost:$Port/index.html"
Write-Host ""
Write-Host "  Keep this window open while you edit. Close it to stop."
Write-Host ""

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII)
    $requestLine = $reader.ReadLine()
    if ([string]::IsNullOrEmpty($requestLine)) { $client.Close(); continue }
    while ($true) { $h = $reader.ReadLine(); if ([string]::IsNullOrEmpty($h)) { break } }

    $target = ($requestLine -split '\s+')[1]
    $path = ([string]($target -split '\?')[0])
    $path = [System.Uri]::UnescapeDataString($path)
    if ($path -eq "/" -or $path -eq "") { $path = "/index.html" }

    $rel = $path.TrimStart("/").Replace("/", "\")
    $full = [System.IO.Path]::GetFullPath((Join-Path $rootFull $rel))

    $okPath = $full.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)
    if ($okPath -and (Test-Path -LiteralPath $full -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $head = "HTTP/1.1 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nAccept-Ranges: none`r`nCache-Control: no-cache, no-store`r`nConnection: close`r`n`r`n"
    } else {
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
      $head = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
    }
    $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($headBytes, 0, $headBytes.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Flush()
  } catch {
    # ignore a single bad/aborted request and keep serving
  } finally {
    $client.Close()
  }
}
