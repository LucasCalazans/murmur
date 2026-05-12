"""Exporta todos os modelos para que `SQLModel.metadata` seja completo.

O Alembic importa esse módulo via `migrations/env.py` para autogerar diffs.
"""
from src.db.models.audio import AudioRecording
from src.db.models.note import Note
from src.db.models.suggested_action import SuggestedAction, SuggestedActionStatus
from src.db.models.transcript import Transcript, TranscriptStatus
from src.db.models.user import User, UserRole

__all__ = [
    "AudioRecording",
    "Note",
    "SuggestedAction",
    "SuggestedActionStatus",
    "Transcript",
    "TranscriptStatus",
    "User",
    "UserRole",
]
