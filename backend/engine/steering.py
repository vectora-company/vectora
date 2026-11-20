"""Orientações do usuário enviadas enquanto o agente ainda executa.

O usuário escreve uma instrução durante o run e o loop a lê no começo da
próxima iteração, como mais uma mensagem de usuário, sem interromper o turno.
"""

from __future__ import annotations

from collections import deque

_MAX_PENDING_PER_THREAD = 5
_MAX_TEXT_CHARS = 4000
_MAX_THREADS = 256

_pending: dict[str, deque[str]] = {}


def push_steer(thread_id: str, text: str) -> bool:
    """Enfileira a orientação; ``False`` se for vazia ou a fila estiver cheia."""
    cleaned = text.strip()[:_MAX_TEXT_CHARS]
    if not cleaned:
        return False
    queue = _pending.get(thread_id)
    if queue is None:
        if len(_pending) >= _MAX_THREADS:
            _pending.pop(next(iter(_pending)))
        queue = _pending.setdefault(thread_id, deque())
    if len(queue) >= _MAX_PENDING_PER_THREAD:
        return False
    queue.append(cleaned)
    return True


def drain_steers(thread_id: str) -> list[str]:
    """Entrega e esvazia as orientações pendentes da conversa."""
    queue = _pending.pop(thread_id, None)
    return list(queue) if queue else []


def discard_steers(thread_id: str) -> None:
    """Descarta o que sobrou quando o run termina sem consumir."""
    _pending.pop(thread_id, None)


def has_pending_steers(thread_id: str) -> bool:
    """Há orientação esperando para entrar na próxima chamada ao modelo?"""
    return bool(_pending.get(thread_id))
