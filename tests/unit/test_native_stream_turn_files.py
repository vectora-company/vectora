"""A varredura dos arquivos do turno não segura o evento final do stream."""

from __future__ import annotations

import asyncio
import time

import pytest

from backend.api import native_stream


@pytest.mark.asyncio
async def test_slow_scan_is_abandoned_at_deadline(monkeypatch) -> None:
    monkeypatch.setattr(native_stream, "_TURN_FILES_TIMEOUT_SECONDS", 0.05)

    def slow_scan(_snapshot):
        time.sleep(0.3)
        return ["a.py"]

    started_at = time.monotonic()
    result = await native_stream._finalize_turn_files(slow_scan, object())

    assert result == []
    assert time.monotonic() - started_at < 0.25


@pytest.mark.asyncio
async def test_fast_scan_returns_changes() -> None:
    result = await native_stream._finalize_turn_files(lambda _s: ["a.py"], object())
    assert result == ["a.py"]


@pytest.mark.asyncio
async def test_file_persistence_runs_in_background(monkeypatch) -> None:
    called = asyncio.Event()

    class _Store:
        async def attach_edited_files(self, thread_id, run_id, files) -> None:
            called.set()

    async def _get_store():
        return _Store()

    monkeypatch.setattr("backend.services.agent_factory.get_session_store", _get_store)

    native_stream._schedule_attach_edited_files("t", "r", [{"path": "a.py"}])

    await asyncio.wait_for(called.wait(), timeout=1)


@pytest.mark.asyncio
async def test_finalize_and_attach_returns_list_and_schedules_persistence(
    monkeypatch,
) -> None:
    scheduled: list[tuple] = []
    monkeypatch.setattr(
        native_stream,
        "_schedule_attach_edited_files",
        lambda *args: scheduled.append(args),
    )

    payload = await native_stream._finalize_and_attach(
        lambda _s: ["a.py"],
        lambda changes: [{"path": c} for c in changes],
        object(),
        "t1",
        "r1",
    )

    assert payload == [{"path": "a.py"}]
    assert scheduled == [("t1", "r1", [{"path": "a.py"}])]


@pytest.mark.asyncio
async def test_finalize_and_attach_without_changes_does_not_persist(
    monkeypatch,
) -> None:
    scheduled: list[tuple] = []
    monkeypatch.setattr(
        native_stream,
        "_schedule_attach_edited_files",
        lambda *args: scheduled.append(args),
    )

    payload = await native_stream._finalize_and_attach(
        lambda _s: [], lambda changes: [], object(), "t1", "r1"
    )

    assert payload == []
    assert scheduled == []
