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

# Reset completo do banco dev (destrutivo)
python reset_dev_db.py --force

# Iniciar servidor
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Ou, pela raiz do monorepo (atalho)
pnpm api
```

### 2.1 Deploy em Droplet (Docker Compose)

Arquivos de deploy para Droplet:

- `deploy/docker-compose.yml`
- `deploy/.env.example`
- `apps/api/Dockerfile`

Passo a passo no servidor (Ubuntu):

```bash
# 1) Clonar o repo
git clone <seu-repo>
cd egt

# 2) Configurar variaveis de producao
cp deploy/.env.example deploy/.env
nano deploy/.env

# 3) Subir API + PostgreSQL
docker compose --env-file deploy/.env -f deploy/docker-compose.yml up -d --build

# 4) Verificar containers e logs
docker compose -f deploy/docker-compose.yml ps
docker compose -f deploy/docker-compose.yml logs -f api
```

Smoke test:

```bash
curl -i http://<IP_DO_DROPLET>:8000/health
```

Observacoes importantes para producao:

- Mantenha `ENVIRONMENT=production`, `SECRET_KEY` e `ADMIN_API_KEY` fortes.
- Nao exponha a porta 5432 do PostgreSQL publicamente.
- Configure backup periodico do banco (pg_dump + snapshots).
- Se usar dominio e HTTPS, coloque um reverse proxy (Nginx/Caddy) na frente da API.

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
