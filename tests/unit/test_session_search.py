"""Busca FTS5 entre conversas (SessionStore.search_messages + tool)."""

from __future__ import annotations

import pytest

from backend.persistence.native.session_store import (
    SessionStore,
    _fts_match_expression,
)
from backend.vtypes.message import MessageRole, text_message


def test_expressao_fts_e_segura() -> None:
    assert _fts_match_expression('meu "github" OR x*') == '"meu" AND "github" AND "OR"'
    assert _fts_match_expression("a b") == ""
    assert _fts_match_expression("   ") == ""


@pytest.fixture
async def store(tmp_path):
    from backend.storage.sqlite.pool import AsyncConnectionPool

    pool = AsyncConnectionPool(str(tmp_path / "sessions.db"), min_size=1, max_size=2)
    await pool.open()
    store = SessionStore(pool)
    await store.setup()
    try:
        yield store
    finally:
        await pool.close()


@pytest.mark.asyncio
async def test_busca_acha_mensagem_de_outra_conversa(store) -> None:
    await store.create_session("t1", user_id="ana")
    await store.create_session("t2", user_id="ana")
    await store.create_session("t3", user_id="bia")
    await store.append_message(
        "t1", text_message(MessageRole.USER, "O deploy usa Cloudflare Workers")
    )
    await store.append_message(
        "t2", text_message(MessageRole.USER, "Hoje falamos de outra coisa")
    )
    await store.append_message(
        "t3", text_message(MessageRole.USER, "Cloudflare da Bia, privado")
    )

    achados = await store.search_messages("ana", "cloudflare deploy")

    assert [r["thread_id"] for r in achados] == ["t1"]
    assert (
        "[Cloudflare]" in achados[0]["snippet"] or "Cloudflare" in achados[0]["snippet"]
    )


@pytest.mark.asyncio
async def test_busca_exclui_a_thread_atual_e_avisos_sinteticos(store) -> None:
    await store.create_session("t1", user_id="ana")
    await store.append_message(
        "t1", text_message(MessageRole.USER, "projeto vectora engine")
    )
    await store.append_message(
        "t1", text_message(MessageRole.ASSISTANT, "[cancelado] projeto vectora")
    )

    assert await store.search_messages("ana", "vectora", exclude_thread_id="t1") == []
    achados = await store.search_messages("ana", "vectora")
    assert [r["role"] for r in achados] == ["user"]


@pytest.mark.asyncio
async def test_consulta_vazia_nao_busca(store) -> None:
    assert await store.search_messages("ana", "") == []


@pytest.mark.asyncio
async def test_uso_de_tokens_da_conversa_soma_as_execucoes(store) -> None:
    await store.create_session("t1", user_id="ana")
    async with store._pool.acquire() as conn:
        for run_id, metrics in (
            ("r1", '{"input_tokens": 100, "output_tokens": 20, "total_tokens": 120}'),
            ("r2", '{"input_tokens": 50, "output_tokens": 5, "total_tokens": 55}'),
        ):
            await conn.execute(
                "INSERT INTO agent_runs (run_id, thread_id, status, model, "
                "metrics_json, started_at, updated_at) "
                "VALUES (?, 't1', 'passed', 'gemini-2.5-pro', ?, ?, ?)",
                (run_id, metrics, f"2026-01-0{run_id[1]}", f"2026-01-0{run_id[1]}"),
            )
        await conn.commit()

    uso = await store.thread_token_usage("t1")

    assert uso["input_tokens"] == 150
    assert uso["output_tokens"] == 25
    assert uso["total_tokens"] == 175
    assert uso["runs"] == 2
    assert uso["model"] == "gemini-2.5-pro"
    assert (await store.thread_token_usage("vazia"))["runs"] == 0
