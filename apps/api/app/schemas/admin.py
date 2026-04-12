import uuid

from pydantic import BaseModel, EmailStr, Field


class PersonalAdminCreateRequest(BaseModel):
    nome: str
    email: EmailStr
    senha: str = Field(min_length=6)


class PersonalAdminUpdateRequest(BaseModel):
    nome: str | None = None
    email: EmailStr | None = None
    senha: str | None = Field(default=None, min_length=6)
    ativo: bool | None = None


class PersonalAdminOut(BaseModel):
    personal_id: uuid.UUID
    usuario_id: uuid.UUID
    nome: str
    email: EmailStr
    ativo: bool
    role: str


class AlunoAdminCreateRequest(BaseModel):
    nome: str
    email: EmailStr
    senha: str = Field(min_length=6)
    idade: int | None = None
    peso: float | None = None
    altura: float | None = None
    treina_em_academia_condominio: bool = False
    personal_id: uuid.UUID | None = None


class AlunoAdminUpdateRequest(BaseModel):
    nome: str | None = None
    email: EmailStr | None = None
    senha: str | None = Field(default=None, min_length=6)
    ativo: bool | None = None
    idade: int | None = None
    peso: float | None = None
    altura: float | None = None
    treina_em_academia_condominio: bool | None = None
    personal_id: uuid.UUID | None = None


class AlunoAdminOut(BaseModel):
    aluno_id: uuid.UUID
    usuario_id: uuid.UUID
    nome: str
    email: EmailStr
    ativo: bool
    role: str
    idade: int | None = None
    peso: float | None = None
    altura: float | None = None
    treina_em_academia_condominio: bool = False
    personal_id: uuid.UUID | None = None
