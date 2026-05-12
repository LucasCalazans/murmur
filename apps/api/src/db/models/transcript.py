"""Modelo `Transcript` — resultado da transcrição assíncrona de um áudio.

Estados: `pending` (criado, ainda na fila), `running` (whisper rodando),
`done` (texto pronto), `failed` (erro guardado em `error_message`).
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


class TranscriptStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Transcript(SQLModel, table=True):
    __tablename__ = "transcripts"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    audio_id: UUID = Field(
        sa_column=Column(
            "audio_id",
            ForeignKey("audio_recordings.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
            unique=True,
        ),
    )

    status: TranscriptStatus = Field(default=TranscriptStatus.PENDING)
    text: str = Field(sa_column=Column(Text, nullable=False, server_default=""))
    segments: list[dict[str, Any]] | None = Field(
        default=None, sa_column=Column(JSONB, nullable=True)
    )
    language: str = Field(default="", max_length=8)
    model_size: str = Field(default="", max_length=32)
    error_message: str = Field(default="", max_length=1024)

    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False),
    )
    started_at: datetime | None = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
    completed_at: datetime | None = Field(
        default=None,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=True),
    )
