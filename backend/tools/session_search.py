"""Busca em conversas anteriores do usuário (FTS5 sobre o histórico).

Serve para lembrar o que foi dito em OUTRAS conversas. O que está na conversa
atual já está no contexto e não precisa de busca.
"""

from __future__ import annotations

import json
import logging

from backend.tools.context import ToolContext
from backend.tools.registry import ToolExtras, vtool

logger = logging.getLogger(__name__)


@vtool(
    extras=ToolExtras(
        render_hint="json",
        category="memory",
        icon="search",
    )
)
async def search_sessions(ctx: ToolContext, query: str, limit: int = 5) -> str:
    """Busca trechos de conversas anteriores do usuário.

    Use só quando a resposta não estiver nesta conversa e puder ter vindo de
    outra. A busca é textual (sem LLM) e devolve mensagens reais com a thread
    de origem.

    Args:
        query: Palavras a procurar (todas precisam aparecer na mensagem).
        limit: Máximo de resultados (1 a 20).

    Returns:
        JSON com a lista de resultados (thread_id, role, snippet, created_at).
    """
    from backend.services.agent_factory import get_session_store

    store = await get_session_store()
    search = getattr(store, "search_messages", None)
    if search is None:
        return "Error: a busca entre conversas não está disponível neste armazenamento."
    try:
        results = await search(
            ctx.user_id or "local",
            query,
            limit=limit,
            exclude_thread_id=ctx.thread_id or None,
        )
    except Exception as exc:
        logger.warning("search_sessions falhou", exc_info=True)
        return f"Error: falha ao buscar conversas: {exc}"
    return json.dumps(
        {"query": query, "count": len(results), "results": results},
        ensure_ascii=False,
    )
