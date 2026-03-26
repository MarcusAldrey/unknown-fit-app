import uuid

from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class ExercicioBase(Base):
    __tablename__ = "exercicios_base"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(255))
    grupo_muscular: Mapped[str] = mapped_column(String(100))
    equipamento: Mapped[str | None] = mapped_column(String(100), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_por_sistema: Mapped[bool] = mapped_column(Boolean, default=True)
    usos_em_treinos: Mapped[list["ExercicioTreino"]] = relationship(back_populates="exercicio_base")
