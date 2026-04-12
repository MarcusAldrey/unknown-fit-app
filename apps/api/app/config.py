from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/ecg"
    secret_key: str | None = None
    admin_api_key: str | None = None
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    log_level: str = "INFO"

    model_config = {"env_file": "../../.env", "extra": "ignore"}

    @field_validator("database_url", mode="before")
    @classmethod
    def normalize_database_url(cls, value: str) -> str:
        if not isinstance(value, str):
            raise ValueError("DATABASE_URL inválida")

        normalized = value.strip()
        if not normalized:
            raise ValueError("DATABASE_URL não configurada")

        # Placeholder não resolvido do provedor (ex.: ${db.DATABASE_URL}).
        if "${" in normalized:
            raise ValueError(
                "DATABASE_URL parece ser um placeholder não resolvido. "
                "Configure o valor real da URL do banco no provedor."
            )

        # Compatibilidade com URLs comuns de provedores.
        if normalized.startswith("postgres://"):
            normalized = normalized.replace("postgres://", "postgresql+asyncpg://", 1)
        elif normalized.startswith("postgresql://"):
            normalized = normalized.replace("postgresql://", "postgresql+asyncpg://", 1)

        return normalized


@lru_cache
def get_settings() -> Settings:
    return Settings()
