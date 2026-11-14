from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from starlette.requests import Request


def _request(user: object | None) -> Request:
    request = Request(
        {"type": "http", "method": "GET", "path": "/auth/secrets/keys"}
    )
    request.state.user = user
    return request


async def test_secret_key_listing_requires_authentication():
    from backend.api.handlers.auth import list_secret_keys

    with pytest.raises(HTTPException) as exc:
        await list_secret_keys(_request(None))

    assert exc.value.status_code == 401


async def test_secret_key_listing_returns_only_names_for_current_user(monkeypatch):
    from backend.api.handlers import auth

    provider = SimpleNamespace(
        list_keys=AsyncMock(return_value=["TOKEN_B", "TOKEN_A", "TOKEN_A"])
    )
    monkeypatch.setattr("backend.secrets.get_secrets_provider", lambda: provider)

    result = await auth.list_secret_keys(_request(SimpleNamespace(id="user-1")))

    assert result == {"keys": ["TOKEN_A", "TOKEN_B"]}
    provider.list_keys.assert_awaited_once_with("user-1")


async def test_secret_key_listing_reports_locked_vault(monkeypatch):
    from backend.api.handlers import auth

    provider = SimpleNamespace(
        list_keys=AsyncMock(side_effect=RuntimeError("vault locked"))
    )
    monkeypatch.setattr("backend.secrets.get_secrets_provider", lambda: provider)

    with pytest.raises(HTTPException) as exc:
        await auth.list_secret_keys(_request(SimpleNamespace(id="user-1")))

    assert exc.value.status_code == 423
    assert "bloqueado" in exc.value.detail


async def test_internal_provider_does_not_list_keys_when_vault_is_locked(monkeypatch):
    from backend.secrets import internal

    monkeypatch.setattr(internal, "_open_keys", {})
    monkeypatch.setattr(
        internal, "_get_db", AsyncMock(side_effect=AssertionError("DB accessed"))
    )

    with pytest.raises(RuntimeError, match="não está aberto"):
        await internal.InternalSecretsProvider().list_keys("user-1")
