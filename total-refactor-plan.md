# EGT Monorepo — Refactoring Plan (Modularity & Good Practices)

> **Executor instructions (AI or human):** work through the phases **strictly in order
> (0 → 7)**. Each phase ends with a **Verification gate** — do NOT proceed while it fails.
> One commit per completed task; message format `<type>(<scope>): <subject>`, scope ∈
> {api, mobile, types, repo}. Do NOT push. Never run destructive DB commands
> (`reset_dev_db.py --force`, DROP SCHEMA) without explicit human confirmation.
> Line numbers are from the analysis snapshot — if code drifted, trust the code: search
> by function/route name instead of line number, adapt minimally, and note deviations in
> your final summary.

## 0. Context

Repo = "ECG — Elite Training Gym" (`egt`), pnpm 9 + Turborepo monorepo, Windows host:

```
apps/api        FastAPI + SQLAlchemy async + Alembic (Python 3.11+, venv at apps/api/.venv)
apps/mobile     React Native + Expo SDK 54 + React Query 5 + Axios (TypeScript)
packages/types  @ecg/types — shared TS types, raw source (package.json main: src/index.ts)
docs/ai/        backend-ai.md + frontend-ai.md — READ FIRST, they are binding
```

Backend tree: `apps/api/app/{config,database,deps,logging_config,main,seed}.py`,
`app/models/` (aluno, conjunto_treino, exercicio_base, exercicio_treino,
exercicio_treino_equivalente, personal, peso_registro, recurso_treino, serie_executada,
sessao_treino, treino, usuario, vinculo), `app/schemas/` (admin, aluno, auth,
conjunto_treino, exercicio, recurso, sessao, treino, usuario),
`app/routers/{auth,admin,personal,aluno,catalogo}.py`,
`app/services/{auth,equivalencia_exercicio}.py`,
`app/repositories/equivalencia_exercicio.py`.
Routers mounted in `app/main.py` L139-143 under `/api/v1/{auth,admin,personal,aluno,catalogo}`.

Mobile tree: `apps/mobile/src/{api/client.ts, contexts/AuthContext.tsx,
navigation/{index,AuthNavigator,AlunoNavigator,PersonalNavigator}.tsx,
screens/{LoginScreen.tsx,
aluno/{ConjuntoAtivo,DetalheTreinoRealizado,HistoricoTreinos,SessaoTreino}Screen.tsx,
personal/{AdminUsuarios,AlunoFicha,AlunosList,CatalogoExercicios,CriarConjunto,CriarExercicio,
CriarTreino,DetalheTreinoRealizadoAluno,EditarExercicioBase,Exercicios,GerirRecursosAluno,
HistoricoTreinosAluno,Treinos}Screen.tsx}, theme/colors.ts, types/index.ts, utils/formatters.ts}`.
`App.tsx` wraps the app in `PersistQueryClientProvider` with an AsyncStorage persister (L21-29).

## 0.1 Golden rules (violation = rework)

1. **Never change public API URLs or response contracts.** Mobile depends on them. Additive only.
2. Domain change ⇒ sync **model + schema + router + seed** (per `docs/ai/backend-ai.md`).
3. Never mask API failures as empty lists; render error states (per `docs/ai/frontend-ai.md`).
4. Domain terms stay Portuguese (treino, aluno, conjunto, vínculo, série, exercício).
   User-facing `detail` messages stay PT-BR; code/comments in English.
5. `passlib[bcrypt]==1.7.4` + `bcrypt==4.0.1` pins (`apps/api/pyproject.toml` L14-15) are
   load-bearing (passlib reads `bcrypt.__about__`, removed in bcrypt ≥ 4.1). Do not bump.
6. Alembic: never create the same PostgreSQL ENUM twice in one migration.
7. Don't reintroduce removed legacy compatibility.

## 0.2 Gap inventory (what this plan fixes — reference section)

**Backend (`apps/api`):**

- **IDOR (P0):** 5 endpoints in `app/routers/personal.py` authenticate but don't scope
  ownership: `listar_treinos` (~L549), `criar_treino` (~L563), `editar_treino` (~L681),
  `listar_exercicios` (~L741), `deletar_exercicio` (~L921). Working pattern to copy:
  `_get_aluno_vinculado` (L64-83), `_get_exercicio_treino_vinculado` (~L902).
- **God router:** `personal.py` 940 LOC / 23 endpoints / 7 concerns. `aluno.py` 562 LOC.
- **Vínculo bug:** `models/vinculo.py` L13-15 `UniqueConstraint("aluno_id","ativo")` caps
  history at 2 rows; `routers/admin.py` `_definir_vinculo_ativo_unico` (~L95) DELETES the
  old vínculo to work around it.
- **CORS:** `main.py` L82-88: `allow_origins=["*"]` + `allow_credentials=True`.
- **500 on bad enums:** manual casts `Tecnica(body.tecnica)` (`personal.py` ~L819/L841),
  `ImplementoExecucao(...)` (`catalogo.py` ~L76) → unhandled `ValueError`. Enums duplicated:
  `models/exercicio_treino.py` L17-26 vs `schemas/exercicio.py` L8-17.
- **Logout stub:** `routers/auth.py` ~L68-70; refresh tokens live 7 days (`config.py` L17).
- **Business logic in routers:** ativar_conjunto (`personal.py` L474-519); reorder+reletter
  (`personal.py` L726-736, `chr(64+idx)` breaks past 26); sessão auto-finalize
  (`aluno.py` L241-250); registrar_serie validation chain (`aluno.py` L400-483);
  `_hard_delete_aluno_dependencias` (`admin.py` L121-191); resource fan-out
  (`catalogo.py` L120-128).
- **Duplication:** "ensure disponibilidade rows" ×3 (`personal.py` L86-107,
  `catalogo.py` L120-128, `seed.py` L151-175); `SerieDetalheOut` build ×2
  (`personal.py` L662-678 ≡ `aluno.py` L340-355); `SessaoResumoOut` build ×2
  (`personal.py` L607-618 ≡ `aluno.py` L297-308); active-conjunto ownership guard ×4
  (`aluno.py` L99-100, L131-132, L156-160, L235-239); `descanso_segundos` min/max sync
  logic ×3 (`schemas/exercicio.py` L62-74, L104-137, `personal.py` L798-802 & L850-875).
- **Hygiene:** 9× `datetime.utcnow()` (`models/usuario.py` L26, `vinculo.py` L20,
  `recurso_treino.py` L18, `sessao_treino.py` L23, `peso_registro.py` L17, `aluno.py`
  L250/L478/L533, `services/auth.py` L33); 14× `== True  # noqa: E712`; dead eager loads
  `deps.py` L64/L84; bottom `# noqa: E402` import blocks in all 13 model files;
  `requirements.txt` duplicates `pyproject.toml` (Dockerfile L9-10 installs it);
  `alembic.ini` L3 hardcoded URL with stale DB name `kine`; version "0.1.0" hardcoded in
  `main.py` L49/L78 + pyproject; `HTTPException` raised inside
  `services/equivalencia_exercicio.py` L4/L162-165/L177-180 (framework coupling in domain layer).
- **Strays:** `check_treinos.py` (debug leftover), `fix_treinos.py` (one-off data fix),
  `seed_custom.py` (overlaps `app/seed.py`, passwords at L92/L112), repo-root
  `treino_aldrey_ciclo1.json` (322 LOC, embedded as dicts in `seed.py` L354-493).
- **Tests:** 20, all mock-based (`DummyDB`/AsyncMock); zero SQL executed → IDOR invisible.
  `tests/conftest.py` is 10 lines (env vars only).

**Frontend (`apps/mobile/src`):**

- **God screens:** `aluno/SessaoTreinoScreen.tsx` 1820 LOC (state L133-163, render
  L992-1446, 372 LOC of styles); `personal/CriarExercicioScreen.tsx` 1203 (hybrid
  RHF+useState L95-127, 130-line validator L388-515); `personal/ExerciciosScreen.tsx`
  1157 (BFS graph L58-117, reorder L267-338, N+1 PATCH L220-227);
  `personal/AdminUsuariosScreen.tsx` 750 (two CRUD domains; `keyExtractor` typed `any`
  L485; `maxHeight: 330` hack L628).
- **No data layer:** 67 inline `queryKey:` across 15 files; conflicting cache policy for
  `["catalogo","exercicios-base"]` (`CatalogoExerciciosScreen` L56-57
  `staleTime:0,refetchOnMount:"always"` vs `CriarExercicioScreen` L223 `staleTime:10min`).
- **Auth leakage:** `AuthContext.logout` (L102-112) doesn't clear the React Query cache
  that `App.tsx` L21-29 persists to AsyncStorage → cross-user data leakage.
- **Type drift:** `src/types/index.ts` (346 LOC) duplicates ~20 types from
  `packages/types/src/index.ts` (165 LOC); packages `ExercicioTreino` (L76-95) lacks
  `descanso_segundos_min`/`_max` present in mobile's copy (L183-204); mobile has NO
  dependency on `@ecg/types`.
- **Tooling void:** `eslint.config.mjs` has ZERO rules (parser only); mobile lacks a
  `typecheck` script (turbo's typecheck task skips it silently); no tests; `@/*` tsconfig
  alias (tsconfig.json L10-14) never used — and Metro has NO alias resolver
  (metro.config.js only sets monorepo watchFolders/nodeModulesPaths).
- **Duplication:** top-bar+kebab ×3 (`AlunosListScreen` L72-120, `CatalogoExerciciosScreen`
  L116-151, `HistoricoTreinosScreen` L91-131); screens
  `aluno/DetalheTreinoRealizadoScreen` (181) ≡ `personal/DetalheTreinoRealizadoAlunoScreen`
  (183), `aluno/HistoricoTreinosScreen` (297) ≡ `personal/HistoricoTreinosAlunoScreen` (220);
  helpers formatTime/parseApiDateToMs (`ConjuntoAtivoScreen` L28-45 ≡ `SessaoTreinoScreen`
  L48-66), formatDate/formatDuration (`HistoricoTreinosScreen` L26-48 ≡
  `HistoricoTreinosAlunoScreen` L23-45), local `useDebounce` (`CriarExercicioScreen`
  L40-47), keyboard effect (`SessaoTreinoScreen` L176-194 ≡ `CriarExercicioScreen` L148-166).
- **Design tokens:** `theme/colors.ts` = 9 colors only; no spacing/radii/typography
  tokens; placeholder color inconsistent (`colors.border` in CriarExercicio vs
  `colors.textMuted` elsewhere); stray `shadowColor:"#000"` (CriarExercicio L1099);
  5 different rgba overlay opacities.
- **Misc:** 25 `any`; 22 `console.*` (12 in `api/client.ts` L25-28/L42-44/L62-64/L83/L88/
  L92-98); entities as route params (stale snapshots); N+1 fetches
  (`SessaoTreinoScreen` L296-313 ultimo-peso per exercise; reorder PATCH loops
  `TreinosScreen` L66-76, `ExerciciosScreen` L220-227); 401 refresh has no single-flight
  (`client.ts` L100-124) and no auth-failure notification; production fallback
  `https://api.ecg.com/api/v1` is a placeholder (`client.ts` L22).

---

## PHASE 0 — Safety net (MANDATORY FIRST)

### 0.1 Backend integration tests (real Postgres)

Files: `apps/api/pyproject.toml`, `apps/api/tests/conftest.py`, new `apps/api/tests/integration/*.py`.

1. `pyproject.toml` `[project.optional-dependencies].dev`: add `"testcontainers[postgres]>=4.0.0"`.
   Then: `cd apps/api && .venv\Scripts\python.exe -m pip install -e ".[dev]"`.
2. Extend `tests/conftest.py` (KEEP existing env block + `get_settings.cache_clear()`):
   - session fixture `test_db_url`: use `TEST_DATABASE_URL` env if set, else
     `PostgresContainer("postgres:15")` (convert sync URL → `postgresql+asyncpg://`).
   - session fixture `apply_migrations(test_db_url)`: set `DATABASE_URL` env,
     `get_settings.cache_clear()`, run `alembic upgrade head` programmatically
     (`alembic.config.Config` pointing at `apps/api/alembic.ini` + `command.upgrade(cfg, "head")`),
     then run the seed programmatically (import the seed callable from `app.seed`).
   - function fixture `db_session`: AsyncSession on the test DB using the
     "join external transaction" rollback pattern (standard SQLAlchemy 2.0 recipe).
   - function fixture `client`: `httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
base_url="http://test")` + `app.dependency_overrides[get_db]` yielding `db_session`;
     clear overrides on teardown.
   - fixtures `personal_token` / `aluno_token`: POST `/api/v1/auth/login` with seed users
     `personal@ecg.com` / `aluno@ecg.com` (password `123456`, per `app/seed.py`);
     `admin_headers = {"X-Admin-Key": "dev-admin-key-change-in-production"}`.
3. New tests (names are contracts):
   - `tests/integration/test_auth_flow.py`: login → 200 + tokens; `GET /auth/me` → 200
     role PERSONAL; `POST /auth/refresh` → 200; aluno token on `GET /personal/alunos` → 403.
   - `tests/integration/test_personal_ownership.py`: create personal B + aluno + vínculo +
     conjunto + treino + exercício (via admin API or direct inserts); personal A's token must
     get 403/404 (never 200) on: `GET /personal/conjuntos/{B_conjunto}/treinos`,
     `POST /personal/conjuntos/{B_conjunto}/treinos`, `PATCH /personal/treinos/{B_treino}`,
     `GET /personal/treinos/{B_treino}/exercicios`, `DELETE /personal/exercicios/{B_exercicio}`.
     **These 5 FAIL today** → mark
     `@pytest.mark.xfail(strict=True, reason="IDOR fixed in Phase 1.1")`.
   - `tests/integration/test_sessao_lifecycle.py`: aluno starts sessão
     (`POST /aluno/sessoes`) → posts série (`POST /aluno/sessoes/{id}/series`) → finalizes
     (`PATCH /aluno/sessoes/{id}/finalizar`); aluno B on aluno A's sessão → 403/404.
   - `tests/integration/test_admin_vinculo.py`: re-assign aluno from personal A to B; assert
     exactly one active vínculo AND the old vínculo row still exists with `fim_em` set.
     Mark `xfail(strict=True, reason="vínculo history fixed in Phase 1.4")` (admin deletes today).
4. Keep the existing 20 mock tests untouched.
5. Remove redundant `@pytest.mark.asyncio` decorators (`asyncio_mode="auto"` already set
   in pyproject.toml L31).

### 0.2 Mobile tooling

1. `apps/mobile/package.json`: add script `"typecheck": "tsc --noEmit"`.
2. `packages/types/package.json`: add `"scripts": {"typecheck": "tsc --noEmit"}`; create
   `packages/types/tsconfig.json`:
   `{ "compilerOptions": { "strict": true, "moduleResolution": "bundler", "lib": ["es2022"], "skipLibCheck": true }, "include": ["src"] }`.
3. Rewrite `apps/mobile/eslint.config.mjs` (flat config): keep `@typescript-eslint/parser`;
   add dev deps `@typescript-eslint/eslint-plugin`, `eslint-plugin-react`,
   `eslint-plugin-react-hooks`, `eslint-plugin-react-native`; apply
   `@typescript-eslint/recommended` + `react-hooks/recommended`; rule
   `@typescript-eslint/no-explicit-any: "warn"`; `settings: { react: { version: "detect" } }`.
   Run `pnpm --filter @ecg/mobile lint -- --fix`; fix autofixables only; remaining
   warnings are acceptable — do NOT mass-refactor to zero warnings.

**GATE 0 (all must pass):**

- `cd apps/api && .venv\Scripts\python.exe -m pytest` → green (xfails allowed).
  Requires Docker for testcontainers; otherwise set `TEST_DATABASE_URL` to a disposable DB.
- Repo root: `pnpm typecheck` → green, actually covering mobile + packages/types.
- `pnpm lint` → runs without errors.

---

## PHASE 1 — Backend P0: security & correctness

### 1.1 Ownership-scoped dependencies (fix IDOR)

1. `app/deps.py`: add (move query logic from `personal.py` `_get_aluno_vinculado` L64-83):
   - `get_aluno_vinculado(aluno_id: uuid.UUID, personal=Depends(get_current_personal), db=Depends(get_db)) -> Aluno`
   - `get_conjunto_vinculado(conjunto_id: uuid.UUID, ...) -> ConjuntoTreino` (conjunto → aluno → active vínculo with this personal)
   - `get_treino_vinculado(treino_id: uuid.UUID, ...) -> Treino` (treino → conjunto → aluno → vínculo)
   - `get_exercicio_vinculado(exercicio_id: uuid.UUID, ...) -> ExercicioTreino` (one level deeper)
     All raise **404** with existing PT-BR not-found wording for missing OR foreign
     resources (no existence leakage; matches current `"Aluno não vinculado"` 404 convention).
2. Delete dead eager loads in `deps.py`: `selectinload(Personal.vinculos)` (L64),
   `selectinload(Aluno.conjuntos_treino)` (L84).
3. Rewire the 5 IDOR endpoints in `routers/personal.py` to consume the new deps (replace
   raw select+fetch); delete now-orphaned private helpers.
4. Remove `xfail` from the 5 ownership tests → they must pass.

### 1.2 CORS

`app/config.py` Settings: add `cors_origins: list[str] = ["http://localhost:8081", "http://localhost:19006"]`.
`app/main.py` L82-88: `allow_origins=settings.cors_origins` (keep `allow_credentials=True`).
Add `CORS_ORIGINS=` (comma-separated) to `.env.example` and `deploy/.env.example`.

### 1.3 Enum single source (422 instead of 500)

1. Create `app/domain/__init__.py` + `app/domain/enums.py`; MOVE `Tecnica` and
   `ImplementoExecucao` ((str, Enum) mixins) there from `models/exercicio_treino.py` L17-26.
2. Import from `app.domain.enums` in models AND in `schemas/exercicio.py` (delete duplicate
   definitions at L8-17). SQLAlchemy enum columns keep working (same values).
3. Use the enum types directly as Pydantic field types in `ExercicioTreinoCreate/Update`
   and `ExercicioBaseUpdate`; DELETE the manual casts (`personal.py` ~L819/L841,
   `catalogo.py` ~L76). Add a test: create exercício with `"tecnica": "INVALID"` → 422.

### 1.4 Vínculo history fix (migration 0002)

1. New file `apps/api/alembic/versions/0002_vinculo_partial_unique.py` (follow the style
   of `0001_initial_schema.py`; revision id `0002_vinculo_partial_unique`,
   `down_revision = <0001 revision id>`):
   - `op.drop_constraint("uq_aluno_vinculo_ativo", "vinculos_personal_aluno", type_="unique")`
   - `op.create_index("uq_aluno_vinculo_ativo", "vinculos_personal_aluno", ["aluno_id"],
unique=True, postgresql_where=sa.text("ativo"))`
   - reversible `downgrade()` (drop index, re-add constraint).
2. `models/vinculo.py`: replace `__table_args__` UniqueConstraint with the matching
   `Index("uq_aluno_vinculo_ativo", "aluno_id", unique=True, postgresql_where=text("ativo"))`.
3. `routers/admin.py` `_definir_vinculo_ativo_unico`: CLOSE the current vínculo
   (`ativo=False`, `fim_em=datetime.now(timezone.utc)`) instead of deleting.
4. Remove `xfail` from the vínculo-history test (0.1) → must pass.

### 1.5 Refresh-token revocation

1. Same migration 0002 (or a separate `0003_refresh_token_revocation.py`): new table
   `refresh_tokens_revogados` (`jti` String primary key, `revogado_em` DateTime not null).
2. `services/auth.py`: `criar_refresh_token` includes a unique `jti` claim
   (`str(uuid.uuid4())`).
3. `routers/auth.py`: `POST /auth/logout` accepts the refresh token and inserts its jti
   into `refresh_tokens_revogados`; `POST /auth/refresh` rejects revoked jtis → 401.
4. Add test: logout then reuse the same refresh token → 401.

**GATE 1:** full `pytest` green (incl. previously-xfailed tests); `alembic upgrade head`
from an empty DB; manual: start uvicorn, login as `personal@ecg.com` works.

---

## PHASE 2 — Backend structure

### 2.1 Split the god router (URLs unchanged)

Convert `app/routers/personal.py` into a package `app/routers/personal/`:

- `__init__.py`: `router = APIRouter()` that `include_router`s the sub-routers below.
- `alunos.py` — aluno list/ficha endpoints.
- `conjuntos.py` — conjunto CRUD + ativar.
- `treinos.py` — treino CRUD + reorder.
- `exercicios.py` — exercício CRUD + equivalentes + descanso min/max.
- `recursos.py` — recurso-disponibilidade endpoints.
- `sessoes.py` — personal-side sessão views.
  Keep every route path/method/response identical. `app/routers/__init__.py` and
  `app/main.py` imports keep working (`from app.routers import personal` now imports the package).

### 2.2 Extract services (thin routers)

Create in `app/services/`:

- `periodizacao.py`: `ativar_conjunto(db, conjunto)` (one transaction: deactivate sibling
  conjuntos of the same aluno + activate target); `reordenar_treinos(...)`; replace
  `chr(64+idx)` code-lettering with an explicit strategy (accept `codigo` from the client,
  or compute next letter with an overflow guard past 26).
- `sessao.py`: `iniciar_sessao` (incl. auto-finalize of stale sessions from `aluno.py`
  L241-250), `registrar_serie` (3-query validation chain from `aluno.py` L400-483),
  `finalizar_sessao`, `excluir_serie`.
- `disponibilidade.py`: single `ensure_disponibilidade_rows(db, aluno_id=None)` used by the
  personal router, the catalogo router, AND the seed (deletes 2 of the 3 copies).
- `admin.py`: create-personal / create-aluno flows; replace `_hard_delete_aluno_dependencias`
  with DB-level `ON DELETE CASCADE` (add the cascades in a new migration `0004_cascades.py`)
  plus a plain delete.
  Routers become: parse body → dependency ownership checks → call service → map to schema.

### 2.3 Domain exceptions

Create `app/exceptions.py`: `NotFoundError`, `ForbiddenError`, `ConflictError`,
`DomainValidationError` — each carries a PT-BR message. Register handlers in `main.py`
mapping them to JSON `{"detail": msg, "code": "<snake_case_code>", "request_id": ...}`
with proper status codes (404/403/409/422). Refactor `services/equivalencia_exercicio.py`
to raise these instead of `HTTPException` (L4/L162-165/L177-180); update
`tests/services/test_equivalencia_exercicio.py` to assert the domain exceptions.

### 2.4 Mapping consolidation

Add `@classmethod from_model(cls, obj)` (or an `app/mappers.py`) for `SerieDetalheOut` and
`SessaoResumoOut`; replace the duplicated inline builds (`personal.py` L662-678/L607-618,
`aluno.py` L340-355/L297-308).

### 2.5 Hygiene batch

- Replace all 9 `datetime.utcnow()` with `datetime.now(timezone.utc)`; change model columns
  to `DateTime(timezone=True)` in a migration. Sites: `models/usuario.py` L26,
  `vinculo.py` L20, `recurso_treino.py` L18, `sessao_treino.py` L23, `peso_registro.py` L17,
  `aluno.py` L250/L478/L533, `services/auth.py` L33.
- Replace 14× `== True  # noqa: E712` with `.is_(True)` and drop the noqas.
- Replace model bottom `# noqa: E402` import blocks (all 13 model files) with
  `TYPE_CHECKING` imports + string relationship targets.
- Delete `check_treinos.py` and `fix_treinos.py`. Fold `seed_custom.py` fixtures into
  `app/seed.py`; move `treino_aldrey_ciclo1.json` → `apps/api/seeds/treino_aldrey_ciclo1.json`
  and make the seed READ the JSON instead of embedded dicts (replaces `seed.py` L354-493);
  gate demo-user creation behind `environment != "production"`.
- Single dependency source: delete `requirements.txt`; update `apps/api/Dockerfile` to
  `COPY pyproject.toml .` + `pip install .` (and document the change in the commit body).
- Version single source: `main.py` reads `importlib.metadata.version("ecg-api")` with
  "0.1.0" fallback for both the FastAPI `version=` and the startup log line.
- Fix `alembic.ini` L3: remove the hardcoded URL (env.py already reads from settings).
- Unify conventions: 204 → `return Response(status_code=204)`; status codes via
  `status.HTTP_*` constants; PATCH → `model_dump(exclude_unset=True)` loop.

### 2.6 New tests

- Migration smoke: empty DB → `upgrade head` → `downgrade base` → `upgrade head`.
- Seed idempotency: run seed twice → stable row counts.
- Service unit tests (real DB session): `periodizacao.ativar_conjunto`,
  `sessao.registrar_serie` (happy path + the 3 rejection paths).

**GATE 2:** full `pytest` green; `alembic upgrade head` from empty DB; manual smoke as
`personal@ecg.com` (login → list alunos → open treinos); mobile app still works unchanged.

---

## PHASE 3 — Frontend data layer

1. `src/api/queryKeys.ts`: key factory, e.g. `keys.auth.me()`,
   `keys.catalogo.exerciciosBase()`, `keys.personal.treinos(conjuntoId)`,
   `keys.personal.exercicios(treinoId)`, `keys.aluno.sessaoAtiva()`, etc.
   Co-locate the staleTime policy per key in this file (single policy for
   `exerciciosBase` resolves the CatalogoExerciciosScreen-vs-CriarExercicioScreen conflict).
2. `src/api/services/` (one file per domain: `auth.ts`, `aluno.ts`, `personal.ts`,
   `catalogo.ts`, `admin.ts`): typed functions wrapping `api.get/post/patch/delete`.
3. `src/hooks/`: `useSessaoAtiva`, `useTreinos`, `useExercicios`, `useUltimosPesos`,
   `useAlunos`, plus mutation hooks whose `onSuccess` invalidate via the key factory.
   Migrate all 67 inline `queryKey:` usages to the factory.
4. `src/api/client.ts` fixes:
   - Gate every `console.*` behind `if (__DEV__)` (L25-28, L42-44, L62-64, L83, L88, L92-98).
   - Single-flight refresh: module-level `let refreshPromise: Promise<...> | null` so
     concurrent 401s share one refresh call (replaces L100-124 logic).
   - Add `setOnAuthFailure(cb)`; invoke it after token deletion when refresh fails;
     `AuthContext` subscribes and sets the user to null (triggers navigation to login).
   - Type `_retry` via `declare module "axios" { interface InternalAxiosRequestConfig { _retry?: boolean } }`.
5. `AuthContext.logout` (L102-112): call `queryClient.clear()`. In `App.tsx` L27-29 add
   `persistOptions={{ persister, dehydrateOptions: { shouldDehydrateQuery: ... } }}`
   excluding sensitive keys (sessão-ativa, admin lists) from AsyncStorage persistence.
6. `src/utils/apiError.ts`: `getApiErrorMessage(error: unknown): string` (axios guard →
   `error.response?.data?.detail` → generic PT-BR fallback). Replace every `(error: any)`.

**GATE 3:** `pnpm typecheck` + `pnpm lint` green; manual: login as both roles, walk the
main flows, confirm zero behavior change.

---

## PHASE 4 — Shared types single source

1. Port the mobile-only types into `packages/types/src/index.ts`: `LoginRequest`, `Usuario`,
   admin types, `*Create`/`*Update` DTOs, `SessaoResumo`, `SessaoAtiva`, `UltimoPesoExercicio`.
2. Fix the drift: add `descanso_segundos_min`/`descanso_segundos_max` to the shared
   `ExercicioTreino` (packages L76-95).
3. `apps/mobile/package.json`: add `"@ecg/types": "workspace:*"` to dependencies; run
   `pnpm install`. (Metro is already monorepo-configured via watchFolders/nodeModulesPaths,
   so raw-TS consumption works.)
4. `apps/mobile/src/types/index.ts` → temporary re-export shim (`export * from "@ecg/types"`)
   keeping mobile-only view models (e.g. `SerieLocal`) defined locally; migrate all imports
   to `@ecg/types`; then delete the shim.
5. Manually verify alignment against `apps/api/app/schemas/*.py` (fields/nullability).

**GATE 4:** `pnpm typecheck` green (mobile now compiles against shared types); app runs.

---

## PHASE 5 — Design system + shared components

1. Extend `src/theme/`: `spacing.ts` (4/8/12/16/20/24), `radii.ts` (canonical 8/10/12/14),
   `typography.ts` (sizes 11/13/15/17/20/24/32 + weights), `shadows.ts`, and ONE `overlay`
   rgba token (replaces the 5 opacity variants). Export all from `theme/index.ts`.
   Existing `colors.ts` stays as-is.
2. New `src/components/`: `ScreenContainer`, `LoadingScreen`, `ErrorState`, `EmptyState`,
   `Card`, `ListCard`, `AddCard` (dashed), `PrimaryButton`/`SecondaryButton`, `ModalShell`,
   `TopBar` + `ContextMenu` (kills the ×3 duplication), `Chip`/`ChipGroup`,
   `ReorderControls`, `FormInput`/`NumberInput`, `StatusBadge`, `QueryState` (uniform
   loading/error/empty wrapper).
3. Consolidate helpers into `src/utils/formatters.ts` / `src/utils/dates.ts`:
   `formatTime`, `parseApiDateToMs`, `formatDate`, `formatDuration`; delete screen-local
   copies. New `src/hooks/useDebounce.ts` and `src/hooks/useKeyboardHeight.ts`; delete the
   two local duplicates.
4. Placeholder color → always `colors.textMuted`; remove the stray `shadowColor: "#000"`.
5. Adopt the `@/` alias: FIRST add Metro resolution — in `metro.config.js`:
   `config.resolver.extraNodeModules = { "@": path.resolve(projectRoot, "src") }` —
   then migrate imports under `src/`. (Without the Metro change, `@/` compiles but fails
   at runtime.)

**GATE 5:** `pnpm typecheck` + lint green; visual smoke on both roles; grep confirms no
remaining duplicated helpers/components.

---

## PHASE 6 — Screen decomposition & navigation

1. **`SessaoTreinoScreen` (1820 → target <300):** extract `useSessaoTreino` (session
   lifecycle + conflict flow), `useSeriesState` (reducer: local series CRUD/renumbering),
   `PreStartView`, `SessionTimer`, `ExercicioCard` + `SerieRow`, `SubstituicaoModal`,
   `useAutosaveObservacao` (debounced). Route contract unchanged for now.
2. **`CriarExercicioScreen` (1203):** unify form state (move the 5 numeric `useState`
   fields L95-127 into RHF, or drop RHF for one zod schema — pick ONE source of truth);
   extract `ExercicioSearchSelect`, `AlvoTipoSelect`; move the L388-515 validator into a
   pure `validateExercicioForm(values): errors` function.
3. **`ExerciciosScreen` (1157):** move `montarMetadadosGrupoEquivalentes` (BFS L58-117) →
   `src/utils/equivalenceGroups.ts`; reorder logic (L267-338) → `useReorder` hook; extract
   the 3 modals into components.
4. **`AdminUsuariosScreen` (750):** split `AdminPersonaisTab` / `AdminAlunosTab` +
   `useAdminCrud` hook; forms → RHF; fix the `any` keyExtractor (L485) with a
   discriminated union.
5. **Merge duplicated screens:** one `HistoricoTreinosList` + one `DetalheTreinoRealizado`
   parameterized by role (personal vs aluno endpoints/query keys); delete the 2 duplicates.
6. **Navigation:** pass IDs as route params (screens fetch entities via hooks) for
   `SessaoTreino`, `DetalheTreinoRealizado*`, `EditarExercicioBase`, `CriarExercicio`
   (edit mode); type tabs with `NavigatorScreenParams`; delete dead param-list types
   (`PersonalNavigator` L68-74).
7. **Config hygiene:** remove committed LAN/prod IPs from `app.json` `extra` and
   `.env.example`; remove the `https://api.ecg.com/api/v1` placeholder fallback
   (`client.ts` L22) — in production with no `EXPO_PUBLIC_API_URL`, fail fast with a
   clear error instead.
8. **N+1 mitigation:** centralize the ultimo-peso fan-out in `useUltimosPesos(exercicioIds)`
   (parallel `Promise.all` in ONE hook). (A bulk backend endpoint is a separate, additive
   follow-up — do not block on it.)
9. **Tests:** add Jest + `@testing-library/react-native` (dev deps; `"test": "jest"` script;
   `jest.config.js` with `preset: "jest-expo"`); cover `utils/formatters`,
   `utils/equivalenceGroups`, and the `useSeriesState` reducer.

**GATE 6:** `pnpm typecheck` + lint + jest green; manual full pass on both roles
(login → alunos/conjunto → treino → session → séries → history) with seed users.

---

## PHASE 7 — AGENTS.md + docs sync

1. Write root `AGENTS.md` (**English**) with these sections:
   - **Project overview + repo map** (apps/api, apps/mobile, packages/types — what lives where).
   - **Architecture rules:** backend layering (router → deps → service → repository;
     domain exceptions; no `HTTPException` in services); frontend layering
     (screen → hook → service → queryKeys; shared components from `src/components`;
     theme tokens only, no hardcoded values).
   - **Domain glossary:** PT-BR terms ↔ meaning (conjunto, treino, exercício, série,
     vínculo, sessão).
   - **Change checklists** (absorbed from `docs/ai/backend-ai.md` + `frontend-ai.md`):
     sync model+schema+router+seed on domain change; sync `packages/types` on contract
     change; never mask errors as empty lists; ownership deps mandatory on
     personal-scoped endpoints; keep IDs as route params.
   - **Commands:** backend venv/pytest/alembic/seed/reset; mobile pnpm
     start/typecheck/lint/test; root turbo commands.
   - **Conventions:** 204 = `return Response(status_code=204)`; status via `status.HTTP_*`;
     PATCH = `model_dump(exclude_unset=True)`; error JSON `{detail, code, request_id}`;
     PT-BR user messages; timezone-aware datetimes; `.is_(True)`; `@/` import alias.
   - **Security invariants:** ownership-scoped deps, CORS from settings, refresh-token
     revocation, secrets via env only, admin endpoints behind `X-Admin-Key`.
   - **Testing rules:** integration-first for backend (real Postgres via testcontainers or
     `TEST_DATABASE_URL`), unit tests for pure logic; mobile tests for utils/hooks.
   - **Safety:** no destructive DB ops without confirmation; bcrypt pins load-bearing;
     never re-create PG ENUMs twice in one migration.
2. Update `docs/ai/backend-ai.md` + `docs/ai/frontend-ai.md`: slim them to point at
   `AGENTS.md` for shared rules, keeping only scope-specific extras (backend command
   block, frontend base-URL resolution rules).
3. Update `README.md` structure section if the layout changed (new `components/`,
   `hooks/`, `services/`, `seeds/` dirs).

**GATE 7:** docs match the final tree; all previous gates still green.

---

## Appendix — verification commands

```powershell
# Backend (from apps/api)
.venv\Scripts\python.exe -m pytest
.venv\Scripts\python.exe -m alembic -c alembic.ini upgrade head
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Mobile / monorepo (from repo root)
pnpm install
pnpm typecheck
pnpm lint
pnpm --filter @ecg/mobile start
```

Seed users for manual validation: `personal@ecg.com` / `aluno@ecg.com` (password `123456`).
Admin header (dev only): `X-Admin-Key: dev-admin-key-change-in-production`.
Summary of what this plan contains:

- 8 phases (0–7) with explicit verification gates — safety net first, security second, structure after.
- Every gap is anchored to a file + line number so a weaker model can locate it by search even if code drifts.
- The 5 IDOR + vínculo-history bugs are captured as xfail tests in Phase 0 and flipped to passing in Phase 1 — self-verifying security fixes.
- Concrete gotchas embedded: bcrypt pins, Metro alias resolver requirement (the @/ alias would fail at runtime without it), jest-expo preset, the dehydrateOptions location in App.tsx L27-29, and the Dockerfile requirements.txt dependency.
