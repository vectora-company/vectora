"""Resolve o launch do Electron em dev — o backend Python (`vectora start`
rodado direto, fora do Electron) passa a spawnar o Electron sozinho, ao
invés do caminho de produção onde é o Electron quem spawna o backend
compilado. Mesmo espírito de resolução defensiva que
`backend/scheduling/nats_sidecar.py::_resolve_binary` já usa: nunca lança,
retorna ``None`` quando qualquer peça não existir — o caller cai no
fallback antigo (bandeja/servidor puro).

Resolução (só dev — produção nunca passa por aqui, ver `_run_start`). O
Electron não tem pacote npm próprio — está fundido em
`frontend/package.json` (sem `electron/package.json` separado), só o
`tsconfig.json` de compilação (Node/NodeNext, incompatível com o tsconfig
browser/Vite do frontend) segue num subdiretório próprio. Por isso a
resolução consulta dois diretórios distintos:
  - binário Electron: `frontend/node_modules/electron/path.txt`
    (convenção do pacote npm `electron` — arquivo texto com o nome do
    executável da plataforma, relativo a `node_modules/electron/dist/`;
    instalado no node_modules do pacote frontend, não num subpacote).
  - entrypoint: `frontend/electron/dist/main.js`, compilado por
    `pnpm --dir frontend run electron:build` (`tsc -p electron/tsconfig.json`).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def _frontend_dir() -> Path:
    """`<repo>/vectora/frontend` — onde `pnpm install` escreve
    `node_modules/electron/` (pacote único, sem subpacote pro Electron)."""
    return Path(__file__).resolve().parent.parent.parent / "frontend"


def _electron_dir() -> Path:
    """`<repo>/vectora/frontend/electron` — onde `tsc` (tsconfig próprio)
    compila `src/main.ts` para `dist/main.js`."""
    return _frontend_dir() / "electron"


def resolve_linux_ozone_argument(requested: str | None) -> str | None:
    """Resolve o backend de janela do Chromium usado pelo Electron no Linux."""
    platform = (requested or "x11").strip().lower()
    if platform == "cosmic":
        platform = "wayland"
    if platform == "auto":
        return None
    if platform not in {"wayland", "x11"}:
        raise ValueError(
            "VECTORA_OZONE_PLATFORM inválido: "
            f"{platform}. Use auto, x11, wayland ou cosmic."
        )
    return f"--ozone-platform={platform}"


def resolve_electron_launch() -> tuple[str, list[str]] | None:
    """Retorna ``(executável, [main.js])`` prontos para
    ``asyncio.create_subprocess_exec``, ou ``None`` se o build de dev do
    Electron não estiver disponível (não instalado, não buildado).

    Cada motivo de falha loga um aviso específico — sem isso, `vectora
    start` cai silenciosamente pro modo web sem nenhuma pista de por que
    o Electron não subiu (achado ao vivo: `pnpm install --frozen-lockfile`
    reporta "Already up to date" mesmo quando o postinstall do pacote
    `electron` nunca rodou de verdade, deixando `node_modules/electron/`
    sem `path.txt`/`dist/` — o `scons frontend` não detecta isso).
    """
    packaged_override = os.environ.get("VECTORA_PACKAGED_ELECTRON_PATH", "").strip()
    if packaged_override:
        executable = Path(packaged_override).expanduser()
        if executable.is_file() and os.access(executable, os.X_OK):
            return str(executable), []
        logger.warning(
            "electron_launcher: VECTORA_PACKAGED_ELECTRON_PATH não aponta "
            "para um executável: %s",
            executable,
        )
        return None

    main_js = _electron_dir() / "dist" / "main.js"
    main_exists = main_js.is_file()
    source_dir = _electron_dir() / "src"
    source_files = list(source_dir.rglob("*.ts")) if source_dir.is_dir() else []
    main_is_stale = (
        main_exists
        and bool(source_files)
        and main_js.stat().st_mtime_ns
        < max(source.stat().st_mtime_ns for source in source_files)
    )
    if not main_exists or main_is_stale:
        reason = "ausente" if not main_exists else "desatualizado em relação aos fontes"
        logger.warning(
            "electron_launcher: %s %s — rode `pnpm --dir frontend "
            "run electron:build` (ou `scons frontend`)",
            main_js,
            reason,
        )
        return None

    path_txt = _frontend_dir() / "node_modules" / "electron" / "path.txt"
    if not path_txt.is_file():
        logger.warning(
            "electron_launcher: %s ausente — o postinstall do pacote npm "
            "`electron` não rodou (binário não baixado); rode `pnpm rebuild "
            "electron` ou `node node_modules/electron/install.js` dentro de "
            "frontend",
            path_txt,
        )
        return None

    try:
        exe_name = path_txt.read_text(encoding="utf-8").strip()
    except OSError:
        logger.exception("electron_launcher: falha ao ler path.txt")
        return None
    if not exe_name:
        logger.warning("electron_launcher: %s está vazio", path_txt)
        return None

    exe_path = path_txt.parent / "dist" / exe_name
    if not exe_path.is_file():
        logger.warning(
            "electron_launcher: binário %s referenciado por path.txt não existe "
            "— rode `pnpm rebuild electron` dentro de frontend",
            exe_path,
        )
        return None

    return str(exe_path), [str(main_js)]
