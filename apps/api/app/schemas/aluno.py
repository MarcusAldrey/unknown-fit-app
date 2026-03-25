import uuid
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
