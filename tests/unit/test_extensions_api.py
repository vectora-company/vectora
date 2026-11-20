"""API e tool do harness para o host de extensões."""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest
from fastapi import HTTPException

import backend.extensions.host as host_module
from backend.api.handlers import extensions as api
from backend.extensions.host import (
    ExtensionHost,
    GrantsUpdate,
    InstallRequest,
    compute_bundle_digest,
)
from backend.extensions.models import Contribution, ExtensionRelease
from backend.extensions.store import ExtensionStore
from backend.tools.extensions import call_extension_tool


class _Client:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def connect(
        self, connections: dict[str, Any], *, strict: bool = False
    ) -> None:
        return None

    def tools(self) -> dict[str, Any]:
        return {"echo": object()}

    async def call_tool(
        self, name: str, arguments: dict[str, Any], ctx: Any = None
    ) -> str:
        self.calls.append((name, arguments))
        return "resposta"

    async def aclose(self) -> None:
        return None


@pytest.fixture
def host(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> ExtensionHost:
    instance = ExtensionHost(
        ExtensionStore(tmp_path / "extensions"), client_factory=_Client
    )
    monkeypatch.setattr(host_module, "_host", instance)
    return instance


def _request(role: str | None) -> Any:
    user = None if role is None else SimpleNamespace(id="u1", role=role)
    return SimpleNamespace(state=SimpleNamespace(user=user))


def _install_body(host: ExtensionHost) -> InstallRequest:
    path = host.bundles_root / "demo-1"
    path.mkdir(parents=True)
    (path / "main.js").write_text("x", encoding="utf-8")
    return InstallRequest(
        id="demo",
        name="Demo",
        publisher="acme",
        release=ExtensionRelease(
            version="1.0.0",
            digest=compute_bundle_digest(path),
            install_path=str(path),
            command="node",
            args=["./main.js"],
            declared_tools=["echo"],
            contributions=[Contribution(kind="mode", id="studio", label="Studio")],
        ),
    )


async def test_summary_never_exposes_paths_or_commands(host: ExtensionHost) -> None:
    await api.install_extension(_request("admin"), _install_body(host))

    [summary] = await api.list_extensions(_request("user"))
    dumped = summary.model_dump_json()

    assert summary.id == "demo"
    assert "install_path" not in dumped
    assert str(host.bundles_root) not in dumped
    assert "node" not in dumped


@pytest.mark.parametrize("role", ["user", "viewer"])
async def test_mutations_require_admin(host: ExtensionHost, role: str) -> None:
    with pytest.raises(HTTPException) as excinfo:
        await api.install_extension(_request(role), _install_body(host))

    assert excinfo.value.status_code == 403
    assert host.installed() == []


async def test_unauthenticated_requests_are_rejected(host: ExtensionHost) -> None:
    with pytest.raises(HTTPException) as listing:
        await api.list_extensions(_request(None))
    with pytest.raises(HTTPException) as audit:
        await api.extension_audit(_request(None), "demo")

    assert listing.value.status_code == 401
    assert audit.value.status_code == 401


async def test_domain_errors_map_to_http_status(host: ExtensionHost) -> None:
    with pytest.raises(HTTPException) as missing:
        await api.get_extension(_request("user"), "nao-existe")
    body = _install_body(host)
    body.release.digest = "0" * 64
    with pytest.raises(HTTPException) as integrity:
        await api.install_extension(_request("admin"), body)

    assert missing.value.status_code == 404
    assert integrity.value.status_code == 422


async def test_full_lifecycle_and_contributions_through_the_api(
    host: ExtensionHost,
) -> None:
    admin = _request("admin")
    await api.install_extension(admin, _install_body(host))
    assert await api.list_contributions(_request("user")) == []

    await api.set_extension_grants(
        admin, "demo", GrantsUpdate(tools=["echo"], workspaces=["ws1"])
    )
    active = await api.activate_extension(admin, "demo")
    contributions = await api.list_contributions(_request("user"))
    revoked = await api.revoke_extension(admin, "demo", api.RevokeBody(reason="teste"))
    removed = await api.remove_extension(admin, "demo")

    assert active.state == "active"
    assert [item["id"] for item in contributions] == ["demo.mode.studio"]
    assert revoked.state == "revoked"
    assert removed == {"status": "removed", "extension_id": "demo"}


async def test_audit_is_admin_only_and_records_actor(host: ExtensionHost) -> None:
    await api.install_extension(_request("admin"), _install_body(host))

    with pytest.raises(HTTPException) as denied:
        await api.extension_audit(_request("user"), "demo")
    entries = await api.extension_audit(_request("admin"), "demo")

    assert denied.value.status_code == 403
    assert entries[0]["actor"] == "u1"
    assert entries[0]["action"] == "install"


async def _ready(host: ExtensionHost) -> None:
    admin = _request("admin")
    await api.install_extension(admin, _install_body(host))
    await api.set_extension_grants(
        admin, "demo", GrantsUpdate(tools=["echo"], workspaces=["ws1"])
    )
    await api.activate_extension(admin, "demo")


async def test_harness_tool_forwards_only_the_arguments(host: ExtensionHost) -> None:
    await _ready(host)
    ctx = SimpleNamespace(workspace_id="ws1", user_id="u1")

    result = await call_extension_tool("demo", "echo", '{"q": "oi"}', ctx)

    assert result == "resposta"


async def test_harness_tool_reports_denial_as_text(host: ExtensionHost) -> None:
    await _ready(host)
    other = SimpleNamespace(workspace_id="ws2", user_id="u1")

    denied = await call_extension_tool("demo", "echo", "{}", other)
    missing = await call_extension_tool("nao-existe", "echo", "{}", other)

    assert denied.startswith("Erro:") and "workspace" in denied
    assert missing.startswith("Erro:")


async def test_harness_tool_rejects_invalid_arguments(host: ExtensionHost) -> None:
    ctx = SimpleNamespace(workspace_id="ws1", user_id="u1")

    assert (await call_extension_tool("demo", "echo", "{", ctx)).startswith("Erro:")
    assert (await call_extension_tool("demo", "echo", "[1]", ctx)).startswith("Erro:")


def test_extension_tool_requires_approval_like_mcp() -> None:
    from backend.engine import hitl

    names = {
        name
        for value in vars(hitl).values()
        if isinstance(value, frozenset)
        for name in value
    }
    assert "call_extension_tool" in names
