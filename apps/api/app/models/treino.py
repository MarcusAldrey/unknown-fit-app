import uuid

from sqlalchemy import String, Integer, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Treino(Base):
    __tablename__ = "treinos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conjunto_treino_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conjuntos_treino.id", ondelete="CASCADE")
    )
    codigo: Mapped[str] = mapped_column(String(10))
    nome: Mapped[str] = mapped_column(String(255))
    observacoes_aluno: Mapped[str | None] = mapped_column(Text, nullable=True)
    ordem: Mapped[int] = mapped_column(Integer)

    conjunto: Mapped["ConjuntoTreino"] = relationship(back_populates="treinos")
    exercicios: Mapped[list["ExercicioTreino"]] = relationship(back_populates="treino", cascade="all, delete-orphan")
    sessoes: Mapped[list["SessaoTreino"]] = relationship(back_populates="treino")


from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.conjunto_treino import ConjuntoTreino
    from app.models.exercicio_treino import ExercicioTreino
    from app.models.sessao_treino import SessaoTreino
