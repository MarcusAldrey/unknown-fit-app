from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Usuario, RefreshTokenRevogado
from app.deps import get_current_user
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
from app.schemas.usuario import UsuarioOut
from app.services.auth import (
    verificar_senha,
    criar_access_token,
    criar_refresh_token,
    decodificar_token,
)

router = APIRouter()


async def _revogar_refresh_token(db: AsyncSession, refresh_token: str) -> None:
    try:
        payload = decodificar_token(refresh_token)
    except ValueError:
        return

    jti = payload.get("jti")
    if jti is None:
        return

    result = await db.execute(
        select(RefreshTokenRevogado).where(RefreshTokenRevogado.jti == jti)
    )
    if result.scalar_one_or_none() is None:
        db.add(RefreshTokenRevogado(jti=jti, revogado_em=datetime.now(timezone.utc)))
        await db.flush()


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Usuario).where(Usuario.email == body.email))
    user = result.scalar_one_or_none()

    if user is None or not verificar_senha(body.senha, user.senha_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciais inválidas")

    if not user.ativo:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Conta desativada")

    access_token = criar_access_token(str(user.id), user.role.value)
    refresh_token = criar_refresh_token(str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role.value,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload = decodificar_token(body.refresh_token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token inválido")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token não é refresh")

    jti = payload.get("jti")
    if jti is not None:
        result = await db.execute(
            select(RefreshTokenRevogado).where(RefreshTokenRevogado.jti == jti)
        )
        if result.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revogado")

    user_id = payload.get("sub")
    result = await db.execute(select(Usuario).where(Usuario.id == user_id))
    user = result.scalar_one_or_none()

    if user is None or not user.ativo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")

    access_token = criar_access_token(str(user.id), user.role.value)
    refresh_token = criar_refresh_token(str(user.id))

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role.value,
    )


@router.post("/logout")
async def logout(
    body: RefreshRequest | None = None,
    db: AsyncSession = Depends(get_db),
):
    if body is not None:
        await _revogar_refresh_token(db, body.refresh_token)
    return {"detail": "Logout realizado"}


@router.get("/me", response_model=UsuarioOut)
async def me(user: Usuario = Depends(get_current_user)):
    return user
