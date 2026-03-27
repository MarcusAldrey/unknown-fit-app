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


class SerieCreate(BaseModel):
    exercicio_treino_id: uuid.UUID
    numero_serie: int
    peso_utilizado: float | None = None
    repeticoes_realizadas: int | None = None
    concluida: bool = True


class SerieOut(BaseModel):
    id: uuid.UUID
    sessao_treino_id: uuid.UUID
    exercicio_treino_id: uuid.UUID
    numero_serie: int
    peso_utilizado: float | None = None
    repeticoes_realizadas: int | None = None
    concluida: bool
    concluida_em: datetime | None = None

    model_config = {"from_attributes": True}


class SerieDetalheOut(BaseModel):
    id: uuid.UUID
    exercicio_treino_id: uuid.UUID
    nome_exercicio: str
    numero_serie: int
    peso_utilizado: float | None = None
    repeticoes_realizadas: int | None = None
    concluida: bool
    concluida_em: datetime | None = None


class UltimoPesoExercicioOut(BaseModel):
    exercicio_treino_id: uuid.UUID
    peso_utilizado: float | None = None


class SessaoAtivaOut(BaseModel):
    id: uuid.UUID
    treino_id: uuid.UUID
    treino_codigo: str
    treino_nome: str
    iniciado_em: datetime
    status: str
    series: list[SerieOut] = []
