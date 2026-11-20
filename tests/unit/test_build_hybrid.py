"""Testes do empacotamento PyInstaller do backend."""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from runpy import run_path
from typing import cast

import pytest

ROOT = Path(__file__).resolve().parents[2]
_module_is_importable = cast(
    "Callable[[str], bool]",
    run_path(str(ROOT / "build-hybrid.py"))["_module_is_importable"],
)


def test_module_probe_does_not_import_package_parent(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    package = tmp_path / "build_probe_package"
    package.mkdir()
    (package / "__init__.py").write_text(
        "raise RuntimeError('package parent must not be imported')\n",
        encoding="utf-8",
    )
    (package / "present.py").write_text("", encoding="utf-8")
    monkeypatch.syspath_prepend(str(tmp_path))

    assert _module_is_importable("build_probe_package.present")
