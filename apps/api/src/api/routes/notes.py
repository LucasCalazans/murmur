"""Rotas CRUD de notas.

Regras de visibilidade:
- `editor`: vê e edita só as suas (`owner_id == current_user.id`).
- `owner`: vê e edita todas (visão global da própria conta — útil pra moderação).
- `viewer`: ainda não pode criar notas; lista vazia.

Compartilhamento via NoteShare entra no parking lot.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from loguru import logger
from sqlalchemy import func
from sqlmodel import col, or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.api.deps import get_current_user, get_db
from src.db.models.note import Note
from src.db.models.user import User, UserRole
from src.schemas.note import NoteCreate, NoteList, NoteOut, NoteUpdate, SortField, SortOrder


router = APIRouter(prefix="/notes", tags=["notes"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _get_owned_note(
    note_id: UUID,
    db: AsyncSession,
    user: User,
) -> Note:
    """Carrega nota e aplica regra de visibilidade. 404 se não existir ou não for sua."""
    note = await db.get(Note, note_id)
    if note is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "note_not_found", "message": "Nota não encontrada."}},
        )
    if user.role != UserRole.OWNER and note.owner_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "note_not_found", "message": "Nota não encontrada."}},
        )
    return note


@router.get("", response_model=NoteList)
async def list_notes(
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
    q: Annotated[str | None, Query(description="Busca em título/conteúdo (ILIKE)")] = None,
    tag: Annotated[str | None, Query(description="Filtra por tag")] = None,
    sort: Annotated[SortField, Query()] = "updated_at",
    order: Annotated[SortOrder, Query()] = "desc",
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> NoteList:
    statement = select(Note)
    count_statement = select(func.count(col(Note.id)))

    if user.role != UserRole.OWNER:
        statement = statement.where(Note.owner_id == user.id)
        count_statement = count_statement.where(Note.owner_id == user.id)

    if q:
        like = f"%{q}%"
        clause = or_(col(Note.title).ilike(like), col(Note.content).ilike(like))
        statement = statement.where(clause)
        count_statement = count_statement.where(clause)

    if tag:
        statement = statement.where(col(Note.tags).any(tag))
        count_statement = count_statement.where(col(Note.tags).any(tag))

    sort_col = {"updated_at": Note.updated_at, "created_at": Note.created_at, "title": Note.title}[sort]
    statement = statement.order_by(sort_col.desc() if order == "desc" else sort_col.asc())
    statement = statement.offset(offset).limit(limit)

    items_result = await db.exec(statement)
    items = list(items_result.all())

    total_result = await db.exec(count_statement)
    total = int(total_result.one() or 0)

    return NoteList(items=[NoteOut.model_validate(n) for n in items], total=total)


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: NoteCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Note:
    if user.role == UserRole.VIEWER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": {"code": "forbidden", "message": "Viewers não criam notas."}},
        )

    note = Note(
        owner_id=user.id,
        title=payload.title,
        content=payload.content,
        tags=payload.tags,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    logger.bind(note_id=str(note.id)).info("nota criada")
    return note


@router.get("/{note_id}", response_model=NoteOut)
async def get_note(
    note_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Note:
    return await _get_owned_note(note_id, db, user)


@router.patch("/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: UUID,
    payload: NoteUpdate,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> Note:
    note = await _get_owned_note(note_id, db, user)
    data = payload.model_dump(exclude_unset=True)
    if not data:
        return note
    for field, value in data.items():
        setattr(note, field, value)
    note.updated_at = _utcnow()
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> None:
    note = await _get_owned_note(note_id, db, user)
    await db.delete(note)
    await db.commit()
    logger.bind(note_id=str(note_id)).info("nota deletada")
