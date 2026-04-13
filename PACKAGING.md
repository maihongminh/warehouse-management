# Hướng dẫn đóng gói — Build file `.exe` cài đặt (Windows)

> **Mục tiêu**: tạo ra một file installer `.exe` gửi cho người dùng.  
> Người dùng chỉ cần chạy file đó, không cần cài Python hay Node.js.

---

## Kiến trúc đóng gói

```
Installer .exe (NSIS)
└── Tauri app (Rust shell)
    ├── UI: React + Vite  ← nhúng tĩnh trong binary
    └── sidecar: wm-backend.exe  ← FastAPI + SQLite (PyInstaller)
```

Khi người dùng mở app:
1. Tauri khởi động, tự spawn `wm-backend.exe` trong background
2. Backend khởi trên `127.0.0.1:8000`, tự tạo DB lần đầu
3. UI hiển thị loading → chờ backend sẵn sàng → vào thẳng Dashboard
4. Khi đóng cửa sổ, Tauri tự kill backend — không để lại process thừa

---

## Yêu cầu — chỉ cần cài một lần

### 1. Visual Studio Build Tools (bắt buộc cho Rust trên Windows)

Tải tại: https://visualstudio.microsoft.com/visual-cpp-build-tools/

Khi installer mở → chọn workload **"Desktop development with C++"** → Install.  
Dung lượng ~4–8 GB, mất 15–30 phút.

### 2. Rust (rustup)

Tải `rustup-init.exe` tại: https://rustup.rs/

Chạy file → Enter → chọn `1 (default)` → đợi ~5 phút.

> **Lưu ý**: sau khi cài, phải mở **terminal mới** để PATH được nhận.  
> Hoặc trong terminal cũ chạy lệnh này một lần:
> ```powershell
> $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
> ```

Kiểm tra:
```powershell
rustc --version   # rustc 1.xx.x
cargo --version   # cargo 1.xx.x
```

### 3. Python venv + requirements (đã có nếu đã chạy backend)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Node.js + npm (đã có nếu đã chạy frontend)

```powershell
cd frontend
npm install
```

---

## Quy trình build — 3 bước

### Bước 1 — Build backend thành `wm-backend.exe`

```powershell
cd backend
.venv\Scripts\activate
powershell -ExecutionPolicy Bypass -File scripts\build_backend_windows.ps1
```

**Output**: `backend\dist\wm-backend.exe` (~30–60 MB)

Thời gian: 2–5 phút (lần đầu lâu hơn do PyInstaller phân tích dependencies).

> Có thể test thử exe này độc lập:
> ```powershell
> .\dist\wm-backend.exe
> # mở http://127.0.0.1:8000/docs — nếu thấy Swagger là OK
> ```

---

### Bước 2 — Copy sidecar vào Tauri bundle

```powershell
cd frontend
powershell -ExecutionPolicy Bypass -File scripts\prepare_sidecar_windows.ps1
```

**Output**: `frontend\src-tauri\binaries\wm-backend-x86_64-pc-windows-msvc.exe`

> Script này chỉ copy và đổi tên file (thêm target triple suffix theo yêu cầu Tauri).

---

### Bước 3 — Build Tauri installer

```powershell
cd frontend
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"   # nếu terminal mới chưa nhận PATH
npm run tauri:build
```

Lần đầu mất **10–20 phút** (compile hàng trăm Rust crates).  
Lần sau (đã cache) chỉ ~1–3 phút.

**Output** (2 file, chọn 1):

| File | Định dạng | Ghi chú |
|------|-----------|---------|
| `bundle\nsis\Warehouse POS_0.1.0_x64-setup.exe` | NSIS installer | **Khuyên dùng** — nhỏ hơn, cài/gỡ gọn |
| `bundle\msi\Warehouse POS_0.1.0_x64_en-US.msi` | MSI | Chuẩn doanh nghiệp Windows |

Đường dẫn đầy đủ:
```
frontend\src-tauri\target\release\bundle\
  ├── nsis\Warehouse POS_0.1.0_x64-setup.exe   ← gửi file này
  └── msi\Warehouse POS_0.1.0_x64_en-US.msi
```

---

## Script tổng hợp (chạy cả 3 bước liên tiếp)

Tạo file `build-release.ps1` ở thư mục gốc project và chạy:

```powershell
# Chạy từ thư mục gốc warehouse-management\
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
$ErrorActionPreference = "Stop"

Write-Host "=== Bước 1: Build backend ===" -ForegroundColor Cyan
Push-Location backend
.venv\Scripts\Activate.ps1
powershell -ExecutionPolicy Bypass -File scripts\build_backend_windows.ps1
Pop-Location

Write-Host "=== Bước 2: Copy sidecar ===" -ForegroundColor Cyan
Push-Location frontend
powershell -ExecutionPolicy Bypass -File scripts\prepare_sidecar_windows.ps1

Write-Host "=== Bước 3: Build installer ===" -ForegroundColor Cyan
npm run tauri:build
Pop-Location

Write-Host "=== DONE ===" -ForegroundColor Green
Write-Host "File installer:" -ForegroundColor Green
Get-ChildItem "frontend\src-tauri\target\release\bundle\nsis\*.exe" | Select-Object FullName
```

---

## Data người dùng — lưu ở đâu?

Sau khi cài và chạy app, DB được tạo tự động tại:

```
C:\Users\<tên_user>\AppData\Roaming\vn.local.warehouse.pos\app.db
```

Hoặc dán vào thanh địa chỉ Explorer:
```
%APPDATA%\vn.local.warehouse.pos
```

| Thao tác | Cách làm |
|----------|----------|
| **Backup** | Copy file `app.db` sang chỗ khác |
| **Restore** | Paste `app.db` vào cùng thư mục (ghi đè) |
| **Chuyển sang máy mới** | Copy `app.db` → paste vào máy mới đã cài app |

---

## Cập nhật phiên bản app

Khi sửa code và muốn ra bản mới:

1. Tăng version trong `frontend/src-tauri/tauri.conf.json`:
   ```json
   "version": "0.2.0"
   ```
2. Chạy lại 3 bước build ở trên
3. Gửi file `*-setup.exe` mới — người dùng cài đè, **data không mất**

---

## Troubleshooting

| Lỗi | Nguyên nhân | Cách fix |
|-----|-------------|----------|
| `rustc` not recognized | PATH chưa nhận sau cài Rust | Mở terminal mới hoặc chạy `$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"` |
| `wm-backend.exe` missing | Chưa chạy Bước 1 | Chạy `build_backend_windows.ps1` trước |
| Sidecar not found in bundle | Chưa chạy Bước 2 | Chạy `prepare_sidecar_windows.ps1` |
| App mở nhưng trắng màn hình | Backend chưa kịp khởi động | Bình thường — loading screen sẽ chờ tự động |
| Port 8000 đã bị dùng | App khác chiếm port | Tắt chương trình đang dùng port 8000 |
| Build lỗi `E0597` (Rust) | Đã được fix trong `lib.rs` | Đảm bảo dùng code mới nhất |
