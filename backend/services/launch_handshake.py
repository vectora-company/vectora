"""Handshake autenticado entre os donos do ciclo de vida desktop."""

from __future__ import annotations

import hmac
import os
from dataclasses import dataclass

from fastapi import HTTPException, Request

LAUNCH_MODES = frozenset({"python-primary", "electron-primary"})


@dataclass(frozen=True)
class LaunchHandshake:
    mode: str
    token: str


def expected_launch_mode() -> str:
    mode = os.environ.get("VECTORA_LAUNCH_MODE", "").strip()
    if mode in LAUNCH_MODES:
        return mode
    return "electron-primary" if os.environ.get("VECTORA_DESKTOP") else "python-primary"


def expected_launch_token() -> str:
    return os.environ.get("VECTORA_LAUNCH_TOKEN", "")


async def verify_launch_handshake(request: Request) -> LaunchHandshake:
    mode = request.headers.get("x-vectora-launch-mode", "").strip()
    token = request.headers.get("x-vectora-launch-token", "")
    if (
        mode != expected_launch_mode()
        or not token
        or not hmac.compare_digest(token, expected_launch_token())
    ):
        raise HTTPException(status_code=403, detail="Assinatura de launch inválida")
    return LaunchHandshake(mode=mode, token=token)
