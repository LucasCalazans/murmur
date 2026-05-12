"""AsyncEngine + sessionmaker globais.

Padrão alinhado com o `prism`: uma engine, sessionmaker singleton e função
`get_session` async-context-manager para uso fora de FastAPI.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from src.core.config import get_settings


settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=settings.app_env == "development" and False,  # ligar pra debugar SQL
    pool_pre_ping=True,
)

SessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


async def get_session() -> AsyncIterator[AsyncSession]:
    """Yield de session — usado como FastAPI dependency."""
    async with SessionLocal() as session:
        yield session
