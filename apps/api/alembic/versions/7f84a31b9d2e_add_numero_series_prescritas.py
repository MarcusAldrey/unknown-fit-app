"""add numero_series_prescritas to exercicios_treino

Revision ID: 7f84a31b9d2e
Revises: ed5c3656796e
Create Date: 2026-03-25 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "7f84a31b9d2e"
down_revision: Union[str, None] = "ed5c3656796e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "exercicios_treino",
        sa.Column("numero_series_prescritas", sa.Integer(), nullable=False, server_default="1"),
    )
    op.alter_column("exercicios_treino", "numero_series_prescritas", server_default=None)


def downgrade() -> None:
    op.drop_column("exercicios_treino", "numero_series_prescritas")
