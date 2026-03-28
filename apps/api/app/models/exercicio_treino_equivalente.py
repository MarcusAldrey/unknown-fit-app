import uuid

from sqlalchemy import Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ExercicioTreinoEquivalente(Base):
    __tablename__ = "exercicios_treino_equivalentes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exercicio_treino_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exercicios_treino.id"))
    exercicio_equivalente_treino_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exercicios_treino.id"))
    ordem: Mapped[int] = mapped_column(Integer, default=1)

    exercicio_treino: Mapped["ExercicioTreino"] = relationship(
        back_populates="equivalentes",
        foreign_keys=[exercicio_treino_id],
    )
    exercicio_equivalente_treino: Mapped["ExercicioTreino"] = relationship(
        back_populates="equivalente_de",
        foreign_keys=[exercicio_equivalente_treino_id],
        lazy="joined",
    )

    @property
    def nome_exercicio(self) -> str:
        return self.exercicio_equivalente_treino.nome_exercicio


from app.models.exercicio_treino import ExercicioTreino  # noqa: E402
