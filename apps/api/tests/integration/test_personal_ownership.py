import pytest
from httpx import AsyncClient

from tests.integration.conftest import _auth
from tests.integration.helpers import setup_estrutura_personal_b


@pytest.fixture
async def estrutura_b(client, admin_headers):
    return await setup_estrutura_personal_b(client, admin_headers)


async def test_listar_treinos_de_conjunto_alheio_bloqueado(
    client: AsyncClient, personal_token: str, estrutura_b: dict
):
    resp = await client.get(
        f"/api/v1/personal/conjuntos/{estrutura_b['conjunto_b']['id']}/treinos",
        headers=_auth(personal_token),
    )
    assert resp.status_code in (403, 404)


async def test_criar_treino_em_conjunto_alheio_bloqueado(
    client: AsyncClient, personal_token: str, estrutura_b: dict
):
    resp = await client.post(
        f"/api/v1/personal/conjuntos/{estrutura_b['conjunto_b']['id']}/treinos",
        headers=_auth(personal_token),
        json={"codigo": "Z", "nome": "Treino intruso", "ordem": 1},
    )
    assert resp.status_code in (403, 404)


async def test_editar_treino_alheio_bloqueado(
    client: AsyncClient, personal_token: str, estrutura_b: dict
):
    resp = await client.patch(
        f"/api/v1/personal/treinos/{estrutura_b['treino_b']['id']}",
        headers=_auth(personal_token),
        json={"nome": "Treino hackeado"},
    )
    assert resp.status_code in (403, 404)


async def test_listar_exercicios_de_treino_alheio_bloqueado(
    client: AsyncClient, personal_token: str, estrutura_b: dict
):
    resp = await client.get(
        f"/api/v1/personal/treinos/{estrutura_b['treino_b']['id']}/exercicios",
        headers=_auth(personal_token),
    )
    assert resp.status_code in (403, 404)


async def test_deletar_exercicio_alheio_bloqueado(
    client: AsyncClient, personal_token: str, estrutura_b: dict
):
    resp = await client.delete(
        f"/api/v1/personal/exercicios/{estrutura_b['exercicio_b']['id']}",
        headers=_auth(personal_token),
    )
    assert resp.status_code in (403, 404)
