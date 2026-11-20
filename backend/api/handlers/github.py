"""Pull requests e issues do repositório do workspace, para a aba GitHub.

Lê pelo `gh` CLI já autenticado do usuário (mesmo helper das tools ``gh_*``);
só leitura. Cada resposta traz um campo ``status`` para a interface mostrar
"gh não instalado" ou "não autenticado" em vez de uma lista vazia.
"""

from __future__ import annotations

import json
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from backend.tools.gh import _gh_run

router = APIRouter(prefix="/github", tags=["github"])

_PR_FIELDS = (
    "number,title,state,isDraft,author,headRefName,baseRefName,updatedAt,url,"
    "reviewDecision,statusCheckRollup"
)
_ISSUE_FIELDS = "number,title,state,author,labels,updatedAt,url,comments"
_LIST_LIMIT = 30


class PullChecks(BaseModel):
    """Resumo dos checks de um PR."""

    passed: int = 0
    failed: int = 0
    pending: int = 0


class PullSummary(BaseModel):
    number: int
    title: str
    state: str
    is_draft: bool = False
    author: str = ""
    head_ref: str = ""
    base_ref: str = ""
    updated_at: str = ""
    url: str = ""
    review_decision: str = ""
    checks: PullChecks = Field(default_factory=PullChecks)


class IssueSummary(BaseModel):
    number: int
    title: str
    state: str
    author: str = ""
    labels: list[str] = Field(default_factory=list)
    updated_at: str = ""
    url: str = ""
    comments: int = 0


class PullListResponse(BaseModel):
    status: Literal["ok", "unavailable", "error"]
    message: str = ""
    pulls: list[PullSummary] = Field(default_factory=list)


class IssueListResponse(BaseModel):
    status: Literal["ok", "unavailable", "error"]
    message: str = ""
    issues: list[IssueSummary] = Field(default_factory=list)


def _require_user(request: Request) -> str:
    user = getattr(request.state, "user", None)
    if user is None or not getattr(user, "id", None):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    return str(user.id)


def _workspace_cwd(workspace_id: str | None) -> str | None:
    from backend.workspace.workspace import workspace_registry

    workspace = (
        workspace_registry.get(workspace_id)
        if workspace_id
        else workspace_registry.get_or_create()
    )
    return workspace.cwd if workspace else None


def _checks_summary(rollup: object) -> PullChecks:
    """Conta os checks por desfecho; vazio ou formato desconhecido vira zero."""
    summary = PullChecks()
    if not isinstance(rollup, list):
        return summary
    for check in rollup:
        if not isinstance(check, dict):
            continue
        conclusion = str(check.get("conclusion") or check.get("state") or "").upper()
        status = str(check.get("status") or "").upper()
        if conclusion in {"SUCCESS", "NEUTRAL", "SKIPPED"}:
            summary.passed += 1
        elif conclusion in {
            "FAILURE",
            "ERROR",
            "TIMED_OUT",
            "CANCELLED",
            "STARTUP_FAILURE",
            "ACTION_REQUIRED",
        }:
            summary.failed += 1
        elif status in {"IN_PROGRESS", "QUEUED", "PENDING", "WAITING"} or (
            conclusion in {"", "PENDING", "EXPECTED"}
        ):
            summary.pending += 1
    return summary


def _author(raw: object) -> str:
    return str(raw.get("login", "")) if isinstance(raw, dict) else ""


def _failure(result: dict) -> tuple[Literal["unavailable", "error"], str]:
    message = str(result.get("message", "")).strip()
    lowered = message.lower()
    if "not found in path" in lowered or "auth" in lowered:
        return "unavailable", message
    return "error", message


@router.get("/pulls", response_model=PullListResponse)
async def list_pulls(
    request: Request,
    state: Annotated[Literal["open", "closed", "merged", "all"], Query()] = "open",
    workspace_id: str | None = None,
) -> PullListResponse:
    """Pull requests do repositório do workspace, com o resumo dos checks."""
    user_id = _require_user(request)
    result = await _gh_run(
        [
            "pr",
            "list",
            "--state",
            state,
            "--limit",
            str(_LIST_LIMIT),
            "--json",
            _PR_FIELDS,
        ],
        cwd=_workspace_cwd(workspace_id),
        user_id=user_id,
    )
    if result["status"] != "ok":
        status, message = _failure(result)
        return PullListResponse(status=status, message=message)
    try:
        raw = json.loads(result["output"])
    except json.JSONDecodeError:
        return PullListResponse(status="error", message="Resposta inválida do gh.")
    pulls = [
        PullSummary(
            number=int(item["number"]),
            title=str(item.get("title", "")),
            state=str(item.get("state", "")),
            is_draft=bool(item.get("isDraft", False)),
            author=_author(item.get("author")),
            head_ref=str(item.get("headRefName", "")),
            base_ref=str(item.get("baseRefName", "")),
            updated_at=str(item.get("updatedAt", "")),
            url=str(item.get("url", "")),
            review_decision=str(item.get("reviewDecision") or ""),
            checks=_checks_summary(item.get("statusCheckRollup")),
        )
        for item in raw
        if isinstance(item, dict) and "number" in item
    ]
    return PullListResponse(status="ok", pulls=pulls)


@router.get("/issues", response_model=IssueListResponse)
async def list_issues(
    request: Request,
    state: Annotated[Literal["open", "closed", "all"], Query()] = "open",
    workspace_id: str | None = None,
) -> IssueListResponse:
    """Issues do repositório do workspace."""
    user_id = _require_user(request)
    result = await _gh_run(
        [
            "issue",
            "list",
            "--state",
            state,
            "--limit",
            str(_LIST_LIMIT),
            "--json",
            _ISSUE_FIELDS,
        ],
        cwd=_workspace_cwd(workspace_id),
        user_id=user_id,
    )
    if result["status"] != "ok":
        status, message = _failure(result)
        return IssueListResponse(status=status, message=message)
    try:
        raw = json.loads(result["output"])
    except json.JSONDecodeError:
        return IssueListResponse(status="error", message="Resposta inválida do gh.")
    issues = [
        IssueSummary(
            number=int(item["number"]),
            title=str(item.get("title", "")),
            state=str(item.get("state", "")),
            author=_author(item.get("author")),
            labels=[
                str(label.get("name", ""))
                for label in item.get("labels") or []
                if isinstance(label, dict)
            ],
            updated_at=str(item.get("updatedAt", "")),
            url=str(item.get("url", "")),
            comments=len(item.get("comments") or []),
        )
        for item in raw
        if isinstance(item, dict) and "number" in item
    ]
    return IssueListResponse(status="ok", issues=issues)
