import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_personal
from app.models import (
    Personal,
    Aluno,
    VinculoPersonalAluno,
    ConjuntoTreino,
    Treino,
    ExercicioTreino,
    Tecnica,
)
from app.schemas import (
    AlunoResumo,
    AlunoFicha,
    ConjuntoTreinoCreate,
    ConjuntoTreinoOut,
    TreinoCreate,
    TreinoUpdate,
    TreinoOut,
    ExercicioTreinoCreate,
    ExercicioTreinoUpdate,
    ExercicioTreinoOut,
)

router = APIRouter()


# --- Helpers ---

async def _get_aluno_vinculado(
    personal: Personal, aluno_id: uuid.UUID, db: AsyncSession
) -> Aluno:
    result = await db.execute(
        select(VinculoPersonalAluno).where(
            VinculoPersonalAluno.personal_id == personal.id,
            VinculoPersonalAluno.aluno_id == aluno_id,
            VinculoPersonalAluno.ativo == True,  # noqa: E712
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
    return result.scalar_one()


# --- Alunos ---

@router.get("/alunos", response_model=list[AlunoResumo])
async def listar_alunos(
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Aluno)
        .join(VinculoPersonalAluno)
        .where(
            VinculoPersonalAluno.personal_id == personal.id,
            VinculoPersonalAluno.ativo == True,  # noqa: E712
        )
        .options(selectinload(Aluno.usuario))
    )
    alunos = result.scalars().all()
    return [
        AlunoResumo(id=a.id, nome=a.usuario.nome, email=a.usuario.email)
        for a in alunos
    ]


@router.get("/alunos/{aluno_id}", response_model=AlunoFicha)
async def ficha_aluno(
    aluno_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    aluno = await _get_aluno_vinculado(personal, aluno_id, db)
    return AlunoFicha(
        id=aluno.id,
        nome=aluno.usuario.nome,
        email=aluno.usuario.email,
        idade=aluno.idade,
        peso=aluno.peso,
        altura=aluno.altura,
    )


# --- Conjuntos de Treino ---

@router.get("/alunos/{aluno_id}/conjuntos", response_model=list[ConjuntoTreinoOut])
async def listar_conjuntos(
    aluno_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    await _get_aluno_vinculado(personal, aluno_id, db)
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
):
    await _get_aluno_vinculado(personal, aluno_id, db)
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
async def ativar_conjunto(
    aluno_id: uuid.UUID,
    conjunto_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    await _get_aluno_vinculado(personal, aluno_id, db)

    # Desativar todos os conjuntos do aluno
    result = await db.execute(
        select(ConjuntoTreino).where(
            ConjuntoTreino.aluno_id == aluno_id,
            ConjuntoTreino.ativo == True,  # noqa: E712
        )
    )
    for c in result.scalars().all():
        c.ativo = False

    # Ativar o escolhido
    result = await db.execute(
        select(ConjuntoTreino).where(
            ConjuntoTreino.id == conjunto_id,
            ConjuntoTreino.aluno_id == aluno_id,
        )
    )
    conjunto = result.scalar_one_or_none()
    if conjunto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conjunto não encontrado")

    conjunto.ativo = True
    await db.flush()
    await db.refresh(conjunto)
    return conjunto


# --- Treinos ---

@router.get("/conjuntos/{conjunto_id}/treinos", response_model=list[TreinoOut])
async def listar_treinos(
    conjunto_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
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
):
    treino = Treino(
        conjunto_treino_id=conjunto_id,
        codigo=body.codigo,
        nome=body.nome,
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
):
    result = await db.execute(select(Treino).where(Treino.id == treino_id))
    treino = result.scalar_one_or_none()
    if treino is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treino não encontrado")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(treino, key, value)

    await db.flush()
    await db.refresh(treino)
    return treino


# --- Exercícios ---

@router.get("/treinos/{treino_id}/exercicios", response_model=list[ExercicioTreinoOut])
async def listar_exercicios(
    treino_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExercicioTreino)
        .where(ExercicioTreino.treino_id == treino_id)
        .order_by(ExercicioTreino.ordem)
    )
    return result.scalars().all()


@router.post("/treinos/{treino_id}/exercicios", response_model=ExercicioTreinoOut, status_code=201)
async def criar_exercicio(
    treino_id: uuid.UUID,
    body: ExercicioTreinoCreate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    exercicio = ExercicioTreino(
        treino_id=treino_id,
        nome_exercicio=body.nome_exercicio,
        ordem=body.ordem,
        numero_series_prescritas=body.numero_series_prescritas,
        prescricao=body.prescricao,
        repeticao_ou_tempo=body.repeticao_ou_tempo,
        rer_rm_valor=body.rer_rm_valor,
        descanso_segundos=body.descanso_segundos,
        tecnica=Tecnica(body.tecnica),
        observacoes=body.observacoes,
    )
    db.add(exercicio)
    await db.flush()
    await db.refresh(exercicio)
    return exercicio


@router.patch("/exercicios/{exercicio_id}", response_model=ExercicioTreinoOut)
async def editar_exercicio(
    exercicio_id: uuid.UUID,
    body: ExercicioTreinoUpdate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExercicioTreino).where(ExercicioTreino.id == exercicio_id)
    )
    exercicio = result.scalar_one_or_none()
    if exercicio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício não encontrado")

    update_data = body.model_dump(exclude_unset=True)
    if "tecnica" in update_data:
        update_data["tecnica"] = Tecnica(update_data["tecnica"])
    for key, value in update_data.items():
        setattr(exercicio, key, value)

    await db.flush()
    await db.refresh(exercicio)
    return exercicio


@router.delete("/exercicios/{exercicio_id}", status_code=204)
async def deletar_exercicio(
    exercicio_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExercicioTreino).where(ExercicioTreino.id == exercicio_id)
    )
    exercicio = result.scalar_one_or_none()
    if exercicio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício não encontrado")

    treino_id = exercicio.treino_id
    await db.delete(exercicio)
    await db.flush()

    # Reordenar exercícios restantes do treino
    result = await db.execute(
        select(ExercicioTreino)
        .where(ExercicioTreino.treino_id == treino_id)
        .order_by(ExercicioTreino.ordem)
    )
    for idx, ex in enumerate(result.scalars().all(), start=1):
        ex.ordem = idx
    await db.flush()
