import uuid
from datetime import date

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
    ExercicioBase,
    Tecnica,
    RegistroPesoAluno,
)
from app.schemas import (
    AlunoResumo,
    AlunoFicha,
    ConjuntoTreinoCreate,
    ConjuntoTreinoUpdate,
    ConjuntoTreinoOut,
    TreinoCreate,
    TreinoUpdate,
    TreinoOut,
    ExercicioTreinoCreate,
    ExercicioTreinoUpdate,
    ExercicioTreinoOut,
    RegistroPesoCreate,
    RegistroPesoOut,
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


@router.get("/alunos/{aluno_id}/peso", response_model=list[RegistroPesoOut])
async def listar_registros_peso(
    aluno_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    await _get_aluno_vinculado(personal, aluno_id, db)
    result = await db.execute(
        select(RegistroPesoAluno)
        .where(RegistroPesoAluno.aluno_id == aluno_id)
        .order_by(RegistroPesoAluno.registrado_em.desc())
    )
    return result.scalars().all()


@router.post("/alunos/{aluno_id}/peso", response_model=RegistroPesoOut, status_code=201)
async def registrar_peso(
    aluno_id: uuid.UUID,
    body: RegistroPesoCreate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    aluno = await _get_aluno_vinculado(personal, aluno_id, db)
    registro = RegistroPesoAluno(aluno_id=aluno_id, peso=body.peso)
    aluno.peso = body.peso

    db.add(registro)
    await db.flush()
    await db.refresh(registro)
    return registro


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
    hoje = date.today()

    # Buscar conjunto alvo antes de aplicar alterações
    result = await db.execute(
        select(ConjuntoTreino).where(
            ConjuntoTreino.id == conjunto_id,
            ConjuntoTreino.aluno_id == aluno_id,
        )
    )
    conjunto = result.scalar_one_or_none()
    if conjunto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conjunto não encontrado")

    # Periodizações concluídas não podem ser reativadas
    if conjunto.data_fim is not None and not conjunto.ativo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta periodização já foi concluída e não pode ser ativada novamente.",
        )

    # Desativar conjunto(s) ativo(s) e marcar como concluído(s)
    result = await db.execute(
        select(ConjuntoTreino).where(
            ConjuntoTreino.aluno_id == aluno_id,
            ConjuntoTreino.ativo == True,  # noqa: E712
        )
    )
    for c in result.scalars().all():
        if c.id != conjunto_id:
            c.data_fim = hoje
        c.ativo = False

    conjunto.ativo = True
    if conjunto.data_inicio is None:
        conjunto.data_inicio = hoje
    await db.flush()
    await db.refresh(conjunto)
    return conjunto


@router.patch("/conjuntos/{conjunto_id}", response_model=ConjuntoTreinoOut)
async def editar_conjunto(
    conjunto_id: uuid.UUID,
    body: ConjuntoTreinoUpdate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ConjuntoTreino).where(ConjuntoTreino.id == conjunto_id)
    )
    conjunto = result.scalar_one_or_none()
    if conjunto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conjunto não encontrado")

    await _get_aluno_vinculado(personal, conjunto.aluno_id, db)

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(conjunto, key, value)

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


@router.delete("/treinos/{treino_id}", status_code=204)
async def deletar_treino(
    treino_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Treino).where(Treino.id == treino_id))
    treino = result.scalar_one_or_none()
    if treino is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Treino não encontrado")

    result = await db.execute(
        select(ConjuntoTreino).where(ConjuntoTreino.id == treino.conjunto_treino_id)
    )
    conjunto = result.scalar_one_or_none()
    if conjunto is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conjunto não encontrado")

    await _get_aluno_vinculado(personal, conjunto.aluno_id, db)

    conjunto_id = treino.conjunto_treino_id
    await db.delete(treino)
    await db.flush()

    # Reordenar treinos restantes no conjunto e recodificar (A, B, C...)
    result = await db.execute(
        select(Treino)
        .where(Treino.conjunto_treino_id == conjunto_id)
        .order_by(Treino.ordem)
    )
    for idx, t in enumerate(result.scalars().all(), start=1):
        t.ordem = idx
        t.codigo = chr(64 + idx)

    await db.flush()


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
    result = await db.execute(
        select(ExercicioBase).where(ExercicioBase.id == body.exercicio_base_id)
    )
    exercicio_base = result.scalar_one_or_none()
    if exercicio_base is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício base não encontrado")

    exercicio = ExercicioTreino(
        treino_id=treino_id,
        exercicio_base_id=body.exercicio_base_id,
        ordem=body.ordem,
        numero_series_prescritas=body.numero_series_prescritas,
        prescricao=body.prescricao,
        repeticao_ou_tempo=body.repeticao_ou_tempo,
        rer_rm_valor=body.rer_rm_valor,
        descanso_segundos=body.descanso_segundos,
        tecnica=Tecnica(body.tecnica),
        observacoes=body.observacoes,
        observacoes_aluno=body.observacoes_aluno,
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
    if "exercicio_base_id" in update_data:
        result = await db.execute(
            select(ExercicioBase).where(ExercicioBase.id == update_data["exercicio_base_id"])
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício base não encontrado")
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
