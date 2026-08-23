import uuid

from sqlalchemy import String, Integer, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base
from app.domain.enums import Tecnica, AlvoTipo, RerRmTipo


class ExercicioTreino(Base):
    __tablename__ = "exercicios_treino"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    treino_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("treinos.id"))
    exercicio_base_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exercicios_base.id"))
    ordem: Mapped[int] = mapped_column(Integer)
    numero_series_prescritas: Mapped[int] = mapped_column(Integer, default=1)
    prescricao: Mapped[str | None] = mapped_column(Text, nullable=True)
    alvo_tipo: Mapped[AlvoTipo] = mapped_column(SAEnum(AlvoTipo), nullable=False)
    alvo_valor_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    alvo_valor_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    alvo_outros_texto: Mapped[str | None] = mapped_column(String(140), nullable=True)
    rer_rm_tipo: Mapped[RerRmTipo | None] = mapped_column(SAEnum(RerRmTipo), nullable=True)
    rer_rm_valor: Mapped[str | None] = mapped_column(String(50), nullable=True)
    descanso_segundos: Mapped[int | None] = mapped_column(Integer, nullable=True)
    descanso_segundos_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    descanso_segundos_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tecnica: Mapped[Tecnica] = mapped_column(SAEnum(Tecnica), default=Tecnica.PADRAO)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    observacoes_aluno: Mapped[str | None] = mapped_column(Text, nullable=True)

    treino: Mapped["Treino"] = relationship(back_populates="exercicios")
    exercicio_base: Mapped["ExercicioBase"] = relationship(back_populates="usos_em_treinos", lazy="joined")
    series_executadas: Mapped[list["SerieExecutada"]] = relationship(
        back_populates="exercicio_treino",
        foreign_keys="SerieExecutada.exercicio_treino_id",
    )
    series_executadas_como_substituto: Mapped[list["SerieExecutada"]] = relationship(
        back_populates="exercicio_treino_executado",
        foreign_keys="SerieExecutada.exercicio_treino_executado_id",
    )
    equivalentes: Mapped[list["ExercicioTreinoEquivalente"]] = relationship(
        back_populates="exercicio_treino",
        foreign_keys="ExercicioTreinoEquivalente.exercicio_treino_id",
        cascade="all, delete-orphan",
        order_by="ExercicioTreinoEquivalente.ordem",
    )
    equivalente_de: Mapped[list["ExercicioTreinoEquivalente"]] = relationship(
        back_populates="exercicio_equivalente_treino",
        foreign_keys="ExercicioTreinoEquivalente.exercicio_equivalente_treino_id",
    )

    @property
    def nome_exercicio(self) -> str:
        return self.exercicio_base.nome


from app.models.treino import Treino  # noqa: E402
from app.models.serie_executada import SerieExecutada  # noqa: E402
from app.models.exercicio_treino_equivalente import ExercicioTreinoEquivalente  # noqa: E402
