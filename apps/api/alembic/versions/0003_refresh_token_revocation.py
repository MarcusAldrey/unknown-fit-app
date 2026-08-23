"""refresh token revocation

Revision ID: 0003_refresh_token_revocation
Revises: 0002_vinculo_partial_unique
Create Date: 2026-04-01 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003_refresh_token_revocation"
down_revision: Union[str, None] = "0002_vinculo_partial_unique"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "refresh_tokens_revogados",
        sa.Column("jti", sa.String(length=36), nullable=False),
        sa.Column("revogado_em", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("jti"),
    )


def downgrade() -> None:
    op.drop_table("refresh_tokens_revogados")
