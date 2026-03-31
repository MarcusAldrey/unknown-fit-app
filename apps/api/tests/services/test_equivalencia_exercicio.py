import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException

import app.services.equivalencia_exercicio as equivalencia_service
from app.services.equivalencia_exercicio import (
    calcular_bloco_limpeza_equivalencia,
    calcular_bloco_equivalencia,
    montar_nova_ordem_com_bloco,
    reordenar_ordens_exercicios_do_treino,
    substituir_equivalentes_no_treino,
)


def _novo_id() -> uuid.UUID:
    return uuid.uuid4()


class FakeEquivalenciaRepo:
    def __init__(self):
        self.ids_treino: list[uuid.UUID] = []
        self.arestas: list[tuple[uuid.UUID, uuid.UUID]] = []
        self.ids_existentes: list[uuid.UUID] = []
        self.exercicios_ordenados: list[SimpleNamespace] = []
        self.equivalentes_saida: list[SimpleNamespace] = []

        self.removidos_ids: set[uuid.UUID] | None = None
        self.bloco_criado_ids: list[uuid.UUID] | None = None

    async def listar_ids_exercicios_treino(self, treino_id: uuid.UUID) -> list[uuid.UUID]:
        return self.ids_treino

    async def listar_arestas_equivalencia(
        self,
        exercicios_ids: list[uuid.UUID],
    ) -> list[tuple[uuid.UUID, uuid.UUID]]:
        return self.arestas

    async def listar_ids_exercicios_existentes_no_treino(
        self,
        treino_id: uuid.UUID,
        exercicios_ids: list[uuid.UUID],
    ) -> list[uuid.UUID]:
        return self.ids_existentes

    async def listar_exercicios_ordenados(self, treino_id: uuid.UUID) -> list[SimpleNamespace]:
        return self.exercicios_ordenados

    async def remover_equivalencias_relacionadas(self, exercicios_ids: set[uuid.UUID]) -> None:
        self.removidos_ids = set(exercicios_ids)

    async def criar_bloco_equivalencias_completo(
        self,
        bloco_ids_ordenados: list[uuid.UUID],
    ) -> None:
        self.bloco_criado_ids = list(bloco_ids_ordenados)

    async def listar_equivalentes_do_exercicio(
        self,
        exercicio_id: uuid.UUID,
    ) -> list[SimpleNamespace]:
        return self.equivalentes_saida

    async def remover_equivalencias_do_exercicio(self, exercicio_id: uuid.UUID) -> None:
        self.removidos_ids = {exercicio_id}


def _patch_repo(monkeypatch: pytest.MonkeyPatch, repo: FakeEquivalenciaRepo) -> None:
    monkeypatch.setattr(
        equivalencia_service,
        "EquivalenciaExercicioRepository",
        lambda db: repo,
    )


def test_calcular_bloco_equivalencia_retorna_componente_conexa() -> None:
    a = _novo_id()
    b = _novo_id()
    c = _novo_id()
    d = _novo_id()
    e = _novo_id()

    exercicios_ids = [a, b, c, d, e]
    equivalencias = [
        (a, b),
        (b, c),
        (d, e),
    ]

    bloco = calcular_bloco_equivalencia(
        exercicio_base_id=b,
        exercicios_ids=exercicios_ids,
        equivalencias=equivalencias,
    )

    assert bloco == {a, b, c}


def test_calcular_bloco_equivalencia_base_fora_do_treino() -> None:
    a = _novo_id()
    b = _novo_id()
    fora = _novo_id()

    bloco = calcular_bloco_equivalencia(
        exercicio_base_id=fora,
        exercicios_ids=[a, b],
        equivalencias=[(a, b)],
    )

    assert bloco == {fora}


def test_montar_nova_ordem_com_bloco_move_equivalentes_para_depois_da_base() -> None:
    a = _novo_id()
    b = _novo_id()
    c = _novo_id()
    d = _novo_id()
    e = _novo_id()
    inexistente = _novo_id()

    nova_ordem = montar_nova_ordem_com_bloco(
        ordem_atual_ids=[a, b, c, d, e],
        exercicio_base_id=d,
        equivalentes_ids=[b, e, b, inexistente, d],
    )

    assert nova_ordem == [a, c, d, b, e]


def test_montar_nova_ordem_com_bloco_sem_equivalentes_validos() -> None:
    a = _novo_id()
    b = _novo_id()
    c = _novo_id()

    nova_ordem = montar_nova_ordem_com_bloco(
        ordem_atual_ids=[a, b, c],
        exercicio_base_id=b,
        equivalentes_ids=[b],
    )

    assert nova_ordem == [a, b, c]


def test_montar_nova_ordem_com_bloco_base_inexistente() -> None:
    a = _novo_id()
    b = _novo_id()
    base_inexistente = _novo_id()

    nova_ordem = montar_nova_ordem_com_bloco(
        ordem_atual_ids=[a, b],
        exercicio_base_id=base_inexistente,
        equivalentes_ids=[a],
    )

    assert nova_ordem == [a, b]


def test_calcular_bloco_limpeza_equivalencia_uniao_de_blocos() -> None:
    a = _novo_id()
    b = _novo_id()
    c = _novo_id()
    d = _novo_id()
    e = _novo_id()

    bloco_limpeza = calcular_bloco_limpeza_equivalencia(
        exercicio_base_id=a,
        equivalentes_ids=[d],
        exercicios_ids=[a, b, c, d, e],
        equivalencias=[
            (a, b),
            (b, c),
            (d, e),
        ],
    )

    assert bloco_limpeza == {a, b, c, d, e}


def test_calcular_bloco_limpeza_equivalencia_com_equivalente_fora_do_treino() -> None:
    a = _novo_id()
    b = _novo_id()
    fora = _novo_id()

    bloco_limpeza = calcular_bloco_limpeza_equivalencia(
        exercicio_base_id=a,
        equivalentes_ids=[fora],
        exercicios_ids=[a, b],
        equivalencias=[(a, b)],
    )

    assert bloco_limpeza == {a, b, fora}


@pytest.mark.asyncio
async def test_substituir_equivalentes_rejeita_ids_fora_do_treino(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repo = FakeEquivalenciaRepo()
    repo.ids_existentes = [_novo_id()]
    _patch_repo(monkeypatch, repo)

    db = SimpleNamespace(flush=AsyncMock())
    treino_id = _novo_id()
    exercicio_id = _novo_id()
    equivalente_valido = repo.ids_existentes[0]
    equivalente_invalido = _novo_id()

    with pytest.raises(HTTPException) as exc_info:
        await substituir_equivalentes_no_treino(
            db=db,
            treino_id=treino_id,
            exercicio_id=exercicio_id,
            equivalentes_ids=[equivalente_valido, equivalente_invalido],
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "Todos os equivalentes devem pertencer ao mesmo treino"
    assert db.flush.await_count == 0


@pytest.mark.asyncio
async def test_substituir_equivalentes_limpa_bloco_ao_zerar(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    base = _novo_id()
    eq1 = _novo_id()
    eq2 = _novo_id()
    outro = _novo_id()

    repo = FakeEquivalenciaRepo()
    repo.ids_treino = [base, eq1, eq2, outro]
    repo.arestas = [(base, eq1), (eq1, eq2)]
    repo.exercicios_ordenados = [
        SimpleNamespace(id=outro, ordem=1),
        SimpleNamespace(id=base, ordem=2),
        SimpleNamespace(id=eq1, ordem=3),
        SimpleNamespace(id=eq2, ordem=4),
    ]
    repo.equivalentes_saida = []
    _patch_repo(monkeypatch, repo)

    db = SimpleNamespace(flush=AsyncMock())

    resultado = await substituir_equivalentes_no_treino(
        db=db,
        treino_id=_novo_id(),
        exercicio_id=base,
        equivalentes_ids=[],
    )

    assert repo.removidos_ids == {base, eq1, eq2}
    assert repo.bloco_criado_ids == [base]
    assert resultado == []
    assert db.flush.await_count == 2


@pytest.mark.asyncio
async def test_substituir_equivalentes_mescla_blocos_e_respeita_ordem(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    a = _novo_id()
    b = _novo_id()
    c = _novo_id()
    d = _novo_id()
    e = _novo_id()

    repo = FakeEquivalenciaRepo()
    repo.ids_existentes = [a, e]
    repo.ids_treino = [a, b, c, d, e]
    repo.arestas = [(a, b), (c, d)]
    repo.exercicios_ordenados = [
        SimpleNamespace(id=a, ordem=1),
        SimpleNamespace(id=b, ordem=2),
        SimpleNamespace(id=c, ordem=3),
        SimpleNamespace(id=d, ordem=4),
        SimpleNamespace(id=e, ordem=5),
    ]
    repo.equivalentes_saida = [SimpleNamespace(exercicio_equivalente_treino_id=a, ordem=1)]
    _patch_repo(monkeypatch, repo)

    db = SimpleNamespace(flush=AsyncMock())

    resultado = await substituir_equivalentes_no_treino(
        db=db,
        treino_id=_novo_id(),
        exercicio_id=c,
        equivalentes_ids=[a, e],
    )

    assert repo.removidos_ids == {a, b, c, d, e}
    assert repo.bloco_criado_ids == [a, c, e]
    assert resultado == repo.equivalentes_saida
    assert db.flush.await_count == 3


@pytest.mark.asyncio
async def test_reordenar_ordens_exercicios_do_treino_corrige_sequencia(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    repo = FakeEquivalenciaRepo()
    repo.exercicios_ordenados = [
        SimpleNamespace(id=_novo_id(), ordem=3),
        SimpleNamespace(id=_novo_id(), ordem=1),
        SimpleNamespace(id=_novo_id(), ordem=8),
    ]
    _patch_repo(monkeypatch, repo)

    db = SimpleNamespace(flush=AsyncMock())

    await reordenar_ordens_exercicios_do_treino(db, _novo_id())

    assert [item.ordem for item in repo.exercicios_ordenados] == [1, 2, 3]
    assert db.flush.await_count == 1
