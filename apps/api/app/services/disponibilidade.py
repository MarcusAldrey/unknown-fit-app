import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Aluno, AlunoRecursoDisponibilidade, RecursoTreino


async def ensure_disponibilidade_rows(
    db: AsyncSession,
    aluno_id: uuid.UUID | None = None,
) -> None:
    recursos_ids = (await db.execute(select(RecursoTreino.id))).scalars().all()

    if aluno_id is None:
        alunos_ids = (await db.execute(select(Aluno.id))).scalars().all()
    else:
        alunos_ids = [aluno_id]

    if not alunos_ids or not recursos_ids:
        return

    existentes = set(
        (
            await db.execute(
                select(
                    AlunoRecursoDisponibilidade.aluno_id,
                    AlunoRecursoDisponibilidade.recurso_treino_id,
                )
            )
        ).all()
    )

    for aid in alunos_ids:
        for rid in recursos_ids:
            if (aid, rid) in existentes:
                continue
            db.add(
                AlunoRecursoDisponibilidade(
                    aluno_id=aid,
                    recurso_treino_id=rid,
                    disponivel_para_aluno=True,
                )
            )
            existentes.add((aid, rid))

    await db.flush()
