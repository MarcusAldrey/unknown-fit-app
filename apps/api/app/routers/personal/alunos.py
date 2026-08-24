import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_aluno_vinculado, get_current_personal
from app.models import (
    Aluno,
    AlunoRecursoDisponibilidade,
    ExercicioBase,
    ExercicioRequisitoRecurso,
    Personal,
    RegistroPesoAluno,
    VinculoPersonalAluno,
)
from app.schemas import (
    AlunoFicha,
    AlunoResumo,
    ExercicioBaseOut,
    RegistroPesoCreate,
    RegistroPesoOut,
)
from app.services.disponibilidade import ensure_disponibilidade_rows

router = APIRouter()


@router.get("/alunos", response_model=list[AlunoResumo])
async def listar_alunos(
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Aluno)
        .join(VinculoPersonalAluno)
        .where(
            VinculoPersonalAluno.personal_id == personal.id,
            VinculoPersonalAluno.ativo.is_(True),
        )
        .options(selectinload(Aluno.usuario))
    )
    alunos = result.scalars().all()
    return [
        AlunoResumo(id=a.id, nome=a.usuario.nome, email=a.usuario.email)
        for a in alunos
    ]


@router.get("/alunos/{aluno_id}", response_model=AlunoFicha)
async def ficha_aluno(
    aluno_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    aluno: Aluno = Depends(get_aluno_vinculado),
):
    return AlunoFicha(
        id=aluno.id,
        nome=aluno.usuario.nome,
        email=aluno.usuario.email,
        idade=aluno.idade,
        peso=aluno.peso,
        altura=aluno.altura,
        treina_em_academia_condominio=aluno.treina_em_academia_condominio,
    )


@router.get("/alunos/{aluno_id}/exercicios-base-disponiveis", response_model=list[ExercicioBaseOut])
async def listar_exercicios_base_disponiveis_aluno(
    aluno_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    aluno: Aluno = Depends(get_aluno_vinculado),
):
    await ensure_disponibilidade_rows(db, aluno_id)

    result = await db.execute(
        select(ExercicioBase)
        .outerjoin(
            ExercicioRequisitoRecurso,
            ExercicioRequisitoRecurso.exercicio_base_id == ExercicioBase.id,
        )
        .outerjoin(
            AlunoRecursoDisponibilidade,
            and_(
                AlunoRecursoDisponibilidade.recurso_treino_id
                == ExercicioRequisitoRecurso.recurso_treino_id,
                AlunoRecursoDisponibilidade.aluno_id == aluno_id,
                AlunoRecursoDisponibilidade.disponivel_para_aluno.is_(True),
            ),
        )
        .where(ExercicioBase.ativo.is_(True))
        .where(
            or_(
                ExercicioRequisitoRecurso.id.is_(None),
                AlunoRecursoDisponibilidade.id.is_not(None),
            )
        )
        .options(
            selectinload(ExercicioBase.requisitos_recurso_links).selectinload(
                ExercicioRequisitoRecurso.recurso_treino
            )
        )
        .order_by(ExercicioBase.grupo_muscular, ExercicioBase.nome)
        .distinct()
    )
    return result.scalars().all()


@router.get("/alunos/{aluno_id}/peso", response_model=list[RegistroPesoOut])
async def listar_registros_peso(
    aluno_id: uuid.UUID,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    aluno: Aluno = Depends(get_aluno_vinculado),
):
    result = await db.execute(
        select(RegistroPesoAluno)
        .where(RegistroPesoAluno.aluno_id == aluno_id)
        .order_by(RegistroPesoAluno.registrado_em.desc())
    )
    return result.scalars().all()


@router.post("/alunos/{aluno_id}/peso", response_model=RegistroPesoOut, status_code=201)
async def registrar_peso(
    aluno_id: uuid.UUID,
    body: RegistroPesoCreate,
    personal: Personal = Depends(get_current_personal),
    db: AsyncSession = Depends(get_db),
    aluno: Aluno = Depends(get_aluno_vinculado),
):
    registro = RegistroPesoAluno(aluno_id=aluno_id, peso=body.peso)
    aluno.peso = body.peso

    db.add(registro)
    await db.flush()
    await db.refresh(registro)
    return registro
