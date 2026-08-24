"""cascades for aluno hard delete

Revision ID: 0004_cascades
Revises: 0003_refresh_token_revocation
Create Date: 2026-04-01 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0004_cascades"
down_revision: Union[str, None] = "0003_refresh_token_revocation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CASCADES = [
    ("vinculos_personal_aluno", "aluno_id", "alunos"),
    ("aluno_recursos_disponibilidade", "aluno_id", "alunos"),
    ("registros_peso_aluno", "aluno_id", "alunos"),
    ("conjuntos_treino", "aluno_id", "alunos"),
    ("sessoes_treino", "aluno_id", "alunos"),
    ("treinos", "conjunto_treino_id", "conjuntos_treino"),
    ("exercicios_treino", "treino_id", "treinos"),
    ("exercicios_treino_equivalentes", "exercicio_treino_id", "exercicios_treino"),
    (
        "exercicios_treino_equivalentes",
        "exercicio_equivalente_treino_id",
        "exercicios_treino",
    ),
    ("series_executadas", "exercicio_treino_id", "exercicios_treino"),
    ("series_executadas", "exercicio_treino_executado_id", "exercicios_treino"),
    ("series_executadas", "sessao_treino_id", "sessoes_treino"),
]

_SQL = (
    "SELECT tc.constraint_name "
    "FROM information_schema.table_constraints tc "
    "JOIN information_schema.key_column_usage kcu "
    "  ON tc.constraint_name = kcu.constraint_name "
    " AND tc.constraint_schema = kcu.constraint_schema "
    "WHERE tc.table_name = :t "
    "  AND tc.constraint_type = 'FOREIGN KEY' "
    "  AND kcu.column_name = :c"
)


def _fk_name(bind, table: str, column: str) -> str:
    row = bind.execute(sa.text(_SQL), {"t": table, "c": column}).fetchone()
    if row is None:
        raise RuntimeError(f"FK constraint not found for {table}.{column}")
    return row[0]


def upgrade() -> None:
    bind = op.get_bind()
    for table, column, referred in _CASCADES:
        name = _fk_name(bind, table, column)
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(
            name,
            table,
            referred,
            [column],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    bind = op.get_bind()
    for table, column, referred in _CASCADES:
        name = _fk_name(bind, table, column)
        op.drop_constraint(name, table, type_="foreignkey")
        op.create_foreign_key(
            name,
            table,
            referred,
            [column],
            ["id"],
        )
