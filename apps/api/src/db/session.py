"""AsyncEngine + sessionmaker globais.

Usa `sqlmodel.ext.asyncio.session.AsyncSession` (wrapper sobre o do SQLAlchemy)
porque ela expõe `.exec()` integrando com queries do SQLModel.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.config import get_settings


settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=False,  # ligar pra debugar SQL
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
