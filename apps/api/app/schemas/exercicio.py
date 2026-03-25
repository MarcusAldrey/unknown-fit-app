import uuid
from pydantic import BaseModel


class ExercicioTreinoCreate(BaseModel):
    nome_exercicio: str
    ordem: int
    prescricao: str | None = None
    repeticao_ou_tempo: str | None = None
    rer_rm_valor: str | None = None
    descanso_segundos: int | None = None
    tecnica: str = "PADRAO"
    observacoes: str | None = None


class ExercicioTreinoUpdate(BaseModel):
    nome_exercicio: str | None = None
    ordem: int | None = None
    prescricao: str | None = None
    repeticao_ou_tempo: str | None = None
    rer_rm_valor: str | None = None
    descanso_segundos: int | None = None
    tecnica: str | None = None
    observacoes: str | None = None


class ExercicioTreinoOut(BaseModel):
    id: uuid.UUID
    treino_id: uuid.UUID
    nome_exercicio: str
    ordem: int
    prescricao: str | None = None
    repeticao_ou_tempo: str | None = None
    rer_rm_valor: str | None = None
    descanso_segundos: int | None = None
    tecnica: str
    observacoes: str | None = None

    model_config = {"from_attributes": True}


class ExercicioBaseOut(BaseModel):
    id: uuid.UUID
    nome: str
    grupo_muscular: str
    equipamento: str | None = None

    model_config = {"from_attributes": True}
