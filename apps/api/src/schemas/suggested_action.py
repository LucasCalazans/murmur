"""Schemas Pydantic para `SuggestedAction`."""
from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from src.db.models.suggested_action import SuggestedActionStatus


class SuggestedActionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    note_id: UUID
    action_type: str
    title: str
    description: str
    source_text: str
    payload: dict[str, Any]
    status: SuggestedActionStatus
    created_at: datetime
    updated_at: datetime


class SuggestedActionList(BaseModel):
    items: list[SuggestedActionOut]


class SuggestedActionUpdate(BaseModel):
    status: SuggestedActionStatus | None = None
    title: str | None = None
    description: str | None = None
