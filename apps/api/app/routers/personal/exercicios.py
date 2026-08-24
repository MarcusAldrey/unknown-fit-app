import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_personal, get_exercicio_vinculado, get_treino_vinculado
from app.models import (
    AlunoRecursoDisponibilidade,
    ExercicioBase,
    ExercicioRequisitoRecurso,
    ExercicioTreino,
    ExercicioTreinoEquivalente,
    Personal,
    Treino,
)
from app.schemas import (
    ExercicioTreinoCreate,
    ExercicioTreinoEquivalenteOut,
    ExercicioTreinoEquivalentesUpdate,
    ExercicioTreinoOut,
    ExercicioTreinoUpdate,
)
from app.services.disponibilidade import ensure_disponibilidade_rows
from app.services.equivalencia_exercicio import (
    remover_equivalencias_do_exercicio,
    reordenar_ordens_exercicios_do_treino,
    substituir_equivalentes_no_treino,
)

router = APIRouter()


async def _exercicio_disponivel_para_aluno(
    exercicio_base_id: uuid.UUID,
    aluno_id: uuid.UUID,
    db: AsyncSession,
) -> bool:
    recurso_ids = (
        await db.execute(
            select(ExercicioRequisitoRecurso.recurso_treino_id).where(
                ExercicioRequisitoRecurso.exercicio_base_id == exercicio_base_id
            )
        )
    ).scalars().all()

    if not recurso_ids:
        return True

    disponibilidade = await db.execute(
        select(AlunoRecursoDisponibilidade.id)
        .where(
            AlunoRecursoDisponibilidade.aluno_id == aluno_id,
            AlunoRecursoDisponibilidade.recurso_treino_id.in_(recurso_ids),
            AlunoRecursoDisponibilidade.disponivel_para_aluno.is_(True),
        )
        .limit(1)
    )
    return disponibilidade.scalar_one_or_none() is not None


async def _get_exercicio_treino_com_equivalentes(
    exercicio_id: uuid.UUID,
    db: AsyncSession,
) -> ExercicioTreino:
    exercicio = (
        await db.execute(
            select(ExercicioTreino)
            .where(ExercicioTreino.id == exercicio_id)
            .options(
                selectinload(ExercicioTreino.equivalentes).selectinload(
                    ExercicioTreinoEquivalente.exercicio_equivalente_treino
                )
            )
        )
    ).scalar_one_or_none()
    if exercicio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício não encontrado")
    return exercicio


@router.get("/treinos/{treino_id}/exercicios", response_model=list[ExercicioTreinoOut])
async def listar_exercicios(
    treino_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    treino: Treino = Depends(get_treino_vinculado),
):
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


@router.post("/treinos/{treino_id}/exercicios", response_model=ExercicioTreinoOut, status_code=201)
async def criar_exercicio(
    treino_id: uuid.UUID,
    body: ExercicioTreinoCreate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    treino: Treino = Depends(get_treino_vinculado),
):
    result = await db.execute(
        select(ExercicioBase).where(ExercicioBase.id == body.exercicio_base_id)
    )
    exercicio_base = result.scalar_one_or_none()
    if exercicio_base is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício base não encontrado")

    aluno_id = treino.conjunto.aluno_id
    await ensure_disponibilidade_rows(db, aluno_id)

    disponivel = await _exercicio_disponivel_para_aluno(
        exercicio_base_id=body.exercicio_base_id,
        aluno_id=aluno_id,
        db=db,
    )
    if not disponivel:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Exercício indisponível para o aluno: nenhum requisito alternativo de recurso está disponível.",
        )

    exercicio = ExercicioTreino(
        treino_id=treino_id,
        exercicio_base_id=body.exercicio_base_id,
        ordem=body.ordem,
        numero_series_prescritas=body.numero_series_prescritas,
        prescricao=body.prescricao,
        alvo_tipo=body.alvo_tipo,
        alvo_valor_min=body.alvo_valor_min,
        alvo_valor_max=body.alvo_valor_max,
        alvo_outros_texto=body.alvo_outros_texto,
        rer_rm_tipo=body.rer_rm_tipo,
        rer_rm_valor=body.rer_rm_valor,
        descanso_segundos=body.descanso_segundos,
        descanso_segundos_min=body.descanso_segundos_min,
        descanso_segundos_max=body.descanso_segundos_max,
        tecnica=body.tecnica,
        observacoes=body.observacoes,
        observacoes_aluno=body.observacoes_aluno,
    )
    db.add(exercicio)
    await db.flush()
    return await _get_exercicio_treino_com_equivalentes(exercicio.id, db)


@router.patch("/exercicios/{exercicio_id}", response_model=ExercicioTreinoOut)
async def editar_exercicio(
    exercicio_id: uuid.UUID,
    body: ExercicioTreinoUpdate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    exercicio: ExercicioTreino = Depends(get_exercicio_vinculado),
):
    aluno_id = exercicio.treino.conjunto.aluno_id
    await ensure_disponibilidade_rows(db, aluno_id)

    update_data = body.model_dump(exclude_unset=True)

    if "exercicio_base_id" in update_data:
        result = await db.execute(
            select(ExercicioBase).where(ExercicioBase.id == update_data["exercicio_base_id"])
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício base não encontrado")

        disponivel = await _exercicio_disponivel_para_aluno(
            exercicio_base_id=update_data["exercicio_base_id"],
            aluno_id=aluno_id,
            db=db,
        )
        if not disponivel:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exercício indisponível para o aluno: nenhum requisito alternativo de recurso está disponível.",
            )

    for key, value in update_data.items():
        setattr(exercicio, key, value)

    await db.flush()
    return await _get_exercicio_treino_com_equivalentes(exercicio.id, db)


@router.put(
    "/exercicios/{exercicio_id}/equivalentes",
    response_model=list[ExercicioTreinoEquivalenteOut],
)
async def substituir_equivalentes_exercicio(
    exercicio_id: uuid.UUID,
    body: ExercicioTreinoEquivalentesUpdate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    exercicio: ExercicioTreino = Depends(get_exercicio_vinculado),
):
    return await substituir_equivalentes_no_treino(
        db=db,
        treino_id=exercicio.treino_id,
        exercicio_id=exercicio.id,
        equivalentes_ids=body.exercicios_equivalentes_ids,
    )


@router.delete("/exercicios/{exercicio_id}", status_code=204)
async def deletar_exercicio(
    exercicio_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    exercicio: ExercicioTreino = Depends(get_exercicio_vinculado),
):
    await remover_equivalencias_do_exercicio(db, exercicio_id)

    treino_id = exercicio.treino_id
    await db.delete(exercicio)
    await db.flush()

    await reordenar_ordens_exercicios_do_treino(db, treino_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
