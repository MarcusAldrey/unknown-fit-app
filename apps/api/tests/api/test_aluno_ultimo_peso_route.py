import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.deps import get_current_aluno
from app.main import app


class DummyScalarResult:
    def __init__(self, value):
        self.value = value

    def scalar_one_or_none(self):
        return self.value


@pytest.fixture(autouse=True)
def _clear_dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def dummy_db():
    return SimpleNamespace(execute=AsyncMock())


@pytest.fixture
def dummy_aluno():
    return SimpleNamespace(id=uuid.uuid4())


@pytest.fixture
def aluno_overrides(dummy_db, dummy_aluno):
    async def _override_get_db():
        yield dummy_db

    async def _override_get_current_aluno():
        return dummy_aluno

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_aluno] = _override_get_current_aluno


async def test_get_ultimo_peso_retorna_peso_e_repeticoes(aluno_overrides, dummy_db):
    exercicio_id = uuid.uuid4()
    dummy_db.execute.side_effect = [
        DummyScalarResult(82.5),
        DummyScalarResult(11),
    ]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(f"/api/v1/aluno/exercicios/{exercicio_id}/ultimo-peso")

    assert response.status_code == 200
    payload = response.json()
    assert payload["exercicio_treino_id"] == str(exercicio_id)
    assert payload["peso_utilizado"] == 82.5
    assert payload["repeticoes_realizadas"] == 11
    assert dummy_db.execute.await_count == 2


async def test_get_ultimo_peso_retorna_nulos_quando_sem_historico(aluno_overrides, dummy_db):
    exercicio_id = uuid.uuid4()
    dummy_db.execute.side_effect = [
        DummyScalarResult(None),
        DummyScalarResult(None),
    ]

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(f"/api/v1/aluno/exercicios/{exercicio_id}/ultimo-peso")

    assert response.status_code == 200
    payload = response.json()
    assert payload["exercicio_treino_id"] == str(exercicio_id)
    assert payload["peso_utilizado"] is None
    assert payload["repeticoes_realizadas"] is None
    assert dummy_db.execute.await_count == 2
