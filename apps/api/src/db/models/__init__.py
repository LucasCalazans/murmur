"""Exporta todos os modelos para que `SQLModel.metadata` seja completo.

O Alembic importa esse módulo via `migrations/env.py` para autogerar diffs.
"""
from src.db.models.user import User, UserRole

__all__ = ["User", "UserRole"]
