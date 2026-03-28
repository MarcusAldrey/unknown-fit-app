from datetime import datetime
import uuid

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RecursoTreino(Base):
    __tablename__ = "recursos_treino"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(120), unique=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_por_sistema: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    requisitos_exercicio: Mapped[list["ExercicioRequisitoRecurso"]] = relationship(
        back_populates="recurso_treino",
        cascade="all, delete-orphan",
    )
    disponibilidades_aluno: Mapped[list["AlunoRecursoDisponibilidade"]] = relationship(
        back_populates="recurso_treino",
        cascade="all, delete-orphan",
    )


class ExercicioRequisitoRecurso(Base):
    __tablename__ = "exercicio_requisitos_recurso"
    __table_args__ = (
        UniqueConstraint(
            "exercicio_base_id",
            "recurso_treino_id",
            name="uq_exercicio_requisito_recurso",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    exercicio_base_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exercicios_base.id"))
    recurso_treino_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("recursos_treino.id"))

    exercicio_base: Mapped["ExercicioBase"] = relationship(back_populates="requisitos_recurso_links")
    recurso_treino: Mapped[RecursoTreino] = relationship(back_populates="requisitos_exercicio")


class AlunoRecursoDisponibilidade(Base):
    __tablename__ = "aluno_recursos_disponibilidade"
    __table_args__ = (
        UniqueConstraint(
            "aluno_id",
            "recurso_treino_id",
            name="uq_aluno_recurso_disponibilidade",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aluno_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("alunos.id"))
    recurso_treino_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("recursos_treino.id"))
    disponivel_para_aluno: Mapped[bool] = mapped_column(Boolean, default=True)

    aluno: Mapped["Aluno"] = relationship(back_populates="recursos_disponibilidade")
    recurso_treino: Mapped[RecursoTreino] = relationship(back_populates="disponibilidades_aluno")


from app.models.aluno import Aluno  # noqa: E402
from app.models.exercicio_base import ExercicioBase  # noqa: E402