import uuid

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.models import (
    Usuario,
    Personal,
    Aluno,
    Role,
    VinculoPersonalAluno,
    ConjuntoTreino,
    Treino,
    ExercicioTreino,
    ExercicioTreinoEquivalente,
)
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
        select(Personal).where(Personal.usuario_id == user.id)
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
        select(Aluno).where(Aluno.usuario_id == user.id)
    )
    aluno = result.scalar_one_or_none()

    if aluno is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Perfil de aluno não encontrado")

    return aluno


async def get_aluno_vinculado(
    aluno_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
) -> Aluno:
    result = await db.execute(
        select(VinculoPersonalAluno).where(
            VinculoPersonalAluno.personal_id == personal.id,
            VinculoPersonalAluno.aluno_id == aluno_id,
            VinculoPersonalAluno.ativo.is_(True),
        )
    )
    vinculo = result.scalar_one_or_none()
    if vinculo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não vinculado")

    result = await db.execute(
        select(Aluno)
        .where(Aluno.id == aluno_id)
        .options(selectinload(Aluno.usuario))
    )
    aluno = result.scalar_one_or_none()
    if aluno is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não vinculado")
    return aluno


async def get_conjunto_vinculado(
    conjunto_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
) -> ConjuntoTreino:
    result = await db.execute(
        select(ConjuntoTreino).where(ConjuntoTreino.id == conjunto_id)
    )
    conjunto = result.scalar_one_or_none()
    if conjunto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conjunto não encontrado")

    await get_aluno_vinculado(conjunto.aluno_id, personal, db)
    return conjunto


async def get_treino_vinculado(
    treino_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
) -> Treino:
    result = await db.execute(
        select(Treino)
        .where(Treino.id == treino_id)
        .options(selectinload(Treino.conjunto))
    )
    treino = result.scalar_one_or_none()
    if treino is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treino não encontrado")

    await get_aluno_vinculado(treino.conjunto.aluno_id, personal, db)
    return treino


async def get_exercicio_vinculado(
    exercicio_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
) -> ExercicioTreino:
    result = await db.execute(
        select(ExercicioTreino)
        .where(ExercicioTreino.id == exercicio_id)
        .options(
            selectinload(ExercicioTreino.treino).selectinload(Treino.conjunto),
            selectinload(ExercicioTreino.equivalentes).selectinload(
                ExercicioTreinoEquivalente.exercicio_equivalente_treino
            ),
        )
    )
    exercicio = result.scalar_one_or_none()
    if exercicio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício não encontrado")

    await get_aluno_vinculado(exercicio.treino.conjunto.aluno_id, personal, db)
    return exercicio
