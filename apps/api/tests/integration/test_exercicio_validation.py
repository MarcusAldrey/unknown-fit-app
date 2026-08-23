from httpx import AsyncClient

from tests.integration.conftest import _auth
from tests.integration.helpers import (
    criar_conjunto,
    criar_exercicio,
    criar_treino,
    primeiro_exercicio_base_id,
    setup_estrutura_personal_b,
)


async def test_criar_exercicio_com_tecnica_invalida_retorna_422(
    client: AsyncClient, admin_headers: dict, personal_token: str
):
    estrutura = await setup_estrutura_personal_b(client, admin_headers)
    login = await client.post(
        "/api/v1/auth/login", json={"email": "personal.b@ecg.com", "senha": "senha123"}
    )
    token_b = login.json()["access_token"]

    exercicio_base_id = await primeiro_exercicio_base_id(client, token_b)

    resp = await client.post(
        f"/api/v1/personal/treinos/{estrutura['treino_b']['id']}/exercicios",
        headers=_auth(token_b),
        json={
            "exercicio_base_id": exercicio_base_id,
            "ordem": 1,
            "numero_series_prescritas": 3,
            "alvo_tipo": "REPETICOES",
            "alvo_valor_min": 8,
            "alvo_valor_max": 12,
            "tecnica": "INVALID",
        },
    )
    assert resp.status_code == 422
