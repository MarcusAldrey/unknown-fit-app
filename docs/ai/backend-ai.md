# Backend IA Contexto (ECG)

Este arquivo orienta agentes de IA a trabalhar no backend FastAPI deste repositório.

## Escopo

O backend está em `apps/api` com FastAPI, SQLAlchemy async e Alembic.
As rotas principais ficam sob `/api/v1`.

## Stack e arquitetura

- FastAPI
- SQLAlchemy Async + asyncpg
- Alembic para migrações
- Pydantic para schemas
- JWT auth com access/refresh token

Rotas registradas em `apps/api/app/main.py`:

- `/api/v1/auth`
- `/api/v1/personal`
- `/api/v1/aluno`
- `/api/v1/catalogo`

## Regras práticas para IA

- Priorizar mudanças pequenas e consistentes com modelos/schemas/rotas existentes.
- Sempre sincronizar: model + schema + router + seed quando o domínio muda.
- Não reintroduzir compatibilidade legada removida sem pedido explícito.
- Em PostgreSQL, evitar criação duplicada de ENUM em migração única.
- Para ambiente dev, usar reset destrutivo somente com confirmação explícita.

## Estado atual relevante

- Migração base única: `apps/api/alembic/versions/0001_initial_schema.py`.
- Script de reset dev: `apps/api/reset_dev_db.py`.
- Dependência de hash estabilizada:
  - `passlib[bcrypt]==1.7.4`
  - `bcrypt==4.0.1`

## Checklist de mudança no backend

- Atualizou schema e validação dos endpoints impactados.
- Atualizou seed quando o domínio muda e validou idempotência.
- Rodou migração/reset em ambiente de desenvolvimento.
- Testou endpoints críticos com usuário seed (`personal@ecg.com`).

## Comandos úteis

Dentro de `apps/api`:

```bash
.venv\Scripts\python.exe reset_dev_db.py --force
.venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
