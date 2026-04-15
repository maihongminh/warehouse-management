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
| POS | `/pos` | Giao diện bán hàng nhanh, quản lý giỏ, lưu phiếu nháp. **Hỗ trợ đơn vị tính (Viên/Hộp)** trong tìm kiếm, tự động quy đổi giá và tồn kho. Giỏ hàng hiển thị rộng hơn. |
| Hóa đơn | `/invoices` | Quản lý hóa đơn với bộ lọc đa tiêu chí. **Hỗ trợ phân trang** và popup chi tiết chống tràn dữ liệu. |
| Sản phẩm | `/products` | Thao tác Import/Export **EXCEL**, quản lý quy đổi. **Hệ thống phân trang mới** (10-100 dòng/trang). |
| Kho | `/inventory` | Bảng tồn kho chi tiết, FEFO, giá vốn. **Hệ thống phân trang mới**. |
| Nhập kho | `/import` | Tạo phiếu, ghi nợ, nhập từ Excel. **Popup chi tiết hỗ trợ cuộn dọc** cho danh sách dài. |
| Kiểm kho | `/stock-take` | Điều chỉnh chênh lệch theo lô. **Hỗ trợ phân trang**. |
| Báo cáo | `/reports` | Doanh thu, lợi nhuận, lô hết hạn. **Phân trang danh sách lô sắp hết hạn**. |

---

## Ghi chú hệ thống v0.2.2
- **Phân trang Hệ thống (Server-side Pagination)**: Tất cả các bảng danh sách lớn (Sản phẩm, Kho, Nhập kho, Hóa đơn...) hiện đã được phân trang từ phía server để đảm bảo hiệu năng. Cho phép chọn hiển thị **10, 20, 50 hoặc 100 dòng**.
- **Cải tiến POS**: Hiển thị đơn vị tính (Viên/Hộp/...) ngay trong danh sách tìm kiếm sản phẩm. Tăng chiều cao vùng hiển thị giỏ hàng lên 500px.
- **Fix UI Detail Modal**: Các cửa sổ xem chi tiết (Hóa đơn, Phiếu nhập) hiện đã hỗ trợ cuộn dọc và giới hạn chiều cao, không còn bị tràn khỏi màn hình khi có quá nhiều sản phẩm.
- **Excel Thông minh**: Nhập kho Excel hỗ trợ xử lý số lượng lẻ (làm tròn), đọc định dạng Date của Excel. Xuất sản phẩm kèm theo mã Lô/HSD của lô gần hết hạn nhất.

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
