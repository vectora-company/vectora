"""Resumo por LLM do contexto descartado (backend/services/context_summary.py)."""

from __future__ import annotations

import pytest

from backend.services import context_summary as cs
from backend.vtypes.message import MessageRole, text_message


@pytest.fixture(autouse=True)
def _limpa() -> None:
    cs.reset_state()


def _msgs(n: int) -> list:
    out = []
    for i in range(n):
        role = MessageRole.USER if i % 2 == 0 else MessageRole.ASSISTANT
        out.append(text_message(role, f"mensagem {i}"))
    return out


def test_dropped_messages_ignora_o_que_foi_mantido() -> None:
    raw = _msgs(6)
    planned = [text_message(MessageRole.SYSTEM, "[Context compacted]"), *raw[4:]]
    assert cs.dropped_messages(raw, planned) == raw[:4]


def test_with_summary_troca_o_marcador_na_mesma_posicao() -> None:
    raw = _msgs(4)
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
async def test_resumo_e_reaproveitado_e_atualizado_de_forma_iterativa() -> None:
    chamadas: list[tuple[str, str | None]] = []

    async def fake(transcript: str, previous: str | None) -> str:
        chamadas.append((transcript, previous))
        return f"resumo{len(chamadas)}"

    raw = _msgs(6)
    assert await cs.summarize_dropped("t", raw[:4], summarizer=fake) == "resumo1"
    # mesmo conjunto: não chama o LLM de novo
    assert await cs.summarize_dropped("t", raw[:4], summarizer=fake) == "resumo1"
    assert len(chamadas) == 1
    # conjunto maior: atualiza o resumo anterior só com a parte nova
    assert await cs.summarize_dropped("t", raw[:6], summarizer=fake) == "resumo2"
    transcript, previous = chamadas[1]
    assert previous == "resumo1"
    assert "mensagem 4" in transcript
    assert "mensagem 0" not in transcript


@pytest.mark.asyncio
async def test_falha_do_llm_mantem_o_marcador_e_respeita_o_cooldown() -> None:
    chamadas = 0

    async def quebra(transcript: str, previous: str | None) -> str:
        nonlocal chamadas
        chamadas += 1
        raise RuntimeError("provider fora")

    raw = _msgs(4)
    assert await cs.summarize_dropped("t", raw, summarizer=quebra) is None
    assert await cs.summarize_dropped("t", raw, summarizer=quebra) is None
    assert chamadas == 1


@pytest.mark.asyncio
async def test_sem_mensagens_descartadas_nao_resume() -> None:
    async def nunca(transcript: str, previous: str | None) -> str:
        raise AssertionError("não deveria chamar")

    assert await cs.summarize_dropped("t", [], summarizer=nunca) is None
