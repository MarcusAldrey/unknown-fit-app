import uuid
from datetime import datetime

from sqlalchemy import Float, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RegistroPesoAluno(Base):
    __tablename__ = "registros_peso_aluno"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aluno_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("alunos.id"), nullable=False)
    peso: Mapped[float] = mapped_column(Float, nullable=False)
    registrado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    aluno: Mapped["Aluno"] = relationship(back_populates="registros_peso")


from app.models.aluno import Aluno  # noqa: E402
