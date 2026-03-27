"""add peso registro and concluida_em

Revision ID: a4b9d6f2c1e3
Revises: ed5c3656796e
Create Date: 2026-03-26 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a4b9d6f2c1e3"
down_revision: Union[str, None] = "ed5c3656796e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("series_executadas", sa.Column("concluida_em", sa.DateTime(), nullable=True))

    op.create_table(
        "registros_peso_aluno",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("aluno_id", sa.UUID(), nullable=False),
        sa.Column("peso", sa.Float(), nullable=False),
        sa.Column("registrado_em", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["aluno_id"], ["alunos.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.execute(
        """
        UPDATE series_executadas
        SET concluida_em = NOW()
        WHERE concluida = TRUE AND concluida_em IS NULL
        """
    )


def downgrade() -> None:
    op.drop_table("registros_peso_aluno")
    op.drop_column("series_executadas", "concluida_em")
