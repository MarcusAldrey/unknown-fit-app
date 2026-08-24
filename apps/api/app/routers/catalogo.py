import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user, get_current_personal
from app.models import (
    ExercicioBase,
    ExercicioRequisitoRecurso,
    Personal,
    RecursoTreino,
    Usuario,
)
from app.schemas import (
    ExercicioBaseOut,
    ExercicioBaseUpdate,
    ExercicioRequisitosRecursoUpdate,
    RecursoTreinoCreate,
    RecursoTreinoOut,
    RecursoTreinoUpdate,
)
from app.services.disponibilidade import ensure_disponibilidade_rows

router = APIRouter()


async def _carregar_exercicio_base(db: AsyncSession, exercicio_id: uuid.UUID) -> ExercicioBase | None:
    result = await db.execute(
        select(ExercicioBase)
        .where(ExercicioBase.id == exercicio_id)
        .options(
            selectinload(ExercicioBase.requisitos_recurso_links).selectinload(
                ExercicioRequisitoRecurso.recurso_treino
            )
        )
    )
    return result.scalar_one_or_none()


@router.get("/exercicios-base", response_model=list[ExercicioBaseOut])
async def listar_exercicios_base(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExercicioBase)
        .where(ExercicioBase.ativo.is_(True))
        .options(
            selectinload(ExercicioBase.requisitos_recurso_links).selectinload(
                ExercicioRequisitoRecurso.recurso_treino
            )
        )
        .order_by(ExercicioBase.grupo_muscular, ExercicioBase.nome)
    )
    return result.scalars().all()


@router.patch("/exercicios-base/{exercicio_id}", response_model=ExercicioBaseOut)
async def editar_exercicio_base(
    exercicio_id: uuid.UUID,
    body: ExercicioBaseUpdate,
    _personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    exercicio = await _carregar_exercicio_base(db, exercicio_id)
    if exercicio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício não encontrado")

    update_data = body.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(exercicio, key, value)

    await db.flush()
    await db.refresh(exercicio)
    exercicio = await _carregar_exercicio_base(db, exercicio_id)
    return exercicio


@router.get("/recursos-treino", response_model=list[RecursoTreinoOut])
async def listar_recursos_treino(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(RecursoTreino)
        .where(RecursoTreino.ativo.is_(True))
        .order_by(RecursoTreino.nome)
    )
    return result.scalars().all()


@router.post("/recursos-treino", response_model=RecursoTreinoOut, status_code=201)
async def criar_recurso_treino(
    body: RecursoTreinoCreate,
    _personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    nome = body.nome.strip()
    if not nome:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome do recurso inválido")

    result = await db.execute(
        select(RecursoTreino).where(func.lower(RecursoTreino.nome) == nome.lower())
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Recurso já cadastrado")

    recurso = RecursoTreino(nome=nome, criado_por_sistema=False)
    db.add(recurso)
    await db.flush()

    await ensure_disponibilidade_rows(db)

    await db.flush()
    await db.refresh(recurso)
    return recurso


@router.patch("/recursos-treino/{recurso_id}", response_model=RecursoTreinoOut)
async def editar_recurso_treino(
    recurso_id: uuid.UUID,
    body: RecursoTreinoUpdate,
    _personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(RecursoTreino).where(RecursoTreino.id == recurso_id))
    recurso = result.scalar_one_or_none()
    if recurso is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recurso não encontrado")

    update_data = body.model_dump(exclude_unset=True)
    if "nome" in update_data and update_data["nome"]:
        novo_nome = update_data["nome"].strip()
        if not novo_nome:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome do recurso inválido")
        dup_result = await db.execute(
            select(RecursoTreino).where(
                func.lower(RecursoTreino.nome) == novo_nome.lower(),
                RecursoTreino.id != recurso.id,
            )
        )
        if dup_result.scalar_one_or_none() is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe recurso com este nome")
        update_data["nome"] = novo_nome

    for key, value in update_data.items():
        setattr(recurso, key, value)

    await db.flush()
    await db.refresh(recurso)
    return recurso


@router.put("/exercicios-base/{exercicio_id}/requisitos-recursos", response_model=ExercicioBaseOut)
async def atualizar_requisitos_recurso_exercicio_base(
    exercicio_id: uuid.UUID,
    body: ExercicioRequisitosRecursoUpdate,
    _personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    exercicio = await _carregar_exercicio_base(db, exercicio_id)
    if exercicio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício não encontrado")

    recurso_ids = list(dict.fromkeys(body.recurso_ids))
    if recurso_ids:
        existentes = (
            await db.execute(
                select(RecursoTreino.id).where(
                    RecursoTreino.id.in_(recurso_ids),
                    RecursoTreino.ativo.is_(True),
                )
            )
        ).scalars().all()
        if len(existentes) != len(recurso_ids):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Um ou mais recursos são inválidos ou estão inativos",
            )

    exercicio.requisitos_recurso_links.clear()
    for recurso_id in recurso_ids:
        exercicio.requisitos_recurso_links.append(
            ExercicioRequisitoRecurso(
                exercicio_base_id=exercicio.id,
                recurso_treino_id=recurso_id,
            )
        )

    await db.flush()
    await db.refresh(exercicio)
    exercicio = await _carregar_exercicio_base(db, exercicio_id)
    return exercicio
