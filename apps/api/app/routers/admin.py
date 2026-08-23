import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import require_admin_api_key
from app.models import (
    Usuario,
    Role,
    Personal,
    Aluno,
    VinculoPersonalAluno,
    ConjuntoTreino,
    Treino,
    ExercicioTreino,
    ExercicioTreinoEquivalente,
    SessaoTreino,
    SerieExecutada,
    RegistroPesoAluno,
    AlunoRecursoDisponibilidade,
)
from app.schemas.admin import (
    PersonalAdminCreateRequest,
    PersonalAdminUpdateRequest,
    PersonalAdminOut,
    AlunoAdminCreateRequest,
    AlunoAdminUpdateRequest,
    AlunoAdminOut,
)
from app.services.auth import hash_senha

router = APIRouter(dependencies=[Depends(require_admin_api_key)])


def _personal_admin_out(personal: Personal) -> PersonalAdminOut:
    return PersonalAdminOut(
        personal_id=personal.id,
        usuario_id=personal.usuario.id,
        nome=personal.usuario.nome,
        email=personal.usuario.email,
        ativo=personal.usuario.ativo,
        role=personal.usuario.role.value,
    )


def _aluno_personal_ativo_id(aluno: Aluno) -> uuid.UUID | None:
    for vinculo in aluno.vinculos:
        if vinculo.ativo:
            return vinculo.personal_id
    return None


def _aluno_admin_out(aluno: Aluno) -> AlunoAdminOut:
    return AlunoAdminOut(
        aluno_id=aluno.id,
        usuario_id=aluno.usuario.id,
        nome=aluno.usuario.nome,
        email=aluno.usuario.email,
        ativo=aluno.usuario.ativo,
        role=aluno.usuario.role.value,
        idade=aluno.idade,
        peso=aluno.peso,
        altura=aluno.altura,
        treina_em_academia_condominio=aluno.treina_em_academia_condominio,
        personal_id=_aluno_personal_ativo_id(aluno),
    )


async def _buscar_usuario_por_email(db: AsyncSession, email: str) -> Usuario | None:
    result = await db.execute(select(Usuario).where(Usuario.email == email))
    return result.scalar_one_or_none()


async def _buscar_personal_por_id(db: AsyncSession, personal_id: uuid.UUID) -> Personal | None:
    result = await db.execute(
        select(Personal)
        .where(Personal.id == personal_id)
        .options(selectinload(Personal.usuario))
    )
    return result.scalar_one_or_none()


async def _buscar_aluno_por_id(db: AsyncSession, aluno_id: uuid.UUID) -> Aluno | None:
    result = await db.execute(
        select(Aluno)
        .where(Aluno.id == aluno_id)
        .options(selectinload(Aluno.usuario), selectinload(Aluno.vinculos))
    )
    return result.scalar_one_or_none()


async def _definir_vinculo_ativo_unico(
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
        vinculo.fim_em = datetime.utcnow()

    await db.flush()

    if personal_id is None:
        return

    personal = await _buscar_personal_por_id(db, personal_id)
    if personal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal não encontrado")

    db.add(
        VinculoPersonalAluno(
            id=uuid.uuid4(),
            aluno_id=aluno_id,
            personal_id=personal_id,
            ativo=True,
        )
    )


async def _hard_delete_aluno_dependencias(db: AsyncSession, aluno_id: uuid.UUID) -> None:
    await db.execute(
        delete(VinculoPersonalAluno).where(VinculoPersonalAluno.aluno_id == aluno_id)
    )
    await db.execute(
        delete(AlunoRecursoDisponibilidade).where(AlunoRecursoDisponibilidade.aluno_id == aluno_id)
    )
    await db.execute(
        delete(RegistroPesoAluno).where(RegistroPesoAluno.aluno_id == aluno_id)
    )

    sessoes_ids = (
        await db.execute(
            select(SessaoTreino.id).where(SessaoTreino.aluno_id == aluno_id)
        )
    ).scalars().all()

    conjuntos_ids = (
        await db.execute(
            select(ConjuntoTreino.id).where(ConjuntoTreino.aluno_id == aluno_id)
        )
    ).scalars().all()

    treinos_ids: list[uuid.UUID] = []
    exercicios_ids: list[uuid.UUID] = []

    if conjuntos_ids:
        treinos_ids = (
            await db.execute(
                select(Treino.id).where(Treino.conjunto_treino_id.in_(conjuntos_ids))
            )
        ).scalars().all()

    if treinos_ids:
        exercicios_ids = (
            await db.execute(
                select(ExercicioTreino.id).where(ExercicioTreino.treino_id.in_(treinos_ids))
            )
        ).scalars().all()

    condicoes_series = []
    if sessoes_ids:
        condicoes_series.append(SerieExecutada.sessao_treino_id.in_(sessoes_ids))
    if exercicios_ids:
        condicoes_series.append(SerieExecutada.exercicio_treino_id.in_(exercicios_ids))
        condicoes_series.append(SerieExecutada.exercicio_treino_executado_id.in_(exercicios_ids))

    if condicoes_series:
        await db.execute(delete(SerieExecutada).where(or_(*condicoes_series)))

    if exercicios_ids:
        await db.execute(
            delete(ExercicioTreinoEquivalente).where(
                or_(
                    ExercicioTreinoEquivalente.exercicio_treino_id.in_(exercicios_ids),
                    ExercicioTreinoEquivalente.exercicio_equivalente_treino_id.in_(exercicios_ids),
                )
            )
        )

    if sessoes_ids:
        await db.execute(delete(SessaoTreino).where(SessaoTreino.id.in_(sessoes_ids)))

    if exercicios_ids:
        await db.execute(delete(ExercicioTreino).where(ExercicioTreino.id.in_(exercicios_ids)))

    if treinos_ids:
        await db.execute(delete(Treino).where(Treino.id.in_(treinos_ids)))

    if conjuntos_ids:
        await db.execute(delete(ConjuntoTreino).where(ConjuntoTreino.id.in_(conjuntos_ids)))


@router.get("/personais", response_model=list[PersonalAdminOut])
async def listar_personais(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Personal).options(selectinload(Personal.usuario)))
    personais = result.scalars().all()
    personais.sort(key=lambda p: p.usuario.nome.lower())
    return [_personal_admin_out(personal) for personal in personais]


@router.post("/personais", response_model=PersonalAdminOut, status_code=status.HTTP_201_CREATED)
async def criar_personal(
    body: PersonalAdminCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    usuario_existente = await _buscar_usuario_por_email(db, body.email)
    if usuario_existente is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado")

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
    return _personal_admin_out(personal)


@router.patch("/personais/{personal_id}", response_model=PersonalAdminOut)
async def atualizar_personal(
    personal_id: uuid.UUID,
    body: PersonalAdminUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    personal = await _buscar_personal_por_id(db, personal_id)
    if personal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal não encontrado")

    usuario = personal.usuario

    if body.email is not None and body.email != usuario.email:
        usuario_existente = await _buscar_usuario_por_email(db, body.email)
        if usuario_existente is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado")
        usuario.email = body.email

    if body.nome is not None:
        usuario.nome = body.nome

    if body.senha is not None:
        usuario.senha_hash = hash_senha(body.senha)

    if body.ativo is not None:
        usuario.ativo = body.ativo

    await db.flush()
    return _personal_admin_out(personal)


@router.delete("/personais/{personal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_personal(
    personal_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    personal = await _buscar_personal_por_id(db, personal_id)
    if personal is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Personal não encontrado")

    usuario = personal.usuario
    await db.execute(
        delete(VinculoPersonalAluno).where(VinculoPersonalAluno.personal_id == personal.id)
    )
    await db.delete(personal)
    await db.delete(usuario)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/alunos", response_model=list[AlunoAdminOut])
async def listar_alunos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Aluno).options(selectinload(Aluno.usuario), selectinload(Aluno.vinculos))
    )
    alunos = result.scalars().all()
    alunos.sort(key=lambda a: a.usuario.nome.lower())
    return [_aluno_admin_out(aluno) for aluno in alunos]


@router.post("/alunos", response_model=AlunoAdminOut, status_code=status.HTTP_201_CREATED)
async def criar_aluno(
    body: AlunoAdminCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    usuario_existente = await _buscar_usuario_por_email(db, body.email)
    if usuario_existente is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado")

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

    await _definir_vinculo_ativo_unico(db, aluno.id, body.personal_id)
    await db.flush()

    return AlunoAdminOut(
        aluno_id=aluno.id,
        usuario_id=usuario.id,
        nome=usuario.nome,
        email=usuario.email,
        ativo=usuario.ativo,
        role=usuario.role.value,
        idade=aluno.idade,
        peso=aluno.peso,
        altura=aluno.altura,
        treina_em_academia_condominio=aluno.treina_em_academia_condominio,
        personal_id=body.personal_id,
    )


@router.patch("/alunos/{aluno_id}", response_model=AlunoAdminOut)
async def atualizar_aluno(
    aluno_id: uuid.UUID,
    body: AlunoAdminUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    aluno = await _buscar_aluno_por_id(db, aluno_id)
    if aluno is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado")

    usuario = aluno.usuario

    if body.email is not None and body.email != usuario.email:
        usuario_existente = await _buscar_usuario_por_email(db, body.email)
        if usuario_existente is not None and usuario_existente.id != usuario.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado")
        usuario.email = body.email

    if body.nome is not None:
        usuario.nome = body.nome

    if body.senha is not None:
        usuario.senha_hash = hash_senha(body.senha)

    if body.ativo is not None:
        usuario.ativo = body.ativo

    campos_recebidos = body.model_fields_set

    if "idade" in campos_recebidos:
        aluno.idade = body.idade

    if "peso" in campos_recebidos:
        aluno.peso = body.peso

    if "altura" in campos_recebidos:
        aluno.altura = body.altura

    if "treina_em_academia_condominio" in campos_recebidos:
        aluno.treina_em_academia_condominio = body.treina_em_academia_condominio

    personal_id_saida = _aluno_personal_ativo_id(aluno)
    if "personal_id" in campos_recebidos:
        await _definir_vinculo_ativo_unico(db, aluno.id, body.personal_id)
        personal_id_saida = body.personal_id

    await db.flush()

    return AlunoAdminOut(
        aluno_id=aluno.id,
        usuario_id=usuario.id,
        nome=usuario.nome,
        email=usuario.email,
        ativo=usuario.ativo,
        role=usuario.role.value,
        idade=aluno.idade,
        peso=aluno.peso,
        altura=aluno.altura,
        treina_em_academia_condominio=aluno.treina_em_academia_condominio,
        personal_id=personal_id_saida,
    )


@router.delete("/alunos/{aluno_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remover_aluno(
    aluno_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    aluno = await _buscar_aluno_por_id(db, aluno_id)
    if aluno is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aluno não encontrado")

    usuario = aluno.usuario
    await _hard_delete_aluno_dependencias(db, aluno.id)
    await db.delete(aluno)
    await db.delete(usuario)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
