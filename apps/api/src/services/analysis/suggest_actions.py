"""Geração de ações sugeridas a partir do contexto de uma nota.

Coleta título + content da nota + transcrições prontas dos áudios anexados,
chama a LLM com um prompt estruturado em PT pedindo JSON com a lista de ações,
parseia o resultado e retorna como dicts prontos para virarem `SuggestedAction`.

Falhas de parse JSON são logadas e a função retorna uma lista vazia — nunca
quebra o request principal.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from loguru import logger

from src.db.models.note import Note
from src.db.models.transcript import Transcript, TranscriptStatus
from src.services.llm import LLMError, llm_client


SYSTEM_PROMPT = """Você é um assistente pessoal pragmático integrado ao Murmur — \
um app de notas com gravação de áudio. Sua função é ler o que o usuário \
escreveu/disse e propor de 2 a 6 ações úteis e concretas. Pense como um amigo \
atento: até observações casuais ou frustrações merecem uma sugestão prática.

Tipos disponíveis (escolha o mais adequado):
- "calendar_event": evento com data/hora explícita ("amanhã às 15h", "sexta às 14"). Payload: {"start": "ISO8601 quando possível, senão descrição em texto", "end": opcional, "location": opcional}.
- "reminder": lembrete sem horário definido ("não esquecer de…"). Payload: {"remind_at": opcional}.
- "contact": ligar / escrever / falar com alguém mencionado. Payload: {"name": "...", "phone": opcional, "email": opcional, "channel": opcional}.
- "research": informação a buscar / pesquisar. Payload: {"query": "termo de busca sugerido", "why": "por que isso ajuda"}.
- "tip": conselho, dica, sugestão prática ou observação útil. Ideal pra reclamações, dúvidas, frustrações ou contextos onde o usuário pode se beneficiar de uma orientação. Payload opcional.
- "task": tarefa genérica (qualquer coisa concreta a fazer que não cai nas outras). Payload livre.

REGRAS:
1. SEJA GENEROSO COM TIPS — toda menção a problema, frustração ou dificuldade \
deveria virar pelo menos uma sugestão prática. Ex.: "estou sem espaço na mesa" \
vira "Tip: liberar espaço movendo X" e/ou "Task: organizar a mesa".
2. NUNCA invente fatos: não crie compromissos com pessoas/datas que não foram \
mencionados. Só extraia o que está na nota.
3. Se a nota for verdadeiramente vazia ou puramente abstrata (sem nada \
acionável), aí sim retorne lista vazia.
4. Cite SEMPRE o trecho original que motivou cada sugestão no campo \
`source_text` (até ~120 caracteres).
5. Sugira no máximo 6 ações.
6. Responda EXCLUSIVAMENTE no formato JSON abaixo, sem texto antes ou depois:

<output>
{
  "actions": [
    {
      "type": "calendar_event | reminder | contact | research | tip | task",
      "title": "Frase curta no imperativo (ex.: 'Liberar espaço na mesa de trabalho')",
      "description": "Detalhe maior (1-3 frases) explicando como/porquê",
      "source_text": "trecho citado do conteúdo original",
      "payload": { ... }
    }
  ]
}
</output>"""


_OUTPUT_RE = re.compile(r"<output>\s*(\{.*?\})\s*</output>", re.DOTALL)


@dataclass(frozen=True)
class SuggestedActionPayload:
    action_type: str
    title: str
    description: str
    source_text: str
    payload: dict[str, Any]


def _build_user_message(note: Note, transcripts: list[Transcript]) -> str:
    """Monta o conteúdo enviado pra LLM."""
    parts: list[str] = []
    if note.title:
        parts.append(f"# Título da nota\n{note.title}")
    if note.content.strip():
        parts.append(f"# Conteúdo (markdown)\n{note.content.strip()}")
    if note.tags:
        parts.append(f"# Tags\n{', '.join(note.tags)}")

    for i, t in enumerate(transcripts, start=1):
        if t.status != TranscriptStatus.DONE or not t.text.strip():
            continue
        parts.append(
            f"# Transcrição de áudio #{i} (idioma: {t.language or 'desconhecido'})\n{t.text.strip()}"
        )

    if not parts:
        return "(nota vazia — retorne lista vazia)"
    return "\n\n".join(parts)


def _parse_actions(raw: str) -> list[SuggestedActionPayload]:
    """Extrai e valida ações do output bruto da LLM."""
    match = _OUTPUT_RE.search(raw)
    if not match:
        logger.bind(raw_excerpt=raw[:200]).warning(
            "suggest_actions: <output> não encontrado na resposta"
        )
        return []

    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        logger.bind(error=str(exc), raw=match.group(1)[:200]).warning(
            "suggest_actions: JSON inválido"
        )
        return []

    raw_actions = data.get("actions") if isinstance(data, dict) else None
    if not isinstance(raw_actions, list):
        return []

    parsed: list[SuggestedActionPayload] = []
    for entry in raw_actions:
        if not isinstance(entry, dict):
            continue
        title = str(entry.get("title") or "").strip()
        if not title:
            continue
        parsed.append(
            SuggestedActionPayload(
                action_type=str(entry.get("type") or "task").strip()[:32] or "task",
                title=title[:200],
                description=str(entry.get("description") or "").strip(),
                source_text=str(entry.get("source_text") or "").strip()[:500],
                payload=entry.get("payload") if isinstance(entry.get("payload"), dict) else {},
            )
        )
    return parsed


async def suggest_actions_for_note(
    note: Note, transcripts: list[Transcript]
) -> list[SuggestedActionPayload]:
    """Pipeline completo: monta prompt → chama LLM → parseia → retorna ações."""
    user_content = _build_user_message(note, transcripts)
    logger.bind(
        note_id=str(note.id),
        transcripts_count=sum(1 for t in transcripts if t.status == TranscriptStatus.DONE),
        prompt_chars=len(user_content),
    ).info("gerando ações sugeridas")

    try:
        response = await llm_client.complete(
            caller="analysis.suggest_actions",
            messages=[{"role": "user", "content": user_content}],
            system=[{"text": SYSTEM_PROMPT, "cache": "ephemeral"}],
            max_tokens=2000,
        )
    except LLMError as exc:
        logger.bind(error=str(exc)).exception("suggest_actions: chamada LLM falhou")
        raise

    actions = _parse_actions(response.text)
    logger.bind(
        note_id=str(note.id),
        count=len(actions),
        input_tokens=response.usage.input_tokens,
        output_tokens=response.usage.output_tokens,
    ).info("ações geradas")
    return actions
