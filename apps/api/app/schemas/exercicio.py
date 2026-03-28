import enum
import uuid
from pydantic import BaseModel, Field, model_validator

from app.schemas.recurso import RecursoTreinoOut


class AlvoTipo(str, enum.Enum):
    SEGUNDOS = "SEGUNDOS"
    REPETICOES = "REPETICOES"
    PASSOS = "PASSOS"
    OUTROS = "OUTROS"


class RerRmTipo(str, enum.Enum):
    RER = "RER"
    RM = "RM"


class ExercicioTreinoCreate(BaseModel):
    exercicio_base_id: uuid.UUID
    ordem: int
    numero_series_prescritas: int = Field(ge=1)
    prescricao: str | None = None
    alvo_tipo: AlvoTipo
    alvo_valor_min: int | None = Field(default=None, ge=1)
    alvo_valor_max: int | None = Field(default=None, ge=1)
    alvo_outros_texto: str | None = None
    rer_rm_tipo: RerRmTipo | None = None
    rer_rm_valor: str | None = None
    descanso_segundos: int | None = None
    tecnica: str = "PADRAO"
    observacoes: str | None = None
    observacoes_aluno: str | None = None

    @model_validator(mode="after")
    def validar_consistencia_alvo_rer_rm(self):
        if self.alvo_tipo == AlvoTipo.OUTROS:
            texto = (self.alvo_outros_texto or "").strip()
            if not texto:
                raise ValueError("alvo_outros_texto é obrigatório quando alvo_tipo = OUTROS")
            self.alvo_outros_texto = texto
            self.alvo_valor_min = None
            self.alvo_valor_max = None
        else:
            if self.alvo_valor_min is None or self.alvo_valor_max is None:
                raise ValueError("alvo_valor_min e alvo_valor_max são obrigatórios")
            if self.alvo_valor_min > self.alvo_valor_max:
                raise ValueError("alvo_valor_min não pode ser maior que alvo_valor_max")
            self.alvo_outros_texto = None

        if self.rer_rm_tipo is None:
            self.rer_rm_valor = None
        else:
            valor_rer_rm = (self.rer_rm_valor or "").strip()
            if not valor_rer_rm:
                raise ValueError("rer_rm_valor é obrigatório quando rer_rm_tipo é informado")
            self.rer_rm_valor = valor_rer_rm

        if self.prescricao is not None:
            self.prescricao = self.prescricao.strip() or None
        if self.observacoes is not None:
            self.observacoes = self.observacoes.strip() or None
        if self.observacoes_aluno is not None:
            self.observacoes_aluno = self.observacoes_aluno.strip() or None

        return self


class ExercicioTreinoUpdate(BaseModel):
    exercicio_base_id: uuid.UUID | None = None
    ordem: int | None = None
    numero_series_prescritas: int | None = Field(default=None, ge=1)
    prescricao: str | None = None
    alvo_tipo: AlvoTipo | None = None
    alvo_valor_min: int | None = Field(default=None, ge=1)
    alvo_valor_max: int | None = Field(default=None, ge=1)
    alvo_outros_texto: str | None = None
    rer_rm_tipo: RerRmTipo | None = None
    rer_rm_valor: str | None = None
    descanso_segundos: int | None = None
    tecnica: str | None = None
    observacoes: str | None = None
    observacoes_aluno: str | None = None


class ExercicioTreinoEquivalentesUpdate(BaseModel):
    exercicios_equivalentes_ids: list[uuid.UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def validar_duplicidade(self):
        if len(set(self.exercicios_equivalentes_ids)) != len(self.exercicios_equivalentes_ids):
            raise ValueError("Não é permitido repetir exercícios equivalentes")
        return self


class ExercicioTreinoEquivalenteOut(BaseModel):
    id: uuid.UUID
    exercicio_treino_id: uuid.UUID
    exercicio_equivalente_treino_id: uuid.UUID
    nome_exercicio: str
    ordem: int

    model_config = {"from_attributes": True}


class ExercicioTreinoOut(BaseModel):
    id: uuid.UUID
    treino_id: uuid.UUID
    exercicio_base_id: uuid.UUID
    nome_exercicio: str
    ordem: int
    numero_series_prescritas: int
    prescricao: str | None = None
    alvo_tipo: AlvoTipo
    alvo_valor_min: int | None = None
    alvo_valor_max: int | None = None
    alvo_outros_texto: str | None = None
    rer_rm_tipo: RerRmTipo | None = None
    rer_rm_valor: str | None = None
    descanso_segundos: int | None = None
    tecnica: str
    observacoes: str | None = None
    observacoes_aluno: str | None = None
    equivalentes: list[ExercicioTreinoEquivalenteOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class ExercicioBaseOut(BaseModel):
    id: uuid.UUID
    nome: str
    grupo_muscular: str
    implemento_execucao: str
    pode_ser_feito_em_casa: bool
    requisitos_alternativos_recurso: list[RecursoTreinoOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class ExercicioBaseUpdate(BaseModel):
    nome: str | None = None
    grupo_muscular: str | None = None
    implemento_execucao: str | None = None
    pode_ser_feito_em_casa: bool | None = None


class ExercicioObservacaoAlunoUpdate(BaseModel):
    observacoes_aluno: str | None = None
