"""GitHub CLI tools — operações via `gh` CLI.

Tools expostas: gh_pr_list, gh_pr_create, gh_pr_view, gh_pr_merge,
gh_issue_list, gh_issue_create, gh_issue_view, gh_issue_comment.

Todas as tools:
- Executam o binário `gh` via subprocess assíncrono (sem imports do SDK GitHub).
- Retornam JSON estruturado compatível com os render_hints declarados.
- O runner compartilhado vive em ``backend.services.github_cli``.
- Fallback gracioso quando `gh` não está no PATH.

Requisito de sistema: `gh` CLI instalado e autenticado (`gh auth login`).
"""

from __future__ import annotations

import json
import warnings

from backend.services.github_cli import run_gh_command as _gh_run
from backend.tools.context import ToolContext
from backend.tools.registry import ToolExtras, vtool

# O lancedb avisa a cada fork que o runtime assíncrono dele foi reiniciado no
# filho. Aqui o filho executa o `gh` na hora (exec), sem tocar no lancedb, então
# o risco descrito não existe e o aviso só repetia a cada chamada.
warnings.filterwarnings(
    "ignore",
    message="lancedb fork support is experimental",
    category=RuntimeWarning,
)


def _resolve_cwd(workspace_id: str | None, ctx: ToolContext) -> str | None:
    """Resolve workspace → cwd para passar ao subprocess gh."""
    from backend.workspace.workspace import workspace_registry

    wid = workspace_id or ctx.workspace_id or None
    ws = workspace_registry.get(wid) if wid else workspace_registry.get_or_create()
    return ws.cwd if ws else None


# ---------------------------------------------------------------------------
# Tools nativas
# ---------------------------------------------------------------------------


@vtool(
    extras=ToolExtras(
        render_hint="table",
        category="git",
        destructive=False,
        icon="git-pull-request",
    )
)
async def gh_pr_list(
    ctx: ToolContext,
    state: str = "open",
    workspace_id: str | None = None,
) -> str:
    """Lista pull requests do repositório.

    Args:
        state: "open" | "closed" | "merged" | "all" (default: "open").
        workspace_id: ID do workspace.
    """
    cwd = _resolve_cwd(workspace_id, ctx)
    result = await _gh_run(
        [
            "pr",
            "list",
            "--state",
            state,
            "--json",
            "number,title,state,author,createdAt,headRefName,baseRefName",
        ],
        cwd=cwd,
        user_id=ctx.user_id,
    )
    if result["status"] != "ok":
        return json.dumps(result)
    try:
        prs = json.loads(result["output"])
        return json.dumps({"status": "ok", "prs": prs, "state": state})
    except json.JSONDecodeError:
        return json.dumps({"status": "ok", "output": result["output"]})


@vtool(
    extras=ToolExtras(
        render_hint="code_block",
        category="git",
        destructive=False,
        icon="git-pull-request",
    )
)
async def gh_pr_create(
    ctx: ToolContext,
    title: str = "",
    body: str = "",
    base: str = "main",
    draft: bool = False,
    workspace_id: str | None = None,
) -> str:
    """Cria um pull request a partir da branch atual.

    Args:
        title: Título do PR (obrigatório).
        body: Descrição do PR (suporta Markdown).
        base: Branch alvo (default: "main").
        draft: Se True, cria como rascunho.
        workspace_id: ID do workspace.
    """
    cwd = _resolve_cwd(workspace_id, ctx)
    if not title:
        return json.dumps({"status": "error", "message": "Título do PR é obrigatório."})
    args = ["pr", "create", "--title", title, "--body-file", "-", "--base", base]
    if draft:
        args.append("--draft")
    result = await _gh_run(args, cwd=cwd, input_data=body, user_id=ctx.user_id)
    return json.dumps(result)


@vtool(
    extras=ToolExtras(
        render_hint="code_block",
        category="git",
        destructive=False,
        icon="git-pull-request",
    )
)
async def gh_pr_view(
    ctx: ToolContext,
    pr_number: int = 0,
    workspace_id: str | None = None,
) -> str:
    """Exibe detalhes de um pull request.

    Args:
        pr_number: Número do PR.
        workspace_id: ID do workspace.
    """
    cwd = _resolve_cwd(workspace_id, ctx)
    if not pr_number:
        return json.dumps({"status": "error", "message": "Número do PR é obrigatório."})
    result = await _gh_run(
        [
            "pr",
            "view",
            str(pr_number),
            "--json",
            "number,title,state,body,author,createdAt,files,reviews",
        ],
        cwd=cwd,
        user_id=ctx.user_id,
    )
    if result["status"] != "ok":
        return json.dumps(result)
    try:
        pr = json.loads(result["output"])
        return json.dumps({"status": "ok", "pr": pr})
    except json.JSONDecodeError:
        return json.dumps({"status": "ok", "output": result["output"]})


@vtool(
    extras=ToolExtras(
        render_hint="code_block",
        category="git",
        destructive=True,
        icon="git-merge",
    )
)
async def gh_pr_merge(
    ctx: ToolContext,
    pr_number: int = 0,
    method: str = "squash",
    workspace_id: str | None = None,
) -> str:
    """Faz merge de um pull request.

    ⚠️ Operação destrutiva — integra commits e pode fechar a branch.

    Args:
        pr_number: Número do PR.
        method: "squash" | "merge" | "rebase" (default: "squash").
        workspace_id: ID do workspace.
    """
    cwd = _resolve_cwd(workspace_id, ctx)
    if not pr_number:
        return json.dumps({"status": "error", "message": "Número do PR é obrigatório."})
    result = await _gh_run(
        ["pr", "merge", str(pr_number), f"--{method}", "--auto"],
        cwd=cwd,
        user_id=ctx.user_id,
    )
    return json.dumps(result)


@vtool(
    extras=ToolExtras(
        render_hint="table",
        category="git",
        destructive=False,
        icon="circle-dot",
    )
)
async def gh_issue_list(
    ctx: ToolContext,
    state: str = "open",
    labels: str = "",
    workspace_id: str | None = None,
) -> str:
    """Lista issues do repositório.

    Args:
        state: "open" | "closed" | "all" (default: "open").
        labels: Labels separadas por vírgula (ex: "bug,enhancement").
        workspace_id: ID do workspace.
    """
    cwd = _resolve_cwd(workspace_id, ctx)
    args = [
        "issue",
        "list",
        "--state",
        state,
        "--json",
        "number,title,state,author,createdAt,labels,assignees",
    ]
    if labels:
        args += ["--label", labels]
    result = await _gh_run(args, cwd=cwd, user_id=ctx.user_id)
    if result["status"] != "ok":
        return json.dumps(result)
    try:
        issues = json.loads(result["output"])
        return json.dumps({"status": "ok", "issues": issues, "state": state})
    except json.JSONDecodeError:
        return json.dumps({"status": "ok", "output": result["output"]})


@vtool(
    extras=ToolExtras(
        render_hint="code_block",
        category="git",
        destructive=False,
        icon="circle-plus",
    )
)
async def gh_issue_create(
    ctx: ToolContext,
    title: str = "",
    body: str = "",
    labels: str = "",
    workspace_id: str | None = None,
) -> str:
    """Cria uma issue no repositório.

    Args:
        title: Título da issue (obrigatório).
        body: Descrição da issue (suporta Markdown).
        labels: Labels separadas por vírgula.
        workspace_id: ID do workspace.
    """
    cwd = _resolve_cwd(workspace_id, ctx)
    if not title:
        return json.dumps(
            {"status": "error", "message": "Título da issue é obrigatório."}
        )
    args = ["issue", "create", "--title", title, "--body-file", "-"]
    if labels:
        args += ["--label", labels]
    result = await _gh_run(args, cwd=cwd, input_data=body, user_id=ctx.user_id)
    return json.dumps(result)


@vtool(
    extras=ToolExtras(
        render_hint="code_block",
        category="git",
        destructive=False,
        icon="circle-dot",
    )
)
async def gh_issue_view(
    ctx: ToolContext,
    issue_number: int = 0,
    workspace_id: str | None = None,
) -> str:
    """Exibe detalhes de uma issue.

    Args:
        issue_number: Número da issue.
        workspace_id: ID do workspace.
    """
    cwd = _resolve_cwd(workspace_id, ctx)
    if not issue_number:
        return json.dumps(
            {"status": "error", "message": "Número da issue é obrigatório."}
        )
    result = await _gh_run(
        [
            "issue",
            "view",
            str(issue_number),
            "--json",
            "number,title,state,body,author,createdAt,labels,comments",
        ],
        cwd=cwd,
        user_id=ctx.user_id,
    )
    if result["status"] != "ok":
        return json.dumps(result)
    try:
        issue = json.loads(result["output"])
        return json.dumps({"status": "ok", "issue": issue})
    except json.JSONDecodeError:
        return json.dumps({"status": "ok", "output": result["output"]})


@vtool(
    extras=ToolExtras(
        render_hint="code_block",
        category="git",
        destructive=False,
        icon="message-circle",
    )
)
async def gh_issue_comment(
    ctx: ToolContext,
    issue_number: int = 0,
    body: str = "",
    workspace_id: str | None = None,
) -> str:
    """Adiciona um comentário a uma issue.

    Args:
        issue_number: Número da issue.
        body: Texto do comentário (suporta Markdown).
        workspace_id: ID do workspace.
    """
    cwd = _resolve_cwd(workspace_id, ctx)
    if not issue_number:
        return json.dumps(
            {"status": "error", "message": "Número da issue é obrigatório."}
        )
    if not body:
        return json.dumps(
            {"status": "error", "message": "Corpo do comentário é obrigatório."}
        )
    result = await _gh_run(
        ["issue", "comment", str(issue_number), "--body-file", "-"],
        cwd=cwd,
        input_data=body,
        user_id=ctx.user_id,
    )
    return json.dumps(result)
