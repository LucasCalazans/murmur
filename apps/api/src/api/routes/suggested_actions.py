"""Rotas de ações sugeridas.

- POST /notes/{id}/suggest-actions  → gera (síncrono, chama LLM) e retorna lista.
- GET  /notes/{id}/suggested-actions → lista existentes.
- PATCH /suggested-actions/{id}     → muda status/title/description.
- DELETE /suggested-actions/{id}    → remove.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from loguru import logger
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.api.deps import get_current_user, get_db
from src.db.models.audio import AudioRecording
from src.db.models.note import Note
from src.db.models.suggested_action import SuggestedAction, SuggestedActionStatus
from src.db.models.transcript import Transcript
from src.db.models.user import User, UserRole
from src.schemas.suggested_action import (
    SuggestedActionList,
    SuggestedActionOut,
    SuggestedActionUpdate,
)
from src.services.analysis.suggest_actions import suggest_actions_for_note
from src.services.llm import LLMError


notes_router = APIRouter(prefix="/notes", tags=["actions"])
actions_router = APIRouter(prefix="/suggested-actions", tags=["actions"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _load_owned_note(note_id: UUID, db: AsyncSession, user: User) -> Note:
    note = await db.get(Note, note_id)
    if note is None or (user.role != UserRole.OWNER and note.owner_id != user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "note_not_found", "message": "Nota não encontrada."}},
        )
    return note


async def _load_owned_action(
    action_id: UUID, db: AsyncSession, user: User
) -> SuggestedAction:
    action = await db.get(SuggestedAction, action_id)
    if action is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "action_not_found", "message": "Sugestão não encontrada."}},
        )
    # Visibilidade via dona da nota.
    note = await db.get(Note, action.note_id)
    if note is None or (user.role != UserRole.OWNER and note.owner_id != user.id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "action_not_found", "message": "Sugestão não encontrada."}},
        )
    return action


@notes_router.post("/{note_id}/suggest-actions", response_model=SuggestedActionList)
async def suggest_actions(
    note_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    note = await _load_owned_note(note_id, db, user)

    # Coleta transcrições "done" dos áudios anexados.
    audios_result = await db.exec(
        select(AudioRecording).where(AudioRecording.note_id == note.id)
    )
    audios = list(audios_result.all())
    transcripts: list[Transcript] = []
    if audios:
        audio_ids = [a.id for a in audios]
        tr_result = await db.exec(
            select(Transcript).where(col(Transcript.audio_id).in_(audio_ids))
        )
        transcripts = list(tr_result.all())

    try:
        proposed = await suggest_actions_for_note(note, transcripts)
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": {"code": "llm_failed", "message": str(exc)}},
        ) from exc

    persisted: list[SuggestedAction] = []
    for payload in proposed:
        action = SuggestedAction(
            note_id=note.id,
            action_type=payload.action_type,
            title=payload.title,
            description=payload.description,
            source_text=payload.source_text,
            payload=payload.payload,
        )
        db.add(action)
        persisted.append(action)

    if persisted:
        await db.commit()
        for a in persisted:
            await db.refresh(a)

    logger.bind(note_id=str(note.id), created=len(persisted)).info(
        "sugestões persistidas"
    )

    # Retorna TODAS as sugestões pendentes da nota (não só as novas) — UI mais útil.
    listing = await db.exec(
        select(SuggestedAction)
        .where(SuggestedAction.note_id == note.id)
        .order_by(col(SuggestedAction.created_at).desc())
    )
    items = list(listing.all())
    return SuggestedActionList(items=[SuggestedActionOut.model_validate(a) for a in items])


@notes_router.get("/{note_id}/suggested-actions", response_model=SuggestedActionList)
async def list_actions(
    note_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    note = await _load_owned_note(note_id, db, user)
    result = await db.exec(
        select(SuggestedAction)
        .where(SuggestedAction.note_id == note.id)
        .order_by(col(SuggestedAction.created_at).desc())
    )
    items = list(result.all())
    return SuggestedActionList(items=[SuggestedActionOut.model_validate(a) for a in items])


@actions_router.patch("/{action_id}", response_model=SuggestedActionOut)
async def update_action(
    action_id: UUID,
    payload: SuggestedActionUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    action = await _load_owned_action(action_id, db, user)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return action

    if "status" in data and data["status"] is not None:
        action.status = SuggestedActionStatus(data["status"])
    if "title" in data and data["title"] is not None:
        action.title = data["title"]
    if "description" in data and data["description"] is not None:
        action.description = data["description"]
    action.updated_at = _utcnow()
    db.add(action)
    await db.commit()
    await db.refresh(action)
    return action


@actions_router.delete("/{action_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_action(
    action_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
):
    action = await _load_owned_action(action_id, db, user)
    await db.delete(action)
    await db.commit()
