import uuid
from pydantic import BaseModel, Field


class ExercicioTreinoCreate(BaseModel):
    exercicio_base_id: uuid.UUID
    ordem: int
    numero_series_prescritas: int = Field(ge=1)
    prescricao: str | None = None
    repeticao_ou_tempo: str | None = None
    rer_rm_valor: str | None = None
    descanso_segundos: int | None = None
    tecnica: str = "PADRAO"
    observacoes: str | None = None
    observacoes_aluno: str | None = None


class ExercicioTreinoUpdate(BaseModel):
    exercicio_base_id: uuid.UUID | None = None
    ordem: int | None = None
    numero_series_prescritas: int | None = Field(default=None, ge=1)
    prescricao: str | None = None
    repeticao_ou_tempo: str | None = None
    rer_rm_valor: str | None = None
    descanso_segundos: int | None = None
    tecnica: str | None = None
    observacoes: str | None = None
    observacoes_aluno: str | None = None


class ExercicioTreinoOut(BaseModel):
    id: uuid.UUID
    treino_id: uuid.UUID
    exercicio_base_id: uuid.UUID
    nome_exercicio: str
    ordem: int
    numero_series_prescritas: int
    prescricao: str | None = None
    repeticao_ou_tempo: str | None = None
    rer_rm_valor: str | None = None
    descanso_segundos: int | None = None
    tecnica: str
    observacoes: str | None = None
    observacoes_aluno: str | None = None

    model_config = {"from_attributes": True}


class ExercicioBaseOut(BaseModel):
    id: uuid.UUID
    nome: str
    grupo_muscular: str
    equipamento: str | None = None

    model_config = {"from_attributes": True}


class ExercicioBaseUpdate(BaseModel):
    nome: str | None = None
    grupo_muscular: str | None = None
    equipamento: str | None = None


class ExercicioObservacaoAlunoUpdate(BaseModel):
    observacoes_aluno: str | None = None
