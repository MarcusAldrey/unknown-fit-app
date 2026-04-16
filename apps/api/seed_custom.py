#!/usr/bin/env python3
"""
Script para criar usuários customizados de teste:
- abreu@ecg.com (personal) com senha 654321*
- aldrey@ecg.com (aluno) com senha 654321*
Executa: python seed_custom.py
"""
import asyncio
from app.database import async_session
from app.models.usuario import Usuario, Role
from app.models.personal import Personal
from app.models.aluno import Aluno
from app.models.conjunto_treino import ConjuntoTreino
from app.models.treino import Treino
from app.models.exercicio_base import ExercicioBase
from app.models.exercicio_treino import ExercicioTreino, AlvoTipo, Tecnica
from app.models.vinculo import VinculoPersonalAluno
from app.services.auth import hash_senha
from sqlalchemy import select


async def _garantir_fixture_treino_aldrey(session, aluno: Aluno) -> None:
    result_ativo = await session.execute(
        select(ConjuntoTreino).where(
            ConjuntoTreino.aluno_id == aluno.id,
            ConjuntoTreino.ativo == True,  # noqa: E712
        )
    )
    if result_ativo.scalar_one_or_none() is not None:
        print("✓ Aldrey já possui conjunto ativo")
        return

    result_exercicio = await session.execute(
        select(ExercicioBase).where(ExercicioBase.nome == "Supino Reto com Barra")
    )
    exercicio_base = result_exercicio.scalar_one_or_none()
    if exercicio_base is None:
        exercicio_base = ExercicioBase(
            nome="Supino Reto com Barra",
            grupo_muscular="Peito",
            criado_por_sistema=True,
        )
        session.add(exercicio_base)
        await session.flush()

    conjunto = ConjuntoTreino(
        aluno_id=aluno.id,
        nome="Aldrey - Ciclo Inicial",
        ativo=True,
    )
    session.add(conjunto)
    await session.flush()

    treino = Treino(
        conjunto_treino_id=conjunto.id,
        codigo="A",
        nome="Full Body Inicial",
        ordem=0,
    )
    session.add(treino)
    await session.flush()

    exercicio = ExercicioTreino(
        treino_id=treino.id,
        exercicio_base_id=exercicio_base.id,
        ordem=0,
        numero_series_prescritas=3,
        alvo_tipo=AlvoTipo.REPETICOES,
        alvo_valor_min=8,
        alvo_valor_max=12,
        tecnica=Tecnica.PADRAO,
        descanso_segundos=90,
        prescricao="Cargar progressivamente mantendo execução controlada.",
    )
    session.add(exercicio)
    await session.flush()

    print("✓ Fixture de treino ativa criada para aldrey@ecg.com")


async def seed_custom():
    async with async_session() as session:
        # Personal Abreu
        result = await session.execute(
            select(Usuario).where(Usuario.email == "abreu@ecg.com")
        )
        personal_user = result.scalar_one_or_none()
        if personal_user is None:
            personal_user = Usuario(
                nome="Abreu",
                email="abreu@ecg.com",
                senha_hash=hash_senha("654321*"),
                role=Role.PERSONAL,
            )
            session.add(personal_user)
            await session.flush()
            session.add(Personal(usuario_id=personal_user.id))
            await session.flush()
            print("✓ Personal abreu@ecg.com criado")
        else:
            print("✓ Personal abreu@ecg.com já existe")

        # Aluno Aldrey
        result = await session.execute(
            select(Usuario).where(Usuario.email == "aldrey@ecg.com")
        )
        aluno_user = result.scalar_one_or_none()
        if aluno_user is None:
            aluno_user = Usuario(
                nome="Aldrey",
                email="aldrey@ecg.com",
                senha_hash=hash_senha("654321*"),
                role=Role.ALUNO,
            )
            session.add(aluno_user)
            await session.flush()
            session.add(Aluno(usuario_id=aluno_user.id, idade=30, peso=80.0, altura=1.80))
            await session.flush()
            print("✓ Aluno aldrey@ecg.com criado")
        else:
            print("✓ Aluno aldrey@ecg.com já existe")

        # Vincular personal <-> aluno
        result_p = await session.execute(
            select(Personal).join(Usuario).where(Usuario.email == "abreu@ecg.com")
        )
        personal = result_p.scalar_one_or_none()
        result_a = await session.execute(
            select(Aluno).join(Usuario).where(Usuario.email == "aldrey@ecg.com")
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
                await session.flush()
                print("✓ Vínculo abreu ↔ aldrey criado")
            else:
                print("✓ Vínculo abreu ↔ aldrey já existe")

            await _garantir_fixture_treino_aldrey(session, aluno)

        await session.commit()
        print("\n✅ Usuários customizados sincronizados!")


if __name__ == "__main__":
    asyncio.run(seed_custom())
