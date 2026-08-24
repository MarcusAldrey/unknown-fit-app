import uuid

from sqlalchemy import Float, Integer, ForeignKey, Boolean
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
    treina_em_academia_condominio: Mapped[bool] = mapped_column(Boolean, default=False)

    usuario: Mapped["Usuario"] = relationship(back_populates="aluno")
    vinculos: Mapped[list["VinculoPersonalAluno"]] = relationship(
        back_populates="aluno", passive_deletes=True
    )
    conjuntos_treino: Mapped[list["ConjuntoTreino"]] = relationship(
        back_populates="aluno", passive_deletes=True
    )
    sessoes: Mapped[list["SessaoTreino"]] = relationship(
        back_populates="aluno", passive_deletes=True
    )
    registros_peso: Mapped[list["RegistroPesoAluno"]] = relationship(
        back_populates="aluno", passive_deletes=True
    )
    recursos_disponibilidade: Mapped[list["AlunoRecursoDisponibilidade"]] = relationship(
        back_populates="aluno",
        cascade="all, delete-orphan",
    )


from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.models.usuario import Usuario
    from app.models.vinculo import VinculoPersonalAluno
    from app.models.conjunto_treino import ConjuntoTreino
    from app.models.sessao_treino import SessaoTreino
    from app.models.peso_registro import RegistroPesoAluno
    from app.models.recurso_treino import AlunoRecursoDisponibilidade
