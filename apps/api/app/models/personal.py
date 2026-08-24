import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Personal(Base):
    __tablename__ = "personais"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id"), unique=True)

    usuario: Mapped["Usuario"] = relationship(back_populates="personal")
    vinculos: Mapped[list["VinculoPersonalAluno"]] = relationship(back_populates="personal")


from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.usuario import Usuario
    from app.models.vinculo import VinculoPersonalAluno
