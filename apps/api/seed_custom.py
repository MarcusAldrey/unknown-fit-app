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
from app.models.vinculo import VinculoPersonalAluno
from app.services.auth import hash_senha
from sqlalchemy import select


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

        await session.commit()
        print("\n✅ Usuários customizados sincronizados!")


if __name__ == "__main__":
    asyncio.run(seed_custom())
