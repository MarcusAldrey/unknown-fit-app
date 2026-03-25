import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_aluno
from app.models import Aluno, ConjuntoTreino, Treino, SessaoTreino, SerieExecutada, StatusSessao
from app.schemas import (
    ConjuntoTreinoOut,
    TreinoOut,
    SessaoCreate,
    SessaoOut,
    SerieCreate,
    SerieOut,
)

router = APIRouter()


# --- Conjunto ativo ---

@router.get("/me/conjunto-ativo", response_model=ConjuntoTreinoOut)
async def conjunto_ativo(
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ConjuntoTreino).where(
            ConjuntoTreino.aluno_id == aluno.id,
            ConjuntoTreino.ativo == True,  # noqa: E712
        )
    )
    conjunto = result.scalar_one_or_none()
    if conjunto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nenhum conjunto ativo")
    return conjunto


@router.get("/me/conjunto-ativo/treinos", response_model=list[TreinoOut])
async def treinos_do_conjunto_ativo(
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ConjuntoTreino).where(
            ConjuntoTreino.aluno_id == aluno.id,
            ConjuntoTreino.ativo == True,  # noqa: E712
        )
    )
    conjunto = result.scalar_one_or_none()
    if conjunto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nenhum conjunto ativo")

    result = await db.execute(
        select(Treino)
        .where(Treino.conjunto_treino_id == conjunto.id)
        .order_by(Treino.ordem)
    )
    return result.scalars().all()


# --- Sessões de treino ---

@router.post("/sessoes", response_model=SessaoOut, status_code=201)
async def iniciar_sessao(
    body: SessaoCreate,
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    # Verificar se o treino pertence ao conjunto ativo
    result = await db.execute(
        select(Treino)
        .where(Treino.id == body.treino_id)
        .options(selectinload(Treino.conjunto))
    )
    treino = result.scalar_one_or_none()

    if treino is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treino não encontrado")

    if treino.conjunto.aluno_id != aluno.id or not treino.conjunto.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Treino não pertence ao conjunto ativo",
        )

    sessao = SessaoTreino(
        aluno_id=aluno.id,
        treino_id=body.treino_id,
    )
    db.add(sessao)
    await db.flush()
    await db.refresh(sessao)
    return sessao


@router.get("/sessoes/{sessao_id}", response_model=SessaoOut)
async def detalhe_sessao(
    sessao_id: uuid.UUID,
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SessaoTreino).where(
            SessaoTreino.id == sessao_id,
            SessaoTreino.aluno_id == aluno.id,
        )
    )
    sessao = result.scalar_one_or_none()
    if sessao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessão não encontrada")
    return sessao


@router.post("/sessoes/{sessao_id}/series", response_model=SerieOut, status_code=201)
async def registrar_serie(
    sessao_id: uuid.UUID,
    body: SerieCreate,
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SessaoTreino).where(
            SessaoTreino.id == sessao_id,
            SessaoTreino.aluno_id == aluno.id,
            SessaoTreino.status == StatusSessao.EM_ANDAMENTO,
        )
    )
    sessao = result.scalar_one_or_none()
    if sessao is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sessão não encontrada ou já finalizada",
        )

    serie = SerieExecutada(
        sessao_treino_id=sessao_id,
        exercicio_treino_id=body.exercicio_treino_id,
        numero_serie=body.numero_serie,
        peso_utilizado=body.peso_utilizado,
        repeticoes_realizadas=body.repeticoes_realizadas,
        concluida=body.concluida,
    )
    db.add(serie)
    await db.flush()
    await db.refresh(serie)
    return serie


@router.patch("/sessoes/{sessao_id}/finalizar", response_model=SessaoOut)
async def finalizar_sessao(
    sessao_id: uuid.UUID,
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SessaoTreino).where(
            SessaoTreino.id == sessao_id,
            SessaoTreino.aluno_id == aluno.id,
        )
    )
    sessao = result.scalar_one_or_none()
    if sessao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessão não encontrada")

    sessao.status = StatusSessao.FINALIZADO
    sessao.finalizado_em = datetime.utcnow()

    await db.flush()
    await db.refresh(sessao)
    return sessao
