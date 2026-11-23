"""Runner compartilhado e seguro para o GitHub CLI."""

from __future__ import annotations

import asyncio
import logging
import os
import re
import shutil

logger = logging.getLogger(__name__)

GH_READ_TIMEOUT_S = 30.0
GH_WRITE_TIMEOUT_S = 120.0


class GhUnavailable(RuntimeError):
    """The GitHub CLI executable is unavailable."""

    code = "gh_unavailable"


class GhUnauthenticated(RuntimeError):
    """The GitHub CLI rejected the active credentials."""

    code = "gh_unauthenticated"


class GhCommandFailed(RuntimeError):
    """The GitHub CLI command failed for a reason other than authentication."""

    code = "gh_command_failed"


_WRITE_OPERATIONS = {
    "close",
    "comment",
    "create",
    "delete",
    "edit",
    "merge",
    "publish",
    "reopen",
    "review",
    "ready",
    "transfer",
    "upload",
}
_WRITE_HTTP_METHODS = {"DELETE", "PATCH", "POST", "PUT"}
_REDACT_USERINFO = re.compile(r"(?i)(https?://)[^/@\s]+@")
_REDACT_GITHUB_TOKEN = re.compile(
    r"(?i)\b(?:gh[a-z]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b"
)


def redact_github_credentials(value: str) -> str:
    """Remove user info in URLs and GitHub tokens from external text."""
    value = _REDACT_USERINFO.sub(r"\1***@", value)
    return _REDACT_GITHUB_TOKEN.sub("***", value)


def _is_body_argument(args: list[str]) -> bool:
    write_operation = _is_write_operation(args, None)
    for index, argument in enumerate(args):
        if argument in {"--body", "--body-file"}:
            if argument == "--body-file" and args[index + 1 : index + 2] == ["-"]:
                continue
            return True
        if write_operation and argument in {"-F", "--field"}:
            return True
        if argument.startswith(("--body=", "--body-file=")):
            return argument != "--body-file=-"
    return False


def _is_write_operation(args: list[str], input_data: str | None) -> bool:
    if input_data is not None:
        return True
    if len(args) >= 2 and args[0] in {"issue", "pr", "release", "repo"}:
        return args[1] in _WRITE_OPERATIONS
    if args and args[0] == "api":
        for index, argument in enumerate(args[:-1]):
            if argument in {"-X", "--method"}:
                return args[index + 1].upper() in _WRITE_HTTP_METHODS
    return False


async def _user_environment(user_id: str | None) -> dict[str, str]:
    """Return only the authenticated user's GH token overrides."""
    env = os.environ.copy()
    env.update(
        {
            "GH_PAGER": "",
            "GH_PROMPT_DISABLED": "1",
            "GH_NO_UPDATE_NOTIFIER": "1",
            "NO_COLOR": "1",
        }
    )
    if not user_id:
        return env

    ci_token: str | None = None
    if env.get("CI") == "true":
        ci_token = (
            env.get("GH_TOKEN") or env.get("GITHUB_TOKEN") or ""
        ).strip() or None
    env.pop("GH_TOKEN", None)
    env.pop("GITHUB_TOKEN", None)
    try:
        from backend.rbac.auth import get_env_overrides

        token = (await get_env_overrides(user_id)).get("GITHUB_TOKEN", "").strip()
    except Exception:
        logger.debug("github_cli_user_token_unavailable")
        token = None
    token = token or ci_token
    if token:
        env["GH_TOKEN"] = token
        env["GITHUB_TOKEN"] = token
    return env


def _is_unauthenticated(message: str) -> bool:
    lowered = message.casefold()
    return any(
        marker in lowered
        for marker in (
            "not logged into any github hosts",
            "authentication required",
            "requires authentication",
            "bad credentials",
            "http 401",
            "status 401",
            "gh auth login",
        )
    )


def _error(code: str, message: str, *, exit_code: int | None = None) -> dict:
    result = {
        "status": "error",
        "code": code,
        "message": redact_github_credentials(message),
    }
    if exit_code is not None:
        result["exit_code"] = exit_code
    return result


async def run_gh_command(
    args: list[str],
    *,
    cwd: str | None = None,
    input_data: str | None = None,
    user_id: str | None = None,
) -> dict:
    """Run ``gh`` asynchronously, returning a sanitized structured result.

    Free-form text is only accepted through stdin via ``--body-file -``. Calls
    that put text in ``--body`` or another field argument are rejected before
    spawning a process, so user content never enters the process argument list.
    """
    if _is_body_argument(args):
        return _error(
            "gh_body_in_argv",
            "Texto de escrita precisa ser enviado por stdin com --body-file -.",
        )

    try:
        executable = shutil.which("gh", path=os.environ.get("PATH"))
        if executable is None:
            raise GhUnavailable(
                "GitHub CLI não encontrado no PATH. Instale o gh: https://cli.github.com"
            )
    except GhUnavailable as exc:
        return _error(exc.code, str(exc))

    env = await _user_environment(user_id)
    operation = " ".join(args[:2]) or "gh"
    logger.info(
        "github_cli_command_started",
        extra={"tool": "gh_cli", "operation": redact_github_credentials(operation)},
    )

    try:
        process = await asyncio.create_subprocess_exec(
            executable,
            *args,
            cwd=cwd,
            stdin=asyncio.subprocess.PIPE
            if input_data is not None
            else asyncio.subprocess.DEVNULL,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
    except FileNotFoundError:
        error = GhUnavailable("GitHub CLI não encontrado no PATH.")
        return _error(error.code, str(error))
    except OSError as exc:
        return _error("gh_spawn_failed", str(exc))

    timeout = (
        GH_WRITE_TIMEOUT_S
        if _is_write_operation(args, input_data)
        else GH_READ_TIMEOUT_S
    )
    try:
        stdout_bytes, stderr_bytes = await asyncio.wait_for(
            process.communicate(
                input_data.encode() if input_data is not None else None
            ),
            timeout=timeout,
        )
    except TimeoutError:
        process.kill()
        await process.wait()
        return _error("gh_timeout", f"Comando gh excedeu {timeout:g} s.")
    except asyncio.CancelledError:
        process.kill()
        await process.wait()
        raise
    except Exception as exc:
        process.kill()
        await process.wait()
        return _error("gh_process_failed", str(exc))

    stdout = redact_github_credentials(stdout_bytes.decode(errors="replace").strip())
    stderr = redact_github_credentials(stderr_bytes.decode(errors="replace").strip())
    if process.returncode != 0:
        message = stderr or stdout or "Comando gh falhou."
        error = (
            GhUnauthenticated(message)
            if _is_unauthenticated(message)
            else GhCommandFailed(message)
        )
        logger.warning(
            "github_cli_command_failed",
            extra={
                "tool": "gh_cli",
                "operation": redact_github_credentials(operation),
                "exit_code": process.returncode,
                "code": error.code,
            },
        )
        return _error(error.code, str(error), exit_code=process.returncode)

    logger.info(
        "github_cli_command_completed",
        extra={
            "tool": "gh_cli",
            "operation": redact_github_credentials(operation),
            "exit_code": process.returncode,
            "output_length": len(stdout),
        },
    )
    return {"status": "ok", "output": stdout}
