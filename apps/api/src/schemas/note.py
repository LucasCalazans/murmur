"""Schemas Pydantic para `Note`."""
from __future__ import annotations

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class NoteCreate(BaseModel):
    title: str = Field(default="", max_length=200)
    content: str = ""
    tags: list[str] = Field(default_factory=list, max_length=32)


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    content: str | None = None
    tags: list[str] | None = Field(default=None, max_length=32)


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    owner_id: UUID
    title: str
    content: str
    tags: list[str]
    created_at: datetime
    updated_at: datetime


class NoteList(BaseModel):
    items: list[NoteOut]
    total: int


SortField = Literal["updated_at", "created_at", "title"]
SortOrder = Literal["asc", "desc"]
