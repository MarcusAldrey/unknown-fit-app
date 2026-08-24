import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class VinculoPersonalAluno(Base):
    __tablename__ = "vinculos_personal_aluno"
    __table_args__ = (
        Index(
            "uq_aluno_vinculo_ativo",
            "aluno_id",
            unique=True,
            postgresql_where=text("ativo"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aluno_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("alunos.id", ondelete="CASCADE")
    )
    personal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("personais.id"))
    inicio_em: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    fim_em: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)

    aluno: Mapped["Aluno"] = relationship(back_populates="vinculos")
    personal: Mapped["Personal"] = relationship(back_populates="vinculos")


from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.aluno import Aluno
    from app.models.personal import Personal
