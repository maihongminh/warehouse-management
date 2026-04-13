$ErrorActionPreference = "Stop"

# Copy backend exe into src-tauri/binaries with required target triple suffix for Windows.
# Expected input: backend/dist/wm-backend.exe (built by backend/scripts/build_backend_windows.ps1)

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repo = (Resolve-Path (Join-Path $root "..")).Path

$backendExe = Join-Path $repo "backend\dist\wm-backend.exe"
$binDir = Join-Path $root "src-tauri\binaries"

if (!(Test-Path $backendExe)) {
  throw "Missing $backendExe. Build it first: backend/scripts/build_backend_windows.ps1"
}

New-Item -ItemType Directory -Force -Path $binDir | Out-Null

# Most Windows builds use MSVC toolchain target triple
$target = "x86_64-pc-windows-msvc"
$out = Join-Path $binDir "wm-backend-$target.exe"

Copy-Item -Force $backendExe $out
Write-Host "Sidecar copied to: $out"

