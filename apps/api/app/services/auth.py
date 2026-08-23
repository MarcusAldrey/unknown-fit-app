from datetime import datetime, timedelta, timezone
from typing import Any
import uuid

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def _get_secret_key() -> str:
    secret_key = settings.secret_key
    if not secret_key:
        raise RuntimeError("SECRET_KEY não configurada")
    return secret_key


def hash_senha(senha: str) -> str:
    return pwd_context.hash(senha)


def verificar_senha(senha: str, senha_hash: str) -> bool:
    return pwd_context.verify(senha, senha_hash)


def criar_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, _get_secret_key(), algorithm=ALGORITHM)


def criar_access_token(sub: str, role: str) -> str:
    return criar_token(
        {"sub": sub, "role": role},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def criar_refresh_token(sub: str) -> str:
    return criar_token(
        {"sub": sub, "type": "refresh", "jti": str(uuid.uuid4())},
        timedelta(days=settings.refresh_token_expire_days),
    )


def decodificar_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, _get_secret_key(), algorithms=[ALGORITHM])
    except JWTError:
        raise ValueError("Token inválido")
