import uuid
from datetime import date
from pydantic import BaseModel


class ConjuntoTreinoCreate(BaseModel):
    nome: str
    data_inicio: date | None = None
    data_fim: date | None = None


class ConjuntoTreinoOut(BaseModel):
    id: uuid.UUID
    aluno_id: uuid.UUID
    nome: str
    ativo: bool
    data_inicio: date | None = None
    data_fim: date | None = None

    model_config = {"from_attributes": True}
