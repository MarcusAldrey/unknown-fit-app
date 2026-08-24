import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_aluno_vinculado, get_current_personal
from app.models import (
    Aluno,
    AlunoRecursoDisponibilidade,
    Personal,
    RecursoTreino,
)
from app.schemas import (
    AlunoRecursoDisponibilidadeOut,
    AlunoRecursoDisponibilidadeUpdate,
    AlunoRecursosDisponibilidadeBatchUpdate,
)
from app.services.disponibilidade import ensure_disponibilidade_rows

router = APIRouter()


@router.get("/alunos/{aluno_id}/recursos-treino", response_model=list[AlunoRecursoDisponibilidadeOut])
async def listar_recursos_treino_aluno(
    aluno_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    aluno: Aluno = Depends(get_aluno_vinculado),
):
    await ensure_disponibilidade_rows(db, aluno_id)

    rows = (
        await db.execute(
            select(AlunoRecursoDisponibilidade, RecursoTreino)
            .join(RecursoTreino, AlunoRecursoDisponibilidade.recurso_treino_id == RecursoTreino.id)
            .where(
                AlunoRecursoDisponibilidade.aluno_id == aluno_id,
                RecursoTreino.ativo.is_(True),
            )
            .order_by(RecursoTreino.nome)
        )
    ).all()

    return [
        AlunoRecursoDisponibilidadeOut(
            recurso_treino_id=recurso.id,
            nome_recurso=recurso.nome,
            disponivel_para_aluno=disponibilidade.disponivel_para_aluno,
        )
        for disponibilidade, recurso in rows
    ]


@router.patch(
    "/alunos/{aluno_id}/recursos-treino",
    response_model=list[AlunoRecursoDisponibilidadeOut],
)
async def atualizar_disponibilidade_recursos_aluno_em_lote(
    aluno_id: uuid.UUID,
    body: AlunoRecursosDisponibilidadeBatchUpdate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    aluno: Aluno = Depends(get_aluno_vinculado),
):
    await ensure_disponibilidade_rows(db, aluno_id)

    rows = (
        await db.execute(
            select(AlunoRecursoDisponibilidade, RecursoTreino)
            .join(RecursoTreino, AlunoRecursoDisponibilidade.recurso_treino_id == RecursoTreino.id)
            .where(
                AlunoRecursoDisponibilidade.aluno_id == aluno_id,
                RecursoTreino.ativo.is_(True),
            )
            .order_by(RecursoTreino.nome)
        )
    ).all()

    for disponibilidade, _ in rows:
        disponibilidade.disponivel_para_aluno = body.disponivel_para_aluno

    await db.flush()

    return [
        AlunoRecursoDisponibilidadeOut(
            recurso_treino_id=recurso.id,
            nome_recurso=recurso.nome,
            disponivel_para_aluno=disponibilidade.disponivel_para_aluno,
        )
        for disponibilidade, recurso in rows
    ]


@router.patch(
    "/alunos/{aluno_id}/recursos-treino/{recurso_id}",
    response_model=AlunoRecursoDisponibilidadeOut,
)
async def atualizar_disponibilidade_recurso_aluno(
    aluno_id: uuid.UUID,
    recurso_id: uuid.UUID,
    body: AlunoRecursoDisponibilidadeUpdate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    aluno: Aluno = Depends(get_aluno_vinculado),
):
    recurso = (
        await db.execute(
            select(RecursoTreino).where(
                RecursoTreino.id == recurso_id,
                RecursoTreino.ativo.is_(True),
            )
        )
    ).scalar_one_or_none()
    if recurso is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurso não encontrado")

    disponibilidade = (
        await db.execute(
            select(AlunoRecursoDisponibilidade).where(
                AlunoRecursoDisponibilidade.aluno_id == aluno_id,
                AlunoRecursoDisponibilidade.recurso_treino_id == recurso_id,
            )
        )
    ).scalar_one_or_none()

    if disponibilidade is None:
        disponibilidade = AlunoRecursoDisponibilidade(
            aluno_id=aluno_id,
            recurso_treino_id=recurso_id,
            disponivel_para_aluno=body.disponivel_para_aluno,
        )
        db.add(disponibilidade)
    else:
        disponibilidade.disponivel_para_aluno = body.disponivel_para_aluno

    await db.flush()

    return AlunoRecursoDisponibilidadeOut(
        recurso_treino_id=recurso.id,
        nome_recurso=recurso.nome,
        disponivel_para_aluno=disponibilidade.disponivel_para_aluno,
    )
