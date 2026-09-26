#!/usr/bin/env sh
set -eu

echo "[entrypoint] waiting for database to be ready..."
python - << 'EOF'
import os, time, socket
from urllib.parse import urlsplit

url = os.getenv("DATABASE_URL", "")
if url:
    host = urlsplit(url).hostname or "db"
    port = urlsplit(url).port or 5432
    for _ in range(30):
        try:
            with socket.create_connection((host, port), timeout=2):
                print(f"[entrypoint] Database is ready at {host}:{port}")
                break
        except OSError:
            time.sleep(1)
EOF

echo "[entrypoint] applying migrations"
python -m alembic -c alembic.ini upgrade head

echo "[entrypoint] starting api"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --app-dir .

