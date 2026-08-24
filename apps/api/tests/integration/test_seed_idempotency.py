from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

import app.seed as seed_module
from app.models import ConjuntoTreino, ExercicioBase, Usuario


async def _row_counts(sessionmaker) -> tuple[int, int, int]:
    async with sessionmaker() as session:
        usuarios = (
            await session.execute(select(func.count()).select_from(Usuario))
        ).scalar_one()
        exercicios = (
            await session.execute(select(func.count()).select_from(ExercicioBase))
        ).scalar_one()
        conjuntos = (
            await session.execute(select(func.count()).select_from(ConjuntoTreino))
        ).scalar_one()
    return usuarios, exercicios, conjuntos


async def test_seed_eh_idempotente(test_engine, apply_migrations):
    sessionmaker = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    seed_module.engine = test_engine
    seed_module.async_session = sessionmaker

    antes = await _row_counts(sessionmaker)

    await seed_module.seed()

    depois = await _row_counts(sessionmaker)

    assert antes == depois
