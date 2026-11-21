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


async def test_pulls_are_listed_with_review_and_without_checks_payload(
    monkeypatch,
) -> None:
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
    assert pull.checks.passed == 0
    # A lista não pede o rollup de checks (payload pesado); só o detalhe pede.
    assert "statusCheckRollup" not in calls[0][0][calls[0][0].index("--json") + 1]
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


PULL_VIEW = {
    "number": 7,
    "title": "feat: algo",
    "state": "OPEN",
    "isDraft": False,
    "author": {"login": "ana"},
    "headRefName": "feat/x",
    "baseRefName": "master",
    "createdAt": "2026-11-19T10:00:00Z",
    "updatedAt": "2026-11-19T11:00:00Z",
    "url": "https://github.com/o/r/pull/7",
    "body": "Closes #3",
    "labels": [{"name": "bug"}, {"name": "frontend"}],
    "assignees": [{"login": "ana"}],
    "reviewRequests": [{"login": "bia"}, {"name": "time-ui"}],
    "milestone": {"title": "0.2"},
    "additions": 56,
    "deletions": 32,
    "changedFiles": 2,
    "mergeable": "MERGEABLE",
    "reviewDecision": "APPROVED",
    "statusCheckRollup": [{"conclusion": "SUCCESS"}, {"conclusion": "FAILURE"}],
    "comments": [
        {
            "author": {"login": "bia"},
            "body": "Boa!",
            "createdAt": "2026-11-19T12:00:00Z",
            "url": "https://github.com/o/r/pull/7#c1",
        }
    ],
    "commits": [
        {
            "oid": "abc1234",
            "messageHeadline": "feat: algo",
            "authors": [{"login": "ana", "name": "Ana"}],
            "committedDate": "2026-11-19T10:30:00Z",
        }
    ],
    "files": [{"path": "a.ts", "additions": 30, "deletions": 0}],
}


async def test_pull_detail_returns_body_comments_commits_and_files(
    monkeypatch,
) -> None:
    calls = _fake_gh(monkeypatch, {"status": "ok", "output": json.dumps(PULL_VIEW)})

    response = await github.get_pull(_request(), 7, "ws1")

    assert calls[0][0][:3] == ["pr", "view", "7"]
    pull = response.pull
    assert response.status == "ok" and pull is not None
    assert (pull.title, pull.author, pull.head_ref, pull.base_ref) == (
        "feat: algo",
        "ana",
        "feat/x",
        "master",
    )
    assert pull.labels == ["bug", "frontend"]
    assert pull.reviewers == ["bia", "time-ui"]
    assert pull.milestone == "0.2"
    assert (pull.additions, pull.deletions, pull.changed_files) == (56, 32, 2)
    assert (pull.checks.passed, pull.checks.failed) == (1, 1)
    assert [c.author for c in pull.comments] == ["bia"]
    assert pull.commits[0].sha == "abc1234"
    assert pull.commits[0].author == "ana"
    assert [(f.path, f.additions) for f in pull.files] == [("a.ts", 30)]


async def test_pull_detail_survives_missing_optional_fields(monkeypatch) -> None:
    _fake_gh(
        monkeypatch,
        {
            "status": "ok",
            "output": json.dumps({"number": 9, "title": "x", "state": "OPEN"}),
        },
    )

    response = await github.get_pull(_request(), 9, None)

    assert response.pull is not None
    assert response.pull.body == ""
    assert response.pull.labels == []
    assert response.pull.comments == []


async def test_pull_detail_reports_gh_unavailable_not_an_empty_pull(
    monkeypatch,
) -> None:
    _fake_gh(monkeypatch, {"status": "error", "message": "gh not found in PATH"})

    response = await github.get_pull(_request(), 7, None)

    assert response.status == "unavailable"
    assert response.pull is None


@pytest.mark.parametrize("output", ["", "nope", "[]", '{"title": "sem numero"}'])
async def test_pull_detail_rejects_invalid_payloads(monkeypatch, output) -> None:
    _fake_gh(monkeypatch, {"status": "ok", "output": output})

    response = await github.get_pull(_request(), 7, None)

    assert response.status == "error"
    assert response.pull is None


async def test_pull_detail_requires_an_authenticated_user(monkeypatch) -> None:
    _fake_gh(monkeypatch, {"status": "ok", "output": "{}"})

    with pytest.raises(HTTPException) as error:
        await github.get_pull(_request(None), 7, None)

    assert error.value.status_code == 401


async def test_issue_detail_returns_body_labels_and_comments(monkeypatch) -> None:
    payload = {
        "number": 3,
        "title": "bug no chat",
        "state": "OPEN",
        "author": {"login": "ana"},
        "createdAt": "2026-11-19T10:00:00Z",
        "updatedAt": "2026-11-19T11:00:00Z",
        "url": "https://github.com/o/r/issues/3",
        "body": "## Objetivo",
        "labels": [{"name": "bug"}],
        "assignees": [{"login": "bia"}],
        "milestone": None,
        "comments": [{"author": {"login": "bia"}, "body": "ok", "createdAt": "x"}],
    }
    calls = _fake_gh(monkeypatch, {"status": "ok", "output": json.dumps(payload)})

    response = await github.get_issue(_request(), 3, "ws1")

    assert calls[0][0][:3] == ["issue", "view", "3"]
    issue = response.issue
    assert response.status == "ok" and issue is not None
    assert (issue.title, issue.author, issue.labels, issue.assignees) == (
        "bug no chat",
        "ana",
        ["bug"],
        ["bia"],
    )
    assert issue.milestone == ""
    assert [c.body for c in issue.comments] == ["ok"]


async def test_issue_detail_reports_errors(monkeypatch) -> None:
    _fake_gh(monkeypatch, {"status": "error", "message": "could not resolve"})

    response = await github.get_issue(_request(), 3, None)

    assert response.status == "error"
    assert response.issue is None


def test_comment_list_is_capped() -> None:
    many = [{"author": {"login": "a"}, "body": str(i)} for i in range(500)]

    assert len(github._comments(many)) == 100


# --- cache curto das leituras do gh -----------------------------------------


@pytest.mark.asyncio
async def test_leitura_repetida_usa_o_cache_e_chama_o_gh_uma_vez(monkeypatch):
    calls = _fake_gh(monkeypatch, {"status": "ok", "output": "[]"})

    first = await github._gh_read(["pr", "list"], cwd="/w", user_id="u1")
    second = await github._gh_read(["pr", "list"], cwd="/w", user_id="u1")

    assert first == second
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_cache_nao_mistura_usuarios_nem_argumentos(monkeypatch):
    calls = _fake_gh(monkeypatch, {"status": "ok", "output": "[]"})

    await github._gh_read(["pr", "list"], cwd="/w", user_id="u1")
    await github._gh_read(["pr", "list"], cwd="/w", user_id="u2")
    await github._gh_read(["issue", "list"], cwd="/w", user_id="u1")

    assert len(calls) == 3


@pytest.mark.asyncio
async def test_erro_nao_fica_em_cache(monkeypatch):
    calls = _fake_gh(monkeypatch, {"status": "error", "message": "boom"})

    await github._gh_read(["pr", "list"], cwd="/w", user_id="u1")
    await github._gh_read(["pr", "list"], cwd="/w", user_id="u1")

    assert len(calls) == 2


@pytest.mark.asyncio
async def test_chamadas_simultaneas_iguais_compartilham_uma_execucao(monkeypatch):
    import asyncio

    started = 0

    async def slow(args, cwd=None, input_data=None, user_id=None):
        nonlocal started
        started += 1
        await asyncio.sleep(0.01)
        return {"status": "ok", "output": "[]"}

    monkeypatch.setattr(github, "_gh_run", slow)

    await asyncio.gather(
        *(github._gh_read(["pr", "list"], cwd="/w", user_id="u1") for _ in range(5))
    )

    assert started == 1


@pytest.mark.asyncio
async def test_cache_expira_depois_do_ttl(monkeypatch):
    calls = _fake_gh(monkeypatch, {"status": "ok", "output": "[]"})
    clock = [100.0]
    monkeypatch.setattr(github.time, "monotonic", lambda: clock[0])

    await github._gh_read(["pr", "list"], cwd="/w", user_id="u1")
    clock[0] += github._GH_CACHE_TTL_S + 1
    await github._gh_read(["pr", "list"], cwd="/w", user_id="u1")

    assert len(calls) == 2
