from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import ExercicioBase, Usuario
from app.schemas import ExercicioBaseOut

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
