import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_conjunto_vinculado, get_current_personal, get_treino_vinculado
from app.models import ConjuntoTreino, Personal, Treino
from app.schemas import TreinoCreate, TreinoOut, TreinoUpdate
from app.services.periodizacao import reordenar_treinos

router = APIRouter()


@router.get("/conjuntos/{conjunto_id}/treinos", response_model=list[TreinoOut])
async def listar_treinos(
    conjunto_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    conjunto: ConjuntoTreino = Depends(get_conjunto_vinculado),
):
    result = await db.execute(
        select(Treino)
        .where(Treino.conjunto_treino_id == conjunto_id)
        .order_by(Treino.ordem)
    )
    return result.scalars().all()


@router.post("/conjuntos/{conjunto_id}/treinos", response_model=TreinoOut, status_code=201)
async def criar_treino(
    conjunto_id: uuid.UUID,
    body: TreinoCreate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    conjunto: ConjuntoTreino = Depends(get_conjunto_vinculado),
):
    treino = Treino(
        conjunto_treino_id=conjunto_id,
        codigo=body.codigo,
        nome=body.nome,
        observacoes_aluno=body.observacoes_aluno,
        ordem=body.ordem,
    )
    db.add(treino)
    await db.flush()
    await db.refresh(treino)
    return treino


@router.patch("/treinos/{treino_id}", response_model=TreinoOut)
async def editar_treino(
    treino_id: uuid.UUID,
    body: TreinoUpdate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    treino: Treino = Depends(get_treino_vinculado),
):
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(treino, key, value)

    await db.flush()
    await db.refresh(treino)
    return treino


@router.delete("/treinos/{treino_id}", status_code=204)
async def deletar_treino(
    treino_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    treino: Treino = Depends(get_treino_vinculado),
):
    conjunto_id = treino.conjunto_treino_id
    await db.delete(treino)
    await db.flush()

    await reordenar_treinos(db, conjunto_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
