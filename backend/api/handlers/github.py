"""Pull requests e issues do repositório do workspace, para a aba GitHub.

Lê pelo `gh` CLI já autenticado do usuário (mesmo helper das tools ``gh_*``);
só leitura. Cada resposta traz um campo ``status`` para a interface mostrar
"gh não instalado" ou "não autenticado" em vez de uma lista vazia.
"""

from __future__ import annotations

import json
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Path, Query, Request
from pydantic import BaseModel, Field

from backend.tools.gh import _gh_run

router = APIRouter(prefix="/github", tags=["github"])

_PR_FIELDS = (
    "number,title,state,isDraft,author,headRefName,baseRefName,updatedAt,url,"
    "reviewDecision,statusCheckRollup"
)
_ISSUE_FIELDS = "number,title,state,author,labels,updatedAt,url,comments"
_LIST_LIMIT = 30
_PR_DETAIL_FIELDS = (
    "number,title,state,isDraft,author,headRefName,baseRefName,createdAt,"
    "updatedAt,url,body,labels,assignees,reviewRequests,milestone,additions,"
    "deletions,changedFiles,mergeable,reviewDecision,statusCheckRollup,"
    "comments,commits,files"
)
_ISSUE_DETAIL_FIELDS = (
    "number,title,state,author,createdAt,updatedAt,url,body,labels,"
    "assignees,milestone,comments"
)
_MAX_COMMENTS = 100
_MAX_FILES = 300


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


class GithubComment(BaseModel):
    author: str = ""
    body: str = ""
    created_at: str = ""
    url: str = ""


class PullFile(BaseModel):
    path: str
    additions: int = 0
    deletions: int = 0


class PullCommit(BaseModel):
    sha: str
    message: str = ""
    author: str = ""
    date: str = ""


class PullDetail(BaseModel):
    """Um PR por inteiro, para abrir como document na workbench Git."""

    number: int
    title: str
    state: str
    is_draft: bool = False
    author: str = ""
    head_ref: str = ""
    base_ref: str = ""
    created_at: str = ""
    updated_at: str = ""
    url: str = ""
    body: str = ""
    labels: list[str] = Field(default_factory=list)
    assignees: list[str] = Field(default_factory=list)
    reviewers: list[str] = Field(default_factory=list)
    milestone: str = ""
    additions: int = 0
    deletions: int = 0
    changed_files: int = 0
    mergeable: str = ""
    review_decision: str = ""
    checks: PullChecks = Field(default_factory=PullChecks)
    comments: list[GithubComment] = Field(default_factory=list)
    commits: list[PullCommit] = Field(default_factory=list)
    files: list[PullFile] = Field(default_factory=list)


class IssueDetail(BaseModel):
    """Uma issue por inteiro, para abrir como document na workbench Git."""

    number: int
    title: str
    state: str
    author: str = ""
    created_at: str = ""
    updated_at: str = ""
    url: str = ""
    body: str = ""
    labels: list[str] = Field(default_factory=list)
    assignees: list[str] = Field(default_factory=list)
    milestone: str = ""
    comments: list[GithubComment] = Field(default_factory=list)


class PullDetailResponse(BaseModel):
    status: Literal["ok", "unavailable", "error"]
    message: str = ""
    pull: PullDetail | None = None


class IssueDetailResponse(BaseModel):
    status: Literal["ok", "unavailable", "error"]
    message: str = ""
    issue: IssueDetail | None = None


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


def _names(items: object, *keys: str) -> list[str]:
    """Nomes de uma lista de objetos do gh (login, ou name para times/labels)."""
    names: list[str] = []
    for item in items if isinstance(items, list) else []:
        if not isinstance(item, dict):
            continue
        value = next((str(item[k]) for k in keys if item.get(k)), "")
        if value:
            names.append(value)
    return names


def _comments(items: object) -> list[GithubComment]:
    return [
        GithubComment(
            author=_author(item.get("author")),
            body=str(item.get("body", "")),
            created_at=str(item.get("createdAt", "")),
            url=str(item.get("url", "")),
        )
        for item in (items if isinstance(items, list) else [])[:_MAX_COMMENTS]
        if isinstance(item, dict)
    ]


def _milestone(raw: object) -> str:
    return str(raw.get("title", "")) if isinstance(raw, dict) else ""


def _commit_author(item: dict) -> str:
    authors = item.get("authors")
    if isinstance(authors, list) and authors and isinstance(authors[0], dict):
        return str(authors[0].get("login") or authors[0].get("name") or "")
    return ""


def _pull_detail(item: dict) -> PullDetail:
    commits = [
        PullCommit(
            sha=str(commit.get("oid", "")),
            message=str(commit.get("messageHeadline", "")),
            author=_commit_author(commit),
            date=str(commit.get("committedDate", "")),
        )
        for commit in item.get("commits") or []
        if isinstance(commit, dict) and commit.get("oid")
    ]
    files = [
        PullFile(
            path=str(f.get("path", "")),
            additions=int(f.get("additions") or 0),
            deletions=int(f.get("deletions") or 0),
        )
        for f in (item.get("files") or [])[:_MAX_FILES]
        if isinstance(f, dict) and f.get("path")
    ]
    return PullDetail(
        number=int(item["number"]),
        title=str(item.get("title", "")),
        state=str(item.get("state", "")),
        is_draft=bool(item.get("isDraft", False)),
        author=_author(item.get("author")),
        head_ref=str(item.get("headRefName", "")),
        base_ref=str(item.get("baseRefName", "")),
        created_at=str(item.get("createdAt", "")),
        updated_at=str(item.get("updatedAt", "")),
        url=str(item.get("url", "")),
        body=str(item.get("body") or ""),
        labels=_names(item.get("labels"), "name"),
        assignees=_names(item.get("assignees"), "login"),
        reviewers=_names(item.get("reviewRequests"), "login", "name"),
        milestone=_milestone(item.get("milestone")),
        additions=int(item.get("additions") or 0),
        deletions=int(item.get("deletions") or 0),
        changed_files=int(item.get("changedFiles") or 0),
        mergeable=str(item.get("mergeable") or ""),
        review_decision=str(item.get("reviewDecision") or ""),
        checks=_checks_summary(item.get("statusCheckRollup")),
        comments=_comments(item.get("comments")),
        commits=commits,
        files=files,
    )


@router.get("/pulls/{number}", response_model=PullDetailResponse)
async def get_pull(
    request: Request,
    number: Annotated[int, Path(ge=1)],
    workspace_id: str | None = None,
) -> PullDetailResponse:
    """Um PR por inteiro: corpo, comentários, commits, arquivos e checks."""
    user_id = _require_user(request)
    result = await _gh_run(
        ["pr", "view", str(number), "--json", _PR_DETAIL_FIELDS],
        cwd=_workspace_cwd(workspace_id),
        user_id=user_id,
    )
    if result["status"] != "ok":
        status, message = _failure(result)
        return PullDetailResponse(status=status, message=message)
    try:
        raw = json.loads(result["output"])
        if not isinstance(raw, dict) or "number" not in raw:
            raise ValueError("sem número")
        return PullDetailResponse(status="ok", pull=_pull_detail(raw))
    except (ValueError, TypeError):
        return PullDetailResponse(status="error", message="Resposta inválida do gh.")


@router.get("/issues/{number}", response_model=IssueDetailResponse)
async def get_issue(
    request: Request,
    number: Annotated[int, Path(ge=1)],
    workspace_id: str | None = None,
) -> IssueDetailResponse:
    """Uma issue por inteiro: corpo, rótulos, responsáveis e comentários."""
    user_id = _require_user(request)
    result = await _gh_run(
        ["issue", "view", str(number), "--json", _ISSUE_DETAIL_FIELDS],
        cwd=_workspace_cwd(workspace_id),
        user_id=user_id,
    )
    if result["status"] != "ok":
        status, message = _failure(result)
        return IssueDetailResponse(status=status, message=message)
    try:
        raw = json.loads(result["output"])
        if not isinstance(raw, dict) or "number" not in raw:
            raise ValueError("sem número")
        issue = IssueDetail(
            number=int(raw["number"]),
            title=str(raw.get("title", "")),
            state=str(raw.get("state", "")),
            author=_author(raw.get("author")),
            created_at=str(raw.get("createdAt", "")),
            updated_at=str(raw.get("updatedAt", "")),
            url=str(raw.get("url", "")),
            body=str(raw.get("body") or ""),
            labels=_names(raw.get("labels"), "name"),
            assignees=_names(raw.get("assignees"), "login"),
            milestone=_milestone(raw.get("milestone")),
            comments=_comments(raw.get("comments")),
        )
        return IssueDetailResponse(status="ok", issue=issue)
    except (ValueError, TypeError):
        return IssueDetailResponse(status="error", message="Resposta inválida do gh.")


# ---------------------------------------------------------------------------
# Actions (somente leitura): runs, jobs, passos, log e workflows
# ---------------------------------------------------------------------------

_RUN_LIST_FIELDS = (
    "databaseId,number,displayTitle,workflowName,status,conclusion,event,"
    "headBranch,headSha,createdAt,updatedAt,startedAt,url,attempt"
)
_RUN_DETAIL_FIELDS = _RUN_LIST_FIELDS + ",jobs"
_RUN_LIMIT = 30
_MAX_LOG_CHARS = 200_000

# Estados e conclusões que o `gh run list --status` aceita.
_RUN_STATUSES = frozenset(
    {
        "queued",
        "in_progress",
        "completed",
        "waiting",
        "requested",
        "pending",
        "success",
        "failure",
        "cancelled",
        "skipped",
        "timed_out",
        "neutral",
        "stale",
        "action_required",
        "startup_failure",
    }
)
# Branch e workflow vão como argumento: nunca começam com "-" (opção) e só
# usam caracteres comuns de nomes de branch e de arquivo de workflow.
_REF_PATTERN = r"^[A-Za-z0-9_][A-Za-z0-9_./ @+-]{0,199}$"


class RunSummary(BaseModel):
    id: int
    number: int = 0
    title: str = ""
    workflow: str = ""
    status: str = ""
    conclusion: str = ""
    event: str = ""
    branch: str = ""
    sha: str = ""
    created_at: str = ""
    updated_at: str = ""
    started_at: str = ""
    url: str = ""
    attempt: int = 1


class RunStep(BaseModel):
    number: int = 0
    name: str = ""
    status: str = ""
    conclusion: str = ""
    started_at: str = ""
    completed_at: str = ""


class RunJob(BaseModel):
    id: int
    name: str = ""
    status: str = ""
    conclusion: str = ""
    started_at: str = ""
    completed_at: str = ""
    url: str = ""
    steps: list[RunStep] = Field(default_factory=list)


class RunDetail(RunSummary):
    jobs: list[RunJob] = Field(default_factory=list)


class Workflow(BaseModel):
    id: int
    name: str
    state: str = ""


class RunListResponse(BaseModel):
    status: Literal["ok", "unavailable", "error"]
    message: str = ""
    runs: list[RunSummary] = Field(default_factory=list)


class RunDetailResponse(BaseModel):
    status: Literal["ok", "unavailable", "error"]
    message: str = ""
    run: RunDetail | None = None


class WorkflowListResponse(BaseModel):
    status: Literal["ok", "unavailable", "error"]
    message: str = ""
    workflows: list[Workflow] = Field(default_factory=list)


class JobLogResponse(BaseModel):
    status: Literal["ok", "unavailable", "error"]
    message: str = ""
    log: str = ""
    truncated: bool = False


def _int(value: object, default: int = 0) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else default


def _run_summary(item: dict) -> RunSummary:
    return RunSummary(
        id=int(item["databaseId"]),
        number=_int(item.get("number")),
        title=str(item.get("displayTitle", "")),
        workflow=str(item.get("workflowName", "")),
        status=str(item.get("status", "")),
        conclusion=str(item.get("conclusion") or ""),
        event=str(item.get("event", "")),
        branch=str(item.get("headBranch", "")),
        sha=str(item.get("headSha", "")),
        created_at=str(item.get("createdAt", "")),
        updated_at=str(item.get("updatedAt", "")),
        started_at=str(item.get("startedAt", "")),
        url=str(item.get("url", "")),
        attempt=max(1, _int(item.get("attempt"), 1)),
    )


def _run_job(item: dict) -> RunJob:
    steps = [
        RunStep(
            number=_int(step.get("number")),
            name=str(step.get("name", "")),
            status=str(step.get("status", "")),
            conclusion=str(step.get("conclusion") or ""),
            started_at=str(step.get("startedAt") or ""),
            completed_at=str(step.get("completedAt") or ""),
        )
        for step in item.get("steps") or []
        if isinstance(step, dict)
    ]
    return RunJob(
        id=int(item["databaseId"]),
        name=str(item.get("name", "")),
        status=str(item.get("status", "")),
        conclusion=str(item.get("conclusion") or ""),
        started_at=str(item.get("startedAt") or ""),
        completed_at=str(item.get("completedAt") or ""),
        url=str(item.get("url", "")),
        steps=steps,
    )


@router.get("/runs", response_model=RunListResponse)
async def list_runs(
    request: Request,
    status: Annotated[str | None, Query()] = None,
    branch: Annotated[str | None, Query(pattern=_REF_PATTERN)] = None,
    workflow: Annotated[str | None, Query(pattern=_REF_PATTERN)] = None,
    workspace_id: str | None = None,
) -> RunListResponse:
    """Runs do GitHub Actions do repositório, com filtros opcionais."""
    user_id = _require_user(request)
    if status is not None and status not in _RUN_STATUSES:
        raise HTTPException(status_code=422, detail="Estado de run inválido.")
    args = ["run", "list", "--limit", str(_RUN_LIMIT), "--json", _RUN_LIST_FIELDS]
    if status:
        args += ["--status", status]
    if branch:
        args += ["--branch", branch]
    if workflow:
        args += ["--workflow", workflow]
    result = await _gh_run(args, cwd=_workspace_cwd(workspace_id), user_id=user_id)
    if result["status"] != "ok":
        failure, message = _failure(result)
        return RunListResponse(status=failure, message=message)
    try:
        raw = json.loads(result["output"])
        if not isinstance(raw, list):
            raise ValueError("lista esperada")
        runs = [
            _run_summary(item)
            for item in raw
            if isinstance(item, dict) and "databaseId" in item
        ]
        return RunListResponse(status="ok", runs=runs)
    except (ValueError, TypeError):
        return RunListResponse(status="error", message="Resposta inválida do gh.")


@router.get("/runs/{run_id}", response_model=RunDetailResponse)
async def get_run(
    request: Request,
    run_id: Annotated[int, Path(ge=1)],
    workspace_id: str | None = None,
) -> RunDetailResponse:
    """Um run por inteiro: metadados, jobs e passos."""
    user_id = _require_user(request)
    result = await _gh_run(
        ["run", "view", str(run_id), "--json", _RUN_DETAIL_FIELDS],
        cwd=_workspace_cwd(workspace_id),
        user_id=user_id,
    )
    if result["status"] != "ok":
        failure, message = _failure(result)
        return RunDetailResponse(status=failure, message=message)
    try:
        raw = json.loads(result["output"])
        if not isinstance(raw, dict) or "databaseId" not in raw:
            raise ValueError("sem id")
        jobs = [
            _run_job(job)
            for job in raw.get("jobs") or []
            if isinstance(job, dict) and "databaseId" in job
        ]
        run = RunDetail(**_run_summary(raw).model_dump(), jobs=jobs)
        return RunDetailResponse(status="ok", run=run)
    except (ValueError, TypeError):
        return RunDetailResponse(status="error", message="Resposta inválida do gh.")


@router.get("/runs/{run_id}/jobs/{job_id}/log", response_model=JobLogResponse)
async def get_job_log(
    request: Request,
    run_id: Annotated[int, Path(ge=1)],
    job_id: Annotated[int, Path(ge=1)],
    workspace_id: str | None = None,
) -> JobLogResponse:
    """Log de um job (só existe depois de o job terminar), limitado em tamanho."""
    user_id = _require_user(request)
    result = await _gh_run(
        ["run", "view", str(run_id), "--job", str(job_id), "--log"],
        cwd=_workspace_cwd(workspace_id),
        user_id=user_id,
    )
    if result["status"] != "ok":
        failure, message = _failure(result)
        return JobLogResponse(status=failure, message=message)
    text = str(result.get("output", ""))
    truncated = len(text) > _MAX_LOG_CHARS
    # Mantém o fim do log, onde costuma estar a falha.
    return JobLogResponse(
        status="ok",
        log=text[-_MAX_LOG_CHARS:] if truncated else text,
        truncated=truncated,
    )


@router.get("/workflows", response_model=WorkflowListResponse)
async def list_workflows(
    request: Request,
    workspace_id: str | None = None,
) -> WorkflowListResponse:
    """Workflows do repositório, para o filtro da aba Actions."""
    user_id = _require_user(request)
    result = await _gh_run(
        ["workflow", "list", "--json", "id,name,state"],
        cwd=_workspace_cwd(workspace_id),
        user_id=user_id,
    )
    if result["status"] != "ok":
        failure, message = _failure(result)
        return WorkflowListResponse(status=failure, message=message)
    try:
        raw = json.loads(result["output"])
        if not isinstance(raw, list):
            raise ValueError("lista esperada")
        workflows = [
            Workflow(
                id=int(item["id"]),
                name=str(item.get("name", "")),
                state=str(item.get("state", "")),
            )
            for item in raw
            if isinstance(item, dict) and "id" in item
        ]
        return WorkflowListResponse(status="ok", workflows=workflows)
    except (ValueError, TypeError):
        return WorkflowListResponse(status="error", message="Resposta inválida do gh.")
