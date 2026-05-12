"""Schemas Pydantic para `Transcript`."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from src.db.models.transcript import TranscriptStatus


class TranscriptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    audio_id: UUID
    status: TranscriptStatus
    text: str
    segments: list[dict[str, Any]] | None
    language: str
    model_size: str
    error_message: str
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class TranscriptUpdate(BaseModel):
    """Edição manual — só o texto é editável."""

    text: str
