import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class RecursoTreinoCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=120)


class RecursoTreinoUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=120)
    ativo: bool | None = None


class RecursoTreinoOut(BaseModel):
    id: uuid.UUID
    nome: str
    ativo: bool
    criado_por_sistema: bool
    criado_em: datetime

    model_config = {"from_attributes": True}


class ExercicioRequisitosRecursoUpdate(BaseModel):
    recurso_ids: list[uuid.UUID]


class AlunoRecursoDisponibilidadeUpdate(BaseModel):
    disponivel_para_aluno: bool


class AlunoRecursosDisponibilidadeBatchUpdate(BaseModel):
    disponivel_para_aluno: bool


class AlunoRecursoDisponibilidadeOut(BaseModel):
    recurso_treino_id: uuid.UUID
    nome_recurso: str
    disponivel_para_aluno: bool