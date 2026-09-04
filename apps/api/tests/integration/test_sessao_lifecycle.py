from httpx import AsyncClient

from tests.integration.conftest import _auth
from tests.integration.helpers import criar_aluno_b


async def _treino_do_conjunto_ativo(client: AsyncClient, aluno_token: str) -> dict:
    resp = await client.get(
        "/api/v1/aluno/me/conjunto-ativo/treinos", headers=_auth(aluno_token)
    )
    assert resp.status_code == 200, resp.text
    treinos = resp.json()
    assert treinos, "Aluno seed precisa de conjunto ativo com treinos"
    return treinos[0]


async def _exercicio_do_treino(
    client: AsyncClient, aluno_token: str, treino_id: str
) -> dict:
    resp = await client.get(
        f"/api/v1/aluno/treinos/{treino_id}/exercicios", headers=_auth(aluno_token)
    )
    assert resp.status_code == 200, resp.text
    exercicios = resp.json()
    assert exercicios
    return exercicios[0]


async def test_ciclo_completo_de_sessao(client: AsyncClient, aluno_token: str):
    treino = await _treino_do_conjunto_ativo(client, aluno_token)
    exercicio = await _exercicio_do_treino(client, aluno_token, treino["id"])

    iniciar = await client.post(
        "/api/v1/aluno/sessoes",
        headers=_auth(aluno_token),
        json={"treino_id": treino["id"]},
    )
    assert iniciar.status_code == 201, iniciar.text
    sessao = iniciar.json()
    sessao_id = sessao["id"]

    serie = await client.post(
        f"/api/v1/aluno/sessoes/{sessao_id}/series",
        headers=_auth(aluno_token),
        json={
            "exercicio_treino_id": exercicio["id"],
            "numero_serie": 1,
            "peso_utilizado": 40.0,
            "repeticoes_realizadas": 10,
            "concluida": True,
        },
    )
    assert serie.status_code == 201, serie.text

    finalizar = await client.patch(
        f"/api/v1/aluno/sessoes/{sessao_id}/finalizar",
        headers=_auth(aluno_token),
    )
    assert finalizar.status_code == 200, finalizar.text
    assert finalizar.json()["status"] == "FINALIZADO"


async def test_aluno_b_nao_acessa_sessao_de_aluno_a(
    client: AsyncClient, aluno_token: str, admin_headers: dict
):
    treino = await _treino_do_conjunto_ativo(client, aluno_token)

    iniciar = await client.post(
        "/api/v1/aluno/sessoes",
        headers=_auth(aluno_token),
        json={"treino_id": treino["id"]},
    )
    assert iniciar.status_code == 201, iniciar.text
    sessao_id = iniciar.json()["id"]

    await criar_aluno_b(client, admin_headers)
    login_b = await client.post(
        "/api/v1/auth/login", json={"email": "aluno.b@kine.com", "senha": "senha123"}
    )
    assert login_b.status_code == 200, login_b.text
    token_b = login_b.json()["access_token"]

    resp = await client.get(
        f"/api/v1/aluno/sessoes/{sessao_id}", headers=_auth(token_b)
    )
    assert resp.status_code in (403, 404)

    serie = await client.post(
        f"/api/v1/aluno/sessoes/{sessao_id}/series",
        headers=_auth(token_b),
        json={
            "exercicio_treino_id": "00000000-0000-0000-0000-000000000000",
            "numero_serie": 1,
        },
    )
    assert serie.status_code in (403, 404)
