
import asyncio
from app.database import async_session
from app.models import ConjuntoTreino, Usuario, Aluno
from sqlalchemy import select, update

async def fix():
    NEW_CONJUNTO_NOME = "Aldrey - Ciclo 1 - Adaptativo - ABCDE - 08FEV26"
    async with async_session() as session:
        # Get aluno_id
        result_a = await session.execute(
            select(Aluno.id).join(Usuario).where(Usuario.email == 'aluno@ecg.com')
        )
        aluno_id = result_a.scalar_one_or_none()
        if not aluno_id:
            print("Aluno não encontrado.")
            return

        # Deactivate all EXCEPT the new one
        await session.execute(
            update(ConjuntoTreino)
            .where(ConjuntoTreino.aluno_id == aluno_id)
            .where(ConjuntoTreino.nome != NEW_CONJUNTO_NOME)
            .values(ativo=False)
        )
        
        # Ensure the new one is active
        await session.execute(
            update(ConjuntoTreino)
            .where(ConjuntoTreino.aluno_id == aluno_id)
            .where(ConjuntoTreino.nome == NEW_CONJUNTO_NOME)
            .values(ativo=True)
        )
        
        await session.commit()
        print("Treinos antigos desativados. Novo ciclo ativado.")

if __name__ == "__main__":
    asyncio.run(fix())
