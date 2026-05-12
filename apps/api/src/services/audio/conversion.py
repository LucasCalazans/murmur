"""Normalização de áudio via ffmpeg.

Qualquer formato suportado pelo ffmpeg vira WAV 16kHz mono PCM s16le —
o "canônico" pra ML/Whisper. Roda em executor pra não bloquear o event loop.
"""
from __future__ import annotations

import asyncio
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


class FFmpegError(RuntimeError):
    pass


@dataclass(frozen=True)
class AudioInfo:
    duration_seconds: float
    sample_rate: int
    channels: int


def _require_ffmpeg() -> str:
    path = shutil.which("ffmpeg")
    if path is None:
        raise FFmpegError("ffmpeg não encontrado no PATH (imagem deveria ter — ver Dockerfile).")
    return path


def _require_ffprobe() -> str:
    path = shutil.which("ffprobe")
    if path is None:
        raise FFmpegError("ffprobe não encontrado no PATH.")
    return path


def _probe_sync(path: Path) -> AudioInfo:
    """ffprobe pra duração + sample rate. Síncrono — chamado via to_thread."""
    ffprobe = _require_ffprobe()
    cmd = [
        ffprobe,
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=sample_rate,channels:format=duration",
        "-of", "default=noprint_wrappers=1:nokey=0",
        str(path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise FFmpegError(f"ffprobe falhou: {proc.stderr.strip()}")

    duration = 0.0
    sample_rate = 0
    channels = 0
    for line in proc.stdout.splitlines():
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key == "duration":
            try:
                duration = float(value)
            except ValueError:
                pass
        elif key == "sample_rate":
            try:
                sample_rate = int(value)
            except ValueError:
                pass
        elif key == "channels":
            try:
                channels = int(value)
            except ValueError:
                pass

    return AudioInfo(duration_seconds=duration, sample_rate=sample_rate, channels=channels)


def _convert_sync(src: Path, dst: Path) -> None:
    """ffmpeg: qualquer formato → WAV 16kHz mono PCM s16le. Síncrono."""
    ffmpeg = _require_ffmpeg()
    cmd = [
        ffmpeg,
        "-y",                     # sobrescrever
        "-i", str(src),
        "-ac", "1",               # mono
        "-ar", "16000",           # 16 kHz (Whisper expectation)
        "-c:a", "pcm_s16le",      # PCM s16 little-endian
        "-vn",                    # sem vídeo
        "-loglevel", "error",
        str(dst),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise FFmpegError(f"ffmpeg falhou: {proc.stderr.strip()}")


async def convert_to_wav(src: Path, dst: Path) -> AudioInfo:
    """Converte `src` para WAV 16kHz mono em `dst`. Retorna metadados do destino."""
    await asyncio.to_thread(_convert_sync, src, dst)
    return await asyncio.to_thread(_probe_sync, dst)


async def probe(path: Path) -> AudioInfo:
    """Apenas inspeciona — usado pra validar duração antes de aceitar upload."""
    return await asyncio.to_thread(_probe_sync, path)
