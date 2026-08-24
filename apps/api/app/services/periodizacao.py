from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.exceptions import DomainValidationError
from app.models import ConjuntoTreino, Treino


async def ativar_conjunto(db: AsyncSession, conjunto: ConjuntoTreino) -> ConjuntoTreino:
    hoje = date.today()

    if conjunto.data_fim is not None and not conjunto.ativo:
        raise DomainValidationError(
            "Esta periodização já foi concluída e não pode ser ativada novamente."
        )

    result = await db.execute(
        select(ConjuntoTreino).where(
            ConjuntoTreino.aluno_id == conjunto.aluno_id,
            ConjuntoTreino.ativo.is_(True),
        )
    )
    for c in result.scalars().all():
        if c.id != conjunto.id:
            c.data_fim = hoje
        c.ativo = False

    conjunto.ativo = True
    if conjunto.data_inicio is None:
        conjunto.data_inicio = hoje

    await db.flush()
    await db.refresh(conjunto)
    return conjunto


async def reordenar_treinos(
    db: AsyncSession,
    conjunto_id,
    codigos: list[str] | None = None,
) -> None:
    """Renumera a ordem dos treinos e recodifica usando códigos explícitos.

    Quando ``codigos`` é fornecido, usa os códigos na ordem recebida; caso
    contrário, computa letras (A, B, C...) com guarda contra estouro além de 26.
    """
    result = await db.execute(
        select(Treino)
        .where(Treino.conjunto_treino_id == conjunto_id)
        .order_by(Treino.ordem)
    )
    treinos = result.scalars().all()

    for idx, treino in enumerate(treinos):
        treino.ordem = idx + 1
        if codigos is not None and idx < len(codigos):
            treino.codigo = codigos[idx]
        else:
            treino.codigo = _codigo_para_indice(idx)

    await db.flush()


def _codigo_para_indice(idx: int) -> str:
    """Gera um código de letra para o índice (0-based), com overflow após Z."""
    letras: list[str] = []
    valor = idx
    while valor >= 26:
        letras.insert(0, chr(65 + (valor % 26)))
        valor = valor // 26 - 1
    letras.insert(0, chr(65 + valor))
    return "".join(letras)
