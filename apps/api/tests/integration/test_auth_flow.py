from httpx import AsyncClient

from tests.integration.conftest import _auth


async def test_login_retorna_tokens_e_role(client: AsyncClient):
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "personal@kine.com", "senha": "123456"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["access_token"]
    assert data["refresh_token"]
    assert data["role"] == "PERSONAL"


async def test_me_retorna_role_personal(client: AsyncClient, personal_token: str):
    resp = await client.get("/api/v1/auth/me", headers=_auth(personal_token))
    assert resp.status_code == 200
    assert resp.json()["role"] == "PERSONAL"


async def test_refresh_retorna_novos_tokens(client: AsyncClient, personal_token: str):
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "personal@kine.com", "senha": "123456"},
    )
    refresh_token = login.json()["refresh_token"]

    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert resp.status_code == 200
    assert resp.json()["access_token"]


async def test_aluno_token_nao_acessa_rota_personal(client: AsyncClient, aluno_token: str):
    resp = await client.get("/api/v1/personal/alunos", headers=_auth(aluno_token))
    assert resp.status_code == 403


async def test_logout_revoga_refresh_token(client: AsyncClient):
    login = await client.post(
        "/api/v1/auth/login",
        json={"email": "personal@kine.com", "senha": "123456"},
    )
    assert login.status_code == 200
    refresh_token = login.json()["refresh_token"]

    logout = await client.post(
        "/api/v1/auth/logout", json={"refresh_token": refresh_token}
    )
    assert logout.status_code == 200

    resp = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": refresh_token}
    )
    assert resp.status_code == 401
