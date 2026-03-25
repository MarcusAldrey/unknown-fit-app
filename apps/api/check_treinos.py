
import asyncio
from app.database import async_session
from app.models import ConjuntoTreino, Usuario, Aluno
from sqlalchemy import select

async def check():
    async with async_session() as session:
        result = await session.execute(
            select(ConjuntoTreino)
            .join(Aluno)
            .join(Usuario)
            .where(Usuario.email == 'aluno@ecg.com')
        )
        conjuntos = result.scalars().all()
        for c in conjuntos:
            print(f"ID: {c.id}, Nome: {c.nome}, Ativo: {c.ativo}")

if __name__ == "__main__":
    asyncio.run(check())
