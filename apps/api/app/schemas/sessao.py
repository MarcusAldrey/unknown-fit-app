import uuid
from datetime import datetime
from pydantic import BaseModel


class SessaoCreate(BaseModel):
    treino_id: uuid.UUID


class SessaoOut(BaseModel):
    id: uuid.UUID
    aluno_id: uuid.UUID
    treino_id: uuid.UUID
    iniciado_em: datetime
    finalizado_em: datetime | None = None
    status: str

    model_config = {"from_attributes": True}


class SessaoResumoOut(BaseModel):
    id: uuid.UUID
    treino_id: uuid.UUID
    treino_codigo: str
    treino_nome: str
    iniciado_em: datetime
    finalizado_em: datetime | None = None
    status: str

    @classmethod
    def from_model(cls, sessao, treino) -> "SessaoResumoOut":
        return cls(
            id=sessao.id,
            treino_id=sessao.treino_id,
            treino_codigo=treino.codigo,
            treino_nome=treino.nome,
            iniciado_em=sessao.iniciado_em,
            finalizado_em=sessao.finalizado_em,
            status=sessao.status.value,
        )


class SerieCreate(BaseModel):
    exercicio_treino_id: uuid.UUID
    exercicio_treino_executado_id: uuid.UUID | None = None
    numero_serie: int
    peso_utilizado: float | None = None
    repeticoes_realizadas: int | None = None
    concluida: bool = True


class SerieOut(BaseModel):
    id: uuid.UUID
    sessao_treino_id: uuid.UUID
    exercicio_treino_id: uuid.UUID
    exercicio_treino_executado_id: uuid.UUID | None = None
    numero_serie: int
    peso_utilizado: float | None = None
    repeticoes_realizadas: int | None = None
    concluida: bool
    concluida_em: datetime | None = None

    model_config = {"from_attributes": True}


class SerieDetalheOut(BaseModel):
    id: uuid.UUID
    exercicio_treino_id: uuid.UUID
    exercicio_treino_executado_id: uuid.UUID | None = None
    nome_exercicio: str
    nome_exercicio_executado: str | None = None
    numero_serie: int
    peso_utilizado: float | None = None
    repeticoes_realizadas: int | None = None
    concluida: bool
    concluida_em: datetime | None = None

    @classmethod
    def from_model(cls, serie, exercicio, exercicio_executado=None) -> "SerieDetalheOut":
        return cls(
            id=serie.id,
            exercicio_treino_id=serie.exercicio_treino_id,
            exercicio_treino_executado_id=serie.exercicio_treino_executado_id,
            nome_exercicio=exercicio.nome_exercicio,
            nome_exercicio_executado=(
                exercicio_executado.nome_exercicio if exercicio_executado is not None else None
            ),
            numero_serie=serie.numero_serie,
            peso_utilizado=serie.peso_utilizado,
            repeticoes_realizadas=serie.repeticoes_realizadas,
            concluida=serie.concluida,
            concluida_em=serie.concluida_em,
        )


class UltimoPesoExercicioOut(BaseModel):
    exercicio_treino_id: uuid.UUID
    peso_utilizado: float | None = None
    repeticoes_realizadas: int | None = None


class SessaoAtivaOut(BaseModel):
    id: uuid.UUID
    treino_id: uuid.UUID
    treino_codigo: str
    treino_nome: str
    iniciado_em: datetime
    status: str
    series: list[SerieOut] = []
