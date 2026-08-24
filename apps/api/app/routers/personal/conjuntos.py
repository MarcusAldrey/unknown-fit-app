import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_aluno_vinculado, get_conjunto_vinculado, get_current_personal
from app.models import Aluno, ConjuntoTreino, Personal
from app.schemas import ConjuntoTreinoCreate, ConjuntoTreinoOut, ConjuntoTreinoUpdate
from app.services.periodizacao import ativar_conjunto

router = APIRouter()


@router.get("/alunos/{aluno_id}/conjuntos", response_model=list[ConjuntoTreinoOut])
async def listar_conjuntos(
    aluno_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    aluno: Aluno = Depends(get_aluno_vinculado),
):
    result = await db.execute(
        select(ConjuntoTreino).where(ConjuntoTreino.aluno_id == aluno_id)
    )
    return result.scalars().all()


@router.post("/alunos/{aluno_id}/conjuntos", response_model=ConjuntoTreinoOut, status_code=201)
async def criar_conjunto(
    aluno_id: uuid.UUID,
    body: ConjuntoTreinoCreate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    aluno: Aluno = Depends(get_aluno_vinculado),
):
    conjunto = ConjuntoTreino(
        aluno_id=aluno_id,
        nome=body.nome,
        data_inicio=body.data_inicio,
        data_fim=body.data_fim,
    )
    db.add(conjunto)
    await db.flush()
    await db.refresh(conjunto)
    return conjunto


@router.patch("/alunos/{aluno_id}/conjuntos/{conjunto_id}/ativar", response_model=ConjuntoTreinoOut)
async def ativar_conjunto_route(
    aluno_id: uuid.UUID,
    conjunto_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    aluno: Aluno = Depends(get_aluno_vinculado),
):
    result = await db.execute(
        select(ConjuntoTreino).where(
            ConjuntoTreino.id == conjunto_id,
            ConjuntoTreino.aluno_id == aluno_id,
        )
    )
    conjunto = result.scalar_one_or_none()
    if conjunto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conjunto não encontrado")

    return await ativar_conjunto(db, conjunto)


@router.patch("/conjuntos/{conjunto_id}", response_model=ConjuntoTreinoOut)
async def editar_conjunto(
    conjunto_id: uuid.UUID,
    body: ConjuntoTreinoUpdate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    conjunto: ConjuntoTreino = Depends(get_conjunto_vinculado),
):
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(conjunto, key, value)

    await db.flush()
    await db.refresh(conjunto)
    return conjunto
