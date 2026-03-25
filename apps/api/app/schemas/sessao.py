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

    model_config = {"from_attributes": True}
