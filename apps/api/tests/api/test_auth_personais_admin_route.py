import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_db
from app.main import app
from app.models import Role
from app.routers import admin as admin_router


@pytest.fixture(autouse=True)
def _clear_dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def dummy_db():
    class DummyDB:
        def __init__(self):
            self.added = []
            self.flush = AsyncMock()
            self.delete = AsyncMock()
            self.execute = AsyncMock()

        def add(self, obj):
            self.added.append(obj)

    return DummyDB()


@pytest.fixture
def db_override(dummy_db):
    async def _override_get_db():
        yield dummy_db

    app.dependency_overrides[get_db] = _override_get_db


async def test_criar_personal_exige_admin_key(db_override):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/admin/personais",
            json={
                "nome": "Personal Novo",
                "email": "personal.novo@ecg.com",
                "senha": "senha123",
            },
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Admin key inválida"


async def test_criar_personal_com_admin_key_retorna_201(
    monkeypatch: pytest.MonkeyPatch,
    db_override,
    dummy_db,
):
    monkeypatch.setattr(
        admin_router,
        "_buscar_usuario_por_email",
        AsyncMock(return_value=None),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/admin/personais",
            headers={"X-Admin-Key": "dev-admin-key-change-in-production"},
            json={
                "nome": "Personal Novo",
                "email": "personal.novo@ecg.com",
                "senha": "senha123",
            },
        )

    assert response.status_code == 201
    payload = response.json()
    assert payload["nome"] == "Personal Novo"
    assert payload["email"] == "personal.novo@ecg.com"
    assert payload["role"] == "PERSONAL"
    assert payload["ativo"] is True
    assert payload["personal_id"]
    assert payload["usuario_id"]
    assert len(dummy_db.added) == 2
    assert dummy_db.flush.await_count == 2


async def test_criar_aluno_com_admin_key_retorna_201(
    monkeypatch: pytest.MonkeyPatch,
    db_override,
    dummy_db,
):
    monkeypatch.setattr(
        admin_router,
        "_buscar_usuario_por_email",
        AsyncMock(return_value=None),
    )

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/admin/alunos",
            headers={"X-Admin-Key": "dev-admin-key-change-in-production"},
            json={
                "nome": "Aluno Novo",
                "email": "aluno.novo@ecg.com",
                "senha": "senha123",
                "idade": 25,
                "peso": 78.5,
                "altura": 1.8,
                "treina_em_academia_condominio": True,
            },
        )

    assert response.status_code == 201
    payload = response.json()
    assert payload["nome"] == "Aluno Novo"
    assert payload["email"] == "aluno.novo@ecg.com"
    assert payload["role"] == "ALUNO"
    assert payload["ativo"] is True
    assert payload["idade"] == 25
    assert payload["treina_em_academia_condominio"] is True
    assert payload["aluno_id"]
    assert payload["usuario_id"]
    assert len(dummy_db.added) == 2
    assert dummy_db.flush.await_count == 3
    assert dummy_db.execute.await_count == 1


async def test_remover_personal_apaga_personal_e_usuario(
    monkeypatch: pytest.MonkeyPatch,
    db_override,
    dummy_db,
):
    personal_id = uuid.uuid4()
    usuario = SimpleNamespace(
        id=uuid.uuid4(),
        nome="Personal X",
        email="personal.x@ecg.com",
        ativo=True,
        role=Role.PERSONAL,
    )
    personal = SimpleNamespace(id=personal_id, usuario=usuario)

    buscar_personal_mock = AsyncMock(return_value=personal)
    dummy_db.execute = AsyncMock()

    monkeypatch.setattr(admin_router, "_buscar_personal_por_id", buscar_personal_mock)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.delete(
            f"/api/v1/admin/personais/{personal_id}",
            headers={"X-Admin-Key": "dev-admin-key-change-in-production"},
        )

    assert response.status_code == 204
    buscar_personal_mock.assert_awaited_once()
    assert dummy_db.execute.await_count == 1
    assert dummy_db.delete.await_count == 2


async def test_remover_aluno_apaga_aluno_e_usuario(
    monkeypatch: pytest.MonkeyPatch,
    db_override,
    dummy_db,
):
    aluno_id = uuid.uuid4()
    usuario = SimpleNamespace(
        id=uuid.uuid4(),
        nome="Aluno X",
        email="aluno.x@ecg.com",
        ativo=True,
        role=Role.ALUNO,
    )
    aluno = SimpleNamespace(id=aluno_id, usuario=usuario)

    buscar_aluno_mock = AsyncMock(return_value=aluno)
    hard_delete_mock = AsyncMock()

    monkeypatch.setattr(admin_router, "_buscar_aluno_por_id", buscar_aluno_mock)
    monkeypatch.setattr(admin_router, "_hard_delete_aluno_dependencias", hard_delete_mock)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.delete(
            f"/api/v1/admin/alunos/{aluno_id}",
            headers={"X-Admin-Key": "dev-admin-key-change-in-production"},
        )

    assert response.status_code == 204
    buscar_aluno_mock.assert_awaited_once()
    hard_delete_mock.assert_awaited_once_with(dummy_db, aluno_id)
    assert dummy_db.delete.await_count == 2


async def test_rota_antiga_de_personais_saiu_do_auth(db_override):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/auth/personais",
            headers={"X-Admin-Key": "dev-admin-key-change-in-production"},
            json={
                "nome": "Personal Antigo",
                "email": "personal.antigo@ecg.com",
                "senha": "senha123",
            },
        )

    assert response.status_code == 404
