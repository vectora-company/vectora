"""Observer podado: diretórios pesados não recebem watch e o log não faz spam."""

import logging
import sys
import time
from pathlib import Path

import pytest

from backend.workspace.fs_watch import (
    IGNORED_DIR_NAMES,
    _OverflowWarningThrottle,
    create_observer,
    is_ignored_path,
)


def test_ignora_componentes_abaixo_da_raiz_apenas(tmp_path: Path) -> None:
    root = tmp_path / "build" / "proj"
    assert not is_ignored_path(root / "src" / "a.py", root)
    assert is_ignored_path(root / "node_modules" / "x" / "a.js", root)
    # HEAD e refs do .git continuam observados (commits por fora avisam o Git).
    assert not is_ignored_path(root / ".git" / "HEAD", root)
    assert not is_ignored_path(root / ".git" / "refs" / "heads" / "main", root)
    assert is_ignored_path(root / ".git" / "objects" / "ab" / "cd", root)
    assert is_ignored_path(root / ".git" / "logs" / "HEAD", root)


def test_throttle_deixa_passar_um_overflow_por_intervalo() -> None:
    filtro = _OverflowWarningThrottle(interval_s=60)

    def rec(msg: str) -> logging.LogRecord:
        return logging.LogRecord("w", logging.WARNING, "f", 1, msg, None, None)

    assert filtro.filter(rec("Inotify queue overflowed; events lost"))
    assert not filtro.filter(rec("Inotify queue overflowed; reconciling"))
    assert filtro.filter(rec("outro aviso qualquer"))


@pytest.mark.skipif(not sys.platform.startswith("linux"), reason="inotify é Linux")
def test_nao_ha_eventos_de_diretorios_ignorados(tmp_path: Path) -> None:
    from watchdog.events import FileSystemEventHandler

    (tmp_path / "node_modules" / "pkg").mkdir(parents=True)
    (tmp_path / "src").mkdir()
    (tmp_path / ".git" / "objects").mkdir(parents=True)
    vistos: list[str] = []

    class Coletor(FileSystemEventHandler):
        def on_any_event(self, event) -> None:
            vistos.append(str(event.src_path))

    observer = create_observer()
    observer.daemon = True
    observer.schedule(Coletor(), str(tmp_path), recursive=True)
    observer.start()
    try:
        (tmp_path / "node_modules" / "pkg" / "a.js").write_text("x")
        (tmp_path / ".git" / "objects" / "pack").write_text("x")
        (tmp_path / ".git" / "HEAD").write_text("ref: refs/heads/main")
        (tmp_path / "src" / "b.py").write_text("y")
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline and not (
            any("b.py" in v for v in vistos) and any("HEAD" in v for v in vistos)
        ):
            time.sleep(0.05)
    finally:
        observer.stop()
        observer.join(timeout=5)

    assert any("b.py" in v for v in vistos)
    assert not any("node_modules" in v and v.endswith("a.js") for v in vistos)
    assert any(v.endswith("/.git/HEAD") for v in vistos)
    assert not any("/.git/objects/" in v for v in vistos)
    assert "node_modules" in IGNORED_DIR_NAMES
