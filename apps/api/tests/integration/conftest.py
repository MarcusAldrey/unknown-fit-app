import asyncio
import os
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.config import get_settings
from app.database import get_db
from app.main import app


def _to_asyncpg_url(url: str) -> str:
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql+") and "://" in url:
        scheme, _, rest = url.partition("://")
        return f"postgresql+asyncpg://{rest}"
    return url


@pytest.fixture(scope="session")
def test_db_url() -> str:
    env_url = os.environ.get("TEST_DATABASE_URL")
    if env_url:
        yield _to_asyncpg_url(env_url)
        return

    from testcontainers.postgres import PostgresContainer

    container = PostgresContainer("postgres:15")
    container.start()
    yield _to_asyncpg_url(container.get_connection_url())
    container.stop()


@pytest.fixture(scope="session")
async def test_engine(test_db_url: str):
    engine = create_async_engine(test_db_url)
    yield engine
    await engine.dispose()


@pytest.fixture(scope="session")
def apply_migrations(test_db_url: str):
    os.environ["DATABASE_URL"] = test_db_url
    get_settings.cache_clear()

    from alembic import command
    from alembic.config import Config

    project_dir = Path(__file__).resolve().parents[2]
    cfg = Config(str(project_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(project_dir / "alembic"))
    command.upgrade(cfg, "head")

    async def _seed() -> None:
        import app.seed as seed_module

        engine = create_async_engine(test_db_url)
        sessionmaker = async_sessionmaker(
            engine, class_=AsyncSession, expire_on_commit=False
        )
        seed_module.engine = engine
        seed_module.async_session = sessionmaker
        try:
            await seed_module.seed()
        finally:
            await engine.dispose()

    asyncio.run(_seed())
    yield


@pytest.fixture
async def db_session(test_engine, apply_migrations):
    async with test_engine.connect() as conn:
        trans = await conn.begin()
        session = AsyncSession(
            bind=conn,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        try:
            yield session
        finally:
            await session.close()
            await trans.rollback()


@pytest.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def admin_headers() -> dict[str, str]:
    return {"X-Admin-Key": "dev-admin-key-change-in-production"}


async def _login(client: AsyncClient, email: str, senha: str) -> str:
    resp = await client.post("/api/v1/auth/login", json={"email": email, "senha": senha})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def personal_token(client) -> str:
    return await _login(client, "personal@kine.com", "123456")


@pytest.fixture
async def aluno_token(client) -> str:
    return await _login(client, "aluno@kine.com", "123456")
