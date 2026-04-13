import logging
import os
import sys
from pathlib import Path

import uvicorn


def _get_log_path() -> Path:
    """Derive log file path from WM_DATABASE_URL env (set by Tauri) or APPDATA fallback."""
    db_url = os.getenv("WM_DATABASE_URL", "")
    if db_url.startswith("sqlite:///"):
        db_path = Path(db_url.replace("sqlite:///", ""))
        return db_path.parent / "backend.log"
    appdata = os.getenv("APPDATA", str(Path.home()))
    return Path(appdata) / "vn.local.warehouse.pos" / "backend.log"


def _setup_logging() -> None:
    log_path = _get_log_path()
    log_path.parent.mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8", mode="w"),  # ghi đè mỗi lần mở app
            logging.StreamHandler(sys.stdout),
        ],
        force=True,
    )
    logging.info("=== wm-backend starting ===")
    logging.info("Python %s", sys.version)
    logging.info("Platform: %s", sys.platform)
    logging.info("Log file: %s", log_path)


def _ensure_db_bootstrap() -> None:
    """
    Desktop packaging convenience: ensure schema exists on first run.
    We keep Alembic for dev, but a bundled exe should be able to start from empty DB.
    """
    logging.info("Bootstrapping database...")
    import app.models  # noqa: F401
    from app.db.session import Base, engine

    Base.metadata.create_all(bind=engine)
    logging.info("Database ready.")


def main() -> None:
    _setup_logging()

    host = os.getenv("WM_HOST", "127.0.0.1")
    port = int(os.getenv("WM_PORT", "8000"))

    logging.info("WM_DATABASE_URL=%s", os.getenv("WM_DATABASE_URL", "(not set)"))
    logging.info("Starting on %s:%s", host, port)

    try:
        _ensure_db_bootstrap()
    except Exception:
        logging.exception("Failed to bootstrap database")
        sys.exit(1)

    try:
        from app.main import app as fastapi_app  # noqa: F401 (import after bootstrap)

        logging.info("FastAPI app loaded. Starting uvicorn...")
        uvicorn.run(
            fastapi_app,
            host=host,
            port=port,
            log_level=os.getenv("WM_LOG_LEVEL", "info").lower(),
            access_log=False,
        )
    except Exception:
        logging.exception("Fatal error in uvicorn.run()")
        sys.exit(1)


if __name__ == "__main__":
    main()
