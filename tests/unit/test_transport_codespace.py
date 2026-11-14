from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from backend.transport.base import RunResult
from backend.transport.codespace import CodespaceTransport


@pytest.fixture
def transport() -> CodespaceTransport:
    return CodespaceTransport(
        codespace_name="example", remote_path="/workspaces/project"
    )


async def test_read_file_returns_bounded_bytes(transport, monkeypatch):
    run = AsyncMock(return_value=RunResult(0, "content", ""))
    monkeypatch.setattr(transport, "run", run)

    assert await transport.read_file("/workspaces/project/a.txt", 12) == b"content"
    run.assert_awaited_once()


async def test_read_file_surfaces_missing_file(transport, monkeypatch):
    monkeypatch.setattr(
        transport,
        "run",
        AsyncMock(return_value=RunResult(1, "", "No such file or directory")),
    )

    with pytest.raises(FileNotFoundError):
        await transport.read_file("/workspaces/project/missing.txt")


@pytest.mark.parametrize("operation", ["list_dir", "read_file", "write_file"])
async def test_filesystem_operations_surface_cli_failure(transport, monkeypatch, operation):
    monkeypatch.setattr(
        transport,
        "run",
        AsyncMock(return_value=RunResult(127, "", "gh unavailable")),
    )

    call = (
        transport.list_dir("/workspaces/project")
        if operation == "list_dir"
        else transport.read_file("/workspaces/project/a.txt")
        if operation == "read_file"
        else transport.write_file("/workspaces/project/a.txt", b"content")
    )
    with pytest.raises(RuntimeError, match="gh unavailable"):
        await call
