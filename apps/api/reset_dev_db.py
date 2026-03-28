"""Reset do banco de desenvolvimento com migração única.

Uso:
  python reset_dev_db.py --force
  python reset_dev_db.py --force --no-seed
"""

from __future__ import annotations

import argparse
import asyncio
import subprocess
import sys
from pathlib import Path

from sqlalchemy import text

from app.database import engine

PROJECT_DIR = Path(__file__).resolve().parent


def _run(cmd: list[str]) -> None:
    subprocess.run(cmd, cwd=PROJECT_DIR, check=True)


async def _reset_public_schema() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        await conn.execute(text("CREATE SCHEMA public"))
    await engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Reseta o schema public e reaplica as migrações do backend.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Confirma execução destrutiva (obrigatório).",
    )
    parser.add_argument(
        "--no-seed",
        action="store_true",
        help="Não executa o seed após aplicar migrações.",
    )
    args = parser.parse_args()

    if not args.force:
        print("Operação destrutiva bloqueada. Use --force para continuar.")
        return 2

    print("[1/3] Resetando schema public...")
    asyncio.run(_reset_public_schema())

    print("[2/3] Aplicando migrações...")
    _run([sys.executable, "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"])

    if not args.no_seed:
        print("[3/3] Executando seed...")
        _run([sys.executable, "-m", "app.seed"])
    else:
        print("[3/3] Seed ignorado (--no-seed).")

    print("Reset concluído com sucesso.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
