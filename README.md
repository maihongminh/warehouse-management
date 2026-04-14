# Quản lý kho & POS (hiệu thuốc)

Triển khai: FastAPI + SQLite + Alembic (backend), React + Vite + Tailwind (frontend), **Tauri 2** (desktop shell).

---

## Chạy nhanh (development)

Cần **2 terminal** chạy song song:

**Terminal 1 — Backend:**
```powershell
cd backend
python -m venv .venv          # lần đầu
.venv\Scripts\activate
pip install -r requirements.txt   # lần đầu
alembic upgrade head              # lần đầu
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API: `http://127.0.0.1:8000` — Swagger docs: `/docs`

**Terminal 2 — Frontend:**
```powershell
cd frontend
npm install       # lần đầu
npm run dev
```

Mở `http://127.0.0.1:5173`. hoặc `http://localhost:5173/`

---

## Tính năng hiện có

| Màn hình | Route | Mô tả |
|----------|-------|-------|
| Dashboard | `/` | Lối tắt nghiệp vụ nhanh, thống kê hôm nay, tồn thấp & lô sắp hết hạn |
| POS | `/pos` | Giao diện bán hàng nhanh, quản lý giỏ, lưu phiếu nháp, hóa đơn chi tiết |
| Hóa đơn | `/invoices` | Bảng quản lý hóa đơn riêng biệt với bộ lọc đa tiêu chí |
| Sản phẩm | `/products` | Thêm trường **Quy đổi**, xóa sản phẩm (ẩn), thao tác Import/Export **EXCEL** hàng loạt |
| Kho | `/inventory` | Bảng chi tiết: màu cảnh báo HSD (FEFO), giá vốn trung bình, số lượng tổng |
| Nhập kho | `/import` | Tạo phiếu, **Ghi nợ** / **Trả nợ**, lịch sử phiếu với bộ lọc (trạng thái, tên, NCC) |
| Kiểm kho | `/stock-take` | Nhập SL thực tế theo lô, tự điều chỉnh chênh lệch |
| Báo cáo | `/reports` | Doanh thu, lợi nhuận, số HĐ theo kỳ, cảnh báo tồn/HSD |

Trả hàng khách: `POST /api/returns/customer`
Xóa sản phẩm (soft delete): `DELETE /api/products/{id}`

---

## Đóng gói thành file `.exe` — Desktop App

> Xem hướng dẫn đầy đủ từng bước: **[PACKAGING.md](./PACKAGING.md)**

Tóm tắt 3 bước (chạy trên Windows):

```powershell
# Bước 1 — Build backend exe (PyInstaller)
cd backend && .venv\Scripts\activate
powershell -ExecutionPolicy Bypass -File scripts\build_backend_windows.ps1

# Bước 2 — Copy sidecar vào Tauri bundle
cd frontend
powershell -ExecutionPolicy Bypass -File scripts\prepare_sidecar_windows.ps1

# Bước 3 — Build installer
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
npm run tauri:build
```

**Output**: `frontend\src-tauri\target\release\bundle\nsis\Warehouse POS_0.1.0_x64-setup.exe`

**Data người dùng** lưu tại: `%APPDATA%\vn.local.warehouse.pos\app.db`

---

## Desktop Dev (Tauri cửa sổ native)

Cần Rust đã cài ([rustup.rs](https://rustup.rs/)) + VS Build Tools.

```powershell
# Terminal 1 — chạy backend như bình thường
# Terminal 2:
cd frontend
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
npm run tauri:dev
```

---

## Sao lưu DB (dev)

```bash
./scripts/backup_db.sh
```

File backup trong `backend/data/backup/`.

---

## Cấu trúc thư mục

```
warehouse-management/
├── backend/
│   ├── app/
│   │   ├── api/          — routers: products, sales, inventory, reports, ...
│   │   ├── services/     — FEFO sale, reports, import, stock adjust, return
│   │   ├── models.py     — SQLAlchemy models
│   │   ├── schemas/      — Pydantic schemas
│   │   └── desktop_server.py  — entry point cho PyInstaller
│   ├── scripts/
│   │   └── build_backend_windows.ps1  — build wm-backend.exe
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/        — Dashboard, POS, Products, Inventory, Import, StockTake, Reports
│   │   ├── api.ts        — fetch wrapper
│   │   ├── types.ts      — TypeScript types
│   │   └── main.tsx      — health-check loading screen → App
│   ├── scripts/
│   │   └── prepare_sidecar_windows.ps1  — copy exe vào src-tauri/binaries/
│   └── src-tauri/
│       ├── src/lib.rs    — spawn & kill sidecar tự động
│       ├── tauri.conf.json
│       └── capabilities/default.json
├── scripts/
│   └── backup_db.sh
├── README.md             — hướng dẫn tổng quan (file này)
└── PACKAGING.md          — hướng dẫn đóng gói exe chi tiết
```

---

## Phase tiếp theo

| Ưu tiên | Nội dung |
|---------|----------|
| Cao | **Phân quyền**: đăng nhập local, vai trò (thu ngân / quản lý) |
| Trung bình | **Backup tự động** + xuất CSV báo cáo |
| Trung bình | **Barcode** (USB scanner / camera) |
| Thấp | **Đa kho**, cloud sync |
