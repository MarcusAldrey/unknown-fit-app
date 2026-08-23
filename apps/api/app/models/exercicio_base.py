import uuid

from sqlalchemy import String, Boolean, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base
from app.domain.enums import ImplementoExecucao


class ExercicioBase(Base):
    __tablename__ = "exercicios_base"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nome: Mapped[str] = mapped_column(String(255))
    grupo_muscular: Mapped[str] = mapped_column(String(100))
    implemento_execucao: Mapped[ImplementoExecucao] = mapped_column(
        SAEnum(ImplementoExecucao, name="implementoexecucao"),
        default=ImplementoExecucao.OUTRO,
    )
    pode_ser_feito_em_casa: Mapped[bool] = mapped_column(Boolean, default=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True)
    criado_por_sistema: Mapped[bool] = mapped_column(Boolean, default=True)
    usos_em_treinos: Mapped[list["ExercicioTreino"]] = relationship(back_populates="exercicio_base")
    requisitos_recurso_links: Mapped[list["ExercicioRequisitoRecurso"]] = relationship(
        back_populates="exercicio_base",
        cascade="all, delete-orphan",
    )

    @property
    def requisitos_alternativos_recurso(self) -> list["RecursoTreino"]:
        return [link.recurso_treino for link in self.requisitos_recurso_links]


from app.models.recurso_treino import ExercicioRequisitoRecurso, RecursoTreino  # noqa: E402
