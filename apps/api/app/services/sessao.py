import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.exceptions import DomainValidationError, NotFoundError
from app.models import (
    Aluno,
    ExercicioTreino,
    ExercicioTreinoEquivalente,
    SessaoTreino,
    SerieExecutada,
    StatusSessao,
    Treino,
)
from app.schemas import SerieCreate


async def iniciar_sessao(
    db: AsyncSession,
    aluno: Aluno,
    treino_id: uuid.UUID,
) -> SessaoTreino:
    result = await db.execute(
        select(Treino)
        .where(Treino.id == treino_id)
        .options(selectinload(Treino.conjunto))
    )
    treino = result.scalar_one_or_none()
    if treino is None:
        raise NotFoundError("Treino não encontrado")

    if treino.conjunto.aluno_id != aluno.id or not treino.conjunto.ativo:
        raise DomainValidationError("Treino não pertence ao conjunto ativo")

    result_ativas = await db.execute(
        select(SessaoTreino).where(
            SessaoTreino.aluno_id == aluno.id,
            SessaoTreino.status == StatusSessao.EM_ANDAMENTO,
        )
    )
    for sessao_antiga in result_ativas.scalars():
        sessao_antiga.status = StatusSessao.FINALIZADO
        sessao_antiga.finalizado_em = datetime.now(timezone.utc)

    sessao = SessaoTreino(aluno_id=aluno.id, treino_id=treino_id)
    db.add(sessao)
    await db.flush()
    await db.refresh(sessao)
    return sessao


async def registrar_serie(
    db: AsyncSession,
    aluno: Aluno,
    sessao_id: uuid.UUID,
    body: SerieCreate,
) -> SerieExecutada:
    result = await db.execute(
        select(SessaoTreino).where(
            SessaoTreino.id == sessao_id,
            SessaoTreino.aluno_id == aluno.id,
            SessaoTreino.status == StatusSessao.EM_ANDAMENTO,
        )
    )
    sessao = result.scalar_one_or_none()
    if sessao is None:
        raise NotFoundError("Sessão não encontrada ou já finalizada")

    exercicio_prescrito = (
        await db.execute(
            select(ExercicioTreino).where(
                ExercicioTreino.id == body.exercicio_treino_id,
                ExercicioTreino.treino_id == sessao.treino_id,
            )
        )
    ).scalar_one_or_none()
    if exercicio_prescrito is None:
        raise DomainValidationError("Exercício do bloco não pertence ao treino da sessão")

    exercicio_executado_id = body.exercicio_treino_executado_id
    if exercicio_executado_id is not None and exercicio_executado_id != body.exercicio_treino_id:
        exercicio_executado = (
            await db.execute(
                select(ExercicioTreino).where(
                    ExercicioTreino.id == exercicio_executado_id,
                    ExercicioTreino.treino_id == sessao.treino_id,
                )
            )
        ).scalar_one_or_none()
        if exercicio_executado is None:
            raise DomainValidationError("Exercício ativo não pertence ao treino da sessão")

        equivalente = (
            await db.execute(
                select(ExercicioTreinoEquivalente.id).where(
                    ExercicioTreinoEquivalente.exercicio_treino_id == body.exercicio_treino_id,
                    ExercicioTreinoEquivalente.exercicio_equivalente_treino_id
                    == exercicio_executado_id,
                )
            )
        ).scalar_one_or_none()
        if equivalente is None:
            raise DomainValidationError(
                "Exercício ativo não está configurado como equivalente para este bloco"
            )

    serie = SerieExecutada(
        sessao_treino_id=sessao_id,
        exercicio_treino_id=body.exercicio_treino_id,
        exercicio_treino_executado_id=(
            exercicio_executado_id
            if exercicio_executado_id is not None
            and exercicio_executado_id != body.exercicio_treino_id
            else None
        ),
        numero_serie=body.numero_serie,
        peso_utilizado=body.peso_utilizado,
        repeticoes_realizadas=body.repeticoes_realizadas,
        concluida=body.concluida,
        concluida_em=datetime.now(timezone.utc) if body.concluida else None,
    )
    db.add(serie)
    await db.flush()
    await db.refresh(serie)
    return serie


async def finalizar_sessao(
    db: AsyncSession,
    aluno: Aluno,
    sessao_id: uuid.UUID,
) -> SessaoTreino:
    result = await db.execute(
        select(SessaoTreino).where(
            SessaoTreino.id == sessao_id,
            SessaoTreino.aluno_id == aluno.id,
        )
    )
    sessao = result.scalar_one_or_none()
    if sessao is None:
        raise NotFoundError("Sessão não encontrada")

    sessao.status = StatusSessao.FINALIZADO
    sessao.finalizado_em = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(sessao)
    return sessao


async def excluir_serie(
    db: AsyncSession,
    aluno: Aluno,
    sessao_id: uuid.UUID,
    serie_id: uuid.UUID,
) -> None:
    result = await db.execute(
        select(SerieExecutada, SessaoTreino)
        .join(SessaoTreino, SerieExecutada.sessao_treino_id == SessaoTreino.id)
        .where(
            SerieExecutada.id == serie_id,
            SerieExecutada.sessao_treino_id == sessao_id,
            SessaoTreino.aluno_id == aluno.id,
            SessaoTreino.status == StatusSessao.EM_ANDAMENTO,
        )
    )
    row = result.first()
    if row is None:
        raise NotFoundError("Série não encontrada na sessão em andamento")

    serie, _ = row
    await db.delete(serie)
    await db.flush()
