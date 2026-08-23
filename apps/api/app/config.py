from functools import lru_cache
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pydantic import field_validator
from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    environment: str = "development"
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/kine"
    secret_key: str | None = None
    admin_api_key: str | None = None
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    log_level: str = "INFO"
    cors_origins: list[str] = ["http://localhost:8081", "http://localhost:19006"]

    model_config = {"env_file": str(_ENV_FILE), "extra": "ignore"}

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

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

        # O asyncpg espera `ssl`, enquanto provedores costumam entregar `sslmode`.
        parsed = urlsplit(normalized)
        query_params = parse_qsl(parsed.query, keep_blank_values=True)
        has_ssl_param = any(key == "ssl" for key, _ in query_params)

        if query_params and not has_ssl_param:
            converted_params: list[tuple[str, str]] = []
            sslmode_value: str | None = None

            for key, param_value in query_params:
                if key == "sslmode":
                    sslmode_value = param_value
                    continue

                converted_params.append((key, param_value))

            if sslmode_value is not None:
                converted_params.append(("ssl", sslmode_value))
                normalized = urlunsplit(
                    (
                        parsed.scheme,
                        parsed.netloc,
                        parsed.path,
                        urlencode(converted_params, doseq=True),
                        parsed.fragment,
                    )
                )

        return normalized


@lru_cache
def get_settings() -> Settings:
    return Settings()
