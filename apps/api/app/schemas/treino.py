import uuid
from pydantic import BaseModel


class TreinoCreate(BaseModel):
    codigo: str
    nome: str
    ordem: int


class TreinoUpdate(BaseModel):
    codigo: str | None = None
    nome: str | None = None
    ordem: int | None = None


class TreinoOut(BaseModel):
    id: uuid.UUID
    conjunto_treino_id: uuid.UUID
    codigo: str
    nome: str
    ordem: int

    model_config = {"from_attributes": True}
