"""Whitelist de providers + validação no boot.

Adicionar provider novo = duas mudanças: append em `SUPPORTED_PROVIDERS` e
tratar o caso em `LLMClient`. A whitelist existe pra que typo
(`LLM_PROVIDER=anthopic`) falhe no boot, não em runtime.
"""
from __future__ import annotations

from src.services.llm.exceptions import LLMConfigError

SUPPORTED_PROVIDERS = ("anthropic", "openai", "ollama")


def resolve_model(settings_obj, provider: str | None = None) -> str:
    """Retorna o model string ativo para o provider configurado (ou override)."""
    active = provider or getattr(settings_obj, "llm_provider", "anthropic")
    if active == "ollama":
        return getattr(settings_obj, "ollama_model", "") or ""
    return getattr(settings_obj, "llm_model", "") or ""


def validate_llm_config(settings_obj) -> None:
    """Boot-time check: provider whitelisted + credenciais presentes.

    Lança `LLMConfigError` com mensagem acionável. Plugar no startup do FastAPI
    pra falhar cedo em vez de na primeira request.
    """
    provider = getattr(settings_obj, "llm_provider", "anthropic")

    if provider not in SUPPORTED_PROVIDERS:
        raise LLMConfigError(
            f"LLM_PROVIDER={provider!r} não suportado. "
            f"Disponíveis: {list(SUPPORTED_PROVIDERS)}. "
            f"Adicione em SUPPORTED_PROVIDERS (services/llm/config.py)."
        )

    if provider == "anthropic" and not getattr(settings_obj, "anthropic_api_key", ""):
        raise LLMConfigError("LLM_PROVIDER=anthropic exige ANTHROPIC_API_KEY definida.")

    if provider == "openai" and not getattr(settings_obj, "openai_api_key", ""):
        raise LLMConfigError("LLM_PROVIDER=openai exige OPENAI_API_KEY definida.")

    if provider == "ollama":
        if not getattr(settings_obj, "ollama_base_url", ""):
            raise LLMConfigError("LLM_PROVIDER=ollama exige OLLAMA_BASE_URL definida.")
        if not getattr(settings_obj, "ollama_model", ""):
            raise LLMConfigError("LLM_PROVIDER=ollama exige OLLAMA_MODEL definida.")

    if not resolve_model(settings_obj):
        raise LLMConfigError(
            "Modelo vazio: configure LLM_MODEL (ex.: claude-sonnet-4-6) "
            "ou OLLAMA_MODEL se LLM_PROVIDER=ollama."
        )
