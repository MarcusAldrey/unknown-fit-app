import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased, selectinload

from app.database import get_db
from app.deps import get_current_aluno
from app.models import (
    Aluno,
    ConjuntoTreino,
    Treino,
    SessaoTreino,
    SerieExecutada,
    StatusSessao,
    ExercicioTreino,
    ExercicioTreinoEquivalente,
)
from app.schemas import (
    ConjuntoTreinoOut,
    TreinoOut,
    ExercicioTreinoOut,
    SessaoCreate,
    SessaoOut,
    SessaoResumoOut,
    SessaoAtivaOut,
    SerieCreate,
    SerieOut,
    SerieDetalheOut,
    UltimoPesoExercicioOut,
    TreinoObservacaoAlunoUpdate,
    ExercicioObservacaoAlunoUpdate,
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


@router.patch("/treinos/{treino_id}/observacoes-aluno", response_model=TreinoOut)
async def atualizar_observacoes_aluno_treino(
    treino_id: uuid.UUID,
    body: TreinoObservacaoAlunoUpdate,
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Treino)
        .where(Treino.id == treino_id)
        .options(selectinload(Treino.conjunto))
    )
    treino = result.scalar_one_or_none()

    if treino is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treino não encontrado")

    if treino.conjunto.aluno_id != aluno.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Treino não pertence ao aluno")

    texto = body.observacoes_aluno.strip() if body.observacoes_aluno else None
    treino.observacoes_aluno = texto or None
    await db.flush()
    await db.refresh(treino)
    return treino


@router.patch("/exercicios/{exercicio_treino_id}/observacoes-aluno", response_model=ExercicioTreinoOut)
async def atualizar_observacoes_aluno_exercicio(
    exercicio_treino_id: uuid.UUID,
    body: ExercicioObservacaoAlunoUpdate,
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExercicioTreino)
        .where(ExercicioTreino.id == exercicio_treino_id)
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

    if exercicio.treino.conjunto.aluno_id != aluno.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Exercício não pertence ao aluno")

    texto = body.observacoes_aluno.strip() if body.observacoes_aluno else None
    exercicio.observacoes_aluno = texto or None
    await db.flush()
    return exercicio


@router.get("/treinos/{treino_id}/exercicios", response_model=list[ExercicioTreinoOut])
async def exercicios_do_treino(
    treino_id: uuid.UUID,
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Treino)
        .where(Treino.id == treino_id)
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

    result = await db.execute(
        select(ExercicioTreino)
        .where(ExercicioTreino.treino_id == treino_id)
        .options(
            selectinload(ExercicioTreino.equivalentes).selectinload(
                ExercicioTreinoEquivalente.exercicio_equivalente_treino
            )
        )
        .order_by(ExercicioTreino.ordem)
    )
    return result.scalars().all()


# --- Sessões de treino ---

@router.get("/sessoes/ativa", response_model=SessaoAtivaOut)
async def sessao_ativa(
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    """Retorna a sessão EM_ANDAMENTO do aluno, ou 404."""
    result = await db.execute(
        select(SessaoTreino, Treino)
        .join(Treino, SessaoTreino.treino_id == Treino.id)
        .where(
            SessaoTreino.aluno_id == aluno.id,
            SessaoTreino.status == StatusSessao.EM_ANDAMENTO,
        )
        .order_by(SessaoTreino.iniciado_em.desc())
        .limit(1)
    )
    row = result.first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Nenhuma sessão ativa")

    sessao, treino = row

    # Buscar séries já registradas
    result_series = await db.execute(
        select(SerieExecutada)
        .where(SerieExecutada.sessao_treino_id == sessao.id)
        .order_by(SerieExecutada.numero_serie)
    )
    series = result_series.scalars().all()

    return SessaoAtivaOut(
        id=sessao.id,
        treino_id=sessao.treino_id,
        treino_codigo=treino.codigo,
        treino_nome=treino.nome,
        iniciado_em=sessao.iniciado_em,
        status=sessao.status.value,
        series=[SerieOut.model_validate(s) for s in series],
    )


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

    # Auto-finalizar qualquer sessão em andamento
    result_ativas = await db.execute(
        select(SessaoTreino).where(
            SessaoTreino.aluno_id == aluno.id,
            SessaoTreino.status == StatusSessao.EM_ANDAMENTO,
        )
    )
    for sessao_antiga in result_ativas.scalars():
        sessao_antiga.status = StatusSessao.FINALIZADO
        sessao_antiga.finalizado_em = datetime.utcnow()

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


@router.get("/sessoes", response_model=list[SessaoResumoOut])
async def listar_sessoes(
    limit: int = 50,
    offset: int = 0,
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SessaoTreino, Treino)
        .join(Treino, SessaoTreino.treino_id == Treino.id)
        .where(SessaoTreino.aluno_id == aluno.id)
        .order_by(SessaoTreino.iniciado_em.desc())
        .limit(limit)
        .offset(offset)
    )

    rows = result.all()
    return [
        SessaoResumoOut(
            id=sessao.id,
            treino_id=sessao.treino_id,
            treino_codigo=treino.codigo,
            treino_nome=treino.nome,
            iniciado_em=sessao.iniciado_em,
            finalizado_em=sessao.finalizado_em,
            status=sessao.status.value,
        )
        for sessao, treino in rows
    ]


@router.get("/sessoes/{sessao_id}/series", response_model=list[SerieDetalheOut])
async def listar_series_da_sessao(
    sessao_id: uuid.UUID,
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    exercicio_executado_alias = aliased(ExercicioTreino)
    result = await db.execute(
        select(SessaoTreino).where(
            SessaoTreino.id == sessao_id,
            SessaoTreino.aluno_id == aluno.id,
        )
    )
    sessao = result.scalar_one_or_none()
    if sessao is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sessão não encontrada")

    result = await db.execute(
        select(SerieExecutada, ExercicioTreino, exercicio_executado_alias)
        .join(ExercicioTreino, SerieExecutada.exercicio_treino_id == ExercicioTreino.id)
        .outerjoin(
            exercicio_executado_alias,
            SerieExecutada.exercicio_treino_executado_id == exercicio_executado_alias.id,
        )
        .where(SerieExecutada.sessao_treino_id == sessao_id)
        .order_by(ExercicioTreino.ordem, SerieExecutada.numero_serie)
    )
    rows = result.all()

    return [
        SerieDetalheOut(
            id=serie.id,
            exercicio_treino_id=serie.exercicio_treino_id,
            exercicio_treino_executado_id=serie.exercicio_treino_executado_id,
            nome_exercicio=exercicio.nome_exercicio,
            nome_exercicio_executado=(
                exercicio_executado.nome_exercicio if exercicio_executado is not None else None
            ),
            numero_serie=serie.numero_serie,
            peso_utilizado=serie.peso_utilizado,
            repeticoes_realizadas=serie.repeticoes_realizadas,
            concluida=serie.concluida,
            concluida_em=serie.concluida_em,
        )
        for serie, exercicio, exercicio_executado in rows
    ]


@router.get("/exercicios/{exercicio_treino_id}/ultimo-peso", response_model=UltimoPesoExercicioOut)
async def ultimo_peso_exercicio(
    exercicio_treino_id: uuid.UUID,
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
    peso_result = await db.execute(
        select(SerieExecutada.peso_utilizado)
        .join(SessaoTreino, SerieExecutada.sessao_treino_id == SessaoTreino.id)
        .where(
            SerieExecutada.exercicio_treino_id == exercicio_treino_id,
            SessaoTreino.aluno_id == aluno.id,
            SessaoTreino.status == StatusSessao.FINALIZADO,
            SerieExecutada.peso_utilizado.is_not(None),
        )
        .order_by(SessaoTreino.iniciado_em.desc(), SerieExecutada.numero_serie.desc())
        .limit(1)
    )
    peso = peso_result.scalar_one_or_none()

    repeticoes_result = await db.execute(
        select(SerieExecutada.repeticoes_realizadas)
        .join(SessaoTreino, SerieExecutada.sessao_treino_id == SessaoTreino.id)
        .where(
            SerieExecutada.exercicio_treino_id == exercicio_treino_id,
            SessaoTreino.aluno_id == aluno.id,
            SessaoTreino.status == StatusSessao.FINALIZADO,
            SerieExecutada.repeticoes_realizadas.is_not(None),
        )
        .order_by(SessaoTreino.iniciado_em.desc(), SerieExecutada.numero_serie.desc())
        .limit(1)
    )
    repeticoes = repeticoes_result.scalar_one_or_none()

    return UltimoPesoExercicioOut(
        exercicio_treino_id=exercicio_treino_id,
        peso_utilizado=peso,
        repeticoes_realizadas=repeticoes,
    )


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

    exercicio_prescrito = (
        await db.execute(
            select(ExercicioTreino).where(
                ExercicioTreino.id == body.exercicio_treino_id,
                ExercicioTreino.treino_id == sessao.treino_id,
            )
        )
    ).scalar_one_or_none()
    if exercicio_prescrito is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exercício do bloco não pertence ao treino da sessão",
        )

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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exercício ativo não pertence ao treino da sessão",
            )

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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exercício ativo não está configurado como equivalente para este bloco",
            )

    serie = SerieExecutada(
        sessao_treino_id=sessao_id,
        exercicio_treino_id=body.exercicio_treino_id,
        exercicio_treino_executado_id=(
            exercicio_executado_id
            if exercicio_executado_id is not None and exercicio_executado_id != body.exercicio_treino_id
            else None
        ),
        numero_serie=body.numero_serie,
        peso_utilizado=body.peso_utilizado,
        repeticoes_realizadas=body.repeticoes_realizadas,
        concluida=body.concluida,
        concluida_em=datetime.utcnow() if body.concluida else None,
    )
    db.add(serie)
    await db.flush()
    await db.refresh(serie)
    return serie


@router.delete("/sessoes/{sessao_id}/series/{serie_id}", status_code=204)
async def excluir_serie(
    sessao_id: uuid.UUID,
    serie_id: uuid.UUID,
    aluno: Aluno = Depends(get_current_aluno),
    db: AsyncSession = Depends(get_db),
):
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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Série não encontrada na sessão em andamento",
        )

    serie, _ = row
    await db.delete(serie)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


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


@router.delete("/sessoes/{sessao_id}", status_code=204)
async def descartar_sessao(
    sessao_id: uuid.UUID,
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
            detail="Sessão em andamento não encontrada",
        )

    await db.delete(sessao)
    await db.flush()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
