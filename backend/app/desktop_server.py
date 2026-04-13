import os
from pathlib import Path

import uvicorn


def _ensure_db_bootstrap() -> None:
    """
    Desktop packaging convenience: ensure schema exists on first run.
    We keep Alembic for dev, but a bundled exe should be able to start from empty DB.
    """
    import app.models  # noqa: F401
    from app.db.session import Base, engine

    Base.metadata.create_all(bind=engine)


def main() -> None:
    host = os.getenv("WM_HOST", "127.0.0.1")
    port = int(os.getenv("WM_PORT", "8000"))

    # Default to a user-writable DB path when packaged.
    # Tauri will set WM_DATABASE_URL to an AppData path; if not set, config.py fallback is used.
    _ensure_db_bootstrap()

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        log_level=os.getenv("WM_LOG_LEVEL", "info").lower(),
        access_log=False,
    )


if __name__ == "__main__":
    main()

