#!/usr/bin/env sh
set -eu

echo "[entrypoint] applying migrations"
python -m alembic -c alembic.ini upgrade head

echo "[entrypoint] starting api"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir .
