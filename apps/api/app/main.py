from contextlib import asynccontextmanager
import importlib.metadata
import logging
from time import perf_counter
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.exceptions import DomainError
from app.logging_config import (
    configure_logging,
    get_request_id,
    reset_request_id,
    set_request_id,
)
from app.routers import auth, personal, aluno, catalogo, admin


settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger("ecg.api")


def _app_version() -> str:
    try:
        return importlib.metadata.version("ecg-api")
    except importlib.metadata.PackageNotFoundError:
        return "0.1.0"


API_VERSION = _app_version()

_SECRET_PLACEHOLDERS = {
    "dev-secret-key-change-in-production",
    "sua-chave-secreta-aqui",
}
_ADMIN_KEY_PLACEHOLDERS = {
    "dev-admin-key-change-in-production",
    "sua-chave-admin-aqui",
}


def _missing_or_placeholder(value: str | None, placeholders: set[str]) -> bool:
    if value is None:
        return True

    normalized = value.strip()
    return normalized == "" or normalized in placeholders


@asynccontextmanager
async def lifespan(app: FastAPI):
    environment = settings.environment.strip().lower()
    invalid_secret_key = _missing_or_placeholder(settings.secret_key, _SECRET_PLACEHOLDERS)
    invalid_admin_key = _missing_or_placeholder(settings.admin_api_key, _ADMIN_KEY_PLACEHOLDERS)

    logger.info(
        "api_startup version=%s host=%s port=%s environment=%s",
        API_VERSION,
        settings.api_host,
        settings.api_port,
        settings.environment,
    )

    if environment == "production":
        missing_vars: list[str] = []
        if invalid_secret_key:
            missing_vars.append("SECRET_KEY")
        if invalid_admin_key:
            missing_vars.append("ADMIN_API_KEY")

        if missing_vars:
            raise RuntimeError(
                "Configuração inválida para produção. Defina valores fortes para: "
                + ", ".join(missing_vars)
            )
    else:
        if invalid_secret_key:
            logger.warning("security_warning secret_key_missing_or_placeholder_non_production")
        if invalid_admin_key:
            logger.warning("security_warning admin_api_key_missing_or_placeholder_non_production")
    yield
    logger.info("api_shutdown")


app = FastAPI(
    title="ECG - Elite Training Gym",
    version=API_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    token = set_request_id(request_id)

    started_at = perf_counter()
    logger.info("request_started method=%s path=%s", request.method, request.url.path)

    try:
        response = await call_next(request)
        elapsed_ms = (perf_counter() - started_at) * 1000
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request_finished method=%s path=%s status=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )
        return response
    except Exception:
        elapsed_ms = (perf_counter() - started_at) * 1000
        logger.exception(
            "request_failed_before_handler method=%s path=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            elapsed_ms,
        )
        raise
    finally:
        reset_request_id(token)


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError):
    request_id = getattr(request.state, "request_id", get_request_id())
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code, "request_id": request_id},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", get_request_id())
    logger.exception(
        "unhandled_exception method=%s path=%s",
        request.method,
        request.url.path,
        exc_info=exc,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor", "request_id": request_id},
    )

app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(personal.router, prefix="/api/v1/personal", tags=["Personal"])
app.include_router(aluno.router, prefix="/api/v1/aluno", tags=["Aluno"])
app.include_router(catalogo.router, prefix="/api/v1/catalogo", tags=["Catálogo"])


@app.get("/health")
async def health():
    return {"status": "ok"}
