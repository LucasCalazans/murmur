"""Rotas de transcrição.

POST /audio/{id}/transcribe → cria Transcript(status=pending), enfileira
BackgroundTask, retorna 202 com o objeto inicial.

GET /transcripts/{id}, GET /audio/{id}/transcript, PATCH /transcripts/{id}
seguem padrões usuais.

A BackgroundTask vive no event loop do FastAPI; pra carga real (vários áudios
em paralelo) faria sentido mover pra Celery/RQ/arq depois. Por enquanto basta.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from loguru import logger
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.api.deps import get_current_user, get_db
from src.core.config import Settings, get_settings
from src.db.models.audio import AudioRecording
from src.db.models.transcript import Transcript, TranscriptStatus
from src.db.models.user import User, UserRole
from src.db.session import SessionLocal
from src.schemas.transcript import TranscriptOut, TranscriptUpdate
from src.services.transcription.whisper import transcribe

audio_router = APIRouter(prefix="/audio", tags=["transcripts"])
transcript_router = APIRouter(prefix="/transcripts", tags=["transcripts"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _load_audio(audio_id: UUID, db: AsyncSession, user: User) -> AudioRecording:
    audio = await db.get(AudioRecording, audio_id)
    if audio is None or (user.role != UserRole.OWNER and audio.user_id != user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "audio_not_found", "message": "Áudio não encontrado."}},
        )
    return audio


async def _load_transcript(
    transcript_id: UUID, db: AsyncSession, user: User
) -> tuple[Transcript, AudioRecording]:
    transcript = await db.get(Transcript, transcript_id)
    if transcript is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "transcript_not_found", "message": "Não encontrado."}},
        )
    audio = await db.get(AudioRecording, transcript.audio_id)
    if audio is None or (user.role != UserRole.OWNER and audio.user_id != user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "transcript_not_found", "message": "Não encontrado."}},
        )
    return transcript, audio


async def _run_transcription(
    transcript_id: UUID, audio_path: Path, settings: Settings
) -> None:
    """Job de transcrição. Roda em BackgroundTask — abre sua própria session."""
    async with SessionLocal() as db:  # type: ignore[arg-type]
        transcript = await db.get(Transcript, transcript_id)
        if transcript is None:
            logger.bind(transcript_id=str(transcript_id)).warning(
                "transcrição cancelada — transcript desapareceu"
            )
            return

        transcript.status = TranscriptStatus.RUNNING
        transcript.started_at = _utcnow()
        db.add(transcript)
        await db.commit()

        try:
            result = await transcribe(audio_path, settings)
            transcript.text = result.text
            transcript.segments = result.segments
            transcript.language = result.language
            transcript.model_size = result.model_size
            transcript.status = TranscriptStatus.DONE
            transcript.completed_at = _utcnow()
            db.add(transcript)
            await db.commit()
            logger.bind(
                transcript_id=str(transcript_id),
                language=result.language,
                segments=len(result.segments),
                chars=len(result.text),
            ).info("transcrição concluída")
        except Exception as exc:  # noqa: BLE001
            transcript.status = TranscriptStatus.FAILED
            transcript.error_message = str(exc)[:1024]
            transcript.completed_at = _utcnow()
            db.add(transcript)
            await db.commit()
            logger.bind(transcript_id=str(transcript_id)).exception("transcrição falhou")


@audio_router.post(
    "/{audio_id}/transcribe",
    response_model=TranscriptOut,
    status_code=status.HTTP_202_ACCEPTED,
)
async def start_transcription(
    audio_id: UUID,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    audio = await _load_audio(audio_id, db, user)

    # Já tem transcrição? Reutiliza (terminal: retorna direto; pending/running: idempotente).
    existing = await db.exec(select(Transcript).where(Transcript.audio_id == audio_id))
    transcript = existing.first()

    if transcript is not None and transcript.status in {
        TranscriptStatus.PENDING,
        TranscriptStatus.RUNNING,
    }:
        return transcript

    if transcript is not None:
        # Já estava `done` ou `failed` — recria pra forçar nova execução.
        await db.delete(transcript)
        await db.commit()

    transcript = Transcript(audio_id=audio_id, status=TranscriptStatus.PENDING)
    db.add(transcript)
    await db.commit()
    await db.refresh(transcript)

    audio_path = Path(settings.audio_storage_path) / audio.file_path
    background_tasks.add_task(_run_transcription, transcript.id, audio_path, settings)

    logger.bind(transcript_id=str(transcript.id), audio_id=str(audio_id)).info(
        "transcrição enfileirada"
    )
    return transcript


@audio_router.get("/{audio_id}/transcript", response_model=TranscriptOut | None)
async def get_audio_transcript(
    audio_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    await _load_audio(audio_id, db, user)
    result = await db.exec(select(Transcript).where(Transcript.audio_id == audio_id))
    return result.first()


@transcript_router.get("/{transcript_id}", response_model=TranscriptOut)
async def get_transcript(
    transcript_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    transcript, _ = await _load_transcript(transcript_id, db, user)
    return transcript


@transcript_router.patch("/{transcript_id}", response_model=TranscriptOut)
async def update_transcript(
    transcript_id: UUID,
    payload: TranscriptUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    transcript, _ = await _load_transcript(transcript_id, db, user)
    if transcript.status != TranscriptStatus.DONE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "transcript_not_ready",
                    "message": f"Transcript em status '{transcript.status}'.",
                }
            },
        )
    transcript.text = payload.text
    db.add(transcript)
    await db.commit()
    await db.refresh(transcript)
    return transcript
