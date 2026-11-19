"""Chave de cache de prompt da conversa corrente.

O loop publica o id da conversa aqui e os clients que aceitam uma chave de
roteamento de cache (OpenAI ``prompt_cache_key``) a repassam. Chamadas da
mesma conversa vão para o mesmo cache, o que aumenta a taxa de acerto do
prefixo estável.
"""

from __future__ import annotations

from contextvars import ContextVar

prompt_cache_key: ContextVar[str | None] = ContextVar("prompt_cache_key", default=None)
