"""Validador de padrões de ignore (gitignore, npmignore, dockerignore, etc).

Respeita arquivos de ignore do workspace com sintaxe gitignore, além das regras
dedicadas do Vectora em ``.vectoraignore`` e dos bloqueios de segurança locais.

Previne que Vectora faça embedding de:
- node_modules/, venv/, .venv/, __pycache__/
- .env, .secrets, credentials
- build/, dist/, .build/ artifacts
- cache, tmp files
- private keys, SSH, certificates
"""

import logging
import re
from collections.abc import Sequence
from pathlib import Path

import pathspec

from backend.services.ignore import is_ignored

logger = logging.getLogger(__name__)


class IgnorePatternValidator:
    """Validador multi-formato de padrões de ignore para RAG."""

    def __init__(self, base_dir: Path | None = None) -> None:
        """Inicializa o validador com padrões de ignore.

        Args:
            base_dir: Diretório base para procurar ignore files.
                     Se None, usa diretório atual.
        """
        self.base_dir = (base_dir or Path.cwd()).resolve()
        self.patterns: list[str] = []
        self._configured_patterns: list[str] = []
        self._spec = pathspec.PathSpec.from_lines("gitignore", [])
        self.ignore_files = [
            ".gitignore",
            ".vectoraignore",
            ".npmignore",
            ".dockerignore",
            ".prettierignore",
            ".eslintignore",
            ".flake8ignore",
        ]

        # Padrões embutidos que sempre devem ser ignorados
        self.builtin_patterns = [
            # Diretórios Python
            "__pycache__",
            ".venv",
            "venv",
            ".egg-info",
            ".mypy_cache",
            ".pytest_cache",
            # Diretórios Node
            "node_modules",
            # Diretórios de build
            "build",
            "dist",
            ".build",
            "target",
            # Git
            ".git",
            ".github",
            # Arquivos de env
            ".env",
            # Credenciais e segurança
            ".secrets",
            ".pem",
            ".key",
            ".jks",
            "id_rsa",
            "id_ed25519",
            ".ssh",
            ".aws",
            ".kube",
            "credentials",
            "apikey",
            "api_key",
            "password",
            "token",
            "secret",
        ]

        self._load_ignore_patterns()

    def _load_ignore_patterns(self) -> None:
        """Carrega padrões de todos os arquivos de ignore disponíveis."""
        logger.debug(
            "Loading ignore patterns",
            extra={"base_dir": str(self.base_dir)},
        )

        self.patterns = self.builtin_patterns.copy()
        self._configured_patterns = []
        for ignore_file in self.ignore_files:
            ignore_path = self.base_dir / ignore_file
            if ignore_path.exists():
                try:
                    self._load_from_file(ignore_path)
                    logger.debug("Loaded patterns from %s", ignore_file)
                except Exception as e:
                    logger.warning(
                        "Failed to load patterns from %s: %s", ignore_file, e
                    )
        self._spec = pathspec.PathSpec.from_lines(
            "gitignore", self._configured_patterns
        )

        logger.info(
            "Ignore patterns loaded",
            extra={
                "total_patterns": len(self.patterns),
                "builtin_patterns": len(self.builtin_patterns),
            },
        )

    def _load_from_file(self, ignore_path: Path) -> None:
        """Carrega padrões de um arquivo de ignore.

        Args:
            ignore_path: Caminho do arquivo de ignore
        """
        with ignore_path.open(encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()

                if line and not line.startswith("#"):
                    self._configured_patterns.append(line)
                    line = line.removeprefix("!")
                    clean_pattern = line.rstrip("/").lstrip("/")
                    if clean_pattern and clean_pattern not in self.patterns:
                        self.patterns.append(clean_pattern)

    @staticmethod
    def _glob_to_regex(glob_pattern: str) -> str:
        """Converte padrão glob para regex (simplificado).

        Suporta:
        - * (qualquer coisa)
        - ** (qualquer coisa recursivo)

        Args:
            glob_pattern: Padrão glob

        Returns:
            Padrão regex equivalente
        """
        glob_pattern = glob_pattern.rstrip("/")
        pattern = re.escape(glob_pattern)
        pattern = pattern.replace(r"\*\*", ".*")
        pattern = pattern.replace(r"\*", "[^/]*")
        if "/" not in glob_pattern and not glob_pattern.startswith("."):
            pattern = f"(^|.*/){pattern}(/.*)?$"
        elif glob_pattern.startswith("."):
            pattern = f"(^|.*/){pattern}$"
        else:
            pattern = f"^{pattern}(/.*)?$"
        return pattern

    def should_ignore(self, file_path: Path | str) -> bool:
        """Verifica se um arquivo deve ser ignorado.

        Args:
            file_path: Caminho do arquivo (absoluto ou relativo)

        Returns:
            True se arquivo deve ser ignorado, False caso contrário
        """
        if isinstance(file_path, str):
            file_path = Path(file_path)

        candidate = Path(file_path)
        if not candidate.is_absolute():
            candidate = self.base_dir / candidate
        candidate = candidate.resolve()
        try:
            relative = candidate.relative_to(self.base_dir)
        except ValueError:
            logger.debug("Ignore validator rejected path outside root: %s", candidate)
            return True

        parts = {part.lower() for part in relative.parts}
        if parts.intersection(
            {
                "__pycache__",
                ".venv",
                "venv",
                ".egg-info",
                ".mypy_cache",
                ".pytest_cache",
                "node_modules",
                "build",
                "dist",
                ".build",
                "target",
                ".git",
                ".github",
                ".secrets",
                ".ssh",
                ".aws",
                ".kube",
            }
        ):
            return True
        name = relative.name.lower()
        if (
            name == ".env"
            or name.startswith(".env.")
            or name in {"credentials", "id_rsa", "id_ed25519"}
            or name.endswith((".pem", ".key", ".jks"))
        ):
            return True

        relative_path = relative.as_posix()
        return self._spec.match_file(relative_path) or is_ignored(
            candidate, self.base_dir, None
        )

    def filter_files(self, file_paths: Sequence[Path | str]) -> list[Path]:
        """Filtra lista de arquivos removendo os que devem ser ignorados.

        Args:
            file_paths: Lista de caminhos de arquivos

        Returns:
            Lista filtrada apenas com arquivos que NÃO devem ser ignorados
        """
        result = []
        ignored_count = 0

        for file_path in file_paths:
            if not self.should_ignore(file_path):
                result.append(Path(file_path))
            else:
                ignored_count += 1

        if ignored_count > 0:
            logger.debug(
                f"Filtered out {ignored_count} ignored files",
                extra={"remaining": len(result)},
            )

        return result

    def get_ignored_patterns_summary(self) -> dict[str, int]:
        """Retorna resumo dos padrões carregados.

        Returns:
            Dicionário com contagem de padrões por tipo
        """
        return {
            "builtin_patterns": len(self.builtin_patterns),
            "total_patterns": len(self.patterns),
        }


# Singleton global
_validators: dict[Path, IgnorePatternValidator] = {}


def get_ignore_validator(base_dir: Path | None = None) -> IgnorePatternValidator:
    """Obtém instância singleton do validador de ignore.

    Args:
        base_dir: Diretório base (usado apenas na primeira inicialização)

    Returns:
        IgnorePatternValidator singleton
    """
    root = (base_dir or Path.cwd()).resolve()
    validator = _validators.get(root)
    if validator is None:
        validator = IgnorePatternValidator(root)
        _validators[root] = validator
    else:
        # Recarrega arquivos de ignore para respeitar alterações no workspace.
        validator._load_ignore_patterns()
    return validator
