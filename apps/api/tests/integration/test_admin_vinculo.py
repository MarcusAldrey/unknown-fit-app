import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.models import VinculoPersonalAluno
from tests.integration.helpers import criar_personal_b


async def _aluno_id_por_email(client: AsyncClient, admin_headers: dict, email: str) -> str:
    resp = await client.get("/api/v1/admin/alunos", headers=admin_headers)
    assert resp.status_code == 200, resp.text
    for aluno in resp.json():
        if aluno["email"] == email:
            return aluno["aluno_id"]
    raise AssertionError(f"Aluno {email} não encontrado")


@pytest.mark.xfail(strict=True, reason="vínculo history fixed in Phase 1.4")
async def test_revincular_aluno_mantem_historico(
    client: AsyncClient, admin_headers: dict, db_session
):
    aluno_id = await _aluno_id_por_email(client, admin_headers, "aluno@ecg.com")
    personal_b = await criar_personal_b(client, admin_headers)

    resp = await client.patch(
        f"/api/v1/admin/alunos/{aluno_id}",
        headers=admin_headers,
        json={"personal_id": personal_b["personal_id"]},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["personal_id"] == personal_b["personal_id"]

    vinculos = (
        await db_session.execute(
            select(VinculoPersonalAluno).where(VinculoPersonalAluno.aluno_id == aluno_id)
        )
    ).scalars().all()

    ativos = [v for v in vinculos if v.ativo]
    assert len(ativos) == 1, "Deve existir exatamente um vínculo ativo"
    assert str(ativos[0].personal_id) == personal_b["personal_id"]

    inativos = [v for v in vinculos if not v.ativo]
    assert inativos, "O vínculo antigo deve permanecer no histórico"
    assert all(v.fim_em is not None for v in inativos), (
        "O vínculo antigo deve ter fim_em preenchido"
    )
