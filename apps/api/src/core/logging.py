"""Logging estruturado com loguru.

- Output JSON em `apps/api/logs/api.log` (bind-mountado no host).
- stdout em formato humano (pra `docker compose logs`).
- Rotação diária + retenção de 14 dias + compressão zstd.
- Propagação automática de `request_id` e `user_id` via `contextvars`.
- Middleware de access log com path, method, status, duration_ms.
- Hijack do logging stdlib pra que libs (uvicorn, sqlalchemy, etc.) também
  caiam no mesmo pipeline JSON.
"""
from __future__ import annotations

import logging
import sys
import time
import uuid
from contextvars import ContextVar
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Request
from loguru import logger
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from src.core.config import Settings

# Contexto compartilhado entre middleware e handlers.
_request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
_user_id_var: ContextVar[str | None] = ContextVar("user_id", default=None)


def current_request_id() -> str | None:
    return _request_id_var.get()


def bind_user_id(user_id: str | None) -> None:
    """Chamada de `get_current_user` pra anexar user no log da request."""
    _user_id_var.set(user_id)


def _inject_context(record: dict[str, Any]) -> None:
    """Patcher do loguru — adiciona request_id/user_id em todo log emitido durante uma request."""
    record["extra"].setdefault("request_id", _request_id_var.get())
    record["extra"].setdefault("user_id", _user_id_var.get())


class _StdlibInterceptHandler(logging.Handler):
    """Faz `logging` da stdlib (uvicorn, sqlalchemy, etc.) sair pelo loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        frame, depth = logging.currentframe(), 2
        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1
        logger.opt(depth=depth, exception=record.exc_info).log(level, record.getMessage())


def init_logging(settings: Settings) -> None:
    """Configura loguru. Idempotente — chamável várias vezes (uvicorn --reload)."""
    logger.remove()

    is_dev = settings.app_env == "development"

    # stdout: formato humano (curto, fácil de ler em `docker logs`).
    logger.add(
        sys.stdout,
        level="DEBUG" if is_dev else "INFO",
        format=(
            "<green>{time:HH:mm:ss.SSS}</green> "
            "<level>{level: <8}</level> "
            "<cyan>{extra[request_id]!s:.8}</cyan> "
            "<cyan>{name}:{function}:{line}</cyan> "
            "<level>{message}</level>"
        ),
        colorize=True,
        backtrace=is_dev,
        diagnose=is_dev,
    )

    # Arquivo: JSON estruturado por linha. Path absoluto pra evitar surpresas com CWD.
    log_path = Path("/app/logs/api.log")
    log_path.parent.mkdir(parents=True, exist_ok=True)
    logger.add(
        str(log_path),
        level="INFO",
        serialize=True,  # JSON por linha
        rotation="00:00",
        retention="14 days",
        compression="gz",
        enqueue=True,    # thread-safe via fila — não bloqueia handlers async
    )

    logger.configure(patcher=_inject_context)

    # Captura logs da stdlib (uvicorn, fastapi, sqlalchemy...).
    logging.root.handlers = [_StdlibInterceptHandler()]
    logging.root.setLevel(logging.INFO)
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "fastapi", "sqlalchemy.engine"):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True

    logger.info("logging inicializado (env={})", settings.app_env)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Atribui request_id (header `X-Request-Id` ou UUID novo) e mede duração."""

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex
        token = _request_id_var.set(request_id)
        user_token = _user_id_var.set(None)
        start = time.perf_counter()
        status_code = 500
        try:
            response: Response = await call_next(request)
            status_code = response.status_code
            response.headers["X-Request-Id"] = request_id
            return response
        finally:
            duration_ms = round((time.perf_counter() - start) * 1000, 2)
            logger.bind(
                http_path=request.url.path,
                http_method=request.method,
                http_status=status_code,
                duration_ms=duration_ms,
                client=request.client.host if request.client else None,
            ).info("request")
            _request_id_var.reset(token)
            _user_id_var.reset(user_token)


def install_request_logging(app: FastAPI) -> None:
    app.add_middleware(RequestLoggingMiddleware)
