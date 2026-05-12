"""Modelo `SuggestedAction` — ação sugerida pela LLM a partir de uma nota.

Cada nota pode ter N sugestões. O tipo (`action_type`) guia o ícone e o
formato esperado do `payload` no frontend. Mantemos como string em vez de
enum estrito pra que a LLM possa propor tipos novos sem migration — a UI
trata `task` como fallback pra qualquer tipo desconhecido.
"""
from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlmodel import Field, SQLModel
from sqlalchemy import Text


class SuggestedActionStatus(str, Enum):
    PENDING = "pending"
    DONE = "done"
    DISMISSED = "dismissed"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# Tipos "canônicos" que a UI tem ícone próprio. LLM pode usar qualquer outro
# string — o frontend cai num ícone genérico de tarefa.
ACTION_TYPES = (
    "calendar_event",
    "reminder",
    "contact",
    "research",
    "tip",
    "task",
)


class SuggestedAction(SQLModel, table=True):
    __tablename__ = "suggested_actions"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    note_id: UUID = Field(
        sa_column=Column(
            "note_id",
            ForeignKey("notes.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    action_type: str = Field(max_length=32, default="task")
    title: str = Field(max_length=200)
    description: str = Field(sa_column=Column(Text, nullable=False, server_default=""))
    source_text: str = Field(sa_column=Column(Text, nullable=False, server_default=""))
    payload: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSONB, nullable=False, server_default="{}"),
    )
    status: SuggestedActionStatus = Field(default=SuggestedActionStatus.PENDING)

    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False),
    )
