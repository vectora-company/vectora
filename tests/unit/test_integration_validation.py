"""Registro de validação de produção das integrações OAuth."""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, patch

import pytest

from backend.api.handlers import oauth
from backend.services import integration_validation
from backend.services.integration_validation import OAuthValidation, is_oauth_validated


def test_no_provider_is_announced_before_it_is_validated() -> None:
    assert integration_validation.VALIDATED_OAUTH == {}
    assert not is_oauth_validated("github")


def test_every_recorded_validation_names_a_registered_provider_and_evidence() -> None:
    registered = {integration["id"] for integration in oauth.INTEGRATIONS_REGISTRY}
    for provider, record in integration_validation.VALIDATED_OAUTH.items():
        assert provider in registered
        assert record.evidence.strip()


def test_validated_provider_is_reported_as_validated(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from datetime import date

    monkeypatch.setitem(
        integration_validation.VALIDATED_OAUTH,
        "github",
        OAuthValidation(date(2026, 11, 19), "teste ponta a ponta registrado"),
    )

    assert is_oauth_validated("github")


def test_listing_marks_oauth_providers_as_unvalidated_by_default() -> None:
    request = SimpleNamespace(state=SimpleNamespace(user=SimpleNamespace(id="u1")))
    with (
        patch.object(
            oauth, "_broker_providers", new=AsyncMock(return_value={"github"})
        ),
        patch("backend.rbac.auth.get_env_overrides", new=AsyncMock(return_value={})),
    ):
        result = asyncio.run(oauth.list_integrations(cast("Any", request)))

    by_id = {item["id"]: item for item in result["integrations"]}
    assert by_id["github"]["oauth_configured"] is True
    assert by_id["github"]["oauth_validated"] is False
    api_key = next(i for i in result["integrations"] if i["kind"] == "apikey")
    assert api_key["oauth_validated"] is False
