"""Rotas de PRs e issues da aba GitHub (backend/api/handlers/github.py)."""

from __future__ import annotations

import json
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from backend.api.handlers import github


def _request(user_id: str | None = "alice"):
    user = SimpleNamespace(id=user_id) if user_id else None
    return SimpleNamespace(state=SimpleNamespace(user=user))


def _fake_gh(monkeypatch, result: dict):
    calls: list[tuple[list[str], str | None]] = []

    async def fake(args, cwd=None, input_data=None, user_id=None):
        calls.append((args, user_id))
        return result

    monkeypatch.setattr(github, "_gh_run", fake)
    monkeypatch.setattr(github, "_workspace_cwd", lambda _w: "/tmp/ws")
    return calls


def test_checks_summary_counts_each_outcome() -> None:
    summary = github._checks_summary(
        [
            {"conclusion": "SUCCESS"},
            {"conclusion": "SKIPPED"},
            {"conclusion": "FAILURE"},
            {"status": "IN_PROGRESS", "conclusion": ""},
            {"state": "PENDING"},
            "lixo",
        ]
    )

    assert (summary.passed, summary.failed, summary.pending) == (2, 1, 2)
    assert github._checks_summary(None).passed == 0


async def test_pulls_are_listed_with_checks_and_review(monkeypatch) -> None:
    payload = [
        {
            "number": 7,
            "title": "feat: algo",
            "state": "OPEN",
            "isDraft": True,
            "author": {"login": "ana"},
            "headRefName": "feat/x",
            "baseRefName": "master",
            "updatedAt": "2026-11-19T10:00:00Z",
            "url": "https://github.com/o/r/pull/7",
            "reviewDecision": "APPROVED",
            "statusCheckRollup": [{"conclusion": "SUCCESS"}],
        },
        {"sem": "numero"},
    ]
    calls = _fake_gh(monkeypatch, {"status": "ok", "output": json.dumps(payload)})

    response = await github.list_pulls(_request(), state="all", workspace_id=None)

    assert response.status == "ok"
    assert len(response.pulls) == 1
    pull = response.pulls[0]
    assert (pull.number, pull.author, pull.is_draft) == (7, "ana", True)
    assert pull.review_decision == "APPROVED"
    assert pull.checks.passed == 1
    assert calls[0][0][:4] == ["pr", "list", "--state", "all"]
    assert calls[0][1] == "alice"


async def test_issues_are_listed_with_labels_and_comment_count(monkeypatch) -> None:
    payload = [
        {
            "number": 3,
            "title": "bug",
            "state": "OPEN",
            "author": {"login": "bia"},
            "labels": [{"name": "bug"}, {"name": "frontend"}],
            "comments": [{}, {}],
            "url": "u",
        }
    ]
    _fake_gh(monkeypatch, {"status": "ok", "output": json.dumps(payload)})

    response = await github.list_issues(_request(), state="open", workspace_id=None)

    assert response.issues[0].labels == ["bug", "frontend"]
    assert response.issues[0].comments == 2


@pytest.mark.parametrize(
    ("message", "expected"),
    [
        ("gh not found in PATH", "unavailable"),
        ("To get started with GitHub CLI, please run: gh auth login", "unavailable"),
        ("GraphQL: Could not resolve to a Repository", "error"),
    ],
)
async def test_gh_failures_are_classified(monkeypatch, message, expected) -> None:
    _fake_gh(monkeypatch, {"status": "error", "message": message})

    response = await github.list_pulls(_request(), state="open", workspace_id=None)

    assert response.status == expected
    assert response.message == message
    assert response.pulls == []


async def test_invalid_gh_output_is_an_error(monkeypatch) -> None:
    _fake_gh(monkeypatch, {"status": "ok", "output": "not json"})

    response = await github.list_issues(_request(), state="open", workspace_id=None)

    assert response.status == "error"


async def test_requires_an_authenticated_user() -> None:
    with pytest.raises(HTTPException) as error:
        await github.list_pulls(_request(None), state="open", workspace_id=None)

    assert error.value.status_code == 401
