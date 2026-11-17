"""Raise direct Python dependency lower bounds to the versions in uv.lock."""

from __future__ import annotations

import re
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "pyproject.toml"
LOCK = ROOT / "uv.lock"
DEPENDENCY_LINE = re.compile(r"^(\s*)(['\"])(.*)\2(,?\s*)$")
LOWER_BOUND = re.compile(r">=\s*\d+(?:\.\d+)*(?:[a-zA-Z0-9.+-]*)?")


def _normalize(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


def update_constraints() -> bool:
    lock_data = tomllib.loads(LOCK.read_text(encoding="utf-8"))
    locked_versions = {
        _normalize(package["name"]): package["version"]
        for package in lock_data["package"]
    }
    lines = PROJECT.read_text(encoding="utf-8").splitlines(keepends=True)
    in_dependencies = False
    changed = False

    for index, line in enumerate(lines):
        if line.startswith("dependencies = ["):
            in_dependencies = True
            continue
        if in_dependencies and line.startswith("]"):
            in_dependencies = False
            continue
        if not in_dependencies:
            continue

        match = DEPENDENCY_LINE.match(line.rstrip("\n"))
        if not match:
            continue
        requirement = match.group(3)
        name_match = re.match(r"\s*([A-Za-z0-9_.-]+)", requirement)
        if not name_match:
            continue
        locked = locked_versions.get(_normalize(name_match.group(1)))
        if locked is None:
            raise ValueError(f"Dependência ausente em uv.lock: {requirement}")

        version_constraint = requirement.split(";", maxsplit=1)[0]
        lower_bound = LOWER_BOUND.search(version_constraint)
        if lower_bound and lower_bound.group().removeprefix(">=").strip() == locked:
            continue
        if lower_bound:
            updated = LOWER_BOUND.sub(f">={locked}", requirement, count=1)
        else:
            marker_index = requirement.find(";")
            insert_at = marker_index if marker_index >= 0 else len(requirement)
            updated = f"{requirement[:insert_at].rstrip()} >={locked}{requirement[insert_at:]}"
        lines[index] = (
            f"{match.group(1)}{match.group(2)}{updated}{match.group(2)}{match.group(4)}\n"
        )
        changed = True

    if changed:
        PROJECT.write_text("".join(lines), encoding="utf-8")
    return changed


if __name__ == "__main__":
    status = "atualizado" if update_constraints() else "já atualizado"
    print(f"pyproject.toml {status}")
