"""Créditos das obras que inspiraram o Git Workbench em THIRD_PARTY_NOTICES.md."""

from __future__ import annotations

from pathlib import Path

from utils import third_party_notices as notices

ROOT = Path(__file__).resolve().parents[2]


def _section() -> str:
    return "\n".join(notices.derived_works_section())


def test_credits_gitdesktop_with_its_license_and_notice() -> None:
    section = _section()

    assert "### GitDesktop" in section
    assert "theBGuy" in section
    assert "Apache-2.0" in section
    assert "https://github.com/theBGuy/GitDesktop" in section
    assert "Apache License" in section
    assert "Version 2.0, January 2004" in section
    assert "Copyright 2026 theBGuy" in section


def test_credits_github_desktop_with_the_mit_license() -> None:
    section = _section()

    assert "### GitHub Desktop" in section
    assert "GitHub, Inc." in section
    assert "https://github.com/desktop/desktop" in section
    assert "Permission is hereby granted, free of charge" in section


def test_states_there_is_no_affiliation() -> None:
    assert "não tem vínculo" in _section()


def test_the_rendered_document_includes_the_credits() -> None:
    document = notices.render([], {})

    assert "## Obras que inspiraram o Git Workbench" in document
    assert document.index("Obras que inspiraram") < document.index("## Permissivas")


def test_rendering_is_deterministic() -> None:
    assert notices.render([], {}) == notices.render([], {})


def test_every_license_text_file_exists_and_is_not_empty() -> None:
    for work in notices._DERIVED_WORKS:
        for _label, filename in work.files:
            text = (notices._LICENSES_DIR / filename).read_text(encoding="utf-8")
            assert text.strip(), filename


def test_committed_notices_file_has_the_credits() -> None:
    committed = (ROOT / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")

    assert _section().strip() in committed
