"""LLM client unificado — único `complete()` que call sites usam.

Backed by LiteLLM. A interface é provider-agnostic: trocar Anthropic ↔ OpenAI
↔ Ollama é flip de env (`LLM_PROVIDER`), não refactor.

System blocks aceitam um formato mais amigável que o raw da Anthropic:

    system=[
        {"text": guidelines, "cache": "ephemeral"},
        {"text": system_prompt, "cache": "ephemeral"},
    ]

…traduzido pro `cache_control` apropriado em `_anthropic_complete`.

Telemetria de tokens é simples: cada resposta carrega `LLMUsage`. Persistência
de telemetria fica como exercício pra quando a app precisar (Fase 7+).
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from typing import Any

import httpx
import litellm
from litellm import exceptions as litellm_exceptions
from pydantic import BaseModel

from src.core.config import get_settings
from src.services.llm.config import resolve_model, validate_llm_config
from src.services.llm.exceptions import LLMError, LLMOverloadedError, LLMRateLimitError

logger = logging.getLogger(__name__)

_DEFAULT_WAIT_S = 10.0
_MAX_WAIT_S = 60.0
_MAX_RETRIES = 3


class LLMUsage(BaseModel):
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_write_tokens: int = 0


@dataclass
class LLMResponse:
    """Resposta normalizada entre providers.

    `text` é o conteúdo textual concatenado. `raw` mantém o objeto do provider
    pra quem precisa de detalhes específicos (ex.: thinking blocks da Anthropic).
    """

    text: str
    model: str
    usage: LLMUsage
    raw: Any = None


def _parse_retry_after(exc: Exception) -> float:
    """Honra `retry-after` do servidor (clamp em `_MAX_WAIT_S`)."""
    response: Any = getattr(exc, "response", None)
    headers = getattr(response, "headers", None) if response is not None else None
    if headers is not None:
        try:
            raw = headers.get("retry-after")
        except Exception:
            raw = None
        if raw:
            try:
                return max(1.0, min(_MAX_WAIT_S, float(raw)))
            except (TypeError, ValueError):
                pass
    return _DEFAULT_WAIT_S


def _is_transient(exc: Exception) -> bool:
    if isinstance(exc, litellm_exceptions.RateLimitError):
        return True
    if isinstance(exc, litellm_exceptions.InternalServerError):
        # 529 "overloaded" da Anthropic vira InternalServerError no LiteLLM.
        return getattr(exc, "status_code", None) in (500, 529)
    if isinstance(exc, litellm_exceptions.ServiceUnavailableError):
        return True
    return False


class LLMClient:
    """Cliente de completion provider-agnostic."""

    def __init__(self) -> None:
        self._configured = False

    def _ensure_configured(self) -> None:
        """Setup one-time. LiteLLM lê chaves do env, mas a gente passa explícito
        pra .env-loaded keys funcionarem sem `export` manual."""
        if self._configured:
            return
        settings = get_settings()
        if settings.anthropic_api_key:
            litellm.anthropic_key = settings.anthropic_api_key
        if settings.openai_api_key:
            litellm.openai_key = settings.openai_api_key
        self._configured = True

    async def complete(
        self,
        *,
        caller: str,
        messages: list[dict[str, Any]],
        system: list[dict[str, Any]] | str | None = None,
        max_tokens: int = 1024,
        thinking_budget: int = 0,
        model: str | None = None,
        max_retries: int = _MAX_RETRIES,
        tools: list[dict[str, Any]] | None = None,
        provider: str | None = None,
        json_schema: dict[str, Any] | None = None,
    ) -> LLMResponse:
        """Roda uma completion contra o provider configurado.

        Args:
            caller: Nome lógico pro logging (ex.: "analysis.summary").
            messages: `[{"role": "user", "content": "..."}]` — histórico aceito.
            system: String simples (bloco único uncached) ou lista de
                `{"text": ..., "cache": "ephemeral" | None}`.
            max_tokens: Cap de tokens de saída.
            thinking_budget: Budget de extended thinking (Anthropic). 0 desliga.
            model: Override pontual; default = `resolve_model` do provider ativo.
            tools: Definições no formato Anthropic (ex.: web_search). Forwarded.
            provider: Override por chamada. Default = `settings.llm_provider`.
            json_schema: Schema enforced no Ollama (structured output). Outros
                providers ignoram — coerção via prompt fica no call site.

        Returns:
            `LLMResponse` com texto concatenado, `usage` e `raw`.
        """
        settings = get_settings()
        active_provider = provider or settings.llm_provider

        if active_provider not in {"anthropic", "openai", "ollama"}:
            validate_llm_config(settings)

        resolved_model = model or resolve_model(settings, provider=active_provider)

        if active_provider == "ollama":
            return await self._ollama_complete(
                caller=caller,
                messages=messages,
                system=system,
                max_tokens=max_tokens,
                model=resolved_model,
                max_retries=max_retries,
                json_schema=json_schema,
            )

        if active_provider == "openai":
            return await self._openai_complete(
                caller=caller,
                messages=messages,
                system=system,
                max_tokens=max_tokens,
                model=resolved_model,
                max_retries=max_retries,
            )

        return await self._anthropic_complete(
            caller=caller,
            messages=messages,
            system=system,
            max_tokens=max_tokens,
            thinking_budget=thinking_budget,
            model=resolved_model,
            max_retries=max_retries,
            tools=tools,
        )

    async def _anthropic_complete(
        self,
        *,
        caller: str,
        messages: list[dict[str, Any]],
        system: list[dict[str, Any]] | str | None,
        max_tokens: int,
        thinking_budget: int,
        model: str,
        max_retries: int,
        tools: list[dict[str, Any]] | None = None,
    ) -> LLMResponse:
        self._ensure_configured()

        anthropic_system = self._to_anthropic_system(system)
        kwargs: dict[str, Any] = {
            "model": f"anthropic/{model}",
            "max_tokens": max_tokens,
            "messages": messages,
        }
        if anthropic_system is not None:
            kwargs["system"] = anthropic_system
        if thinking_budget > 0:
            kwargs["thinking"] = {"type": "enabled", "budget_tokens": thinking_budget}
        if tools:
            kwargs["tools"] = tools

        response = await self._call_with_retries(kwargs, caller=caller, max_retries=max_retries)
        text = self._extract_text(response).strip()
        usage = self._extract_usage_litellm(response)
        return LLMResponse(text=text, model=model, usage=usage, raw=response)

    async def _openai_complete(
        self,
        *,
        caller: str,
        messages: list[dict[str, Any]],
        system: list[dict[str, Any]] | str | None,
        max_tokens: int,
        model: str,
        max_retries: int,
    ) -> LLMResponse:
        self._ensure_configured()

        # OpenAI usa `system` como mensagem inline em `messages`, não como param separado.
        openai_messages = list(messages)
        system_text = self._flatten_system(system)
        if system_text:
            openai_messages.insert(0, {"role": "system", "content": system_text})

        kwargs: dict[str, Any] = {
            "model": f"openai/{model}",
            "max_tokens": max_tokens,
            "messages": openai_messages,
        }

        response = await self._call_with_retries(kwargs, caller=caller, max_retries=max_retries)
        text = self._extract_text(response).strip()
        usage = self._extract_usage_litellm(response)
        return LLMResponse(text=text, model=model, usage=usage, raw=response)

    async def _call_with_retries(
        self, kwargs: dict[str, Any], *, caller: str, max_retries: int
    ) -> Any:
        """Loop genérico de retry com backoff exponencial + retry-after."""
        for attempt in range(max_retries + 1):
            try:
                return await litellm.acompletion(**kwargs)
            except Exception as exc:
                if not _is_transient(exc) or attempt >= max_retries:
                    if isinstance(exc, litellm_exceptions.RateLimitError):
                        raise LLMRateLimitError(str(exc)) from exc
                    if (
                        isinstance(exc, litellm_exceptions.InternalServerError)
                        and getattr(exc, "status_code", None) == 529
                    ):
                        raise LLMOverloadedError(str(exc)) from exc
                    raise
                wait = _parse_retry_after(exc)
                logger.info(
                    "%s: transient LLM error (%s), sleeping %.1fs (%d/%d)",
                    caller,
                    type(exc).__name__,
                    wait,
                    attempt + 1,
                    max_retries,
                )
                await asyncio.sleep(wait)
        raise LLMError("retry loop exhausted")  # defesa — nunca chega aqui

    async def _ollama_complete(
        self,
        *,
        caller: str,
        messages: list[dict[str, Any]],
        system: list[dict[str, Any]] | str | None,
        max_tokens: int,
        model: str,
        max_retries: int,
        json_schema: dict[str, Any] | None,
    ) -> LLMResponse:
        """Talk to local Ollama via `/api/chat`. Bypassa LiteLLM porque o `format`
        com schema é essencial pra structured output e LiteLLM não passa direito.
        """
        settings = get_settings()
        base_url = (settings.ollama_base_url or "").rstrip("/")
        if not base_url:
            raise LLMError("OLLAMA_BASE_URL não configurada.")

        ollama_messages: list[dict[str, Any]] = []
        system_text = self._flatten_system(system)
        if system_text:
            ollama_messages.append({"role": "system", "content": system_text})
        ollama_messages.extend(messages)

        payload: dict[str, Any] = {
            "model": model,
            "messages": ollama_messages,
            "stream": False,
            "options": {"num_predict": max_tokens},
        }
        payload["format"] = json_schema if json_schema is not None else "json"

        url = f"{base_url}/api/chat"
        last_exc: Exception | None = None
        async with httpx.AsyncClient(timeout=httpx.Timeout(120.0, connect=10.0)) as client:
            for attempt in range(max_retries + 1):
                try:
                    response = await client.post(url, json=payload)
                    response.raise_for_status()
                    break
                except httpx.HTTPStatusError as exc:
                    last_exc = exc
                    status_code = exc.response.status_code
                    if status_code == 429 and attempt >= max_retries:
                        raise LLMRateLimitError(str(exc)) from exc
                    if 500 <= status_code < 600 and attempt >= max_retries:
                        raise LLMError(f"ollama {status_code}: {exc}") from exc
                    if not (status_code == 429 or 500 <= status_code < 600):
                        raise LLMError(
                            f"ollama {status_code}: {exc.response.text[:200]}"
                        ) from exc
                    wait = min(_MAX_WAIT_S, _DEFAULT_WAIT_S * (attempt + 1))
                    await asyncio.sleep(wait)
                except httpx.HTTPError as exc:
                    last_exc = exc
                    if attempt >= max_retries:
                        raise LLMError(f"ollama transport: {exc}") from exc
                    wait = min(_MAX_WAIT_S, _DEFAULT_WAIT_S * (attempt + 1))
                    await asyncio.sleep(wait)
            else:
                raise LLMError(f"ollama retries esgotados: {last_exc}")

        data = response.json()
        message = data.get("message") or {}
        text = (message.get("content") or "").strip()
        usage = LLMUsage(
            input_tokens=int(data.get("prompt_eval_count") or 0),
            output_tokens=int(data.get("eval_count") or 0),
        )
        return LLMResponse(text=text, model=model, usage=usage, raw=data)

    @staticmethod
    def _flatten_system(system: list[dict[str, Any]] | str | None) -> str:
        """Achata blocos system em uma string única (OpenAI/Ollama).

        Cache flags são silenciosamente descartadas — só fazem sentido na Anthropic.
        """
        if system is None:
            return ""
        if isinstance(system, str):
            return system
        parts: list[str] = []
        for entry in system:
            text = entry.get("text", "")
            if text:
                parts.append(text)
        return "\n\n".join(parts)

    @staticmethod
    def _to_anthropic_system(
        system: list[dict[str, Any]] | str | None,
    ) -> list[dict[str, Any]] | None:
        if system is None:
            return None
        if isinstance(system, str):
            return [{"type": "text", "text": system}]

        blocks: list[dict[str, Any]] = []
        for entry in system:
            text = entry.get("text", "")
            block: dict[str, Any] = {"type": "text", "text": text}
            cache = entry.get("cache")
            if cache == "ephemeral":
                block["cache_control"] = {"type": "ephemeral"}
            elif cache is not None:
                raise ValueError(
                    f"cache mode {cache!r} inválido — só 'ephemeral' ou None."
                )
            blocks.append(block)
        return blocks

    @staticmethod
    def _extract_text(response: Any) -> str:
        """LiteLLM normaliza Anthropic/OpenAI em formato OpenAI-shape (choices).

        `message.content` é string em texto puro e lista de dicts com thinking ligado.
        """
        choices = getattr(response, "choices", None) or []
        if not choices:
            return ""
        message = getattr(choices[0], "message", None)
        if message is None:
            return ""
        content = getattr(message, "content", None)
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts: list[str] = []
            for block in content:
                block_type = (
                    block.get("type")
                    if isinstance(block, dict)
                    else getattr(block, "type", None)
                )
                if block_type in (None, "text"):
                    text = (
                        block.get("text")
                        if isinstance(block, dict)
                        else getattr(block, "text", "")
                    )
                    if text:
                        parts.append(text)
            return "".join(parts)
        return ""

    @staticmethod
    def _extract_usage_litellm(response: Any) -> LLMUsage:
        """Extrai usage da resposta LiteLLM (Anthropic ou OpenAI).

        Atenção: pra Anthropic via LiteLLM, `prompt_tokens` é a SOMA de input +
        cache_read + cache_write. Usar como `input_tokens` direto inflar telemetria.
        Preferimos `prompt_tokens_details.text_tokens`; fallback é subtração manual.
        """
        usage_obj = getattr(response, "usage", None)
        if usage_obj is None:
            return LLMUsage()

        cache_read = getattr(usage_obj, "cache_read_input_tokens", 0) or 0
        cache_write = getattr(usage_obj, "cache_creation_input_tokens", 0) or 0
        prompt_tokens = getattr(usage_obj, "prompt_tokens", 0) or 0

        details = getattr(usage_obj, "prompt_tokens_details", None)
        text_tokens = getattr(details, "text_tokens", None) if details is not None else None
        if isinstance(text_tokens, int):
            input_tokens = text_tokens
        else:
            input_tokens = max(0, prompt_tokens - cache_read - cache_write)

        return LLMUsage(
            input_tokens=input_tokens,
            output_tokens=getattr(usage_obj, "completion_tokens", 0) or 0,
            cache_read_tokens=cache_read,
            cache_write_tokens=cache_write,
        )


llm_client = LLMClient()
