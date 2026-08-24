import asyncio
import os
import uuid
from pathlib import Path

import sqlalchemy as sa
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command
from alembic.config import Config

from app.config import get_settings

PROJECT_DIR = Path(__file__).resolve().parents[2]


def test_migracao_sobe_desce_e_sobe(test_db_url: str):
    dbname = f"mig_smoke_{uuid.uuid4().hex[:8]}"
    tmp_url = make_url(test_db_url).set(database=dbname).render_as_string(hide_password=False)

    async def _admin(sql: str) -> None:
        engine = create_async_engine(test_db_url, isolation_level="AUTOCOMMIT")
        async with engine.connect() as conn:
            await conn.execute(sa.text(sql))
        await engine.dispose()

    asyncio.run(_admin(f'CREATE DATABASE "{dbname}"'))

    os.environ["DATABASE_URL"] = tmp_url
    get_settings.cache_clear()

    cfg = Config(str(PROJECT_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(PROJECT_DIR / "alembic"))

    try:
        command.upgrade(cfg, "head")
        command.downgrade(cfg, "base")
        command.upgrade(cfg, "head")
    finally:
        asyncio.run(_admin(f'DROP DATABASE IF EXISTS "{dbname}"'))
        os.environ["DATABASE_URL"] = test_db_url
        get_settings.cache_clear()
