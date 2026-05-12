"""Modelo `Note` — nota markdown do usuário.

Tags ficam como `text[]` do Postgres por simplicidade — array column é trivial
de filtrar (`tags && ARRAY['x']`) e migrar pra tabela própria depois se virar grande.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY, TIMESTAMP
from sqlmodel import Field, SQLModel
from sqlalchemy import String as SAString
from sqlalchemy import Text


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Note(SQLModel, table=True):
    __tablename__ = "notes"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    owner_id: UUID = Field(
        sa_column=Column(
            "owner_id",
            ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    title: str = Field(max_length=200, default="")
    # Markdown cru. Tamanho ilimitado — TEXT.
    content: str = Field(sa_column=Column(Text, nullable=False, server_default=""))
    tags: list[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(SAString(64)), nullable=False, server_default="{}"),
    )

    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False),
    )
