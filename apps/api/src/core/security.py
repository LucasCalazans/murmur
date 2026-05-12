"""Verificação de session tokens da Clerk.

Usa a função `authenticate_request_async` do SDK oficial `clerk-backend-api`.
Ela valida assinatura, expiração e claims contra a Frontend API da Clerk
(descoberta automática via JWKS, com cache interno).
"""
from __future__ import annotations

from dataclasses import dataclass

from clerk_backend_api import AuthenticateRequestOptions, authenticate_request_async
from fastapi import HTTPException, Request, status

from src.core.config import get_settings


@dataclass(frozen=True)
class ClerkIdentity:
    """Identidade extraída de um token validado da Clerk."""

    clerk_user_id: str        # `sub` do JWT — id estável do usuário na Clerk
    session_id: str | None    # `sid` do JWT, se presente
    email: str | None         # extraído dos claims (quando configurado no template)
    raw_payload: dict         # payload completo, útil pra debugging


async def authenticate(request: Request) -> ClerkIdentity:
    """Valida o token da Clerk no header `Authorization` e retorna a identidade.

    Lança 503 se a Clerk não estiver configurada e 401 se o token for inválido.
    O SDK aceita qualquer objeto com `.headers` (FastAPI Request serve direto).
    """
    settings = get_settings()
    if not settings.clerk_secret_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "error": {
                    "code": "clerk_not_configured",
                    "message": "CLERK_SECRET_KEY ausente. Defina no .env.",
                }
            },
        )

    request_state = await authenticate_request_async(
        request,
        AuthenticateRequestOptions(
            secret_key=settings.clerk_secret_key,
            authorized_parties=settings.authorized_parties_list,
        ),
    )

    if not request_state.is_signed_in or request_state.payload is None:
        reason = request_state.reason
        # `reason` é um enum AuthErrorReason (não-serializável em JSON) — coerção pra str.
        message = (
            getattr(reason, "message", None)
            or (str(reason) if reason is not None else None)
            or "Sessão inválida ou expirada."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": {"code": "unauthenticated", "message": message}},
        )

    payload: dict = dict(request_state.payload)
    return ClerkIdentity(
        clerk_user_id=str(payload["sub"]),
        session_id=payload.get("sid"),
        email=payload.get("email"),
        raw_payload=payload,
    )
