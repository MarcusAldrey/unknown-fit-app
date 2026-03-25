import enum
import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Role(str, enum.Enum):
    PERSONAL = "PERSONAL"
    ALUNO = "ALUNO"


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    senha_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(SAEnum(Role))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    personal: Mapped["Personal"] = relationship(back_populates="usuario", uselist=False)
    aluno: Mapped["Aluno"] = relationship(back_populates="usuario", uselist=False)


from app.models.personal import Personal  # noqa: E402
from app.models.aluno import Aluno  # noqa: E402
