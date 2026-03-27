import uuid

from sqlalchemy import String, Float, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class Aluno(Base):
    __tablename__ = "alunos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("usuarios.id"), unique=True)
    idade: Mapped[int | None] = mapped_column(Integer, nullable=True)
    peso: Mapped[float | None] = mapped_column(Float, nullable=True)
    altura: Mapped[float | None] = mapped_column(Float, nullable=True)

    usuario: Mapped["Usuario"] = relationship(back_populates="aluno")
    vinculos: Mapped[list["VinculoPersonalAluno"]] = relationship(back_populates="aluno")
    conjuntos_treino: Mapped[list["ConjuntoTreino"]] = relationship(back_populates="aluno")
    sessoes: Mapped[list["SessaoTreino"]] = relationship(back_populates="aluno")
    registros_peso: Mapped[list["RegistroPesoAluno"]] = relationship(back_populates="aluno")


from app.models.usuario import Usuario  # noqa: E402
from app.models.vinculo import VinculoPersonalAluno  # noqa: E402
from app.models.conjunto_treino import ConjuntoTreino  # noqa: E402
from app.models.sessao_treino import SessaoTreino  # noqa: E402
from app.models.peso_registro import RegistroPesoAluno  # noqa: E402
