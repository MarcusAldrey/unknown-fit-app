"""
Seed idempotente para ExercicioBase e usuários de demonstração.
Executar: python -m app.seed
"""
import asyncio
import json
import re
from datetime import date
from pathlib import Path

from sqlalchemy import select

from app.config import get_settings
from app.database import engine, async_session, Base
from app.domain.enums import AlvoTipo, ImplementoExecucao, RerRmTipo, Tecnica
from app.models import (
    AlunoRecursoDisponibilidade,
    ExercicioBase,
    ExercicioRequisitoRecurso,
    RecursoTreino,
)
from app.models.usuario import Usuario, Role
from app.models.personal import Personal
from app.models.aluno import Aluno
from app.models.vinculo import VinculoPersonalAluno
from app.models.conjunto_treino import ConjuntoTreino
from app.models.treino import Treino
from app.models.exercicio_treino import ExercicioTreino
from app.services.auth import hash_senha
from app.services.disponibilidade import ensure_disponibilidade_rows

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


def _parse_tecnica(valor: str | None) -> Tecnica:
    if not valor:
        return Tecnica.PADRAO
    normalizado = valor.strip().lower()
    if "isometria" in normalizado:
        return Tecnica.ISOMETRIA
    if "instabilidade" in normalizado:
        return Tecnica.INSTABILIDADE
    return Tecnica.PADRAO


def _extrair_segundos(parte: str) -> int | None:
    mm_ss = re.match(r"(\d+):(\d+)\s*min", parte)
    if mm_ss:
        return int(mm_ss.group(1)) * 60 + int(mm_ss.group(2))
    minutos = re.search(r"(\d+)\s*min", parte)
    if minutos:
        return int(minutos.group(1)) * 60
    segundos = re.search(r"(\d+)\s*seg", parte)
    if segundos:
        return int(segundos.group(1))
    return None


def _parse_descanso(valor: str | None) -> tuple[int | None, int | None]:
    if not valor:
        return None, None

    partes = valor.lower().split(" a ")
    valores: list[int] = []
    for parte in partes:
        segundos = _extrair_segundos(parte)
        if segundos is not None:
            valores.append(segundos)

    if not valores:
        return None, None
    return min(valores), max(valores)


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

    if _is_production():
        print("Ambiente de produção: usuários de demonstração ignorados.")
        return

    await _seed_usuarios_demonstracao()
    await _seed_treino_aldrey_ciclo1()


def _is_production() -> bool:
    return (get_settings().environment or "").strip().lower() == "production"


async def _seed_usuarios_demonstracao():
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

        # Personal customizado (abreu)
        result = await session.execute(
            select(Usuario).where(Usuario.email == "abreu@ecg.com")
        )
        abreu_user = result.scalar_one_or_none()
        if abreu_user is None:
            abreu_user = Usuario(
                nome="Abreu",
                email="abreu@ecg.com",
                senha_hash=hash_senha("654321*"),
                role=Role.PERSONAL,
            )
            session.add(abreu_user)
            await session.flush()
            session.add(Personal(usuario_id=abreu_user.id))
            await session.flush()

        # Aluno customizado (aldrey)
        result = await session.execute(
            select(Usuario).where(Usuario.email == "aldrey@ecg.com")
        )
        aldrey_user = result.scalar_one_or_none()
        if aldrey_user is None:
            aldrey_user = Usuario(
                nome="Aldrey",
                email="aldrey@ecg.com",
                senha_hash=hash_senha("654321*"),
                role=Role.ALUNO,
            )
            session.add(aldrey_user)
            await session.flush()
            session.add(Aluno(usuario_id=aldrey_user.id, idade=30, peso=80.0, altura=1.80))
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

            await ensure_disponibilidade_rows(session, aluno.id)

        # Vincular abreu <-> aldrey
        result_abreu = await session.execute(
            select(Personal).join(Usuario).where(Usuario.email == "abreu@ecg.com")
        )
        abreu = result_abreu.scalar_one_or_none()
        result_aldrey = await session.execute(
            select(Aluno).join(Usuario).where(Usuario.email == "aldrey@ecg.com")
        )
        aldrey = result_aldrey.scalar_one_or_none()
        if abreu and aldrey:
            result_v = await session.execute(
                select(VinculoPersonalAluno).where(
                    VinculoPersonalAluno.personal_id == abreu.id,
                    VinculoPersonalAluno.aluno_id == aldrey.id,
                )
            )
            if result_v.scalar_one_or_none() is None:
                session.add(VinculoPersonalAluno(
                    personal_id=abreu.id,
                    aluno_id=aldrey.id,
                    ativo=True,
                ))
            await ensure_disponibilidade_rows(session, aldrey.id)

        await session.commit()
        print("Usuários de teste criados:")
        print("  Personal: personal@ecg.com / 123456")
        print("  Aluno:    aluno@ecg.com / 123456")
        print("  Personal: abreu@ecg.com / 654321*")
        print("  Aluno:    aldrey@ecg.com / 654321*")


_SEED_TREINO_JSON = Path(__file__).resolve().parents[1] / "seeds" / "treino_aldrey_ciclo1.json"


async def _seed_treino_aldrey_ciclo1():
    """Cria o ConjuntoTreino 'Aldrey - Ciclo 1' para aluno@ecg.com (idempotente)."""
    if not _SEED_TREINO_JSON.exists():
        print("Seed treino: arquivo JSON não encontrado, pulando fixture.")
        return

    fixture = json.loads(_SEED_TREINO_JSON.read_text(encoding="utf-8"))
    conjunto_nome = fixture["nome"]

    async with async_session() as session:
        result_a = await session.execute(
            select(Aluno).join(Usuario).where(Usuario.email == "aluno@ecg.com")
        )
        aluno = result_a.scalar_one_or_none()
        if aluno is None:
            print("Seed treino: aluno@ecg.com não encontrado, pulando fixture de treino.")
            return

        result_c = await session.execute(
            select(ConjuntoTreino).where(
                ConjuntoTreino.aluno_id == aluno.id,
                ConjuntoTreino.nome == conjunto_nome,
            )
        )
        if result_c.scalar_one_or_none() is not None:
            print(f"Seed treino: conjunto '{conjunto_nome}' já existe, pulando.")
            return

        conjunto = ConjuntoTreino(
            aluno_id=aluno.id,
            nome=conjunto_nome,
            ativo=True,
            data_inicio=date(2026, 2, 8),
        )
        session.add(conjunto)
        await session.flush()

        total_exercicios = 0
        for treino_data in fixture["treinos"]:
            treino = Treino(
                conjunto_treino_id=conjunto.id,
                codigo=treino_data["treino"],
                nome=treino_data["foco"],
                ordem=0,
            )
            session.add(treino)
            await session.flush()

            for idx, ex in enumerate(treino_data["exercicios"]):
                exercicio_base_id = await _resolver_exercicio_base_id(session, ex["nome"])

                rep = ex.get("repeticoes") or ex.get("duracao")
                if ex.get("passos_minimos") is not None:
                    rep = f"{ex['passos_minimos']} passos mínimos"
                alvo_tipo, alvo_valor_min, alvo_valor_max, alvo_outros_texto = _parse_alvo(rep)
                rer_rm_tipo, rer_rm_valor = _parse_rer_rm(ex.get("rer_rm"))
                descanso_min, descanso_max = _parse_descanso(ex.get("descanso"))

                session.add(ExercicioTreino(
                    treino_id=treino.id,
                    exercicio_base_id=exercicio_base_id,
                    ordem=idx,
                    numero_series_prescritas=ex["series"],
                    alvo_tipo=alvo_tipo,
                    alvo_valor_min=alvo_valor_min,
                    alvo_valor_max=alvo_valor_max,
                    alvo_outros_texto=alvo_outros_texto,
                    tecnica=_parse_tecnica(ex.get("tecnica")),
                    rer_rm_tipo=rer_rm_tipo,
                    rer_rm_valor=rer_rm_valor,
                    descanso_segundos=descanso_max,
                    descanso_segundos_min=descanso_min,
                    descanso_segundos_max=descanso_max,
                    observacoes=ex.get("observacoes"),
                ))
                total_exercicios += 1

        await session.commit()
        total_treinos = len(fixture["treinos"])
        print(f"Seed treino: '{conjunto_nome}' criado com {total_treinos} treinos e {total_exercicios} exercícios.")


if __name__ == "__main__":
    asyncio.run(seed())
