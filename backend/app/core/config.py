from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = _BACKEND_ROOT / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
_DEFAULT_SQLITE = f"sqlite:///{DATA_DIR / 'app.db'}"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="WM_", extra="ignore")

    database_url: str = _DEFAULT_SQLITE
    api_prefix: str = "/api"


settings = Settings()
