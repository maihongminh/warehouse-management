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
| POS | `/pos` | Giao diện bán hàng nhanh, quản lý giỏ, lưu phiếu nháp. **Hỗ trợ chọn đơn vị Bán lẻ (Viên) hoặc Bán nguyên (Hộp)**, tự động quy đổi giá và tồn kho. |
| Hóa đơn | `/invoices` | Bảng quản lý hóa đơn riêng biệt với bộ lọc đa tiêu chí |
| Sản phẩm | `/products` | Thêm trường **Quy đổi**, xóa sản phẩm (ẩn), thao tác Import/Export **EXCEL** (đã bổ sung thông tin Lô/HSD sớm nhất) |
| Kho | `/inventory` | Bảng chi tiết: màu cảnh báo HSD (FEFO), giá vốn trung bình, số lượng tổng |
| Nhập kho | `/import` | Tạo phiếu, **Ghi nợ** / **Trả nợ**, lịch sử phiếu. Hỗ trợ **Nhập từ Excel** thông minh (tự làm tròn số lượng, khớp mã lô). |
| Kiểm kho | `/stock-take` | Nhập SL thực tế theo lô, tự điều chỉnh chênh lệch |
| Báo cáo | `/reports` | Doanh thu, lợi nhuận thực tế theo Lô, số HĐ theo kỳ, cảnh báo tồn/HSD |

---

## Ghi chú hệ thống v0.2.2
- **Đơn vị Quy đổi (Hộp/Viên)**: POS cho phép chọn đơn vị bán, tự động nhân/chia dựa trên Tỷ lệ quy đổi.
- **Excel Thông minh**: Nhập kho Excel hỗ trợ xử lý số lượng lẻ (làm tròn), đọc định dạng Date của Excel. Xuất sản phẩm kèm theo mã Lô/HSD của lô gần hết hạn nhất.
- **Dọn dẹp UI**: Loại bỏ emoji icon gồ ghề ở các nút Excel, bo góc mượt mà hơn.

---

## Đóng gói thành file `.exe` — Desktop App

> Xem hướng dẫn đầy đủ từng bước: **[PACKAGING.md](./PACKAGING.md)**

Tóm tắt 3 bước (chạy trên Windows):

```powershell
# Sử dụng script tự động tại thư mục gốc:
powershell -ExecutionPolicy Bypass -File build-release.ps1
```

**Output**: `frontend\src-tauri\target\release\bundle\nsis\Warehouse POS_0.2.2_x64-setup.exe`

**Data người dùng** lưu tại: `%APPDATA%\vn.local.warehouse.pos\app.db`

---

## Desktop Dev (Tauri cửa sổ native)

```powershell
# Terminal 1 — chạy backend như bình thường (uvicorn)
# Terminal 2:
cd frontend
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
│   │   ├── services/     — FEFO sale (với ghi đè Lô), reports, import, stock adjust, return
│   │   ├── models.py     — SQLAlchemy models
│   │   ├── schemas/      — Pydantic schemas
│   │   └── desktop_server.py  — entry point cho PyInstaller
│   ├── scripts/
│   │   └── build_backend_windows.ps1
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/        — Dashboard, POS (với chọn Lô), Products, Inventory, Import, StockTake, Reports
│   │   ├── api.ts
│   │   ├── types.ts
│   │   └── main.tsx
│   ├── src-tauri/
│   │   ├── src/lib.rs    — spawn & kill sidecar tự động
│   │   ├── tauri.conf.json
│   │   └── binaries/     — chứa wm-backend.exe (sidecar)
├── build-release.ps1     — Script build 1-click (v0.2.x)
├── README.md             
└── PACKAGING.md          
```

---

## Phase tiếp theo

| Ưu tiên | Nội dung |
|---------|----------|
| Cao | **Phân quyền**: đăng nhập local, vai trò (thu ngân / quản lý) |
| Trung bình | **Backup tự động** + xuất CSV báo cáo |
| Trung bình | **Barcode** (USB scanner / camera) |
| Thấp | **Đa kho**, cloud sync |
