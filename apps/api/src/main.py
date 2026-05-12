"""Murmur API — bootstrap mínimo da Fase 0.

Expõe apenas `/health` para validar que o container subiu e o Postgres está
acessível. Auth, notas, áudio e LLM entram nas próximas fases.
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def create_app() -> FastAPI:
    app = FastAPI(
        title="Murmur API",
        version="0.1.0",
    )

    cors_origin = os.getenv("CORS_ORIGIN", "http://localhost:5173")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[o.strip() for o in cors_origin.split(",") if o.strip()],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "murmur-api",
            "env": os.getenv("APP_ENV", "development"),
        }

    return app


app = create_app()
