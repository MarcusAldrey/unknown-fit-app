# Kine

Monorepo MVP para aplicação de academia com app mobile React Native (Personal + Aluno) e backend FastAPI.

## Estrutura

```
apps/
  api/          → Backend FastAPI (Python)
    app/
      domain/       → enums (fonte única)
      models/       → SQLAlchemy models
      schemas/      → Pydantic schemas
      routers/      → HTTP routers (personal/ é um pacote)
      services/     → lógica de negócio
    alembic/     → migrations
    seeds/       → fixtures de seed
  mobile/       → App React Native com Expo (iOS + Android)
    src/
      api/         → client + queryKeys + services/
      hooks/       → React Query hooks
      components/  → componentes compartilhados
      theme/       → design tokens
packages/
  types/        → Tipos TypeScript compartilhados (@kine/types)
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

# Reset completo do banco dev (destrutivo)
python reset_dev_db.py --force

# Iniciar servidor
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Ou, pela raiz do monorepo (atalho)
pnpm api
```

### 2.1 Deploy em Produção (Oracle Cloud / Docker Compose)

A infraestrutura de produção utiliza Docker Compose com FastAPI e PostgreSQL 15:

- `docker-compose.yml` (na raiz do monorepo)
- `apps/api/Dockerfile`
- `apps/api/entrypoint.sh` (com checagem automática de prontidão do banco e migrações Alembic)

Passo a passo no servidor (Ubuntu 24.04 na Oracle Cloud):

```bash
# 1) Clonar o repositório
git clone https://github.com/MarcusAldrey/unknown-fit-app.git
cd unknown-fit-app

# 2) Criar arquivo de variáveis de ambiente (.env)
cat << 'EOF' > .env
ENVIRONMENT=production
POSTGRES_PASSWORD=sua-senha-segura-aqui
SECRET_KEY=sua-chave-secreta-jwt-aqui
ADMIN_API_KEY=sua-chave-admin-aqui
CORS_ORIGINS=*
EOF

# 3) Subir os containers (API + PostgreSQL)
docker compose up -d --build

# 4) Verificar status e logs
docker compose ps
docker compose logs -f api

# 5) Popular banco de dados inicial (Seed)
docker compose exec api python -m app.seed
```

Smoke test:

```bash
curl -i http://<IP_DO_SERVIDOR>:8000/docs
```

Observações importantes para produção:

- Mantenha `ENVIRONMENT=production`, `SECRET_KEY` e `ADMIN_API_KEY` fortes.
- O acesso visual ao PostgreSQL deve ser feito preferencialmente via **SSH Tunnel** (porta 5432 direcionada para localhost).
- Em máquinas com 1 GB de RAM (como `VM.Standard.E2.1.Micro`), configure um swap file de 2 GB (`sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`).


### 3. Mobile

```bash
cd apps/mobile
pnpm install
pnpm start
```

Para habilitar a tela de gestão de usuários (Admin) no app mobile, defina:

```bash
EXPO_PUBLIC_ADMIN_API_KEY=sua-chave-admin-aqui
```

Para apontar o mobile para a API em Droplet durante build/dev:

```bash
EXPO_PUBLIC_API_URL=http://<IP_OU_DOMINIO_DO_DROPLET>:8000/api/v1
```

Escaneie o QR Code com o Expo Go ou rode em emulador.

## Documentação

Consulte o [guide.md](guide.md) para detalhes sobre arquitetura, domínio, fluxos e endpoints.

Guias para uso com IA:

- [docs/ai/frontend-ai.md](docs/ai/frontend-ai.md)
- [docs/ai/backend-ai.md](docs/ai/backend-ai.md)
