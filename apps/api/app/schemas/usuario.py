import uuid
from pydantic import BaseModel, EmailStr


class UsuarioBase(BaseModel):
    nome: str
    email: EmailStr
    role: str


class UsuarioOut(UsuarioBase):
    id: uuid.UUID
    ativo: bool

    model_config = {"from_attributes": True}
