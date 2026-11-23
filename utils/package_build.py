"""Caminhos para os artefatos intermediários do empacotamento desktop."""

from __future__ import annotations

from collections.abc import Mapping
from pathlib import Path


def electron_builder_output_dir(
    *,
    is_linux: bool,
    environ: Mapping[str, str],
    home_dir: Path,
    temp_dir: Path,
) -> Path:
    """Escolhe um destino com espaço persistente para os pacotes do Electron."""
    configured_dir = environ.get("VECTORA_DIST_ELECTRON_DIR")
    if configured_dir:
        return Path(configured_dir).expanduser().resolve()

    if is_linux:
        return home_dir / ".cache" / "vectora" / "dist-electron"

    parent = Path(environ.get("LOCALAPPDATA") or temp_dir)
    return parent / "Vectora" / "dist-electron"


def electron_builder_temp_dir(
    *,
    is_linux: bool,
    environ: Mapping[str, str],
    output_dir: Path,
) -> Path | None:
    """Mantém arquivos temporários Linux fora de ``/tmp`` potencialmente limitado."""
    if not is_linux:
        return None

    configured_dir = environ.get("VECTORA_DIST_ELECTRON_TMPDIR")
    if configured_dir:
        return Path(configured_dir).expanduser().resolve()

    return output_dir.parent / "tmp"
