"""Configurações tipadas da API.

Lê do ambiente (`docker-compose` passa as vars). Validação acontece no boot —
se algo essencial faltar (DB ou chaves da Clerk em produção), a aplicação não sobe.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ---------- App ----------
    app_env: Literal["development", "test", "production"] = "development"
    app_port: int = 3001
    cors_origin: str = "http://localhost:5173"

    # ---------- Banco ----------
    database_url: str = Field(
        ...,
        description="URL async (asyncpg). Ex.: postgresql+asyncpg://user:pass@host:5432/db",
    )
    database_url_sync: str = Field(
        ...,
        description="URL síncrona (psycopg). Usada apenas pelo Alembic.",
    )

    # ---------- Clerk (auth gerenciada) ----------
    # Em dev local, faltar essas chaves é tolerável — só /auth/* falha.
    # Em produção, valida_clerk_config() impõe que estejam presentes.
    clerk_secret_key: str | None = None
    clerk_publishable_key: str | None = None
    clerk_webhook_secret: str | None = None
    # `authorized_parties` é a lista de origens aceitas pelo authenticate_request.
    # Vírgula separa múltiplos hosts.
    clerk_authorized_parties: str = "http://localhost:5173"

    # Email do dono — primeiro login com esse email vira role=owner automaticamente.
    owner_email: str = "calazans95@hotmail.com"

    # ---------- LLM (será usado na Fase 2) ----------
    llm_provider: Literal["anthropic", "openai", "ollama"] = "anthropic"
    llm_model: str = "claude-sonnet-4-6"
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    ollama_base_url: str | None = None
    ollama_model: str | None = None

    # ---------- Transcrição (Fase 6) ----------
    whisper_model_size: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    whisper_language: str = "pt"

    # ---------- Armazenamento ----------
    audio_storage_path: str = "/app/storage/audio"
    max_audio_size_mb: int = 100

    @property
    def authorized_parties_list(self) -> list[str]:
        return [p.strip() for p in self.clerk_authorized_parties.split(",") if p.strip()]

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origin.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


def validate_clerk_config(settings: Settings) -> None:
    """Falha cedo em produção se a Clerk não estiver configurada."""
    if settings.app_env != "production":
        return
    if not settings.clerk_secret_key or not settings.clerk_publishable_key:
        raise RuntimeError(
            "CLERK_SECRET_KEY e CLERK_PUBLISHABLE_KEY são obrigatórios em produção."
        )
