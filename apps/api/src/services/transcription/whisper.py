"""Wrapper sobre faster-whisper.

Modelo carregado **lazy** no primeiro uso (não no boot) — o load demora alguns
segundos e ocupa memória. Não queremos que `docker compose up` espere por isso.

Roda em executor pra não bloquear o event loop async: `to_thread` envolve a
chamada síncrona do whisper.
"""
from __future__ import annotations

import asyncio
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from faster_whisper import WhisperModel
from loguru import logger

from src.core.config import Settings


@dataclass
class TranscriptionResult:
    text: str
    segments: list[dict[str, Any]]
    language: str
    model_size: str


_model: WhisperModel | None = None
_model_lock = threading.Lock()


def _get_model(settings: Settings) -> WhisperModel:
    """Lazy singleton. Thread-safe."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                logger.bind(
                    model_size=settings.whisper_model_size,
                    device=settings.whisper_device,
                    compute_type=settings.whisper_compute_type,
                ).info("carregando modelo whisper (pode demorar alguns segundos)")
                _model = WhisperModel(
                    settings.whisper_model_size,
                    device=settings.whisper_device,
                    compute_type=settings.whisper_compute_type,
                    download_root="/cache/huggingface",
                )
                logger.info("modelo whisper carregado")
    return _model


def _transcribe_sync(file_path: Path, settings: Settings) -> TranscriptionResult:
    model = _get_model(settings)
    language: str | None = settings.whisper_language if settings.whisper_language != "auto" else None
    segments_iter, info = model.transcribe(
        str(file_path),
        language=language,
        # `vad_filter` corta silêncios — melhora velocidade e qualidade em áudios reais.
        vad_filter=True,
    )
    segments: list[dict[str, Any]] = []
    text_parts: list[str] = []
    for seg in segments_iter:
        segments.append(
            {
                "id": seg.id,
                "start": seg.start,
                "end": seg.end,
                "text": seg.text,
                "no_speech_prob": getattr(seg, "no_speech_prob", None),
            }
        )
        text_parts.append(seg.text)

    return TranscriptionResult(
        text="".join(text_parts).strip(),
        segments=segments,
        language=info.language or "",
        model_size=settings.whisper_model_size,
    )


async def transcribe(file_path: Path, settings: Settings) -> TranscriptionResult:
    """Async wrapper — roda em thread pra não bloquear o event loop."""
    return await asyncio.to_thread(_transcribe_sync, file_path, settings)
