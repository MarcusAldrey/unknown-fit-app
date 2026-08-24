import uuid
from datetime import date

from sqlalchemy import String, Boolean, ForeignKey, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class ConjuntoTreino(Base):
    __tablename__ = "conjuntos_treino"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aluno_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("alunos.id", ondelete="CASCADE")
    )
    nome: Mapped[str] = mapped_column(String(255))
    ativo: Mapped[bool] = mapped_column(Boolean, default=False)
    data_inicio: Mapped[date | None] = mapped_column(Date, nullable=True)
    data_fim: Mapped[date | None] = mapped_column(Date, nullable=True)

    aluno: Mapped["Aluno"] = relationship(back_populates="conjuntos_treino")
    treinos: Mapped[list["Treino"]] = relationship(back_populates="conjunto", cascade="all, delete-orphan")


from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.aluno import Aluno
    from app.models.treino import Treino
