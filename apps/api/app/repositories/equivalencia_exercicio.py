import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import ExercicioTreino, ExercicioTreinoEquivalente


class EquivalenciaExercicioRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def listar_ids_exercicios_treino(self, treino_id: uuid.UUID) -> list[uuid.UUID]:
        return (
            await self.db.execute(
                select(ExercicioTreino.id).where(ExercicioTreino.treino_id == treino_id)
            )
        ).scalars().all()

    async def listar_arestas_equivalencia(
        self,
        exercicios_ids: list[uuid.UUID],
    ) -> list[tuple[uuid.UUID, uuid.UUID]]:
        return (
            await self.db.execute(
                select(
                    ExercicioTreinoEquivalente.exercicio_treino_id,
                    ExercicioTreinoEquivalente.exercicio_equivalente_treino_id,
                ).where(
                    ExercicioTreinoEquivalente.exercicio_treino_id.in_(exercicios_ids),
                    ExercicioTreinoEquivalente.exercicio_equivalente_treino_id.in_(
                        exercicios_ids
                    ),
                )
            )
        ).all()

    async def listar_ids_exercicios_existentes_no_treino(
        self,
        treino_id: uuid.UUID,
        exercicios_ids: list[uuid.UUID],
    ) -> list[uuid.UUID]:
        if not exercicios_ids:
            return []
        return (
            await self.db.execute(
                select(ExercicioTreino.id).where(
                    ExercicioTreino.id.in_(exercicios_ids),
                    ExercicioTreino.treino_id == treino_id,
                )
            )
        ).scalars().all()

    async def listar_exercicios_ordenados(self, treino_id: uuid.UUID) -> list[ExercicioTreino]:
        return (
            await self.db.execute(
                select(ExercicioTreino)
                .where(ExercicioTreino.treino_id == treino_id)
                .order_by(ExercicioTreino.ordem)
            )
        ).scalars().all()

    async def listar_equivalencias_relacionadas(
        self,
        exercicios_ids: set[uuid.UUID],
    ) -> list[ExercicioTreinoEquivalente]:
        if not exercicios_ids:
            return []
        return (
            await self.db.execute(
                select(ExercicioTreinoEquivalente).where(
                    or_(
                        ExercicioTreinoEquivalente.exercicio_treino_id.in_(
                            exercicios_ids
                        ),
                        ExercicioTreinoEquivalente.exercicio_equivalente_treino_id.in_(
                            exercicios_ids
                        ),
                    )
                )
            )
        ).scalars().all()

    async def remover_equivalencias_relacionadas(
        self,
        exercicios_ids: set[uuid.UUID],
    ) -> None:
        equivalencias = await self.listar_equivalencias_relacionadas(exercicios_ids)
        for equivalencia in equivalencias:
            await self.db.delete(equivalencia)

    async def remover_equivalencias_do_exercicio(self, exercicio_id: uuid.UUID) -> None:
        await self.remover_equivalencias_relacionadas({exercicio_id})

    async def criar_bloco_equivalencias_completo(
        self,
        bloco_ids_ordenados: list[uuid.UUID],
    ) -> None:
        if len(bloco_ids_ordenados) <= 1:
            return
        for origem_id in bloco_ids_ordenados:
            ordem = 1
            for destino_id in bloco_ids_ordenados:
                if destino_id == origem_id:
                    continue
                self.db.add(
                    ExercicioTreinoEquivalente(
                        exercicio_treino_id=origem_id,
                        exercicio_equivalente_treino_id=destino_id,
                        ordem=ordem,
                    )
                )
                ordem += 1

    async def listar_equivalentes_do_exercicio(
        self,
        exercicio_id: uuid.UUID,
    ) -> list[ExercicioTreinoEquivalente]:
        return (
            await self.db.execute(
                select(ExercicioTreinoEquivalente)
                .where(ExercicioTreinoEquivalente.exercicio_treino_id == exercicio_id)
                .options(
                    selectinload(ExercicioTreinoEquivalente.exercicio_equivalente_treino)
                )
                .order_by(ExercicioTreinoEquivalente.ordem)
            )
        ).scalars().all()
