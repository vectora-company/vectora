"""A varredura dos arquivos do turno não segura o evento final do stream."""

from __future__ import annotations

import asyncio
import time

import pytest

from backend.api import native_stream


@pytest.mark.asyncio
async def test_varredura_lenta_e_abandonada_no_prazo(monkeypatch) -> None:
    monkeypatch.setattr(native_stream, "_TURN_FILES_TIMEOUT_SECONDS", 0.05)

    def lenta(_snapshot):
        time.sleep(0.3)
        return ["a.py"]

    inicio = time.monotonic()
    resultado = await native_stream._finalize_turn_files(lenta, object())

    assert resultado == []
    assert time.monotonic() - inicio < 0.25


@pytest.mark.asyncio
async def test_varredura_rapida_devolve_as_mudancas() -> None:
    resultado = await native_stream._finalize_turn_files(lambda _s: ["a.py"], object())
    assert resultado == ["a.py"]


@pytest.mark.asyncio
async def test_persistencia_dos_arquivos_roda_em_segundo_plano(monkeypatch) -> None:
    chamado = asyncio.Event()

    class _Store:
        async def attach_edited_files(self, thread_id, run_id, files) -> None:
            chamado.set()

    async def _get_store():
        return _Store()

    monkeypatch.setattr("backend.services.agent_factory.get_session_store", _get_store)

    native_stream._schedule_attach_edited_files("t", "r", [{"path": "a.py"}])

    await asyncio.wait_for(chamado.wait(), timeout=1)


@pytest.mark.asyncio
async def test_finalize_and_attach_devolve_a_lista_e_agenda_a_persistencia(
    monkeypatch,
) -> None:
    agendados: list[tuple] = []
    monkeypatch.setattr(
        native_stream,
        "_schedule_attach_edited_files",
        lambda *args: agendados.append(args),
    )

    payload = await native_stream._finalize_and_attach(
        lambda _s: ["a.py"],
        lambda changes: [{"path": c} for c in changes],
        object(),
        "t1",
        "r1",
    )

    assert payload == [{"path": "a.py"}]
    assert agendados == [("t1", "r1", [{"path": "a.py"}])]


@pytest.mark.asyncio
async def test_finalize_and_attach_sem_mudancas_nao_persiste(monkeypatch) -> None:
    agendados: list[tuple] = []
    monkeypatch.setattr(
        native_stream,
        "_schedule_attach_edited_files",
        lambda *args: agendados.append(args),
    )

    payload = await native_stream._finalize_and_attach(
        lambda _s: [], lambda changes: [], object(), "t1", "r1"
    )

    assert payload == []
    assert agendados == []
