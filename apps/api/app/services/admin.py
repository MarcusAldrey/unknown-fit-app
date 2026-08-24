import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import ConflictError, NotFoundError
from app.models import Aluno, Personal, Role, Usuario, VinculoPersonalAluno
from app.services.auth import hash_senha


async def _usuario_existente(db: AsyncSession, email: str) -> Usuario | None:
    result = await db.execute(select(Usuario).where(Usuario.email == email))
    return result.scalar_one_or_none()


async def criar_personal(db: AsyncSession, body) -> Personal:
    if await _usuario_existente(db, body.email) is not None:
        raise ConflictError("Email já cadastrado")

    usuario = Usuario(
        id=uuid.uuid4(),
        nome=body.nome,
        email=body.email,
        senha_hash=hash_senha(body.senha),
        role=Role.PERSONAL,
        ativo=True,
    )
    db.add(usuario)
    await db.flush()

    personal = Personal(id=uuid.uuid4(), usuario_id=usuario.id)
    db.add(personal)
    await db.flush()

    personal.usuario = usuario
    return personal


async def criar_aluno(db: AsyncSession, body) -> Aluno:
    if await _usuario_existente(db, body.email) is not None:
        raise ConflictError("Email já cadastrado")

    usuario = Usuario(
        id=uuid.uuid4(),
        nome=body.nome,
        email=body.email,
        senha_hash=hash_senha(body.senha),
        role=Role.ALUNO,
        ativo=True,
    )
    db.add(usuario)
    await db.flush()

    aluno = Aluno(
        id=uuid.uuid4(),
        usuario_id=usuario.id,
        idade=body.idade,
        peso=body.peso,
        altura=body.altura,
        treina_em_academia_condominio=body.treina_em_academia_condominio,
    )
    db.add(aluno)
    await db.flush()

    await definir_vinculo_ativo_unico(db, aluno.id, body.personal_id)
    await db.flush()

    aluno.usuario = usuario
    return aluno


async def definir_vinculo_ativo_unico(
    db: AsyncSession,
    aluno_id: uuid.UUID,
    personal_id: uuid.UUID | None,
) -> None:
    result = await db.execute(
        select(VinculoPersonalAluno).where(
            VinculoPersonalAluno.aluno_id == aluno_id,
            VinculoPersonalAluno.ativo.is_(True),
        )
    )
    for vinculo in result.scalars().all():
        vinculo.ativo = False
        vinculo.fim_em = datetime.now(timezone.utc)

    await db.flush()

    if personal_id is None:
        return

    personal = (
        await db.execute(select(Personal).where(Personal.id == personal_id))
    ).scalar_one_or_none()
    if personal is None:
        raise NotFoundError("Personal não encontrado")

    db.add(
        VinculoPersonalAluno(
            id=uuid.uuid4(),
            aluno_id=aluno_id,
            personal_id=personal_id,
            ativo=True,
        )
    )
