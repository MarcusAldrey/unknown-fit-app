from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ecg"
    secret_key: str = "dev-secret-key-change-in-production"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    model_config = {"env_file": "../../.env", "extra": "ignore"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
