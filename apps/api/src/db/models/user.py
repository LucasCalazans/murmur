"""Modelo `User` — espelho leve dos usuários da Clerk no nosso Postgres.

A Clerk é fonte de verdade de email/senha/MFA. A gente guarda só o necessário
pra anexar dados (notas, áudios, transcrições) e aplicar permissões locais
(`owner`/`editor`/`viewer`).
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlmodel import Field, SQLModel


class UserRole(str, Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    # `sub` do JWT da Clerk — `user_xxx`. Único, indexado.
    clerk_user_id: str = Field(index=True, unique=True, max_length=64)
    email: str = Field(index=True, max_length=254)
    role: UserRole = Field(default=UserRole.EDITOR)

    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False),
    )
