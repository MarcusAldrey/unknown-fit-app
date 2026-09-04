import uuid

from httpx import AsyncClient

from tests.integration.conftest import _auth

PERSONAL_B_EMAIL = "personal.b@kine.com"
PERSONAL_B_SENHA = "senha123"
ALUNO_B_EMAIL = "aluno.b@kine.com"


async def criar_personal_b(client: AsyncClient, admin_headers: dict) -> dict:
    resp = await client.post(
        "/api/v1/admin/personais",
        headers=admin_headers,
        json={
            "nome": "Personal B",
            "email": PERSONAL_B_EMAIL,
            "senha": PERSONAL_B_SENHA,
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def criar_aluno_b(
    client: AsyncClient, admin_headers: dict, personal_id: str | None = None
) -> dict:
    payload = {
        "nome": "Aluno B",
        "email": ALUNO_B_EMAIL,
        "senha": "senha123",
        "idade": 30,
        "peso": 80.0,
        "altura": 1.8,
        "treina_em_academia_condominio": False,
    }
    if personal_id is not None:
        payload["personal_id"] = personal_id
    resp = await client.post("/api/v1/admin/alunos", headers=admin_headers, json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def primeiro_exercicio_base_id(client: AsyncClient, token: str) -> str:
    resp = await client.get("/api/v1/catalogo/exercicios-base", headers=_auth(token))
    assert resp.status_code == 200, resp.text
    return resp.json()[0]["id"]


async def criar_conjunto(
    client: AsyncClient, token: str, aluno_id: str, nome: str = "Conjunto B"
) -> dict:
    resp = await client.post(
        f"/api/v1/personal/alunos/{aluno_id}/conjuntos",
        headers=_auth(token),
        json={"nome": nome, "data_inicio": None, "data_fim": None},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def criar_treino(
    client: AsyncClient, token: str, conjunto_id: str, codigo: str = "A"
) -> dict:
    resp = await client.post(
        f"/api/v1/personal/conjuntos/{conjunto_id}/treinos",
        headers=_auth(token),
        json={"codigo": codigo, "nome": "Treino B", "ordem": 1},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def criar_exercicio(
    client: AsyncClient, token: str, treino_id: str, exercicio_base_id: str
) -> dict:
    resp = await client.post(
        f"/api/v1/personal/treinos/{treino_id}/exercicios",
        headers=_auth(token),
        json={
            "exercicio_base_id": exercicio_base_id,
            "ordem": 1,
            "numero_series_prescritas": 3,
            "alvo_tipo": "REPETICOES",
            "alvo_valor_min": 8,
            "alvo_valor_max": 12,
            "tecnica": "PADRAO",
        },
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


async def setup_estrutura_personal_b(
    client: AsyncClient, admin_headers: dict
) -> dict:
    """Cria personal B + aluno B + conjunto + treino + exercício, e devolve os ids."""
    personal_b = await criar_personal_b(client, admin_headers)
    aluno_b = await criar_aluno_b(client, admin_headers, personal_b["personal_id"])

    login = await client.post(
        "/api/v1/auth/login",
        json={"email": PERSONAL_B_EMAIL, "senha": PERSONAL_B_SENHA},
    )
    assert login.status_code == 200, login.text
    token_b = login.json()["access_token"]

    exercicio_base_id = await primeiro_exercicio_base_id(client, token_b)
    conjunto_b = await criar_conjunto(client, token_b, aluno_b["aluno_id"])
    treino_b = await criar_treino(client, token_b, conjunto_b["id"])
    exercicio_b = await criar_exercicio(client, token_b, treino_b["id"], exercicio_base_id)

    return {
        "personal_b": personal_b,
        "aluno_b": aluno_b,
        "token_b": token_b,
        "conjunto_b": conjunto_b,
        "treino_b": treino_b,
        "exercicio_b": exercicio_b,
    }
