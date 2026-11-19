"""Resumo estruturado por LLM das mensagens que a compactação descartou.

A compactação determinística deixa só um marcador no lugar dos turnos
antigos. Aqui esse marcador ganha um resumo: um LLM condensa o que saiu da
janela (objetivo, preferências, progresso, decisões, arquivos, próximos
passos) e a próxima compactação atualiza o resumo anterior em vez de
recomeçar. Qualquer falha mantém o marcador original, então o turno nunca
depende do resumo.
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections import Counter
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass

from backend.services.context_planner import compute_transcript_hash
from backend.vtypes.message import ContentBlock, MessageRole, VMessage, text_message

logger = logging.getLogger(__name__)

SUMMARY_PREFIX = "[Context summary]"
_MARKER_PREFIX = "[Context compacted]"
_MAX_INPUT_CHARS = 24_000
_MAX_SUMMARY_CHARS = 6_000
_SUMMARY_TIMEOUT_SECONDS = 25.0
_FAILURE_COOLDOWN_SECONDS = 60.0
_MAX_THREADS_TRACKED = 256

_SYSTEM_PROMPT = """Você condensa o começo de uma conversa entre um usuário e um \
agente de código para que o agente continue o trabalho sem reler tudo.

Escreva em português, em Markdown, só com o que ajuda a continuar, nestas seções \
(omita as vazias):
## Objetivo
## Preferências do usuário
## Progresso
## Decisões
## Arquivos e comandos relevantes
## Próximos passos
## Contexto crítico

Preserve nomes, caminhos, identificadores e números exatos. Não invente nada. \
Seja breve: no máximo 400 palavras."""

Summarizer = Callable[[str, str | None], Awaitable[str]]


@dataclass(slots=True)
class _State:
    covered: int
    covered_hash: str
    summary: str


_states: dict[str, _State] = {}
_failed_at: dict[str, float] = {}


def reset_state() -> None:
    """Esquece resumos e cooldowns (usado nos testes)."""
    _states.clear()
    _failed_at.clear()


def is_compaction_marker(message: VMessage) -> bool:
    return message.role is MessageRole.SYSTEM and message.text().startswith(
        _MARKER_PREFIX
    )


def _key(message: VMessage) -> tuple[str, str, str]:
    return (message.role.value, message.tool_call_id or "", message.text()[:200])


def dropped_messages(
    raw_history: Sequence[VMessage], planned: Sequence[VMessage]
) -> list[VMessage]:
    """Mensagens do histórico original que não chegaram ao contexto planejado."""
    kept = Counter(_key(m) for m in planned if m.role is not MessageRole.SYSTEM)
    dropped: list[VMessage] = []
    for message in raw_history:
        if message.role is MessageRole.SYSTEM:
            continue
        key = _key(message)
        if kept[key] > 0:
            kept[key] -= 1
        else:
            dropped.append(message)
    return dropped


def render_transcript(messages: Sequence[VMessage]) -> str:
    """Texto plano das mensagens, com resultados de tool encurtados."""
    lines: list[str] = []
    for message in messages:
        if message.role is MessageRole.TOOL:
            text = message.text().strip()[:600]
            lines.append(f"tool({message.name or '?'}): {text}")
            continue
        text = message.text().strip()
        if message.tool_calls:
            calls = ", ".join(call.name for call in message.tool_calls if call.name)
            text = f"{text}\n[chamou: {calls}]".strip()
        if text:
            lines.append(f"{message.role.value}: {text[:2000]}")
    rendered = "\n".join(lines)
    if len(rendered) > _MAX_INPUT_CHARS:
        rendered = rendered[-_MAX_INPUT_CHARS:]
    return rendered


async def _default_summarizer(transcript: str, previous: str | None) -> str:
    from backend.services.utils import load_native_llm

    llm = load_native_llm()
    if previous:
        user = (
            "Resumo anterior:\n"
            f"{previous}\n\nMensagens novas a incorporar:\n{transcript}\n\n"
            "Devolva o resumo atualizado, mantendo o que ainda vale."
        )
    else:
        user = f"Mensagens a resumir:\n{transcript}"
    result = await llm.agenerate(
        [
            text_message(MessageRole.SYSTEM, _SYSTEM_PROMPT),
            text_message(MessageRole.USER, user),
        ]
    )
    return result.text().strip()


async def summarize_dropped(
    thread_id: str,
    dropped: Sequence[VMessage],
    *,
    summarizer: Summarizer | None = None,
    now: Callable[[], float] = time.monotonic,
) -> str | None:
    """Resumo cumulativo do que saiu da janela, ou ``None`` se indisponível."""
    if not dropped:
        return None
    state = _states.get(thread_id)
    if state and len(dropped) == state.covered:
        if compute_transcript_hash(list(dropped)) == state.covered_hash:
            return state.summary

    failed = _failed_at.get(thread_id)
    if failed is not None and now() - failed < _FAILURE_COOLDOWN_SECONDS:
        return state.summary if state else None

    previous: str | None = None
    new_part: Sequence[VMessage] = dropped
    if (
        state
        and len(dropped) > state.covered
        and compute_transcript_hash(list(dropped[: state.covered]))
        == state.covered_hash
    ):
        previous = state.summary
        new_part = dropped[state.covered :]

    fallback = state.summary if state else None
    transcript = render_transcript(new_part)
    if not transcript.strip():
        return fallback
    summary = await _run(
        thread_id, transcript, previous, summarizer or _default_summarizer, now
    )
    if summary is None:
        return fallback
    if len(_states) >= _MAX_THREADS_TRACKED:
        _states.pop(next(iter(_states)))
    _states[thread_id] = _State(
        covered=len(dropped),
        covered_hash=compute_transcript_hash(list(dropped)),
        summary=summary,
    )
    return summary


async def _run(
    thread_id: str,
    transcript: str,
    previous: str | None,
    summarizer: Summarizer,
    now: Callable[[], float],
) -> str | None:
    """Chama o LLM com timeout; falha ou resposta vazia ativa o cooldown."""
    try:
        summary = await asyncio.wait_for(
            summarizer(transcript, previous), timeout=_SUMMARY_TIMEOUT_SECONDS
        )
    except Exception:
        logger.warning(
            "context_summary: falha ao resumir; mantendo marcador", exc_info=True
        )
        summary = ""
    summary = summary.strip()[:_MAX_SUMMARY_CHARS]
    if not summary:
        _failed_at[thread_id] = now()
        return None
    _failed_at.pop(thread_id, None)
    return summary


def with_summary(planned: Sequence[VMessage], summary: str) -> list[VMessage]:
    """Troca o marcador de compactação pelo resumo, mantendo a posição."""
    replacement = VMessage(
        role=MessageRole.SYSTEM,
        content=[ContentBlock(kind="text", text=f"{SUMMARY_PREFIX}\n{summary}")],
    )
    out: list[VMessage] = []
    placed = False
    for message in planned:
        if is_compaction_marker(message):
            if not placed:
                out.append(replacement)
                placed = True
            continue
        out.append(message)
    return out
