"""Resumo por LLM do contexto descartado (backend/services/context_summary.py)."""

from __future__ import annotations

import pytest

from backend.services import context_summary as cs
from backend.vtypes.message import MessageRole, text_message


@pytest.fixture(autouse=True)
def _reset_state() -> None:
    cs.reset_state()


def _make_messages(n: int) -> list:
    out = []
    for i in range(n):
        role = MessageRole.USER if i % 2 == 0 else MessageRole.ASSISTANT
        out.append(text_message(role, f"mensagem {i}"))
    return out


def test_dropped_messages_ignores_kept_ones() -> None:
    raw = _make_messages(6)
    planned = [text_message(MessageRole.SYSTEM, "[Context compacted]"), *raw[4:]]
    assert cs.dropped_messages(raw, planned) == raw[:4]


def test_with_summary_replaces_marker_in_place() -> None:
    raw = _make_messages(4)
    planned = [
        text_message(MessageRole.SYSTEM, "prompt"),
        text_message(MessageRole.SYSTEM, "[Context compacted]\n- x"),
        *raw[2:],
    ]
    out = cs.with_summary(planned, "resumo")
    assert out[1].text().startswith(cs.SUMMARY_PREFIX)
    assert not any(cs.is_compaction_marker(m) for m in out)
    assert len(out) == len(planned)


@pytest.mark.asyncio
async def test_summary_is_reused_and_updated_iteratively() -> None:
    calls: list[tuple[str, str | None]] = []

    async def fake(transcript: str, previous: str | None) -> str:
        calls.append((transcript, previous))
        return f"resumo{len(calls)}"

    raw = _make_messages(6)
    assert await cs.summarize_dropped("t", raw[:4], summarizer=fake) == "resumo1"
    # mesmo conjunto: não chama o LLM de novo
    assert await cs.summarize_dropped("t", raw[:4], summarizer=fake) == "resumo1"
    assert len(calls) == 1
    # conjunto maior: atualiza o resumo anterior só com a parte nova
    assert await cs.summarize_dropped("t", raw[:6], summarizer=fake) == "resumo2"
    transcript, previous = calls[1]
    assert previous == "resumo1"
    assert "mensagem 4" in transcript
    assert "mensagem 0" not in transcript


@pytest.mark.asyncio
async def test_llm_failure_keeps_marker_and_honors_cooldown() -> None:
    calls = 0

    async def failing_summarizer(transcript: str, previous: str | None) -> str:
        nonlocal calls
        calls += 1
        raise RuntimeError("provider fora")

    raw = _make_messages(4)
    assert await cs.summarize_dropped("t", raw, summarizer=failing_summarizer) is None
    assert await cs.summarize_dropped("t", raw, summarizer=failing_summarizer) is None
    assert calls == 1


@pytest.mark.asyncio
async def test_no_dropped_messages_means_no_summary() -> None:
    async def never_called(transcript: str, previous: str | None) -> str:
        raise AssertionError("não deveria chamar")

    assert await cs.summarize_dropped("t", [], summarizer=never_called) is None
