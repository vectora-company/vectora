"""Transações do fluxo OAuth local: ``state`` aleatório, uso único e PKCE.

O ``state`` identifica a transação e nunca o usuário. Cada início de fluxo gera
um valor imprevisível, que vale uma vez e expira em poucos minutos; o callback só
vira token para o usuário que iniciou aquela transação. O PKCE (S256) impede
que um ``code`` interceptado seja trocado por quem não tem o verificador.
"""

from __future__ import annotations

import base64
import hashlib
import secrets
import threading
import time
from dataclasses import dataclass
from typing import Final

STATE_TTL_SECONDS: Final = 300.0
_MAX_PENDING: Final = 1024


class OAuthStateError(Exception):
    """O ``state`` do callback é desconhecido, expirado, repetido ou de outro provider."""


@dataclass(frozen=True, slots=True)
class OAuthTransaction:
    user_id: str
    provider: str
    code_verifier: str
    expires_at: float


_pending: dict[str, OAuthTransaction] = {}
_lock = threading.Lock()


def _purge(now: float) -> None:
    for key in [key for key, txn in _pending.items() if txn.expires_at <= now]:
        del _pending[key]


def _challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def begin(user_id: str, provider: str, *, now: float | None = None) -> tuple[str, str]:
    """Abre uma transação e devolve ``(state, code_challenge)``."""
    moment = time.monotonic() if now is None else now
    state = secrets.token_urlsafe(32)
    verifier = secrets.token_urlsafe(48)
    with _lock:
        _purge(moment)
        if len(_pending) >= _MAX_PENDING:
            oldest = min(_pending, key=lambda key: _pending[key].expires_at)
            del _pending[oldest]
        _pending[state] = OAuthTransaction(
            user_id=user_id,
            provider=provider,
            code_verifier=verifier,
            expires_at=moment + STATE_TTL_SECONDS,
        )
    return state, _challenge(verifier)


def consume(state: str, provider: str, *, now: float | None = None) -> OAuthTransaction:
    """Valida e consome a transação; repetir o mesmo ``state`` falha."""
    moment = time.monotonic() if now is None else now
    with _lock:
        _purge(moment)
        txn = _pending.pop(state, None)
    if txn is None or txn.provider != provider:
        raise OAuthStateError("state inválido, expirado ou já usado")
    return txn
