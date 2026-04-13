# build-release.ps1
# Chạy từ thư mục gốc: warehouse-management\
# Tự động build wm-backend.exe (PyInstaller) → copy sidecar → build Tauri installer
#
# Kết quả:
#   frontend\src-tauri\target\release\bundle\nsis\Warehouse POS_x.x.x_x64-setup.exe

$ErrorActionPreference = "Stop"

# Thêm Rust vào PATH nếu chưa có (tránh lỗi 'cargo not found' trong terminal cũ)
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
}

$root = $PSScriptRoot

# ── Bước 1: Build backend exe ────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Bước 1/3 — Build backend (PyInstaller)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$backendDir = Join-Path $root "backend"
Push-Location $backendDir

# Kích hoạt venv
$activate = Join-Path $backendDir ".venv\Scripts\Activate.ps1"
if (!(Test-Path $activate)) {
    Write-Host "ERROR: Chua tim thay .venv. Chay: python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt" -ForegroundColor Red
    exit 1
}
. $activate

powershell -ExecutionPolicy Bypass -File "scripts\build_backend_windows.ps1"
Pop-Location

Write-Host "OK — backend\dist\wm-backend.exe da san sang" -ForegroundColor Green

# ── Bước 2: Copy sidecar vào Tauri binaries ──────────────────────────────────
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host " Bước 2/3 — Copy sidecar vào Tauri    " -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan

$frontendDir = Join-Path $root "frontend"
Push-Location $frontendDir
powershell -ExecutionPolicy Bypass -File "scripts\prepare_sidecar_windows.ps1"
Pop-Location

Write-Host "OK — sidecar da copy vao src-tauri\binaries\" -ForegroundColor Green

# ── Bước 3: Build Tauri installer ────────────────────────────────────────────
Write-Host ""
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host " Bước 3/3 — Build Tauri installer     " -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host "(Lan dau mat 10-20 phut de compile Rust, lan sau ~1-3 phut)" -ForegroundColor Yellow

Push-Location $frontendDir
npm run tauri:build
Pop-Location

# ── Kết quả ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " BUILD THANH CONG!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

$bundleNsis = Join-Path $frontendDir "src-tauri\target\release\bundle\nsis"
$bundleMsi  = Join-Path $frontendDir "src-tauri\target\release\bundle\msi"

Write-Host ""
Write-Host "File installer:" -ForegroundColor White
if (Test-Path $bundleNsis) {
    Get-ChildItem "$bundleNsis\*.exe" | ForEach-Object {
        Write-Host "  [NSIS] $($_.FullName)  ($([math]::Round($_.Length/1MB, 1)) MB)" -ForegroundColor Green
    }
}
if (Test-Path $bundleMsi) {
    Get-ChildItem "$bundleMsi\*.msi" | ForEach-Object {
        Write-Host "  [MSI]  $($_.FullName)  ($([math]::Round($_.Length/1MB, 1)) MB)" -ForegroundColor Green
    }
}
Write-Host ""
Write-Host "Data nguoi dung se luu tai: %APPDATA%\vn.local.warehouse.pos\app.db" -ForegroundColor White
