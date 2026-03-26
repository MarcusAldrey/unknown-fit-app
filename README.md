# ECG — Elite Training Gym

Monorepo MVP para aplicação de academia com app mobile React Native (Personal + Aluno) e backend FastAPI.

## Estrutura

```
apps/
  api/          → Backend FastAPI (Python)
  mobile/       → App React Native com Expo (iOS + Android)
packages/
  types/        → Tipos TypeScript compartilhados
```

## Pré-requisitos

- Node.js 20+
- pnpm 9+
- Python 3.11+
- PostgreSQL 15+

## Setup

### 1. Instalar dependências do monorepo

```bash
pnpm install
```

### 2. Backend

```bash
cd apps/api
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -e ".[dev]"
```

Copie o `.env.example` para `.env` na raiz e ajuste a `DATABASE_URL`.

```bash
# Criar tabelas e rodar seed
python -m app.seed

# Rodar migrações (quando houver)
alembic upgrade head

# Iniciar servidor
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Ou, pela raiz do monorepo (atalho)
pnpm api
```

### 3. Mobile

```bash
cd apps/mobile
pnpm install
pnpm start
```

Escaneie o QR Code com o Expo Go ou rode em emulador.

## Documentação

Consulte o [guide.md](guide.md) para detalhes sobre arquitetura, domínio, fluxos e endpoints.
