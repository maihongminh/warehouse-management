"""
Backup & restore API.

Endpoints
---------
GET  /backup/info        – đường dẫn DB, thư mục backup, danh sách file backup
POST /backup/now         – tạo bản sao DB ngay lập tức
POST /backup/restore     – khôi phục từ một file backup đã có (theo tên file)
GET  /backup/schedule    – đọc cấu hình lịch tự động
POST /backup/schedule    – ghi cấu hình lịch tự động
"""

import json
import logging
import shutil
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_db_path() -> Path | None:
    """Lấy đường dẫn tuyệt đối tới file SQLite.  None nếu không phải SQLite."""
    url = settings.database_url
    if url.startswith("sqlite:///"):
        return Path(url[len("sqlite:///"):]).resolve()
    return None


def _get_backup_dir() -> Path:
    """Thư mục chứa các file backup (cùng cấp với DB, hoặc trong APPDATA)."""
    db_path = _get_db_path()
    if db_path:
        bdir = db_path.parent / "backups"
    else:
        import os
        appdata = os.getenv("APPDATA", str(Path.home()))
        bdir = Path(appdata) / "vn.local.warehouse.pos" / "backups"
    bdir.mkdir(parents=True, exist_ok=True)
    return bdir


def _schedule_file() -> Path:
    return _get_backup_dir() / "_schedule.json"


def _list_backups() -> list[dict]:
    bdir = _get_backup_dir()
    files = sorted(
        [f for f in bdir.iterdir() if f.suffix == ".db" and f.is_file()],
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )
    result = []
    for f in files[:50]:  # giới hạn 50 bản
        stat = f.stat()
        result.append({
            "name": f.name,
            "size_bytes": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
        })
    return result


# ─── Schemas ─────────────────────────────────────────────────────────────────

class BackupInfo(BaseModel):
    db_path: str | None
    backup_dir: str
    backups: list[dict]


class BackupResult(BaseModel):
    filename: str
    message: str


class RestoreRequest(BaseModel):
    filename: str  # tên file trong thư mục backup


class RestoreResult(BaseModel):
    message: str


class ScheduleConfig(BaseModel):
    enabled: bool = False
    interval: str = "daily"   # "daily" | "weekly" | "monthly" | "quarterly"
    keep_count: int = 30


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/info", response_model=BackupInfo)
def get_backup_info() -> dict:
    db_path = _get_db_path()
    backup_dir = _get_backup_dir()
    return {
        "db_path": str(db_path) if db_path else None,
        "backup_dir": str(backup_dir),
        "backups": _list_backups(),
    }


@router.post("/now", response_model=BackupResult)
def backup_now() -> dict:
    db_path = _get_db_path()
    if not db_path or not db_path.exists():
        raise HTTPException(status_code=400, detail="Không tìm thấy file database SQLite.")
    backup_dir = _get_backup_dir()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = backup_dir / f"backup_{ts}.db"
    try:
        shutil.copy2(db_path, dest)
        logger.info("Backup created: %s", dest)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi tạo backup: {exc}") from exc
    # Xoá backup cũ nếu vượt keep_count
    _prune_backups()
    return {"filename": dest.name, "message": f"✅ Backup thành công: {dest.name}"}


@router.post("/restore", response_model=RestoreResult)
def restore_backup(body: RestoreRequest) -> dict:
    db_path = _get_db_path()
    if not db_path:
        raise HTTPException(status_code=400, detail="Không hỗ trợ restore cho non-SQLite database.")
    backup_dir = _get_backup_dir()
    src = backup_dir / body.filename
    if not src.exists() or src.suffix != ".db":
        raise HTTPException(status_code=404, detail="File backup không tồn tại.")
    # An toàn: tạo bản sao DB hiện tại trước khi khôi phục
    if db_path.exists():
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safety_copy = backup_dir / f"pre_restore_{ts}.db"
        try:
            shutil.copy2(db_path, safety_copy)
        except OSError:
            pass  # non-fatal
    try:
        shutil.copy2(src, db_path)
        logger.info("Restored from %s to %s", src, db_path)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Lỗi khi khôi phục: {exc}") from exc
    return {"message": f"✅ Đã khôi phục từ {body.filename}. Vui lòng khởi động lại ứng dụng để áp dụng."}


@router.post("/clear-data")
def clear_all_data(db: Session = Depends(get_db)) -> dict:
    """Xóa tất cả dữ liệu nghiệp vụ (Sản phẩm, Hóa đơn, Nhập kho,...) nhưng giữ nguyên Schema."""
    tables = [
        "batches",
        "import_items",
        "import_receipts",
        "inventory_logs",
        "sale_items",
        "sale_return_items",
        "sale_returns",
        "sales",
        "stock_adjustments",
        "products",
        "suppliers",
    ]
    try:
        # Xóa dữ liệu các bảng
        for table in tables:
            db.execute(text(f"DELETE FROM {table}"))
        
        # Reset ID tự tăng trong SQLite
        try:
            for table in tables:
                db.execute(text(f"DELETE FROM sqlite_sequence WHERE name='{table}'"))
        except Exception:
            pass # Có thể bảng không có AUTOINCREMENT
            
        db.commit()
        logger.warning("DATABASE WIPED BY USER REQUEST")
        return {"message": "✅ Đã xóa toàn bộ dữ liệu thành công. Hệ thống đã trở về trạng thái trống."}
    except Exception as exc:
        db.rollback()
        logger.error("Error clearing data: %s", exc)
        raise HTTPException(status_code=500, detail=f"Lỗi khi xóa dữ liệu: {exc}") from exc


@router.get("/schedule", response_model=ScheduleConfig)
def get_schedule() -> dict:
    sf = _schedule_file()
    if sf.exists():
        try:
            return json.loads(sf.read_text(encoding="utf-8"))
        except Exception:
            pass
    return ScheduleConfig().model_dump()


@router.post("/schedule", response_model=ScheduleConfig)
def save_schedule(body: ScheduleConfig) -> dict:
    sf = _schedule_file()
    sf.write_text(body.model_dump_json(), encoding="utf-8")
    logger.info("Schedule config updated: %s", body)
    return body.model_dump()


# ─── Internal helper ─────────────────────────────────────────────────────────

def _prune_backups() -> None:
    """Xoá các backup cũ vượt keep_count theo cấu hình schedule."""
    sf = _schedule_file()
    keep = 30
    if sf.exists():
        try:
            cfg = json.loads(sf.read_text(encoding="utf-8"))
            keep = int(cfg.get("keep_count", 30))
        except Exception:
            pass
    bdir = _get_backup_dir()
    files = sorted(
        [f for f in bdir.iterdir() if f.suffix == ".db" and f.is_file() and f.name.startswith("backup_")],
        key=lambda f: f.stat().st_mtime,
        reverse=True,
    )
    for old in files[keep:]:
        try:
            old.unlink()
            logger.info("Pruned old backup: %s", old.name)
        except OSError:
            pass
