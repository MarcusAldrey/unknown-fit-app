import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.database import get_db
from app.deps import get_aluno_vinculado, get_conjunto_vinculado, get_current_personal
from app.models import (
    Aluno,
    ConjuntoTreino,
    ExercicioTreino,
    Personal,
    SerieExecutada,
    SessaoTreino,
    Treino,
)
from app.schemas import SerieDetalheOut, SessaoResumoOut

router = APIRouter()


@router.get(
    "/alunos/{aluno_id}/conjuntos/{conjunto_id}/sessoes",
    response_model=list[SessaoResumoOut],
)
async def listar_sessoes_aluno_por_conjunto(
    aluno_id: uuid.UUID,
    conjunto_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    aluno: Aluno = Depends(get_aluno_vinculado),
    conjunto: ConjuntoTreino = Depends(get_conjunto_vinculado),
):
    if conjunto.aluno_id != aluno_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conjunto não encontrado")

    rows = (
        await db.execute(
            select(SessaoTreino, Treino)
            .join(Treino, SessaoTreino.treino_id == Treino.id)
            .where(
                SessaoTreino.aluno_id == aluno_id,
                Treino.conjunto_treino_id == conjunto_id,
            )
            .order_by(SessaoTreino.iniciado_em.desc())
        )
    ).all()

    return [SessaoResumoOut.from_model(sessao, treino) for sessao, treino in rows]


@router.get(
    "/alunos/{aluno_id}/sessoes/{sessao_id}/series",
    response_model=list[SerieDetalheOut],
)
async def listar_series_sessao_aluno(
    aluno_id: uuid.UUID,
    sessao_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    aluno: Aluno = Depends(get_aluno_vinculado),
):
    exercicio_executado_alias = aliased(ExercicioTreino)

    sessao = (
        await db.execute(
            select(SessaoTreino)
            .join(Treino, SessaoTreino.treino_id == Treino.id)
            .join(ConjuntoTreino, Treino.conjunto_treino_id == ConjuntoTreino.id)
            .where(
                SessaoTreino.id == sessao_id,
                SessaoTreino.aluno_id == aluno_id,
                ConjuntoTreino.aluno_id == aluno_id,
            )
        )
    ).scalar_one_or_none()
    if sessao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessão não encontrada")

    rows = (
        await db.execute(
            select(SerieExecutada, ExercicioTreino, exercicio_executado_alias)
            .join(ExercicioTreino, SerieExecutada.exercicio_treino_id == ExercicioTreino.id)
            .outerjoin(
                exercicio_executado_alias,
                SerieExecutada.exercicio_treino_executado_id == exercicio_executado_alias.id,
            )
            .where(SerieExecutada.sessao_treino_id == sessao.id)
            .order_by(ExercicioTreino.ordem, SerieExecutada.numero_serie)
        )
    ).all()

    return [
        SerieDetalheOut.from_model(serie, exercicio, exercicio_executado)
        for serie, exercicio, exercicio_executado in rows
    ]
