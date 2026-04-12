import uuid

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.models import Usuario, Personal, Aluno, Role
from app.services.auth import decodificar_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
settings = get_settings()


def require_admin_api_key(
    x_admin_key: str | None = Header(default=None, alias="X-Admin-Key"),
) -> None:
    configured_admin_key = settings.admin_api_key
    if not configured_admin_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Admin key não configurada",
        )

    if x_admin_key != configured_admin_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin key inválida")


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> Usuario:
    try:
        payload = decodificar_token(token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token inválido")

    result = await db.execute(select(Usuario).where(Usuario.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.ativo:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Usuário não encontrado")

    return user


async def get_current_personal(
    user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Personal:
    if user.role != Role.PERSONAL:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a personais")

    result = await db.execute(
        select(Personal)
        .where(Personal.usuario_id == user.id)
        .options(selectinload(Personal.vinculos))
    )
    personal = result.scalar_one_or_none()

    if personal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil de personal não encontrado")

    return personal


async def get_current_aluno(
    user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Aluno:
    if user.role != Role.ALUNO:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a alunos")

    result = await db.execute(
        select(Aluno)
        .where(Aluno.usuario_id == user.id)
        .options(selectinload(Aluno.conjuntos_treino))
    )
    aluno = result.scalar_one_or_none()

    if aluno is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil de aluno não encontrado")

    return aluno
