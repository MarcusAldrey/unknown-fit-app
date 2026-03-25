import uuid

from sqlalchemy import Integer, Float, Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base


class SerieExecutada(Base):
    __tablename__ = "series_executadas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sessao_treino_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sessoes_treino.id"))
    exercicio_treino_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exercicios_treino.id"))
    numero_serie: Mapped[int] = mapped_column(Integer)
    peso_utilizado: Mapped[float | None] = mapped_column(Float, nullable=True)
    repeticoes_realizadas: Mapped[int | None] = mapped_column(Integer, nullable=True)
    concluida: Mapped[bool] = mapped_column(Boolean, default=False)

    sessao: Mapped["SessaoTreino"] = relationship(back_populates="series")
    exercicio_treino: Mapped["ExercicioTreino"] = relationship(back_populates="series_executadas")


from app.models.sessao_treino import SessaoTreino  # noqa: E402
from app.models.exercicio_treino import ExercicioTreino  # noqa: E402
