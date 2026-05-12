"""Rotas de autenticação.

Login/registro/reset são feitos pela Clerk no frontend — aqui só expomos
informações do usuário local após validar a sessão.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from src.api.deps import get_current_user
from src.db.models.user import User
from src.schemas.user import UserOut


router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)) -> User:
    return user
