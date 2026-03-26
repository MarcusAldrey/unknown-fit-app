import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_current_personal
from app.models import ExercicioBase, Usuario, Personal
from app.schemas import ExercicioBaseOut, ExercicioBaseUpdate

router = APIRouter()


@router.get("/exercicios-base", response_model=list[ExercicioBaseOut])
async def listar_exercicios_base(
    _user: Usuario = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ExercicioBase)
        .where(ExercicioBase.ativo == True)  # noqa: E712
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
    result = await db.execute(
        select(ExercicioBase).where(ExercicioBase.id == exercicio_id)
    )
    exercicio = result.scalar_one_or_none()
    if exercicio is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exercício não encontrado")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(exercicio, key, value)

    await db.flush()
    await db.refresh(exercicio)
    return exercicio
