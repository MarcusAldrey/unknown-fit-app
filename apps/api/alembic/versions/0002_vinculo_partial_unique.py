"""vinculo partial unique index

Revision ID: 0002_vinculo_partial_unique
Revises: 0001_initial_schema
Create Date: 2026-04-01 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002_vinculo_partial_unique"
down_revision: Union[str, None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_aluno_vinculo_ativo",
        "vinculos_personal_aluno",
        type_="unique",
    )
    op.create_index(
        "uq_aluno_vinculo_ativo",
        "vinculos_personal_aluno",
        ["aluno_id"],
        unique=True,
        postgresql_where=sa.text("ativo"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_aluno_vinculo_ativo",
        table_name="vinculos_personal_aluno",
    )
    op.create_unique_constraint(
        "uq_aluno_vinculo_ativo",
        "vinculos_personal_aluno",
        ["aluno_id", "ativo"],
    )
