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
_assert_pydantic_core_extension_bundled = cast(
    "Callable[[Path, str], None]",
    run_path(str(ROOT / "build-hybrid.py"))["_assert_pydantic_core_extension_bundled"],
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


@pytest.mark.parametrize(
    ("platform", "extension"),
    [
        ("linux", "_pydantic_core.cpython-313-x86_64-linux-gnu.so"),
        ("win32", "_pydantic_core.cp313-win_amd64.pyd"),
    ],
)
def test_pydantic_core_native_extension_is_required(
    tmp_path: Path, platform: str, extension: str
) -> None:
    package = tmp_path / "_internal" / "pydantic_core"
    package.mkdir(parents=True)
    (package / extension).touch()
    _assert_pydantic_core_extension_bundled(tmp_path, platform)


def test_pydantic_core_native_extension_missing_fails_the_build(tmp_path: Path) -> None:
    with pytest.raises(SystemExit, match="extensão nativa do pydantic_core ausente"):
        _assert_pydantic_core_extension_bundled(tmp_path, "linux")


def test_yt_dlp_hook_excludes_emscripten_and_collects_ejs_data() -> None:
    hook_path = ROOT / "utils" / "pyinstaller_hooks" / "hook-yt_dlp.py"
    hook = run_path(str(hook_path))

    hiddenimports = hook["hiddenimports"]
    datas = hook["datas"]

    assert not any(
        module.startswith("urllib3.contrib.emscripten") for module in hiddenimports
    )
    assert any(destination.startswith("yt_dlp_ejs/") for _source, destination in datas)
