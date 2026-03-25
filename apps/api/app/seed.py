"""
Seed idempotente para ExercicioBase.
Executar: python -m app.seed
"""
import asyncio
from datetime import date

from sqlalchemy import select

from app.database import engine, async_session, Base
from app.models import ExercicioBase
from app.models.usuario import Usuario, Role
from app.models.personal import Personal
from app.models.aluno import Aluno
from app.models.vinculo import VinculoPersonalAluno
from app.models.conjunto_treino import ConjuntoTreino
from app.models.treino import Treino
from app.models.exercicio_treino import ExercicioTreino, Tecnica
from app.services.auth import hash_senha

EXERCICIOS_BASE = [
    # Peito
    {"nome": "Supino Reto com Barra", "grupo_muscular": "Peito", "equipamento": "Barra"},
    {"nome": "Supino Inclinado com Halteres", "grupo_muscular": "Peito", "equipamento": "Halteres"},
    {"nome": "Supino Declinado", "grupo_muscular": "Peito", "equipamento": "Barra"},
    {"nome": "Crucifixo com Halteres", "grupo_muscular": "Peito", "equipamento": "Halteres"},
    {"nome": "Crossover", "grupo_muscular": "Peito", "equipamento": "Cabo"},
    {"nome": "Flexão de Braço", "grupo_muscular": "Peito", "equipamento": None},
    # Costas
    {"nome": "Puxada Frontal", "grupo_muscular": "Costas", "equipamento": "Cabo"},
    {"nome": "Remada Curvada com Barra", "grupo_muscular": "Costas", "equipamento": "Barra"},
    {"nome": "Remada Unilateral com Halter", "grupo_muscular": "Costas", "equipamento": "Halter"},
    {"nome": "Pulldown", "grupo_muscular": "Costas", "equipamento": "Cabo"},
    {"nome": "Barra Fixa", "grupo_muscular": "Costas", "equipamento": None},
    {"nome": "Remada Baixa no Cabo", "grupo_muscular": "Costas", "equipamento": "Cabo"},
    # Pernas
    {"nome": "Agachamento Livre", "grupo_muscular": "Pernas", "equipamento": "Barra"},
    {"nome": "Leg Press 45°", "grupo_muscular": "Pernas", "equipamento": "Máquina"},
    {"nome": "Cadeira Extensora", "grupo_muscular": "Pernas", "equipamento": "Máquina"},
    {"nome": "Mesa Flexora", "grupo_muscular": "Pernas", "equipamento": "Máquina"},
    {"nome": "Agachamento Búlgaro", "grupo_muscular": "Pernas", "equipamento": "Halteres"},
    {"nome": "Stiff", "grupo_muscular": "Pernas", "equipamento": "Barra"},
    {"nome": "Panturrilha em Pé", "grupo_muscular": "Pernas", "equipamento": "Máquina"},
    {"nome": "Panturrilha Sentado", "grupo_muscular": "Pernas", "equipamento": "Máquina"},
    # Ombros
    {"nome": "Desenvolvimento com Halteres", "grupo_muscular": "Ombros", "equipamento": "Halteres"},
    {"nome": "Elevação Lateral", "grupo_muscular": "Ombros", "equipamento": "Halteres"},
    {"nome": "Elevação Frontal", "grupo_muscular": "Ombros", "equipamento": "Halteres"},
    {"nome": "Face Pull", "grupo_muscular": "Ombros", "equipamento": "Cabo"},
    {"nome": "Encolhimento com Barra", "grupo_muscular": "Ombros", "equipamento": "Barra"},
    # Bíceps
    {"nome": "Rosca Direta com Barra", "grupo_muscular": "Bíceps", "equipamento": "Barra"},
    {"nome": "Rosca Alternada com Halteres", "grupo_muscular": "Bíceps", "equipamento": "Halteres"},
    {"nome": "Rosca Martelo", "grupo_muscular": "Bíceps", "equipamento": "Halteres"},
    {"nome": "Rosca Scott", "grupo_muscular": "Bíceps", "equipamento": "Barra W"},
    # Tríceps
    {"nome": "Tríceps Pulley", "grupo_muscular": "Tríceps", "equipamento": "Cabo"},
    {"nome": "Tríceps Testa com Barra", "grupo_muscular": "Tríceps", "equipamento": "Barra W"},
    {"nome": "Tríceps Francês com Halter", "grupo_muscular": "Tríceps", "equipamento": "Halter"},
    {"nome": "Mergulho em Paralelas", "grupo_muscular": "Tríceps", "equipamento": None},
    # Core
    {"nome": "Abdominal Crunch", "grupo_muscular": "Core", "equipamento": None},
    {"nome": "Prancha", "grupo_muscular": "Core", "equipamento": None},
    {"nome": "Elevação de Pernas", "grupo_muscular": "Core", "equipamento": None},
    {"nome": "Abdominal Bicicleta", "grupo_muscular": "Core", "equipamento": None},
    # Glúteos
    {"nome": "Hip Thrust", "grupo_muscular": "Glúteos", "equipamento": "Barra"},
    {"nome": "Abdução de Quadril", "grupo_muscular": "Glúteos", "equipamento": "Máquina"},
    {"nome": "Kickback no Cabo", "grupo_muscular": "Glúteos", "equipamento": "Cabo"},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        for ex_data in EXERCICIOS_BASE:
            result = await session.execute(
                select(ExercicioBase).where(ExercicioBase.nome == ex_data["nome"])
            )
            existing = result.scalar_one_or_none()
            if existing is None:
                session.add(
                    ExercicioBase(
                        nome=ex_data["nome"],
                        grupo_muscular=ex_data["grupo_muscular"],
                        equipamento=ex_data.get("equipamento"),
                        criado_por_sistema=True,
                    )
                )
        await session.commit()
        print(f"Seed concluído: {len(EXERCICIOS_BASE)} exercícios verificados.")

    # --- Usuários de teste ---
    async with async_session() as session:
        # Personal
        result = await session.execute(
            select(Usuario).where(Usuario.email == "personal@ecg.com")
        )
        personal_user = result.scalar_one_or_none()
        if personal_user is None:
            personal_user = Usuario(
                nome="João Personal",
                email="personal@ecg.com",
                senha_hash=hash_senha("123456"),
                role=Role.PERSONAL,
            )
            session.add(personal_user)
            await session.flush()
            session.add(Personal(usuario_id=personal_user.id))
            await session.flush()

        # Aluno
        result = await session.execute(
            select(Usuario).where(Usuario.email == "aluno@ecg.com")
        )
        aluno_user = result.scalar_one_or_none()
        if aluno_user is None:
            aluno_user = Usuario(
                nome="Maria Aluna",
                email="aluno@ecg.com",
                senha_hash=hash_senha("123456"),
                role=Role.ALUNO,
            )
            session.add(aluno_user)
            await session.flush()
            session.add(Aluno(usuario_id=aluno_user.id, idade=25, peso=60.0, altura=1.65))
            await session.flush()

        # Vincular personal <-> aluno (se ambos existem)
        result_p = await session.execute(
            select(Personal).join(Usuario).where(Usuario.email == "personal@ecg.com")
        )
        personal = result_p.scalar_one_or_none()
        result_a = await session.execute(
            select(Aluno).join(Usuario).where(Usuario.email == "aluno@ecg.com")
        )
        aluno = result_a.scalar_one_or_none()
        if personal and aluno:
            result_v = await session.execute(
                select(VinculoPersonalAluno).where(
                    VinculoPersonalAluno.personal_id == personal.id,
                    VinculoPersonalAluno.aluno_id == aluno.id,
                )
            )
            if result_v.scalar_one_or_none() is None:
                session.add(VinculoPersonalAluno(
                    personal_id=personal.id,
                    aluno_id=aluno.id,
                    ativo=True,
                ))

        await session.commit()
        print("Usuários de teste criados:")
        print("  Personal: personal@ecg.com / 123456")
        print("  Aluno:    aluno@ecg.com / 123456")

    # --- Fixture: Treino Aldrey - Ciclo 1 para aluno@ecg.com ---
    await _seed_treino_aldrey_ciclo1()


async def _seed_treino_aldrey_ciclo1():
    """Cria o ConjuntoTreino 'Aldrey - Ciclo 1' para aluno@ecg.com (idempotente)."""
    CONJUNTO_NOME = "Aldrey - Ciclo 1 - Adaptativo - ABCDE - 08FEV26"

    TREINOS = [
        {
            "codigo": "A",
            "nome": "Peito, Ombro e Tríceps",
            "ordem": 0,
            "exercicios": [
                {"nome": "Supino Inclinado com Barra", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 90, "obs": None},
                {"nome": "Supino Reto com Halteres", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 90, "obs": None},
                {"nome": "Crucifixo com Halter", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 90, "obs": None},
                {"nome": "Desenvolvimento Militar", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 90, "obs": None},
                {"nome": "Tríceps Francês com Halteres", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 60, "obs": None},
                {"nome": "Tríceps na Polia", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 60, "obs": None},
            ],
        },
        {
            "codigo": "B",
            "nome": "Inferiores (Força)",
            "ordem": 1,
            "exercicios": [
                {"nome": "Levantamento Terra", "series": 3, "rep": "5", "tecnica": Tecnica.PADRAO, "rer": "100%/85%", "descanso": None, "obs": "Usar séries longe da falha (1 a 3 reps) com carga progressiva para aquecer e encontrar carga de trabalho. Usar carga de trabalho que falhe em 5RM, depois fazer as outras duas séries em 85% dessa carga."},
                {"nome": "Agachamento", "series": 3, "rep": "5", "tecnica": Tecnica.PADRAO, "rer": "100%/85%", "descanso": 90, "obs": "Usar séries longe da falha (1 a 3 reps) com carga progressiva para aquecer e encontrar carga de trabalho. Usar carga de trabalho que falhe em 5RM, depois fazer as outras duas séries em 85% dessa carga."},
                {"nome": "Cadeira Extensora", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 90, "obs": None},
                {"nome": "Cadeira Flexora", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 60, "obs": None},
                {"nome": "Abdominal Canoa", "series": 3, "rep": "30seg a 1min", "tecnica": Tecnica.ISOMETRIA, "rer": None, "descanso": 60, "obs": "Falhar em todas. Direcionar as mãos e pernas para longe do corpo para dificultar sempre que atingir 1 minuto na progressão. Também é possível adicionar carga em mãos e pernas."},
                {"nome": "Prancha Frontal", "series": 3, "rep": "30seg a 1min", "tecnica": Tecnica.ISOMETRIA, "rer": None, "descanso": 60, "obs": "Falhar em todas."},
                {"nome": "Prancha Lateral", "series": 3, "rep": "30seg a 1min", "tecnica": Tecnica.ISOMETRIA, "rer": None, "descanso": 60, "obs": "Alternar continuamente entre lados. Levantar perna de cima no ar + segurar anilha a frente do corpo com braço de cima são formas de dificultar e manter dentro de 1min."},
            ],
        },
        {
            "codigo": "C",
            "nome": "Costas e Bíceps",
            "ordem": 2,
            "exercicios": [
                {"nome": "Remada Curvada Pronada", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 90, "obs": "Verter os cotovelos a frente do corpo e trazer a barra apenas até a linha do queixo ou levemente abaixo."},
                {"nome": "Puxada Alta Triângulo", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 90, "obs": None},
                {"nome": "Remada Baixa", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 90, "obs": None},
                {"nome": "Rosca Direta com Barra", "series": 3, "rep": "6-8", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 120, "obs": "Socar peso nessa bagaça."},
                {"nome": "Suitcase Carry", "series": 3, "rep": "20 passos mínimos", "tecnica": Tecnica.INSTABILIDADE, "rer": None, "descanso": 30, "obs": "Segurar uma anilha/halter/Kettlebell com apenas uma mão e andar sem deixar o tronco e quadril lateralizar. Andar pelo menos 20 passos. Utilizar carga alta."},
                {"nome": "Panturrilha em Pé", "series": 3, "rep": "6-8", "tecnica": Tecnica.PADRAO, "rer": "FALHA", "descanso": 120, "obs": "Pode fazer onde preferir, contanto que o joelho esteja esticado conta como em pé. Socar carga e FALHAR."},
            ],
        },
        {
            "codigo": "D",
            "nome": "Super Bíceps, Super Lombar e Ombritos",
            "ordem": 3,
            "exercicios": [
                {"nome": "Agachamento Zercher", "series": 4, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": "2", "descanso": 120, "obs": None},
                {"nome": "Isometria de Bíceps em 90 graus de Rosca Direta", "series": 3, "rep": "40seg a 80seg", "tecnica": Tecnica.ISOMETRIA, "rer": None, "descanso": 60, "obs": "Segurar a carga no ângulo de 90 graus."},
                {"nome": "Rosca Martelo", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": None, "descanso": 90, "obs": None},
                {"nome": "Rosca Scott", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": None, "descanso": 90, "obs": None},
                {"nome": "Superman no Solo", "series": 3, "rep": "30seg a 1min", "tecnica": Tecnica.PADRAO, "rer": "FALHA", "descanso": 60, "obs": None},
                {"nome": "Desenvolvimento Militar com Halter", "series": 3, "rep": "12-15", "tecnica": Tecnica.PADRAO, "rer": "FALHA", "descanso": 60, "obs": None},
                {"nome": "Elevação Lateral", "series": 3, "rep": "12-15", "tecnica": Tecnica.PADRAO, "rer": "FALHA", "descanso": 60, "obs": None},
            ],
        },
        {
            "codigo": "E",
            "nome": "Inferiores Complementar",
            "ordem": 4,
            "exercicios": [
                {"nome": "Afundo no Smith", "series": 3, "rep": "6-8", "tecnica": Tecnica.PADRAO, "rer": None, "descanso": 120, "obs": None},
                {"nome": "Elevação Pélvica", "series": 3, "rep": "6-8", "tecnica": Tecnica.PADRAO, "rer": None, "descanso": 120, "obs": None},
                {"nome": "Cadeira Extensora", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": None, "descanso": 90, "obs": None},
                {"nome": "Cadeira Flexora", "series": 3, "rep": "8-12", "tecnica": Tecnica.PADRAO, "rer": None, "descanso": 90, "obs": None},
                {"nome": "Flexão de Joelho no Solo", "series": 3, "rep": "30seg a 1min", "tecnica": Tecnica.ISOMETRIA, "rer": None, "descanso": 30, "obs": "Manter apenas os calcanhares e a parte alta das costas no solo."},
            ],
        },
    ]

    async with async_session() as session:
        # Buscar aluno
        result_a = await session.execute(
            select(Aluno).join(Usuario).where(Usuario.email == "aluno@ecg.com")
        )
        aluno = result_a.scalar_one_or_none()
        if aluno is None:
            print("Seed treino: aluno@ecg.com não encontrado, pulando fixture de treino.")
            return

        # Verificar se já existe
        result_c = await session.execute(
            select(ConjuntoTreino).where(
                ConjuntoTreino.aluno_id == aluno.id,
                ConjuntoTreino.nome == CONJUNTO_NOME,
            )
        )
        if result_c.scalar_one_or_none() is not None:
            print(f"Seed treino: conjunto '{CONJUNTO_NOME}' já existe, pulando.")
            return

        # Criar conjunto
        conjunto = ConjuntoTreino(
            aluno_id=aluno.id,
            nome=CONJUNTO_NOME,
            ativo=True,
            data_inicio=date(2026, 2, 8),
        )
        session.add(conjunto)
        await session.flush()

        # Criar treinos e exercícios
        for treino_data in TREINOS:
            treino = Treino(
                conjunto_treino_id=conjunto.id,
                codigo=treino_data["codigo"],
                nome=treino_data["nome"],
                ordem=treino_data["ordem"],
            )
            session.add(treino)
            await session.flush()

            for idx, ex in enumerate(treino_data["exercicios"]):
                session.add(ExercicioTreino(
                    treino_id=treino.id,
                    nome_exercicio=ex["nome"],
                    ordem=idx,
                    numero_series_prescritas=ex["series"],
                    repeticao_ou_tempo=ex["rep"],
                    tecnica=ex["tecnica"],
                    rer_rm_valor=ex["rer"],
                    descanso_segundos=ex["descanso"],
                    observacoes=ex["obs"],
                ))

        await session.commit()
        total_ex = sum(len(t["exercicios"]) for t in TREINOS)
        print(f"Seed treino: '{CONJUNTO_NOME}' criado com {len(TREINOS)} treinos e {total_ex} exercícios.")


if __name__ == "__main__":
    asyncio.run(seed())
