from __future__ import annotations

from pathlib import Path

from backend.services.ignore_validator import (
    IgnorePatternValidator,
    get_ignore_validator,
)


def test_validator_applies_workspace_gitignore_and_negation(tmp_path: Path) -> None:
    (tmp_path / ".gitignore").write_text("*.log\n!important.log\n")
    (tmp_path / "ignored.log").touch()
    (tmp_path / "important.log").touch()
    validator = IgnorePatternValidator(tmp_path)

    assert validator.should_ignore(tmp_path / "ignored.log")
    assert not validator.should_ignore(tmp_path / "important.log")


def test_validator_applies_vectoraignore_and_sensitive_defaults(tmp_path: Path) -> None:
    (tmp_path / ".vectoraignore").write_text("private/**\n")
    private = tmp_path / "private" / "notes.txt"
    secret = tmp_path / ".env.production"
    regular = tmp_path / "source.py"
    private.parent.mkdir()
    private.touch()
    secret.touch()
    regular.touch()
    validator = IgnorePatternValidator(tmp_path)

    assert validator.should_ignore(private)
    assert validator.should_ignore(secret)
    assert not validator.should_ignore(regular)


def test_filter_files_rejects_paths_outside_the_workspace(tmp_path: Path) -> None:
    outside = tmp_path.parent / "outside.txt"
    inside = tmp_path / "inside.txt"
    inside.touch()
    validator = IgnorePatternValidator(tmp_path)

    assert validator.filter_files([inside, outside]) == [inside]


def test_relative_path_is_resolved_from_workspace_root(tmp_path: Path) -> None:
    (tmp_path / ".gitignore").write_text("cache/**\n")
    validator = IgnorePatternValidator(tmp_path)

    assert validator.should_ignore(Path("cache/data.json"))


def test_cached_validator_reloads_workspace_patterns(tmp_path: Path) -> None:
    validator = get_ignore_validator(tmp_path)
    target = tmp_path / "generated.bin"
    target.touch()
    assert not validator.should_ignore(target)

    (tmp_path / ".gitignore").write_text("generated.bin\n")
    refreshed = get_ignore_validator(tmp_path)

    assert refreshed is validator
    assert refreshed.should_ignore(target)
