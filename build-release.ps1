# build-release.ps1
# Chay tu thu muc goc: warehouse-management\
# Tu dong build wm-backend.exe (PyInstaller) -> copy sidecar -> build Tauri installer
#
# Ket qua:
#   frontend\src-tauri\target\release\bundle\nsis\GTA Launcher_x.x.x_x64-setup.exe

$ErrorActionPreference = "Stop"

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
}

$root = $PSScriptRoot

Write-Host "=== Buoc 1/3: Build backend ===" -ForegroundColor Cyan
$backendDir = Join-Path $root "backend"
Push-Location $backendDir

$activate = Join-Path $backendDir ".venv\Scripts\Activate.ps1"
if (!(Test-Path $activate)) {
    Write-Host "ERROR: Chua tim thay .venv. Chay thu cong cac lenh setup truoc." -ForegroundColor Red
    exit 1
}
. $activate

powershell -ExecutionPolicy Bypass -File "scripts\build_backend_windows.ps1"
Pop-Location
Write-Host "OK - backend build xong" -ForegroundColor Green

Write-Host "=== Buoc 2/3: Copy sidecar ===" -ForegroundColor Cyan
$frontendDir = Join-Path $root "frontend"
Push-Location $frontendDir
powershell -ExecutionPolicy Bypass -File "scripts\prepare_sidecar_windows.ps1"
Pop-Location
Write-Host "OK - copy sidecar xong" -ForegroundColor Green

Write-Host "=== Buoc 3/3: Build Tauri installer ===" -ForegroundColor Cyan
Push-Location $frontendDir
npm run tauri:build
Pop-Location
Write-Host "OK - tauri build xong" -ForegroundColor Green

Write-Host "=== Hoan tatch ===" -ForegroundColor Green
$bundleNsis = Join-Path $frontendDir "src-tauri\target\release\bundle\nsis"
if (Test-Path $bundleNsis) {
    Get-ChildItem "$bundleNsis\*.exe" | ForEach-Object {
        Write-Host "[Installer] $($_.FullName)" -ForegroundColor Yellow
    }
}
