"""FastAPI dependencies — sessão de banco e usuário autenticado.

`get_current_user` é o ponto único de entrada para qualquer rota protegida:
valida o token da Clerk, faz lazy-upsert da `User` row e retorna o objeto local.
"""
from __future__ import annotations

from collections.abc import AsyncIterator

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from src.core.config import Settings, get_settings
from src.core.security import ClerkIdentity, authenticate
from src.db.models.user import User, UserRole
from src.db.session import SessionLocal


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:  # type: ignore[arg-type]
        yield session


async def get_clerk_identity(request: Request) -> ClerkIdentity:
    return await authenticate(request)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> User:
    """Valida o token e devolve a `User` local — cria se for o primeiro acesso.

    Regra de role no upsert:
    - Se o email é o `OWNER_EMAIL` configurado → `owner`.
    - Caso contrário → `editor` (padrão).
    Edição posterior de role acontece via endpoints de admin (futuro).
    """
    identity = await get_clerk_identity(request)

    result = await db.exec(select(User).where(User.clerk_user_id == identity.clerk_user_id))
    user = result.first()

    if user is not None:
        return user

    # Lazy-create. Sem email no token (template padrão), fica vazio até webhook chegar.
    email = identity.email or ""
    role = (
        UserRole.OWNER
        if email and email.lower() == settings.owner_email.lower()
        else UserRole.EDITOR
    )

    user = User(clerk_user_id=identity.clerk_user_id, email=email, role=role)
    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": {"code": "user_provision_failed", "message": str(exc)}},
        ) from exc

    return user


def require_role(*allowed: UserRole):
    """Restringe rota a uma lista de roles."""

    async def _checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": {
                        "code": "forbidden",
                        "message": f"Role '{user.role}' não tem acesso.",
                    }
                },
            )
        return user

    return _checker
