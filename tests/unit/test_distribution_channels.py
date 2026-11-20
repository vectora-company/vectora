"""O manifesto de canais não promete mais do que o build e o CI entregam."""

from __future__ import annotations

import asyncio
import re
from pathlib import Path
from types import SimpleNamespace
from typing import Any, cast

import pytest
from fastapi import HTTPException

from backend.api.handlers import distribution
from backend.services.distribution_channels import CHANNELS

ROOT = Path(__file__).resolve().parents[2]
BUILDER = (ROOT / "frontend/electron/electron-builder.yml").read_text(encoding="utf-8")
WORKFLOW = (ROOT / ".github/workflows/vectora.yml").read_text(encoding="utf-8")


def _builder_targets() -> set[str]:
    targets: set[str] = set()
    for block in ("win", "mac", "linux"):
        match = re.search(
            rf"^{block}:\n(?P<body>(?:[ \t].*\n|\n)+)", BUILDER, re.MULTILINE
        )
        assert match, block
        targets.update(re.findall(r"^\s+- ([\w.]+)\s*$", match["body"], re.MULTILINE))
    return targets


def test_ids_are_unique() -> None:
    ids = [channel["id"] for channel in CHANNELS]
    assert len(ids) == len(set(ids))


def test_every_listed_format_is_really_built_by_electron_builder() -> None:
    targets = _builder_targets()
    for channel in CHANNELS:
        assert set(channel["formats"]) <= targets, channel["id"]


def test_available_and_build_only_channels_declare_formats_and_integrity() -> None:
    for channel in CHANNELS:
        if channel["status"] in {"available", "build_only"}:
            assert channel["formats"], channel["id"]
            assert channel["integrity"], channel["id"]
        else:
            assert channel["formats"] == [], channel["id"]


def test_build_only_channels_are_built_in_the_release_workflow() -> None:
    for channel in CHANNELS:
        if channel["status"] != "build_only":
            continue
        for fmt in channel["formats"]:
            assert f"*.{fmt}" in WORKFLOW, (channel["id"], fmt)


def test_only_github_releases_is_announced_as_available() -> None:
    available = [c["id"] for c in CHANNELS if c["status"] == "available"]
    assert available == ["github_release"]


def test_store_channels_are_not_claimed_without_publication() -> None:
    by_id = {channel["id"]: channel for channel in CHANNELS}
    for channel_id in ("flathub", "snap_store"):
        assert by_id[channel_id]["status"] != "available"
    for channel_id in ("homebrew", "scoop", "winget", "install_script"):
        assert by_id[channel_id]["status"] == "planned"


def test_macos_intel_is_not_a_target() -> None:
    assert "x64" not in re.findall(r"macos[- ]\w+", WORKFLOW.lower())
    for channel in CHANNELS:
        assert "intel" not in channel["note"].lower()


def test_flatpak_uses_the_current_supported_freedesktop_runtime() -> None:
    flatpak = re.search(
        r"^flatpak:\n(?P<body>(?:[ \t].*\n|\n)+)", BUILDER, re.MULTILINE
    )
    assert flatpak
    assert "runtime: org.freedesktop.Platform" in flatpak["body"]
    assert 'runtimeVersion: "26.08"' in flatpak["body"]


def test_endpoint_requires_authentication_and_returns_the_manifest() -> None:
    anonymous = SimpleNamespace(state=SimpleNamespace(user=None))
    logged = SimpleNamespace(state=SimpleNamespace(user=SimpleNamespace(id="u1")))

    with pytest.raises(HTTPException) as excinfo:
        asyncio.run(distribution.list_channels(cast("Any", anonymous)))

    assert excinfo.value.status_code == 401
    assert asyncio.run(distribution.list_channels(cast("Any", logged))) == CHANNELS


def test_install_validated_formats_are_really_installed_by_the_ci() -> None:
    for channel in CHANNELS:
        for fmt in channel["install_validated"]:
            assert f'"format":"{fmt}"' in WORKFLOW or f"*.{fmt}" in WORKFLOW, (
                channel["id"],
                fmt,
            )


def test_unvalidated_formats_are_not_claimed_as_installed() -> None:
    github = next(c for c in CHANNELS if c["id"] == "github_release")
    for fmt in ("AppImage", "snap", "flatpak", "pacman", "tar.gz"):
        assert fmt not in github["install_validated"]
