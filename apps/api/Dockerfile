# syntax=docker/dockerfile:1.7

# ---------- base ----------
# Python 3.11 slim + ffmpeg (necessário pro faster-whisper decodificar áudio).
# libgomp1 é dependência runtime do CTranslate2 (backend do faster-whisper).
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    POETRY_VIRTUALENVS_CREATE=false

RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg \
        libgomp1 \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ---------- deps ----------
# Instala dependências separadas do código para cachear bem o layer.
FROM base AS deps

COPY pyproject.toml ./
# Instala usando pip a partir do pyproject (PEP 621). `-e .` daria editable,
# mas em container preferimos instalação normal pra não depender do bind mount.
RUN pip install --upgrade pip && \
    pip install ".[dev]"

# ---------- dev ----------
# Imagem usada em desenvolvimento. O código vem por bind mount (ver compose),
# então não copiamos `src/` aqui — uvicorn --reload pega as mudanças do host.
FROM deps AS dev

ENV APP_ENV=development \
    PYTHONPATH=/app

# Pasta onde os áudios serão salvos (bind-mountada do host em dev)
RUN mkdir -p /app/storage/audio

EXPOSE 3001

# --reload + --reload-dir restringe o watcher pra não escanear node_modules etc.
CMD ["uvicorn", "src.main:app", \
     "--host", "0.0.0.0", \
     "--port", "3001", \
     "--reload", \
     "--reload-dir", "/app/src"]

# ---------- prod ----------
# Imagem enxuta pra produção: copia o código no build, sem --reload.
FROM deps AS prod

ENV APP_ENV=production \
    PYTHONPATH=/app

COPY src ./src
COPY migrations ./migrations
COPY alembic.ini ./alembic.ini

RUN mkdir -p /app/storage/audio

EXPOSE 3001

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "3001", "--workers", "2"]
