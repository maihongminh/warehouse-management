# Quản lý kho & POS (hiệu thuốc)

Triển khai theo [`tool/idea.md`](../idea.md): FastAPI + SQLite + Alembic (backend), React + Vite + Tailwind (frontend), **Tauri 2** (desktop shell trong `frontend/src-tauri`).

## Chạy backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

API: `http://127.0.0.1:8000` — tài liệu tự sinh: `/docs`.

## Chạy frontend

```bash
cd frontend
npm install
npm run dev
```

Mở `http://127.0.0.1:5173`. Biến `VITE_API_URL` (mặc định trong `.env.development`) trỏ tới API.

## Tính năng đã có (v1 + bước kế)

- **Dashboard**: doanh thu / lợi nhuận trong ngày, cảnh báo tồn thấp & lô sắp hết hạn; link nhanh tới báo cáo / kiểm kho / POS.
- **Sản phẩm**: tạo + liệt kê + tìm; luồng gợi ý → nhập kho.
- **Nhập kho**: phiếu nhập, gộp lô theo (sản phẩm, mã lô, HSD), ghi `inventory_logs`.
- **Kho**: danh sách tồn theo sản phẩm, mở rộng xem từng lô.
- **POS**: giỏ hàng, thanh toán **FEFO**, snapshot giá nhập.
- **Kiểm kho (UI)**: màn `/stock-take` — nhập SL thực tế theo lô, gọi `POST /api/stock/adjust`.
- **Báo cáo (Phase 5)**: màn `/reports` — tổng doanh thu / lợi nhuận / số HĐ theo kỳ (`GET /api/reports/period`), danh sách HĐ hoàn thành (`GET /api/sales?status=completed&date_from=&date_to=`), lô sắp hết hạn 30 ngày.
- **Trả hàng khách**: `POST /api/returns/customer`.

## Sao lưu DB (nhẹ)

Nên tắt backend hoặc đảm bảo không ghi đồng thời khi copy.

```bash
./scripts/backup_db.sh
```

File nằm trong `backend/data/backup/`.

## Desktop (Tauri) — Phase 6

Đã gắn **Tauri 2** vào `frontend/`. UI gọi API tại `http://127.0.0.1:8000` (CORS đã cho phép `https://tauri.localhost` khi chạy bản build).

### Cài Rust & dependency hệ thống (một lần)

- **Rust**: [rustup.rs](https://rustup.rs/) (Linux/macOS/WSL: script curl trên trang; Windows: cài Rustup rồi mở lại terminal).
- **Linux**: cài thêm WebKitGTK / thư viện build theo [Prerequisites Tauri v2](https://v2.tauri.app/start/prerequisites/) (ví dụ Ubuntu: `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, …).

### Dev — một lệnh (API + cửa sổ desktop)

```bash
chmod +x scripts/desktop-dev.sh   # lần đầu
./scripts/desktop-dev.sh
```

Hoặc **hai terminal**: (1) `uvicorn` như mục «Chạy backend»; (2) `cd frontend && npm run tauri:dev`.

Windows (PowerShell): terminal 1 kích hoạt `.venv` rồi `uvicorn app.main:app --host 127.0.0.1 --port 8000` trong `backend`; terminal 2 `cd frontend` rồi `npm run tauri:dev`.

### Build cài đặt

```bash
cd frontend
npm install
npm run build          # Vite → dist/
npm run tauri:build    # NSIS / .msi (Windows), .deb / AppImage (Linux), .app (macOS) tùy OS
```

File output trong `frontend/src-tauri/target/release/bundle/`. **File `.exe` chỉ sinh khi build trên Windows** (hoặc CI Windows).

### Ghi chú triển khai

- Bản build vẫn cần **Python backend + SQLite** chạy trên máy (bước sau: PyInstaller / sidecar spawn `uvicorn`).
- Đổi API: tạo `frontend/.env.production` với `VITE_API_URL=...`.

## Việc nên làm tiếp (Phase 7 & mở rộng)

| Ưu tiên | Nội dung |
|--------|-----------|
| Cao | **Gói API kèm desktop**: PyInstaller hoặc Tauri spawn `uvicorn`. |
| Cao | **Phân quyền**: đăng nhập local, vai trò (thu ngân / quản lý). |
| Trung bình | **Backup tự động**, xuất CSV báo cáo. |
| Trung bình | **Barcode** (USB scanner / camera). |
| Thấp | **Đa kho**, cloud sync (theo `idea.md` mục 8). |

## Cấu trúc thư mục

- `backend/app` — models, API, services (FEFO trong `services/sale.py`).
- `frontend/src/pages` — Dashboard, POS, Sản phẩm, Kho, Nhập kho, Kiểm kho, Báo cáo.
- `scripts/backup_db.sh` — sao chép nhanh file SQLite.
- `scripts/desktop-dev.sh` — chạy API + `npm run tauri:dev`.
- `frontend/src-tauri/` — Rust shell Tauri 2.
