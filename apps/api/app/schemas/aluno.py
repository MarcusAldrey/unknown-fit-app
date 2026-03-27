import uuid
from datetime import datetime
from pydantic import BaseModel


class AlunoFicha(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    idade: int | None = None
    peso: float | None = None
    altura: float | None = None

    model_config = {"from_attributes": True}


class AlunoResumo(BaseModel):
    id: uuid.UUID
    nome: str
    email: str

    model_config = {"from_attributes": True}


class RegistroPesoCreate(BaseModel):
    peso: float


class RegistroPesoOut(BaseModel):
    id: uuid.UUID
    aluno_id: uuid.UUID
    peso: float
    registrado_em: datetime

    model_config = {"from_attributes": True}
