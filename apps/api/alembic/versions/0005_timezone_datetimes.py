"""timezone-aware datetime columns

Revision ID: 0005_timezone_datetimes
Revises: 0004_cascades
Create Date: 2026-04-01 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0005_timezone_datetimes"
down_revision: Union[str, None] = "0004_cascades"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_COLUMNS = [
    ("usuarios", "criado_em"),
    ("recursos_treino", "criado_em"),
    ("vinculos_personal_aluno", "inicio_em"),
    ("vinculos_personal_aluno", "fim_em"),
    ("sessoes_treino", "iniciado_em"),
    ("sessoes_treino", "finalizado_em"),
    ("registros_peso_aluno", "registrado_em"),
    ("series_executadas", "concluida_em"),
    ("refresh_tokens_revogados", "revogado_em"),
]


def upgrade() -> None:
    for table, column in _COLUMNS:
        op.alter_column(table, column, type_=sa.DateTime(timezone=True))


def downgrade() -> None:
    for table, column in _COLUMNS:
        op.alter_column(table, column, type_=sa.DateTime(timezone=False))
