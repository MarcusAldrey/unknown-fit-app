"""dynamic implementos_execucao

Revision ID: 0006_implemento_execucao_dinamico
Revises: 0005_timezone_datetimes
Create Date: 2026-04-02 00:00:00.000000
"""

from datetime import datetime, timezone
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "0006_implementos_execucao"
down_revision: Union[str, None] = "0005_timezone_datetimes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_IMPLEMENTO_LABELS = {
    "BARRA": "Barra",
    "ELASTICO": "Elástico",
    "HALTERE": "Halteres",
    "KETTLEBELL": "Kettlebell",
    "CABO": "Cabo",
    "MAQUINA": "Máquina",
    "PESO_CORPO": "Peso corporal",
    "OUTRO": "Outro",
}

_IMPLEMENTOS = list(_IMPLEMENTO_LABELS.values())


def upgrade() -> None:
    op.create_table(
        "implementos_execucao",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("criado_por_sistema", sa.Boolean(), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nome", name="uq_implemento_execucao_nome"),
    )

    op.execute(
        """
        ALTER TABLE exercicios_base
        ALTER COLUMN implemento_execucao TYPE VARCHAR(120)
        USING (
            CASE implemento_execucao::text
                WHEN 'BARRA' THEN 'Barra'
                WHEN 'ELASTICO' THEN 'Elástico'
                WHEN 'HALTERE' THEN 'Halteres'
                WHEN 'KETTLEBELL' THEN 'Kettlebell'
                WHEN 'CABO' THEN 'Cabo'
                WHEN 'MAQUINA' THEN 'Máquina'
                WHEN 'PESO_CORPO' THEN 'Peso corporal'
                WHEN 'OUTRO' THEN 'Outro'
                ELSE implemento_execucao::text
            END
        )
        """
    )

    op.execute("DROP TYPE implementoexecucao")

    now = datetime.now(timezone.utc)
    implementos_table = sa.table(
        "implementos_execucao",
        sa.column("id", postgresql.UUID(as_uuid=True)),
        sa.column("nome", sa.String()),
        sa.column("ativo", sa.Boolean()),
        sa.column("criado_por_sistema", sa.Boolean()),
        sa.column("criado_em", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(
        implementos_table,
        [
            {
                "id": uuid.uuid4(),
                "nome": nome,
                "ativo": True,
                "criado_por_sistema": True,
                "criado_em": now,
            }
            for nome in _IMPLEMENTOS
        ],
    )


def downgrade() -> None:
    implemento_execucao_enum = postgresql.ENUM(
        "BARRA",
        "ELASTICO",
        "HALTERE",
        "KETTLEBELL",
        "CABO",
        "MAQUINA",
        "PESO_CORPO",
        "OUTRO",
        name="implementoexecucao",
        create_type=True,
    )
    implemento_execucao_enum.create(op.get_bind(), checkfirst=True)

    op.execute(
        """
        ALTER TABLE exercicios_base
        ALTER COLUMN implemento_execucao TYPE implementoexecucao
        USING (
            CASE implemento_execucao
                WHEN 'Barra' THEN 'BARRA'::implementoexecucao
                WHEN 'Elástico' THEN 'ELASTICO'::implementoexecucao
                WHEN 'Halteres' THEN 'HALTERE'::implementoexecucao
                WHEN 'Kettlebell' THEN 'KETTLEBELL'::implementoexecucao
                WHEN 'Cabo' THEN 'CABO'::implementoexecucao
                WHEN 'Máquina' THEN 'MAQUINA'::implementoexecucao
                WHEN 'Peso corporal' THEN 'PESO_CORPO'::implementoexecucao
                WHEN 'Outro' THEN 'OUTRO'::implementoexecucao
                ELSE 'OUTRO'::implementoexecucao
            END
        )
        """
    )

    op.drop_table("implementos_execucao")
