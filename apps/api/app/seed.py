"""
Seed idempotente para ExercicioBase.
Executar: python -m app.seed
"""
import asyncio

from sqlalchemy import select

from app.database import engine, async_session, Base
from app.models import ExercicioBase
from app.models.usuario import Usuario, Role
from app.models.personal import Personal
from app.models.aluno import Aluno
from app.models.vinculo import VinculoPersonalAluno
from app.services.auth import hash_senha

EXERCICIOS_BASE = [
    # Peito
    {"nome": "Supino Reto com Barra", "grupo_muscular": "Peito", "equipamento": "Barra"},
    {"nome": "Supino Inclinado com Halteres", "grupo_muscular": "Peito", "equipamento": "Halteres"},
    {"nome": "Supino Declinado", "grupo_muscular": "Peito", "equipamento": "Barra"},
    {"nome": "Crucifixo com Halteres", "grupo_muscular": "Peito", "equipamento": "Halteres"},
    {"nome": "Crossover", "grupo_muscular": "Peito", "equipamento": "Cabo"},
    {"nome": "Flexão de Braço", "grupo_muscular": "Peito", "equipamento": None},
    # Costas
    {"nome": "Puxada Frontal", "grupo_muscular": "Costas", "equipamento": "Cabo"},
    {"nome": "Remada Curvada com Barra", "grupo_muscular": "Costas", "equipamento": "Barra"},
    {"nome": "Remada Unilateral com Halter", "grupo_muscular": "Costas", "equipamento": "Halter"},
    {"nome": "Pulldown", "grupo_muscular": "Costas", "equipamento": "Cabo"},
    {"nome": "Barra Fixa", "grupo_muscular": "Costas", "equipamento": None},
    {"nome": "Remada Baixa no Cabo", "grupo_muscular": "Costas", "equipamento": "Cabo"},
    # Pernas
    {"nome": "Agachamento Livre", "grupo_muscular": "Pernas", "equipamento": "Barra"},
    {"nome": "Leg Press 45°", "grupo_muscular": "Pernas", "equipamento": "Máquina"},
    {"nome": "Cadeira Extensora", "grupo_muscular": "Pernas", "equipamento": "Máquina"},
    {"nome": "Mesa Flexora", "grupo_muscular": "Pernas", "equipamento": "Máquina"},
    {"nome": "Agachamento Búlgaro", "grupo_muscular": "Pernas", "equipamento": "Halteres"},
    {"nome": "Stiff", "grupo_muscular": "Pernas", "equipamento": "Barra"},
    {"nome": "Panturrilha em Pé", "grupo_muscular": "Pernas", "equipamento": "Máquina"},
    {"nome": "Panturrilha Sentado", "grupo_muscular": "Pernas", "equipamento": "Máquina"},
    # Ombros
    {"nome": "Desenvolvimento com Halteres", "grupo_muscular": "Ombros", "equipamento": "Halteres"},
    {"nome": "Elevação Lateral", "grupo_muscular": "Ombros", "equipamento": "Halteres"},
    {"nome": "Elevação Frontal", "grupo_muscular": "Ombros", "equipamento": "Halteres"},
    {"nome": "Face Pull", "grupo_muscular": "Ombros", "equipamento": "Cabo"},
    {"nome": "Encolhimento com Barra", "grupo_muscular": "Ombros", "equipamento": "Barra"},
    # Bíceps
    {"nome": "Rosca Direta com Barra", "grupo_muscular": "Bíceps", "equipamento": "Barra"},
    {"nome": "Rosca Alternada com Halteres", "grupo_muscular": "Bíceps", "equipamento": "Halteres"},
    {"nome": "Rosca Martelo", "grupo_muscular": "Bíceps", "equipamento": "Halteres"},
    {"nome": "Rosca Scott", "grupo_muscular": "Bíceps", "equipamento": "Barra W"},
    # Tríceps
    {"nome": "Tríceps Pulley", "grupo_muscular": "Tríceps", "equipamento": "Cabo"},
    {"nome": "Tríceps Testa com Barra", "grupo_muscular": "Tríceps", "equipamento": "Barra W"},
    {"nome": "Tríceps Francês com Halter", "grupo_muscular": "Tríceps", "equipamento": "Halter"},
    {"nome": "Mergulho em Paralelas", "grupo_muscular": "Tríceps", "equipamento": None},
    # Core
    {"nome": "Abdominal Crunch", "grupo_muscular": "Core", "equipamento": None},
    {"nome": "Prancha", "grupo_muscular": "Core", "equipamento": None},
    {"nome": "Elevação de Pernas", "grupo_muscular": "Core", "equipamento": None},
    {"nome": "Abdominal Bicicleta", "grupo_muscular": "Core", "equipamento": None},
    # Glúteos
    {"nome": "Hip Thrust", "grupo_muscular": "Glúteos", "equipamento": "Barra"},
    {"nome": "Abdução de Quadril", "grupo_muscular": "Glúteos", "equipamento": "Máquina"},
    {"nome": "Kickback no Cabo", "grupo_muscular": "Glúteos", "equipamento": "Cabo"},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        for ex_data in EXERCICIOS_BASE:
            result = await session.execute(
                select(ExercicioBase).where(ExercicioBase.nome == ex_data["nome"])
            )
            existing = result.scalar_one_or_none()
            if existing is None:
                session.add(
                    ExercicioBase(
                        nome=ex_data["nome"],
                        grupo_muscular=ex_data["grupo_muscular"],
                        equipamento=ex_data.get("equipamento"),
                        criado_por_sistema=True,
                    )
                )
        await session.commit()
        print(f"Seed concluído: {len(EXERCICIOS_BASE)} exercícios verificados.")

    # --- Usuários de teste ---
    async with async_session() as session:
        # Personal
        result = await session.execute(
            select(Usuario).where(Usuario.email == "personal@ecg.com")
        )
        personal_user = result.scalar_one_or_none()
        if personal_user is None:
            personal_user = Usuario(
                nome="João Personal",
                email="personal@ecg.com",
                senha_hash=hash_senha("123456"),
                role=Role.PERSONAL,
            )
            session.add(personal_user)
            await session.flush()
            session.add(Personal(usuario_id=personal_user.id))
            await session.flush()

        # Aluno
        result = await session.execute(
            select(Usuario).where(Usuario.email == "aluno@ecg.com")
        )
        aluno_user = result.scalar_one_or_none()
        if aluno_user is None:
            aluno_user = Usuario(
                nome="Maria Aluna",
                email="aluno@ecg.com",
                senha_hash=hash_senha("123456"),
                role=Role.ALUNO,
            )
            session.add(aluno_user)
            await session.flush()
            session.add(Aluno(usuario_id=aluno_user.id, idade=25, peso=60.0, altura=1.65))
            await session.flush()

        # Vincular personal <-> aluno (se ambos existem)
        result_p = await session.execute(
            select(Personal).join(Usuario).where(Usuario.email == "personal@ecg.com")
        )
        personal = result_p.scalar_one_or_none()
        result_a = await session.execute(
            select(Aluno).join(Usuario).where(Usuario.email == "aluno@ecg.com")
        )
        aluno = result_a.scalar_one_or_none()
        if personal and aluno:
            result_v = await session.execute(
                select(VinculoPersonalAluno).where(
                    VinculoPersonalAluno.personal_id == personal.id,
                    VinculoPersonalAluno.aluno_id == aluno.id,
                )
            )
            if result_v.scalar_one_or_none() is None:
                session.add(VinculoPersonalAluno(
                    personal_id=personal.id,
                    aluno_id=aluno.id,
                    ativo=True,
                ))

        await session.commit()
        print("Usuários de teste criados:")
        print("  Personal: personal@ecg.com / 123456")
        print("  Aluno:    aluno@ecg.com / 123456")


if __name__ == "__main__":
    asyncio.run(seed())
