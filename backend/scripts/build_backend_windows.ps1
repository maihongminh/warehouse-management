$ErrorActionPreference = "Stop"

# Build backend as a single-file Windows exe (PyInstaller).
# Run this on Windows in a Python venv that has backend requirements installed.

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$backend = $root
$dist = (Join-Path $backend "dist")

Set-Location $backend

if (!(Test-Path ".venv")) {
  Write-Host "Missing .venv. Create venv and install requirements first." -ForegroundColor Yellow
}

python -m pip install -U pip
python -m pip install -r requirements.txt
python -m pip install pyinstaller

if (Test-Path "build") { Remove-Item -Recurse -Force "build" }
if (Test-Path "dist") { Remove-Item -Recurse -Force "dist" }
if (Test-Path "desktop_server.spec") { Remove-Item -Force "desktop_server.spec" }

# We include alembic folder only if you later want to run migrations inside the exe.
# For now desktop_server.py uses create_all() for bootstrap.
pyinstaller `
  --noconfirm `
  --clean `
  --onefile `
  --name wm-backend `
  --paths "$backend" `
  --hidden-import app.models `
  --hidden-import app.api `
  --hidden-import app.services `
  --hidden-import app.schemas `
  --collect-all fastapi `
  --collect-all uvicorn `
  --collect-all sqlalchemy `
  "app\desktop_server.py"

Write-Host "Built: $dist\wm-backend.exe"

