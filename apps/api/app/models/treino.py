import uuid

from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Treino(Base):
    __tablename__ = "treinos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    conjunto_treino_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("conjuntos_treino.id"))
    codigo: Mapped[str] = mapped_column(String(10))
    nome: Mapped[str] = mapped_column(String(255))
    ordem: Mapped[int] = mapped_column(Integer)

    conjunto: Mapped["ConjuntoTreino"] = relationship(back_populates="treinos")
    exercicios: Mapped[list["ExercicioTreino"]] = relationship(back_populates="treino", cascade="all, delete-orphan")
    sessoes: Mapped[list["SessaoTreino"]] = relationship(back_populates="treino")


from app.models.conjunto_treino import ConjuntoTreino  # noqa: E402
from app.models.exercicio_treino import ExercicioTreino  # noqa: E402
from app.models.sessao_treino import SessaoTreino  # noqa: E402
