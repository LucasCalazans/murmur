"""Hierarquia de exceções da camada LLM.

Call sites devem pegar essas, não as do vendor — assim trocar de provider
não exige tocar em quem chama.
"""
from __future__ import annotations


class LLMError(Exception):
    """Base de qualquer erro da camada LLM."""


class LLMConfigError(LLMError):
    """`LLM_PROVIDER` / `LLM_MODEL` inválidos ou faltando credenciais."""


class LLMRateLimitError(LLMError):
    """Provider retornou 429 mesmo após retries internos."""


class LLMOverloadedError(LLMError):
    """Provider Anthropic retornou 529 ('overloaded') após retries."""
