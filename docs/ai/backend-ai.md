# Backend IA Contexto (ECG)

Regras compartilhadas de arquitetura, domínio e convenções estão no
[`AGENTS.md`](../../AGENTS.md). Este arquivo mantém apenas extras específicos
do backend.

## Escopo

O backend está em `apps/api` com FastAPI, SQLAlchemy async e Alembic.
As rotas principais ficam sob `/api/v1`.

## Rotas registradas em `apps/api/app/main.py`

- `/api/v1/auth`
- `/api/v1/admin` — protegida por header `X-Admin-Key` (`require_admin_api_key` em `app/deps.py`)
- `/api/v1/personal`
- `/api/v1/aluno`
- `/api/v1/catalogo`

## Estado atual relevante

- Migrações em `apps/api/alembic/versions/` (`0001` … `0005`).
- Enums de domínio em `app/domain/enums.py` (fonte única).
- Exceções de domínio em `app/exceptions.py`.
- Testes em `apps/api/tests` (mock em `tests/api`/`tests/services`; integração
  com Postgres real via testcontainers em `tests/integration`).
- `passlib[bcrypt]==1.7.4` + `bcrypt==4.0.1` são pinos load-bearing (não alterar).

## Comandos úteis

Dentro de `apps/api`:

```bash
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
.venv\Scripts\python.exe -m app.seed
```
