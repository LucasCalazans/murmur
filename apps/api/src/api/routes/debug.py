"""Rotas de debug — registradas apenas em desenvolvimento.

Servem pra smoke test de subsistemas (LLM, Whisper futuramente) sem precisar
de UI ou auth. NUNCA expor em produção.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from src.api.deps import get_current_user
from src.core.config import Settings, get_settings
from src.db.models.user import User
from src.services.llm import llm_client


router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/llm")
async def smoke_llm(
    prompt: str = "Diga 'olá' em português.",
    _user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
):
    """Manda um prompt curto pro LLM ativo e retorna o resultado.

    Útil pra validar que `LLM_PROVIDER`, `LLM_MODEL` e a chave estão certos.
    """
    response = await llm_client.complete(
        caller="debug.smoke_llm",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
    )
    return {
        "provider": settings.llm_provider,
        "model": response.model,
        "text": response.text,
        "usage": response.usage.model_dump(),
    }
