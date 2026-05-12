"""Rotas de áudio — upload com conversão pra WAV, listagem, download.

Endpoints:
- POST /audio              — multipart upload, opcional ?note_id=
- GET  /audio              — lista do usuário
- GET  /audio/{id}         — metadados
- GET  /audio/{id}/file    — stream do arquivo WAV
- DELETE /audio/{id}       — remove DB row + arquivo
"""
from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from loguru import logger
from sqlalchemy import func
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.api.deps import get_current_user, get_db
from src.core.config import Settings, get_settings
from src.db.models.audio import AudioRecording
from src.db.models.note import Note
from src.db.models.user import User, UserRole
from src.schemas.audio import AudioList, AudioOut
from src.services.audio.conversion import FFmpegError, convert_to_wav

router = APIRouter(prefix="/audio", tags=["audio"])

# Limites razoáveis pra notas pessoais. Configurável via env futuramente.
_MAX_DURATION_S = 30 * 60  # 30 minutos


def _user_dir(settings: Settings, user_id: UUID) -> Path:
    base = Path(settings.audio_storage_path) / str(user_id)
    base.mkdir(parents=True, exist_ok=True)
    return base


async def _load_audio(
    audio_id: UUID, db: AsyncSession, user: User
) -> AudioRecording:
    audio = await db.get(AudioRecording, audio_id)
    if audio is None or (user.role != UserRole.OWNER and audio.user_id != user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "audio_not_found", "message": "Áudio não encontrado."}},
        )
    return audio


@router.post("", response_model=AudioOut, status_code=status.HTTP_201_CREATED)
async def upload_audio(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
    file: Annotated[UploadFile, File(description="Arquivo de áudio em qualquer formato suportado pelo ffmpeg.")],
    note_id: Annotated[UUID | None, Form()] = None,
):
    if user.role == UserRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "forbidden", "message": "Viewers não enviam áudio."}},
        )

    # Valida note_id se fornecido (e checa ownership).
    if note_id is not None:
        note = await db.get(Note, note_id)
        if note is None or (user.role != UserRole.OWNER and note.owner_id != user.id):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": {"code": "note_not_found", "message": "Nota não encontrada."}},
            )

    max_bytes = settings.max_audio_size_mb * 1024 * 1024

    # Salva temp pra ffmpeg processar. UploadFile já é spooled mas precisamos do path.
    suffix = Path(file.filename or "audio").suffix or ".bin"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = Path(tmp.name)
        total = 0
        while chunk := await file.read(1024 * 1024):
            total += len(chunk)
            if total > max_bytes:
                tmp_path.unlink(missing_ok=True)
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail={
                        "error": {
                            "code": "file_too_large",
                            "message": f"Limite: {settings.max_audio_size_mb} MB",
                        }
                    },
                )
            tmp.write(chunk)

    audio_id = uuid4()
    dst_dir = _user_dir(settings, user.id)
    dst = dst_dir / f"{audio_id}.wav"

    try:
        info = await convert_to_wav(tmp_path, dst)
    except FFmpegError as exc:
        dst.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "ffmpeg_failed", "message": str(exc)}},
        ) from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    if info.duration_seconds > _MAX_DURATION_S:
        dst.unlink(missing_ok=True)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "error": {
                    "code": "duration_too_long",
                    "message": f"Duração máxima: {_MAX_DURATION_S // 60} minutos.",
                }
            },
        )

    audio = AudioRecording(
        id=audio_id,
        user_id=user.id,
        note_id=note_id,
        file_path=f"{user.id}/{audio_id}.wav",
        original_format=file.content_type or suffix.lstrip("."),
        mime_type="audio/wav",
        duration_seconds=info.duration_seconds,
        file_size_bytes=dst.stat().st_size,
    )
    db.add(audio)
    await db.commit()
    await db.refresh(audio)
    logger.bind(
        audio_id=str(audio.id),
        duration_seconds=info.duration_seconds,
        bytes=audio.file_size_bytes,
        note_id=str(note_id) if note_id else None,
    ).info("áudio convertido e armazenado")
    return audio


@router.get("", response_model=AudioList)
async def list_audio(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    note_id: Annotated[UUID | None, Query()] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    statement = select(AudioRecording)
    count_statement = select(func.count(col(AudioRecording.id)))

    if user.role != UserRole.OWNER:
        statement = statement.where(AudioRecording.user_id == user.id)
        count_statement = count_statement.where(AudioRecording.user_id == user.id)

    if note_id is not None:
        statement = statement.where(AudioRecording.note_id == note_id)
        count_statement = count_statement.where(AudioRecording.note_id == note_id)

    statement = statement.order_by(col(AudioRecording.created_at).desc()).offset(offset).limit(limit)
    items_result = await db.exec(statement)
    items = list(items_result.all())

    total_result = await db.exec(count_statement)
    total = int(total_result.one() or 0)

    return AudioList(items=[AudioOut.model_validate(a) for a in items], total=total)


@router.get("/{audio_id}", response_model=AudioOut)
async def get_audio(
    audio_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    return await _load_audio(audio_id, db, user)


@router.get("/{audio_id}/file")
async def get_audio_file(
    audio_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    audio = await _load_audio(audio_id, db, user)
    full_path = Path(settings.audio_storage_path) / audio.file_path
    if not full_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "file_missing", "message": "Arquivo sumiu do disco."}},
        )
    return FileResponse(path=str(full_path), media_type=audio.mime_type, filename=f"{audio.id}.wav")


@router.delete("/{audio_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_audio(
    audio_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
):
    audio = await _load_audio(audio_id, db, user)
    full_path = Path(settings.audio_storage_path) / audio.file_path
    await db.delete(audio)
    await db.commit()
    full_path.unlink(missing_ok=True)
    logger.bind(audio_id=str(audio_id)).info("áudio deletado")
