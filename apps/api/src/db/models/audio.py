"""Modelo `AudioRecording` — gravação de áudio do usuário.

Storage: arquivo WAV 16kHz mono PCM s16le em
`apps/api/storage/audio/{user_id}/{id}.wav` (bind-mountado em /app/storage).
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Column, ForeignKey
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AudioRecording(SQLModel, table=True):
    __tablename__ = "audio_recordings"

    id: UUID = Field(default_factory=uuid4, primary_key=True)
    user_id: UUID = Field(
        sa_column=Column(
            "user_id",
            ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
    )
    note_id: UUID | None = Field(
        default=None,
        sa_column=Column(
            "note_id",
            ForeignKey("notes.id", ondelete="SET NULL"),
            nullable=True,
            index=True,
        ),
    )

    # Path relativo a `settings.audio_storage_path` (ex.: "{user_id}/{id}.wav").
    file_path: str = Field(max_length=512)
    # Formato original enviado pelo cliente (mime ou extensão, pra rastreio).
    original_format: str = Field(max_length=64, default="")
    # Após conversão sempre WAV. Mantemos por se um dia parar de converter.
    mime_type: str = Field(max_length=64, default="audio/wav")
    duration_seconds: float = Field(default=0.0)
    file_size_bytes: int = Field(default=0)

    created_at: datetime = Field(
        default_factory=_utcnow,
        sa_column=Column(TIMESTAMP(timezone=True), nullable=False),
    )
