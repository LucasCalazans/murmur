"""Schemas Pydantic para `AudioRecording`."""
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AudioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    note_id: UUID | None
    original_format: str
    mime_type: str
    duration_seconds: float
    file_size_bytes: int
    created_at: datetime


class AudioList(BaseModel):
    items: list[AudioOut]
    total: int
