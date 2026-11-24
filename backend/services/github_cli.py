"""Runner compartilhado e seguro para o GitHub CLI."""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import re
import shutil
import time

logger = logging.getLogger(__name__)

GH_READ_TIMEOUT_S = 30.0
GH_WRITE_TIMEOUT_S = 120.0


class GhUnavailableError(RuntimeError):
    """The GitHub CLI executable is unavailable."""

    code = "gh_unavailable"


class GhUnauthenticatedError(RuntimeError):
    """The GitHub CLI rejected the active credentials."""

    code = "gh_unauthenticated"


class GhCommandFailedError(RuntimeError):
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


async def github_auth_epoch(user_id: str | None) -> str:
    """Return a non-reversible cache namespace for the active credential."""
    env = await _user_environment(user_id)
    token = env.get("GH_TOKEN") or env.get("GITHUB_TOKEN") or ""
    return hashlib.sha256(token.encode()).hexdigest() if token else "anonymous"


def _http_response_headers(output: str) -> tuple[int | None, dict[str, str]]:
    """Extract only cache and rate-limit headers from ``gh api --include``."""
    status: int | None = None
    headers: dict[str, str] = {}
    allowed = {"etag", "retry-after", "x-ratelimit-reset", "x-ratelimit-remaining"}
    for line in output.splitlines():
        if line.startswith("HTTP/"):
            pieces = line.split()
            status = int(pieces[1]) if len(pieces) > 1 and pieces[1].isdigit() else None
        elif ":" in line:
            name, value = line.split(":", 1)
            normalized = name.strip().casefold()
            if normalized in allowed:
                headers[normalized] = value.strip()
    return status, headers


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


def _rate_limit_details(
    message: str,
    headers: dict[str, str] | None = None,
) -> dict[str, int | str] | None:
    lowered = message.casefold()
    headers = headers or {}
    if (
        not any(
            marker in lowered
            for marker in ("rate limit", "secondary rate", "abuse detection")
        )
        and headers.get("x-ratelimit-remaining") != "0"
    ):
        return None
    reset_match = re.search(
        r"(?:reset|resets)\s+(?:at\s+)?(\d{10})", message, re.IGNORECASE
    )
    retry_match = re.search(r"retry[- ]after[: ]+(\d+)", message, re.IGNORECASE)
    reset_header = headers.get("x-ratelimit-reset")
    retry_header = headers.get("retry-after")
    if reset_header and reset_header.isdigit():
        reset_at = int(reset_header)
    elif retry_header and retry_header.isdigit():
        reset_at = int(time.time()) + max(60, int(retry_header))
    elif reset_match:
        reset_at = int(reset_match.group(1))
    elif retry_match:
        reset_at = int(time.time()) + max(60, int(retry_match.group(1)))
    else:
        reset_at = int(time.time()) + 60
    return {"code": "rate_limited", "reset_at": reset_at}


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

    executable = shutil.which("gh", path=os.environ.get("PATH"))
    if executable is None:
        error = GhUnavailableError(
            "GitHub CLI não encontrado no PATH. Instale o gh: https://cli.github.com"
        )
        return _error(error.code, str(error))

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
        error = GhUnavailableError("GitHub CLI não encontrado no PATH.")
        return _error(error.code, str(error))
    except OSError as exc:
        return _error("gh_spawn_failed", str(exc))

    timeout = (
        GH_WRITE_TIMEOUT_S
        if _is_write_operation(args, input_data)
        else GH_READ_TIMEOUT_S
    )
    result: dict
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
        result = _error("gh_timeout", f"Comando gh excedeu {timeout:g} s.")
    except asyncio.CancelledError:
        process.kill()
        await process.wait()
        raise
    except Exception as exc:
        process.kill()
        await process.wait()
        result = _error("gh_process_failed", str(exc))
    else:
        stdout = redact_github_credentials(
            stdout_bytes.decode(errors="replace").strip()
        )
        stderr = redact_github_credentials(
            stderr_bytes.decode(errors="replace").strip()
        )
        if process.returncode != 0:
            message = stderr or stdout or "Comando gh falhou."
            error = (
                GhUnauthenticatedError(message)
                if _is_unauthenticated(message)
                else GhCommandFailedError(message)
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
            result = _error(error.code, str(error), exit_code=process.returncode)
            http_status, response_headers = _http_response_headers(
                stdout_bytes.decode(errors="replace")
            )
            if http_status is not None:
                result["http_status"] = http_status
            rate_limit = _rate_limit_details(message, response_headers)
            if rate_limit is not None:
                result.update(rate_limit)
        else:
            logger.info(
                "github_cli_command_completed",
                extra={
                    "tool": "gh_cli",
                    "operation": redact_github_credentials(operation),
                    "exit_code": process.returncode,
                    "output_length": len(stdout),
                },
            )
            result = {"status": "ok", "output": stdout}
            http_status, response_headers = _http_response_headers(stdout)
            if http_status is not None:
                result["http_status"] = http_status
            result.update(response_headers)

    return result
