"""API do host de extensões Vext.

Qualquer usuário autenticado vê as extensões ativas e as contribuições
habilitadas. Instalar, ativar, conceder permissões, reverter, revogar e remover
exigem admin. Nenhuma resposta traz caminhos do disco, comandos nem segredos.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any, NoReturn

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from backend.api.handlers.admin import require_admin
from backend.extensions.host import (
    ExtensionError,
    GrantsUpdate,
    InstallRequest,
    get_extension_host,
)
from backend.extensions.models import ExtensionRecord

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/extensions", tags=["extensions"])

_STATUS = {
    "not_found": 404,
    "denied": 403,
    "revoked": 409,
    "conflict": 409,
    "not_active": 409,
    "invalid": 422,
    "incompatible": 422,
    "integrity": 422,
    "failed": 502,
}


class ExtensionSummary(BaseModel):
    id: str
    name: str
    publisher: str
    version: str
    digest: str
    state: str
    state_reason: str
    has_previous: bool
    tools: list[str]
    granted_tools: list[str]
    allow_hosts: list[str]
    workspaces: list[str]
    contributions: int


class RevokeBody(BaseModel):
    reason: str = Field(default="", max_length=300)


def _actor(request: Request) -> str:
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return str(getattr(user, "id", "") or "local")


def _admin(request: Request) -> str:
    actor = _actor(request)
    require_admin(request.state.user)
    return actor


def _fail(exc: ExtensionError) -> NoReturn:
    raise HTTPException(
        status_code=_STATUS.get(exc.code, 400), detail=exc.message
    ) from exc


def _summary(record: ExtensionRecord) -> ExtensionSummary:
    return ExtensionSummary(
        id=record.id,
        name=record.name,
        publisher=record.publisher,
        version=record.current.version,
        digest=record.current.digest,
        state=record.state.value,
        state_reason=record.state_reason,
        has_previous=record.previous is not None,
        tools=record.current.declared_tools,
        granted_tools=record.grants.tools,
        allow_hosts=record.grants.allow_hosts,
        workspaces=record.grants.workspaces,
        contributions=len(record.current.contributions),
    )


@router.get("", response_model=list[ExtensionSummary])
async def list_extensions(request: Request) -> list[ExtensionSummary]:
    _actor(request)
    return [_summary(record) for record in get_extension_host().installed()]


@router.get("/contributions")
async def list_contributions(request: Request) -> list[dict[str, Any]]:
    """Contribuições de interface das extensões ativas."""
    _actor(request)
    return get_extension_host().contributions()


@router.get("/{extension_id}", response_model=ExtensionSummary)
async def get_extension(request: Request, extension_id: str) -> ExtensionSummary:
    _actor(request)
    try:
        return _summary(get_extension_host().get(extension_id))
    except ExtensionError as exc:
        _fail(exc)


@router.get("/{extension_id}/health")
async def extension_health(request: Request, extension_id: str) -> dict[str, Any]:
    _actor(request)
    try:
        return await get_extension_host().health(extension_id)
    except ExtensionError as exc:
        _fail(exc)


@router.get("/{extension_id}/audit")
async def extension_audit(
    request: Request,
    extension_id: str,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[dict[str, Any]]:
    _admin(request)
    return get_extension_host().audit(extension_id)[-limit:]


@router.post("", response_model=ExtensionSummary, status_code=201)
async def install_extension(request: Request, body: InstallRequest) -> ExtensionSummary:
    actor = _admin(request)
    try:
        return _summary(await get_extension_host().install(body, actor=actor))
    except ExtensionError as exc:
        _fail(exc)


@router.post("/{extension_id}/activate", response_model=ExtensionSummary)
async def activate_extension(request: Request, extension_id: str) -> ExtensionSummary:
    actor = _admin(request)
    try:
        return _summary(await get_extension_host().activate(extension_id, actor=actor))
    except ExtensionError as exc:
        _fail(exc)


@router.post("/{extension_id}/deactivate", response_model=ExtensionSummary)
async def deactivate_extension(request: Request, extension_id: str) -> ExtensionSummary:
    actor = _admin(request)
    try:
        return _summary(
            await get_extension_host().deactivate(extension_id, actor=actor)
        )
    except ExtensionError as exc:
        _fail(exc)


@router.post("/{extension_id}/rollback", response_model=ExtensionSummary)
async def rollback_extension(request: Request, extension_id: str) -> ExtensionSummary:
    actor = _admin(request)
    try:
        return _summary(await get_extension_host().rollback(extension_id, actor=actor))
    except ExtensionError as exc:
        _fail(exc)


@router.post("/{extension_id}/revoke", response_model=ExtensionSummary)
async def revoke_extension(
    request: Request, extension_id: str, body: RevokeBody
) -> ExtensionSummary:
    actor = _admin(request)
    try:
        return _summary(
            await get_extension_host().revoke(
                extension_id, actor=actor, reason=body.reason
            )
        )
    except ExtensionError as exc:
        _fail(exc)


@router.put("/{extension_id}/grants", response_model=ExtensionSummary)
async def set_extension_grants(
    request: Request, extension_id: str, body: GrantsUpdate
) -> ExtensionSummary:
    actor = _admin(request)
    try:
        return _summary(
            await get_extension_host().set_grants(extension_id, body, actor=actor)
        )
    except ExtensionError as exc:
        _fail(exc)


@router.delete("/{extension_id}")
async def remove_extension(request: Request, extension_id: str) -> dict[str, str]:
    actor = _admin(request)
    try:
        await get_extension_host().remove(extension_id, actor=actor)
    except ExtensionError as exc:
        _fail(exc)
    return {"status": "removed", "extension_id": extension_id}
