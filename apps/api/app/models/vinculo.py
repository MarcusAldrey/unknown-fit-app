import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class VinculoPersonalAluno(Base):
    __tablename__ = "vinculos_personal_aluno"
    __table_args__ = (
        UniqueConstraint("aluno_id", "ativo", name="uq_aluno_vinculo_ativo"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aluno_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("alunos.id"))
    personal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("personais.id"))
    inicio_em: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    fim_em: Mapped[datetime | None] = mapped_column(nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)

    aluno: Mapped["Aluno"] = relationship(back_populates="vinculos")
    personal: Mapped["Personal"] = relationship(back_populates="vinculos")


from app.models.aluno import Aluno  # noqa: E402
from app.models.personal import Personal  # noqa: E402
