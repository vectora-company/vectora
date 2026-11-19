"""Ctrl+C repetido/atrasado precisa derrubar o processo e os filhos."""

import contextlib
import os
import subprocess
import sys
import time

import pytest

from backend.main import _descendant_pids


@pytest.mark.skipif(not sys.platform.startswith("linux"), reason="usa /proc")
def test_descendant_pids_encontra_filhos_e_netos() -> None:
    pai = subprocess.Popen(
        [
            sys.executable,
            "-c",
            (
                "import subprocess,sys,time;"
                "subprocess.Popen([sys.executable,'-c','import time;time.sleep(30)']);"
                "time.sleep(30)"
            ),
        ]
    )
    try:
        deadline = time.monotonic() + 5
        pids: list[int] = []
        while time.monotonic() < deadline and len(pids) < 2:
            pids = _descendant_pids(os.getpid())
            time.sleep(0.1)
        assert pai.pid in pids
        assert len(pids) >= 2
    finally:
        for pid in _descendant_pids(os.getpid()):
            with contextlib.suppress(OSError):
                os.kill(pid, 9)
        pai.wait(timeout=5)
