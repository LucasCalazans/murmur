"""Murmur API — entrypoint FastAPI."""
from __future__ import annotations

from contextlib import suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import audio as audio_routes
from src.api.routes import auth as auth_routes
from src.api.routes import debug as debug_routes
from src.api.routes import notes as notes_routes
from src.api.routes import transcripts as transcripts_routes
from src.core.config import get_settings, validate_clerk_config
from src.core.logging import init_logging, install_request_logging
from src.services.llm import LLMConfigError, validate_llm_config


def create_app() -> FastAPI:
    settings = get_settings()
    init_logging(settings)
    validate_clerk_config(settings)

    # LLM config: validar quando provider tem chave/url definida.
    # Em dev sem chave, só registra warning — `/debug/llm` retorna 503 quando chamado.
    with suppress(LLMConfigError):
        validate_llm_config(settings)

    app = FastAPI(
        title="Murmur API",
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-Id"],
    )

    install_request_logging(app)

    app.include_router(auth_routes.router)
    app.include_router(notes_routes.router)
    app.include_router(audio_routes.router)
    app.include_router(transcripts_routes.audio_router)
    app.include_router(transcripts_routes.transcript_router)
    if settings.app_env != "production":
        app.include_router(debug_routes.router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "murmur-api",
            "env": settings.app_env,
        }

    return app


app = create_app()
