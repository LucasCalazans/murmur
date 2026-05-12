"""Murmur API — entrypoint FastAPI.

Fase 1: auth gerenciada pela Clerk. As rotas de `/auth/*` validam o session token
emitido no frontend e fazem upsert do usuário local na primeira chamada.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import auth as auth_routes
from src.core.config import get_settings, validate_clerk_config


def create_app() -> FastAPI:
    settings = get_settings()
    validate_clerk_config(settings)

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
    )

    app.include_router(auth_routes.router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "murmur-api",
            "env": settings.app_env,
        }

    return app


app = create_app()
