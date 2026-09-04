# AGENTS.md

Guidance for AI agents (and humans) working in this repository. Read this before
making changes. It is the single source of truth for shared rules; the
`docs/ai/*.md` files only carry scope-specific extras.

## Project overview & repo map

ECG ("Elite Training Gym") — a gym management monorepo: a React Native app with
two roles (`PERSONAL` trainer and `ALUNO` student) backed by a FastAPI service.

```
apps/api          FastAPI + SQLAlchemy (async) + Alembic (Python 3.11+)
  app/
    config.py      settings (pydantic-settings)
    database.py    async engine/session + Base
    deps.py        FastAPI dependencies (auth + ownership-scoped lookups)
    exceptions.py  domain exceptions (DomainError hierarchy)
    main.py        app factory, middleware, exception handlers
    domain/        enums.py (Tecnica, AlvoTipo, RerRmTipo, ImplementoExecucao)
    models/        SQLAlchemy models
    schemas/       Pydantic schemas
    routers/       HTTP routers (auth, admin, personal/, aluno, catalogo)
    services/      business logic (auth, sessao, periodizacao, disponibilidade,
                   admin, equivalencia_exercicio)
    repositories/  equivalencia_exercicio.py
    seed.py        idempotent seed
  alembic/         migrations
  tests/           pytest (mock + integration)

apps/mobile       React Native + Expo SDK 54 + React Query 5 + Axios (TypeScript)
  src/
    api/           client.ts (axios instance) + queryKeys.ts + services/
    contexts/      AuthContext.tsx
    hooks/         React Query hooks + useDebounce/useKeyboardHeight
    navigation/    stack/tab navigators
    screens/       aluno/ + personal/
    components/    shared UI components
    theme/         design tokens (colors, spacing, radii, typography, shadows)
    utils/         formatters.ts, dates.ts, apiError.ts
  App.tsx          PersistQueryClientProvider + AuthProvider

packages/types     @kine/types — single source of shared TypeScript types
docs/ai/           backend-ai.md + frontend-ai.md (scope-specific extras)
```

## Architecture rules

### Backend layering

`router → deps → service → repository → model/schema`

- Routers only parse the body, run ownership checks via `deps.py`, call a
  service, and map the result to a response schema.
- Ownership-scoped endpoints MUST use the dedicated dependencies in
  `app/deps.py` (`get_aluno_vinculado`, `get_conjunto_vinculado`,
  `get_treino_vinculado`, `get_exercicio_vinculado`) rather than raw selects.
- Services raise **domain exceptions** from `app/exceptions.py`
  (`NotFoundError`, `ForbiddenError`, `ConflictError`, `DomainValidationError`).
  Do NOT raise `HTTPException` inside services.
- Exception handlers in `main.py` map domain exceptions to
  `{"detail", "code", "request_id"}` with status 404/403/409/422.

### Frontend layering

`screen → hook → service → queryKeys`

- Query keys come only from `src/api/queryKeys.ts` (`keys.*`).
- API calls live in `src/api/services/*.ts` (typed wrappers over the axios client).
- Shared UI lives in `src/components/`; use `src/theme/` tokens (no hardcoded
  colors/spacing/radii).
- Errors surface as `ErrorState` (never mask a failed request as an empty list).

## Domain glossary (PT-BR terms)

- **aluno** — student (role `ALUNO`).
- **personal** — trainer (role `PERSONAL`).
- **vínculo** — the link between a personal and an aluno (has history: `inicio_em`,
  `fim_em`, `ativo`; only one active at a time).
- **conjunto (de treino)** — a training periodization block; only one active per aluno.
- **treino** — a workout within a conjunto (letter code A/B/C..., `ordem`).
- **exercício** — a prescribed exercise inside a treino (base + prescription).
- **exercício base** — the catalog exercise (reusable definition).
- **equivalente** — alternative exercises configured as substitutes within a block.
- **série (executada)** — a performed set recorded during a session.
- **sessão (de treino)** — a workout session (EM_ANDAMENTO / FINALIZADO).
- **recursos** — gym resources; an aluno has per-resource availability.
- **registro de peso** — weight-history entries for an aluno.

User-facing messages stay PT-BR; code, identifiers and comments are English.

## Change checklists

### Backend domain change

- Sync **model + schema + router + seed** (a domain change touches all four).
- Add/keep a migration; never re-create the same PostgreSQL ENUM twice in one migration.
- Keep seed idempotent (running twice is stable).

### API contract change

- Never change public API URLs or response shapes; changes are additive only.
- Sync `packages/types/src/index.ts` with `apps/api/app/schemas/*.py`
  (fields and nullability) when a shared contract changes.
- Ownership deps are mandatory on any personal-scoped endpoint.

### Frontend change

- Never mask API failures as empty lists — render an error state.
- Pass entity IDs as route params and fetch via hooks (don't pass stale snapshots).
- Update both `packages/types` and consumers when a type changes.

## Commands

### Backend (from `apps/api`)

```powershell
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
.venv\Scripts\python.exe -m app.seed
.venv\Scripts\python.exe reset_dev_db.py --force   # destructive
```

### Mobile / monorepo (from repo root)

```powershell
pnpm install
pnpm typecheck
pnpm lint
pnpm --filter @kine/mobile start
```

Seed users: `personal@kine.com` / `aluno@kine.com` (password `123456`).
Admin header (dev): `X-Admin-Key: dev-admin-key-change-in-production`.

## Conventions

- 204 responses: `return Response(status_code=status.HTTP_204_NO_CONTENT)`.
- Status codes via `status.HTTP_*` constants.
- PATCH updates: `body.model_dump(exclude_unset=True)` applied field-by-field.
- Error JSON: `{"detail": "...", "code": "...", "request_id": "..."}`.
- PT-BR user-facing messages; timezone-aware datetimes (`datetime.now(timezone.utc)`,
  columns `DateTime(timezone=True)`).
- Boolean SQL comparisons via `.is_(True)`.
- Frontend import alias `@/` maps to `apps/mobile/src/` (configured in both
  `tsconfig.json` and `metro.config.js`).

## Security invariants

- Personal-scoped endpoints always go through ownership dependencies (IDOR-proof).
- CORS origins come from `Settings.cors_origins` (never `["*"]` in production).
- Refresh tokens carry a `jti` and are revocable on logout; revoked jtis are rejected.
- Secrets come from env only; admin endpoints require the `X-Admin-Key` header.
- The bcrypt pins (`passlib[bcrypt]==1.7.4`, `bcrypt==4.0.1`) are load-bearing — do not bump.

## Testing rules

- Backend: integration-first with real Postgres (testcontainers or `TEST_DATABASE_URL`);
  unit tests for pure logic. Mock-based route tests are acceptable but must not be the
  only coverage for security-sensitive behavior.
- Mobile: tests for pure utils/hooks (Jest + `@testing-library/react-native`).
- Run `pnpm typecheck` + `pnpm lint` before finishing frontend work.

## Safety

- Never run destructive DB operations (`reset_dev_db.py --force`, `DROP SCHEMA`)
  without explicit human confirmation.
- Do not commit secrets; keep `.env` out of version control.
