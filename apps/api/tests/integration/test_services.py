import uuid

import pytest

from app.domain.enums import AlvoTipo
from app.exceptions import DomainValidationError, NotFoundError
from app.models import (
    Aluno,
    ConjuntoTreino,
    ExercicioBase,
    ExercicioTreino,
    Role,
    SessaoTreino,
    StatusSessao,
    Treino,
    Usuario,
)
from app.schemas import SerieCreate
from app.services.periodizacao import ativar_conjunto
from app.services.sessao import registrar_serie


async def _criar_aluno(db) -> Aluno:
    usuario = Usuario(
        nome="Aluno Teste",
        email=f"aluno.{uuid.uuid4().hex}@ecg.com",
        senha_hash="x",
        role=Role.ALUNO,
    )
    db.add(usuario)
    await db.flush()
    aluno = Aluno(usuario_id=usuario.id)
    db.add(aluno)
    await db.flush()
    return aluno


async def _criar_treino(db, aluno: Aluno) -> tuple[ConjuntoTreino, Treino]:
    conjunto = ConjuntoTreino(aluno_id=aluno.id, nome="Conjunto Teste", ativo=True)
    db.add(conjunto)
    await db.flush()
    treino = Treino(conjunto_treino_id=conjunto.id, codigo="A", nome="Treino", ordem=1)
    db.add(treino)
    await db.flush()
    return conjunto, treino


async def _criar_exercicio(db, treino: Treino, nome: str, ordem: int) -> ExercicioTreino:
    base = ExercicioBase(nome=nome, grupo_muscular="Peito", criado_por_sistema=False)
    db.add(base)
    await db.flush()
    exercicio = ExercicioTreino(
        treino_id=treino.id,
        exercicio_base_id=base.id,
        ordem=ordem,
        numero_series_prescritas=3,
        alvo_tipo=AlvoTipo.REPETICOES,
        alvo_valor_min=8,
        alvo_valor_max=12,
    )
    db.add(exercicio)
    await db.flush()
    return exercicio


async def test_ativar_conjunto_desativa_sibling(db_session):
    aluno = await _criar_aluno(db_session)
    conjunto_a = ConjuntoTreino(aluno_id=aluno.id, nome="A", ativo=True)
    db_session.add(conjunto_a)
    await db_session.flush()
    conjunto_b = ConjuntoTreino(aluno_id=aluno.id, nome="B", ativo=False)
    db_session.add(conjunto_b)
    await db_session.flush()

    await ativar_conjunto(db_session, conjunto_b)

    await db_session.refresh(conjunto_a)
    await db_session.refresh(conjunto_b)
    assert conjunto_b.ativo is True
    assert conjunto_a.ativo is False
    assert conjunto_a.data_fim is not None


async def _estrutura_sessao(db):
    aluno = await _criar_aluno(db)
    conjunto, treino = await _criar_treino(db, aluno)
    exercicio = await _criar_exercicio(db, treino, "Ex1", 1)
    sessao = SessaoTreino(aluno_id=aluno.id, treino_id=treino.id)
    db.add(sessao)
    await db.flush()
    return aluno, treino, exercicio, sessao


async def test_registrar_serie_happy_path(db_session):
    aluno, treino, exercicio, sessao = await _estrutura_sessao(db_session)

    serie = await registrar_serie(
        db_session,
        aluno,
        sessao.id,
        SerieCreate(
            exercicio_treino_id=exercicio.id,
            numero_serie=1,
            peso_utilizado=40.0,
            repeticoes_realizadas=10,
        ),
    )

    assert serie.id is not None
    assert serie.numero_serie == 1


async def test_registrar_serie_rejeita_exercicio_de_outro_treino(db_session):
    aluno, treino, exercicio, sessao = await _estrutura_sessao(db_session)
    _, outro_treino = await _criar_treino(db_session, aluno)
    exercicio_fora = await _criar_exercicio(db_session, outro_treino, "ExFora", 1)

    with pytest.raises(DomainValidationError):
        await registrar_serie(
            db_session,
            aluno,
            sessao.id,
            SerieCreate(exercicio_treino_id=exercicio_fora.id, numero_serie=1),
        )


async def test_registrar_serie_rejeita_executado_de_outro_treino(db_session):
    aluno, treino, exercicio, sessao = await _estrutura_sessao(db_session)
    _, outro_treino = await _criar_treino(db_session, aluno)
    exercicio_fora = await _criar_exercicio(db_session, outro_treino, "ExFora", 1)

    with pytest.raises(DomainValidationError):
        await registrar_serie(
            db_session,
            aluno,
            sessao.id,
            SerieCreate(
                exercicio_treino_id=exercicio.id,
                exercicio_treino_executado_id=exercicio_fora.id,
                numero_serie=1,
            ),
        )


async def test_registrar_serie_rejeita_executado_nao_equivalente(db_session):
    aluno, treino, exercicio, sessao = await _estrutura_sessao(db_session)
    outro_exercicio = await _criar_exercicio(db_session, treino, "Ex2", 2)

    with pytest.raises(DomainValidationError):
        await registrar_serie(
            db_session,
            aluno,
            sessao.id,
            SerieCreate(
                exercicio_treino_id=exercicio.id,
                exercicio_treino_executado_id=outro_exercicio.id,
                numero_serie=1,
            ),
        )


async def test_registrar_serie_rejeita_sessao_finalizada(db_session):
    aluno, treino, exercicio, sessao = await _estrutura_sessao(db_session)
    sessao.status = StatusSessao.FINALIZADO
    await db_session.flush()

    with pytest.raises(NotFoundError):
        await registrar_serie(
            db_session,
            aluno,
            sessao.id,
            SerieCreate(exercicio_treino_id=exercicio.id, numero_serie=1),
        )
