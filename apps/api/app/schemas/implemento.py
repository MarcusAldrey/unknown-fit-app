import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ImplementoExecucaoCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=120)


class ImplementoExecucaoUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    ativo: bool | None = None


class ImplementoExecucaoOut(BaseModel):
    id: uuid.UUID
    nome: str
    ativo: bool
    criado_por_sistema: bool
    criado_em: datetime

    model_config = {"from_attributes": True}
