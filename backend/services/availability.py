"""Opt-out de Services restrito à execução, herdado pelos processos filhos."""

from __future__ import annotations

import os


class ServicesDisabledError(RuntimeError):
    """A operação depende do Services, desabilitado nesta execução."""


def services_enabled() -> bool:
    """Não depende das configurações persistidas nem de clientes de rede."""
    return os.environ.get("VECTORA_NO_SERVICES", "").strip().lower() not in {
        "1",
        "true",
        "yes",
        "on",
    }


def require_services() -> None:
    """Bloqueia a operação remota antes de criar clientes ou alterar estado."""
    if not services_enabled():
        raise ServicesDisabledError(
            "Services desabilitado nesta execução (--no-services)"
        )
