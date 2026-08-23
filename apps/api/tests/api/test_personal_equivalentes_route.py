import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.deps import get_current_personal
from app.main import app
from app.routers import personal as personal_router


@pytest.fixture(autouse=True)
def _clear_dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def dummy_db():
    return SimpleNamespace()


@pytest.fixture
def dummy_personal():
    return SimpleNamespace(id=uuid.uuid4())


@pytest.fixture
def personal_overrides(dummy_db, dummy_personal):
    async def _override_get_db():
        yield dummy_db

    async def _override_get_current_personal():
        return dummy_personal

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_personal] = _override_get_current_personal


async def test_put_equivalentes_retorna_lista_do_servico(
    monkeypatch: pytest.MonkeyPatch,
    personal_overrides,
    dummy_db,
):
    exercicio_id = uuid.uuid4()
    treino_id = uuid.uuid4()
    equivalente_id = uuid.uuid4()

    exercicio_stub = SimpleNamespace(id=exercicio_id, treino_id=treino_id)
    helper_mock = AsyncMock(return_value=exercicio_stub)
    service_saida = [
        SimpleNamespace(
            id=uuid.uuid4(),
            exercicio_treino_id=exercicio_id,
            exercicio_equivalente_treino_id=equivalente_id,
            nome_exercicio="Leg Press",
            ordem=1,
        )
    ]
    service_mock = AsyncMock(return_value=service_saida)

    monkeypatch.setattr(personal_router, "_get_exercicio_treino_vinculado", helper_mock)
    monkeypatch.setattr(personal_router, "substituir_equivalentes_no_treino", service_mock)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put(
            f"/api/v1/personal/exercicios/{exercicio_id}/equivalentes",
            json={"exercicios_equivalentes_ids": [str(equivalente_id)]},
        )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["exercicio_treino_id"] == str(exercicio_id)
    assert data[0]["exercicio_equivalente_treino_id"] == str(equivalente_id)
    assert data[0]["nome_exercicio"] == "Leg Press"
    assert data[0]["ordem"] == 1

    helper_mock.assert_awaited_once()
    service_mock.assert_awaited_once_with(
        db=dummy_db,
        treino_id=treino_id,
        exercicio_id=exercicio_id,
        equivalentes_ids=[equivalente_id],
    )


async def test_put_equivalentes_retorna_404_quando_exercicio_nao_encontrado(
    monkeypatch: pytest.MonkeyPatch,
    personal_overrides,
):
    exercicio_id = uuid.uuid4()

    async def _helper_404(*args, **kwargs):
        raise HTTPException(status_code=404, detail="Exercício não encontrado")

    monkeypatch.setattr(personal_router, "_get_exercicio_treino_vinculado", _helper_404)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put(
            f"/api/v1/personal/exercicios/{exercicio_id}/equivalentes",
            json={"exercicios_equivalentes_ids": []},
        )

    assert response.status_code == 404
    assert response.json()["detail"] == "Exercício não encontrado"


async def test_put_equivalentes_retorna_422_para_ids_duplicados(
    monkeypatch: pytest.MonkeyPatch,
    personal_overrides,
):
    exercicio_id = uuid.uuid4()
    treino_id = uuid.uuid4()
    equivalente_id = uuid.uuid4()

    exercicio_stub = SimpleNamespace(id=exercicio_id, treino_id=treino_id)
    monkeypatch.setattr(
        personal_router,
        "_get_exercicio_treino_vinculado",
        AsyncMock(return_value=exercicio_stub),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put(
            f"/api/v1/personal/exercicios/{exercicio_id}/equivalentes",
            json={
                "exercicios_equivalentes_ids": [
                    str(equivalente_id),
                    str(equivalente_id),
                ]
            },
        )

    assert response.status_code == 422
    erros = response.json()["detail"]
    assert any("Não é permitido repetir exercícios equivalentes" in str(item) for item in erros)
