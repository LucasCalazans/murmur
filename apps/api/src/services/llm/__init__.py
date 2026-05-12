"""Camada LLM provider-agnostic.

API pública: `llm_client.complete(...)` é o único entrypoint. Trocar de provider
(Anthropic ↔ OpenAI ↔ Ollama) é flip da env `LLM_PROVIDER` sem refactor.
"""
from src.services.llm.client import LLMClient, LLMResponse, LLMUsage, llm_client
from src.services.llm.config import SUPPORTED_PROVIDERS, resolve_model, validate_llm_config
from src.services.llm.exceptions import (
    LLMConfigError,
    LLMError,
    LLMOverloadedError,
    LLMRateLimitError,
)

__all__ = [
    "LLMClient",
    "LLMResponse",
    "LLMUsage",
    "LLMConfigError",
    "LLMError",
    "LLMOverloadedError",
    "LLMRateLimitError",
    "SUPPORTED_PROVIDERS",
    "llm_client",
    "resolve_model",
    "validate_llm_config",
]
