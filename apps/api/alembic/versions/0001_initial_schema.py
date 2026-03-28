"""initial schema

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-03-27 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0001_initial_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


role_enum = sa.Enum("PERSONAL", "ALUNO", name="role")
tecnica_enum = sa.Enum("PADRAO", "ISOMETRIA", "INSTABILIDADE", name="tecnica")
status_sessao_enum = sa.Enum("EM_ANDAMENTO", "FINALIZADO", name="statussessao")
implemento_execucao_enum = sa.Enum(
    "BARRA",
    "ELASTICO",
    "HALTERE",
    "KETTLEBELL",
    "CABO",
    "MAQUINA",
    "PESO_CORPO",
    "OUTRO",
    name="implementoexecucao",
)
alvo_tipo_enum = sa.Enum(
    "SEGUNDOS",
    "REPETICOES",
    "PASSOS",
    "OUTROS",
    name="alvotipo",
)
rer_rm_tipo_enum = sa.Enum("RER", "RM", name="rerrmtipo")


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("senha_hash", sa.String(length=255), nullable=False),
        sa.Column("role", role_enum, nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_usuarios_email"), "usuarios", ["email"], unique=True)

    op.create_table(
        "exercicios_base",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("grupo_muscular", sa.String(length=100), nullable=False),
        sa.Column("implemento_execucao", implemento_execucao_enum, nullable=False),
        sa.Column("pode_ser_feito_em_casa", sa.Boolean(), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("criado_por_sistema", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "alunos",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("usuario_id", sa.UUID(), nullable=False),
        sa.Column("idade", sa.Integer(), nullable=True),
        sa.Column("peso", sa.Float(), nullable=True),
        sa.Column("altura", sa.Float(), nullable=True),
        sa.Column("treina_em_academia_condominio", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("usuario_id"),
    )

    op.create_table(
        "personais",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("usuario_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("usuario_id"),
    )

    op.create_table(
        "recursos_treino",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("criado_por_sistema", sa.Boolean(), nullable=False),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nome"),
    )

    op.create_table(
        "conjuntos_treino",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("aluno_id", sa.UUID(), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.Column("data_inicio", sa.Date(), nullable=True),
        sa.Column("data_fim", sa.Date(), nullable=True),
        sa.ForeignKeyConstraint(["aluno_id"], ["alunos.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "vinculos_personal_aluno",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("aluno_id", sa.UUID(), nullable=False),
        sa.Column("personal_id", sa.UUID(), nullable=False),
        sa.Column("inicio_em", sa.DateTime(), nullable=False),
        sa.Column("fim_em", sa.DateTime(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["aluno_id"], ["alunos.id"]),
        sa.ForeignKeyConstraint(["personal_id"], ["personais.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("aluno_id", "ativo", name="uq_aluno_vinculo_ativo"),
    )

    op.create_table(
        "treinos",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("conjunto_treino_id", sa.UUID(), nullable=False),
        sa.Column("codigo", sa.String(length=10), nullable=False),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("observacoes_aluno", sa.Text(), nullable=True),
        sa.Column("ordem", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["conjunto_treino_id"], ["conjuntos_treino.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "exercicio_requisitos_recurso",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("exercicio_base_id", sa.UUID(), nullable=False),
        sa.Column("recurso_treino_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["exercicio_base_id"], ["exercicios_base.id"]),
        sa.ForeignKeyConstraint(["recurso_treino_id"], ["recursos_treino.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "exercicio_base_id",
            "recurso_treino_id",
            name="uq_exercicio_requisito_recurso",
        ),
    )
    op.create_index(
        "ix_exercicio_requisitos_recurso_exercicio_base_id",
        "exercicio_requisitos_recurso",
        ["exercicio_base_id"],
    )

    op.create_table(
        "aluno_recursos_disponibilidade",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("aluno_id", sa.UUID(), nullable=False),
        sa.Column("recurso_treino_id", sa.UUID(), nullable=False),
        sa.Column("disponivel_para_aluno", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["aluno_id"], ["alunos.id"]),
        sa.ForeignKeyConstraint(["recurso_treino_id"], ["recursos_treino.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "aluno_id",
            "recurso_treino_id",
            name="uq_aluno_recurso_disponibilidade",
        ),
    )
    op.create_index(
        "ix_aluno_recursos_disponibilidade_aluno_id",
        "aluno_recursos_disponibilidade",
        ["aluno_id"],
    )
    op.create_index(
        "ix_aluno_recursos_disponibilidade_recurso_treino_id",
        "aluno_recursos_disponibilidade",
        ["recurso_treino_id"],
    )

    op.create_table(
        "exercicios_treino",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("treino_id", sa.UUID(), nullable=False),
        sa.Column("exercicio_base_id", sa.UUID(), nullable=False),
        sa.Column("ordem", sa.Integer(), nullable=False),
        sa.Column("numero_series_prescritas", sa.Integer(), nullable=False),
        sa.Column("prescricao", sa.Text(), nullable=True),
        sa.Column("alvo_tipo", alvo_tipo_enum, nullable=False),
        sa.Column("alvo_valor_min", sa.Integer(), nullable=True),
        sa.Column("alvo_valor_max", sa.Integer(), nullable=True),
        sa.Column("alvo_outros_texto", sa.String(length=140), nullable=True),
        sa.Column("rer_rm_tipo", rer_rm_tipo_enum, nullable=True),
        sa.Column("rer_rm_valor", sa.String(length=50), nullable=True),
        sa.Column("descanso_segundos", sa.Integer(), nullable=True),
        sa.Column("tecnica", tecnica_enum, nullable=False),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("observacoes_aluno", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["exercicio_base_id"], ["exercicios_base.id"]),
        sa.ForeignKeyConstraint(["treino_id"], ["treinos.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "sessoes_treino",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("aluno_id", sa.UUID(), nullable=False),
        sa.Column("treino_id", sa.UUID(), nullable=False),
        sa.Column("iniciado_em", sa.DateTime(), nullable=False),
        sa.Column("finalizado_em", sa.DateTime(), nullable=True),
        sa.Column("status", status_sessao_enum, nullable=False),
        sa.ForeignKeyConstraint(["aluno_id"], ["alunos.id"]),
        sa.ForeignKeyConstraint(["treino_id"], ["treinos.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "registros_peso_aluno",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("aluno_id", sa.UUID(), nullable=False),
        sa.Column("peso", sa.Float(), nullable=False),
        sa.Column("registrado_em", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["aluno_id"], ["alunos.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "series_executadas",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("sessao_treino_id", sa.UUID(), nullable=False),
        sa.Column("exercicio_treino_id", sa.UUID(), nullable=False),
        sa.Column("numero_serie", sa.Integer(), nullable=False),
        sa.Column("peso_utilizado", sa.Float(), nullable=True),
        sa.Column("repeticoes_realizadas", sa.Integer(), nullable=True),
        sa.Column("concluida", sa.Boolean(), nullable=False),
        sa.Column("concluida_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["exercicio_treino_id"], ["exercicios_treino.id"]),
        sa.ForeignKeyConstraint(["sessao_treino_id"], ["sessoes_treino.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    bind = op.get_bind()

    op.drop_table("series_executadas")
    op.drop_table("registros_peso_aluno")
    op.drop_table("sessoes_treino")
    op.drop_table("exercicios_treino")

    op.drop_index(
        "ix_aluno_recursos_disponibilidade_recurso_treino_id",
        table_name="aluno_recursos_disponibilidade",
    )
    op.drop_index(
        "ix_aluno_recursos_disponibilidade_aluno_id",
        table_name="aluno_recursos_disponibilidade",
    )
    op.drop_table("aluno_recursos_disponibilidade")

    op.drop_index(
        "ix_exercicio_requisitos_recurso_exercicio_base_id",
        table_name="exercicio_requisitos_recurso",
    )
    op.drop_table("exercicio_requisitos_recurso")

    op.drop_table("treinos")
    op.drop_table("vinculos_personal_aluno")
    op.drop_table("conjuntos_treino")
    op.drop_table("recursos_treino")
    op.drop_table("personais")
    op.drop_table("alunos")
    op.drop_table("exercicios_base")

    op.drop_index(op.f("ix_usuarios_email"), table_name="usuarios")
    op.drop_table("usuarios")

    rer_rm_tipo_enum.drop(bind, checkfirst=True)
    alvo_tipo_enum.drop(bind, checkfirst=True)
    implemento_execucao_enum.drop(bind, checkfirst=True)
    status_sessao_enum.drop(bind, checkfirst=True)
    tecnica_enum.drop(bind, checkfirst=True)
    role_enum.drop(bind, checkfirst=True)
