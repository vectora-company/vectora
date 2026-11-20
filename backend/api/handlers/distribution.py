"""Canais de distribuição e a disponibilidade de cada um."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request

from backend.services.distribution_channels import CHANNELS, Channel

router = APIRouter(prefix="/distribution", tags=["distribution"])


@router.get("/channels")
async def list_channels(request: Request) -> list[Channel]:
    """Canais de distribuição, com o estado real de cada um."""
    if getattr(request.state, "user", None) is None:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return CHANNELS
