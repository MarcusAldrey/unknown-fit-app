"""
Seed idempotente para ExercicioBase.
Executar: python -m app.seed
"""
import asyncio
import re
from datetime import date

from sqlalchemy import select

from app.database import engine, async_session, Base
from app.models import (
    AlunoRecursoDisponibilidade,
    ExercicioBase,
    ExercicioRequisitoRecurso,
    ImplementoExecucao,
    RecursoTreino,
)
from app.models.usuario import Usuario, Role
from app.models.personal import Personal
from app.models.aluno import Aluno
from app.models.vinculo import VinculoPersonalAluno
from app.models.conjunto_treino import ConjuntoTreino
from app.models.treino import Treino
from app.models.exercicio_treino import ExercicioTreino, Tecnica, AlvoTipo, RerRmTipo
from app.services.auth import hash_senha

EXERCICIOS_BASE = [
    # Peito
    {"nome": "Supino Reto com Barra", "grupo_muscular": "Peito", "implemento_execucao": ImplementoExecucao.BARRA},
    {"nome": "Supino Inclinado com Halteres", "grupo_muscular": "Peito", "implemento_execucao": ImplementoExecucao.HALTERE},
    {"nome": "Supino Declinado", "grupo_muscular": "Peito", "implemento_execucao": ImplementoExecucao.BARRA},
    {"nome": "Crucifixo com Halteres", "grupo_muscular": "Peito", "implemento_execucao": ImplementoExecucao.HALTERE},
    {"nome": "Crossover", "grupo_muscular": "Peito", "implemento_execucao": ImplementoExecucao.CABO},
    {"nome": "Flexão de Braço", "grupo_muscular": "Peito", "implemento_execucao": ImplementoExecucao.PESO_CORPO},
    # Costas
    {"nome": "Puxada Frontal", "grupo_muscular": "Costas", "implemento_execucao": ImplementoExecucao.CABO},
    {"nome": "Remada Curvada com Barra", "grupo_muscular": "Costas", "implemento_execucao": ImplementoExecucao.BARRA},
    {"nome": "Remada Unilateral com Halter", "grupo_muscular": "Costas", "implemento_execucao": ImplementoExecucao.HALTERE},
    {"nome": "Pulldown", "grupo_muscular": "Costas", "implemento_execucao": ImplementoExecucao.CABO},
    {"nome": "Barra Fixa", "grupo_muscular": "Costas", "implemento_execucao": ImplementoExecucao.PESO_CORPO},
    {"nome": "Remada Baixa no Cabo", "grupo_muscular": "Costas", "implemento_execucao": ImplementoExecucao.CABO},
    # Pernas
    {"nome": "Agachamento Livre", "grupo_muscular": "Pernas", "implemento_execucao": ImplementoExecucao.BARRA},
    {"nome": "Leg Press 45°", "grupo_muscular": "Pernas", "implemento_execucao": ImplementoExecucao.MAQUINA},
    {"nome": "Cadeira Extensora", "grupo_muscular": "Pernas", "implemento_execucao": ImplementoExecucao.MAQUINA},
    {"nome": "Mesa Flexora", "grupo_muscular": "Pernas", "implemento_execucao": ImplementoExecucao.MAQUINA},
    {"nome": "Agachamento Búlgaro", "grupo_muscular": "Pernas", "implemento_execucao": ImplementoExecucao.HALTERE},
    {"nome": "Afundo no Smith", "grupo_muscular": "Pernas", "implemento_execucao": ImplementoExecucao.MAQUINA},
    {"nome": "Stiff", "grupo_muscular": "Pernas", "implemento_execucao": ImplementoExecucao.BARRA},
    {"nome": "Panturrilha em Pé", "grupo_muscular": "Pernas", "implemento_execucao": ImplementoExecucao.MAQUINA},
    {"nome": "Panturrilha Sentado", "grupo_muscular": "Pernas", "implemento_execucao": ImplementoExecucao.MAQUINA},
    # Ombros
    {"nome": "Desenvolvimento com Halteres", "grupo_muscular": "Ombros", "implemento_execucao": ImplementoExecucao.HALTERE},
    {"nome": "Elevação Lateral", "grupo_muscular": "Ombros", "implemento_execucao": ImplementoExecucao.HALTERE},
    {"nome": "Elevação Frontal", "grupo_muscular": "Ombros", "implemento_execucao": ImplementoExecucao.HALTERE},
    {"nome": "Face Pull", "grupo_muscular": "Ombros", "implemento_execucao": ImplementoExecucao.CABO},
    {"nome": "Encolhimento com Barra", "grupo_muscular": "Ombros", "implemento_execucao": ImplementoExecucao.BARRA},
    # Bíceps
    {"nome": "Rosca Direta com Barra", "grupo_muscular": "Bíceps", "implemento_execucao": ImplementoExecucao.BARRA},
    {"nome": "Rosca Alternada com Halteres", "grupo_muscular": "Bíceps", "implemento_execucao": ImplementoExecucao.HALTERE},
    {"nome": "Rosca Martelo", "grupo_muscular": "Bíceps", "implemento_execucao": ImplementoExecucao.HALTERE},
    {"nome": "Rosca Scott", "grupo_muscular": "Bíceps", "implemento_execucao": ImplementoExecucao.BARRA},
    # Tríceps
    {"nome": "Tríceps Pulley", "grupo_muscular": "Tríceps", "implemento_execucao": ImplementoExecucao.CABO},
    {"nome": "Tríceps Testa com Barra", "grupo_muscular": "Tríceps", "implemento_execucao": ImplementoExecucao.BARRA},
    {"nome": "Tríceps Francês com Halter", "grupo_muscular": "Tríceps", "implemento_execucao": ImplementoExecucao.HALTERE},
    {"nome": "Mergulho em Paralelas", "grupo_muscular": "Tríceps", "implemento_execucao": ImplementoExecucao.PESO_CORPO},
    # Core
    {"nome": "Abdominal Crunch", "grupo_muscular": "Core", "implemento_execucao": ImplementoExecucao.PESO_CORPO},
    {"nome": "Prancha", "grupo_muscular": "Core", "implemento_execucao": ImplementoExecucao.PESO_CORPO},
    {"nome": "Elevação de Pernas", "grupo_muscular": "Core", "implemento_execucao": ImplementoExecucao.PESO_CORPO},
    {"nome": "Abdominal Bicicleta", "grupo_muscular": "Core", "implemento_execucao": ImplementoExecucao.PESO_CORPO},
    # Glúteos
    {"nome": "Hip Thrust", "grupo_muscular": "Glúteos", "implemento_execucao": ImplementoExecucao.BARRA},
    {"nome": "Abdução de Quadril", "grupo_muscular": "Glúteos", "implemento_execucao": ImplementoExecucao.MAQUINA},
    {"nome": "Kickback no Cabo", "grupo_muscular": "Glúteos", "implemento_execucao": ImplementoExecucao.CABO},
]


def _recursos_por_exercicio(nome_exercicio: str, implemento: ImplementoExecucao) -> list[str]:
    nome = nome_exercicio.lower()

    if "supino" in nome:
        return ["Banco de Supino"]
    if "smith" in nome:
        return ["Máquina Smith"]
    if "leg press" in nome:
        return ["Leg Press"]
    if "cadeira extensora" in nome:
        return ["Cadeira Extensora"]
    if "cadeira flexora" in nome or "mesa flexora" in nome:
        return ["Mesa Flexora"]

    defaults = {
        ImplementoExecucao.BARRA: ["Suporte de Barra"],
        ImplementoExecucao.ELASTICO: ["Ponto de Ancoragem para Elástico"],
        ImplementoExecucao.HALTERE: ["Rack de Halteres"],
        ImplementoExecucao.KETTLEBELL: ["Rack de Kettlebells"],
        ImplementoExecucao.CABO: ["Estação de Cabo"],
        ImplementoExecucao.MAQUINA: ["Máquina Específica"],
        ImplementoExecucao.PESO_CORPO: [],
        ImplementoExecucao.OUTRO: [],
    }
    return defaults[implemento]


async def _upsert_recurso(session, nome: str) -> RecursoTreino:
    result = await session.execute(select(RecursoTreino).where(RecursoTreino.nome == nome))
    recurso = result.scalar_one_or_none()
    if recurso is not None:
        return recurso

    recurso = RecursoTreino(nome=nome, criado_por_sistema=True)
    session.add(recurso)
    await session.flush()
    return recurso


async def _sincronizar_recursos_e_requisitos(session) -> None:
    result = await session.execute(select(ExercicioBase))
    exercicios = result.scalars().all()

    for exercicio in exercicios:
        implemento = exercicio.implemento_execucao or ImplementoExecucao.OUTRO
        exercicio.implemento_execucao = implemento
        recursos_nomes = _recursos_por_exercicio(exercicio.nome, implemento)

        links_existentes = (
            await session.execute(
                select(ExercicioRequisitoRecurso).where(
                    ExercicioRequisitoRecurso.exercicio_base_id == exercicio.id
                )
            )
        ).scalars().all()
        if links_existentes:
            continue

        for nome_recurso in recursos_nomes:
            recurso = await _upsert_recurso(session, nome_recurso)
            session.add(
                ExercicioRequisitoRecurso(
                    exercicio_base_id=exercicio.id,
                    recurso_treino_id=recurso.id,
                )
            )

    await session.flush()


async def _sincronizar_disponibilidade_alunos(session) -> None:
    alunos_ids = (await session.execute(select(Aluno.id))).scalars().all()
    recursos_ids = (await session.execute(select(RecursoTreino.id))).scalars().all()
    existentes = set(
        (await session.execute(
            select(
                AlunoRecursoDisponibilidade.aluno_id,
                AlunoRecursoDisponibilidade.recurso_treino_id,
            )
        )).all()
    )

    for aluno_id in alunos_ids:
        for recurso_id in recursos_ids:
            if (aluno_id, recurso_id) in existentes:
                continue
            session.add(
                AlunoRecursoDisponibilidade(
                    aluno_id=aluno_id,
                    recurso_treino_id=recurso_id,
                    disponivel_para_aluno=True,
                )
            )

    await session.flush()


async def _resolver_exercicio_base_id(session, nome: str):
    result = await session.execute(
        select(ExercicioBase).where(ExercicioBase.nome == nome)
    )
    exercicio = result.scalar_one_or_none()
    if exercicio is not None:
        return exercicio.id

    exercicio = ExercicioBase(
        nome=nome,
        grupo_muscular="Outros",
        implemento_execucao=ImplementoExecucao.PESO_CORPO,
        criado_por_sistema=False,
    )
    session.add(exercicio)
    await session.flush()
    return exercicio.id


def _parse_alvo(rep: str | None) -> tuple[AlvoTipo, int | None, int | None, str | None]:
    if rep is None:
        return AlvoTipo.OUTROS, None, None, "Sem alvo"

    texto = rep.strip()
    if not texto:
        return AlvoTipo.OUTROS, None, None, "Sem alvo"

    texto_lower = texto.lower()

    if "passo" in texto_lower:
        numeros = [int(v) for v in re.findall(r"\d+", texto_lower)]
        if numeros:
            minimo = numeros[0]
            maximo = numeros[1] if len(numeros) > 1 else minimo
            return AlvoTipo.PASSOS, minimo, maximo, None
        return AlvoTipo.OUTROS, None, None, texto

    if "seg" in texto_lower or "min" in texto_lower:
        unidades = re.findall(r"(\d+)\s*(seg|s|min)", texto_lower)
        if unidades:
            valores_em_segundos: list[int] = []
            for valor, unidade in unidades:
                numero = int(valor)
                valores_em_segundos.append(numero * 60 if unidade == "min" else numero)
            minimo = valores_em_segundos[0]
            maximo = valores_em_segundos[1] if len(valores_em_segundos) > 1 else minimo
            return AlvoTipo.SEGUNDOS, minimo, maximo, None

        numeros = [int(v) for v in re.findall(r"\d+", texto_lower)]
        if numeros:
            minimo = numeros[0]
            maximo = numeros[1] if len(numeros) > 1 else minimo
            return AlvoTipo.SEGUNDOS, minimo, maximo, None
        return AlvoTipo.OUTROS, None, None, texto

    numeros = [int(v) for v in re.findall(r"\d+", texto_lower)]
    if numeros:
        minimo = numeros[0]
        maximo = numeros[1] if len(numeros) > 1 else minimo
        return AlvoTipo.REPETICOES, minimo, maximo, None

    return AlvoTipo.OUTROS, None, None, texto


def _parse_rer_rm(valor: str | None) -> tuple[RerRmTipo | None, str | None]:
    if valor is None:
        return None, None

    texto = valor.strip()
    if not texto:
        return None, None

    texto_upper = texto.upper()
    if texto_upper == "FALHA":
        return RerRmTipo.RER, "0"
    if "%" in texto or "RM" in texto_upper:
        return RerRmTipo.RM, texto
    return RerRmTipo.RER, texto


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
                        implemento_execucao=ex_data["implemento_execucao"],
                        criado_por_sistema=True,
                    )
                )
            else:
                existing.implemento_execucao = ex_data["implemento_execucao"]

        await _sincronizar_recursos_e_requisitos(session)
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

            await _sincronizar_disponibilidade_alunos(session)

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
                exercicio_base_id = await _resolver_exercicio_base_id(session, ex["nome"])
                alvo_tipo, alvo_valor_min, alvo_valor_max, alvo_outros_texto = _parse_alvo(ex["rep"])
                rer_rm_tipo, rer_rm_valor = _parse_rer_rm(ex["rer"])
                session.add(ExercicioTreino(
                    treino_id=treino.id,
                    exercicio_base_id=exercicio_base_id,
                    ordem=idx,
                    numero_series_prescritas=ex["series"],
                    alvo_tipo=alvo_tipo,
                    alvo_valor_min=alvo_valor_min,
                    alvo_valor_max=alvo_valor_max,
                    alvo_outros_texto=alvo_outros_texto,
                    tecnica=ex["tecnica"],
                    rer_rm_tipo=rer_rm_tipo,
                    rer_rm_valor=rer_rm_valor,
                    descanso_segundos=ex["descanso"],
                    descanso_segundos_min=ex["descanso"],
                    descanso_segundos_max=ex["descanso"],
                    observacoes=ex["obs"],
                ))

        await session.commit()
        total_ex = sum(len(t["exercicios"]) for t in TREINOS)
        print(f"Seed treino: '{CONJUNTO_NOME}' criado com {len(TREINOS)} treinos e {total_ex} exercícios.")


if __name__ == "__main__":
    asyncio.run(seed())
