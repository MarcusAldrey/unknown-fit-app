import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class StatusSessao(str, enum.Enum):
    EM_ANDAMENTO = "EM_ANDAMENTO"
    FINALIZADO = "FINALIZADO"


class SessaoTreino(Base):
    __tablename__ = "sessoes_treino"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aluno_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("alunos.id"))
    treino_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("treinos.id"))
    iniciado_em: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    finalizado_em: Mapped[datetime | None] = mapped_column(nullable=True)
    status: Mapped[StatusSessao] = mapped_column(SAEnum(StatusSessao), default=StatusSessao.EM_ANDAMENTO)

    aluno: Mapped["Aluno"] = relationship(back_populates="sessoes")
    treino: Mapped["Treino"] = relationship(back_populates="sessoes")
    series: Mapped[list["SerieExecutada"]] = relationship(back_populates="sessao", cascade="all, delete-orphan")


from app.models.aluno import Aluno  # noqa: E402
from app.models.treino import Treino  # noqa: E402
from app.models.serie_executada import SerieExecutada  # noqa: E402
