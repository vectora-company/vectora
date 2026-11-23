"""Modelos do registro de extensões e das contribuições de interface."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from enum import StrEnum
from typing import Final, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

#: Versão da API do host que as extensões declaram suportar.
HOST_API_VERSION: Final = 1

_ID_PATTERN: Final = re.compile(r"^[a-z0-9][a-z0-9._-]{1,63}$")
_VERSION_PATTERN: Final = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")
_CONTRIBUTION_ID_PATTERN: Final = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")
_HOST_PATTERN: Final = re.compile(r"^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$")
_ENTRY_PATTERN: Final = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]*\.html$")
_KINDS_WITH_PAGE: Final = frozenset(
    {"mode", "workbench_view", "settings_page", "header_action"}
)

#: Prefixo reservado aos controles do próprio Vectora: extensão nenhuma o usa.
RESERVED_PREFIX: Final = "vectora"

ContributionKind = Literal[
    "mode", "workbench_view", "settings_page", "header_action", "file_icon"
]


def _validate_extension_id(value: str) -> str:
    if not _ID_PATTERN.match(value):
        raise ValueError("id de extensão inválido")
    return value


class ExtensionState(StrEnum):
    """Estado do ciclo de vida de uma extensão no host."""

    INACTIVE = "inactive"
    ACTIVE = "active"
    FAILED = "failed"
    REVOKED = "revoked"


class Contribution(BaseModel):
    """Contribuição de interface declarada por uma extensão.

    A declaração só descreve o que a extensão quer mostrar; o host decide se
    aceita, ordena e ativa. Nenhuma contribuição carrega código para dentro do
    processo da aplicação.
    """

    kind: ContributionKind
    id: str
    label: str = Field(min_length=1, max_length=80)
    icon: str | None = Field(default=None, max_length=64)
    #: Página da extensão que a interface mostra, relativa a ``ui/`` no pacote.
    #: Só vale para ``mode``, ``workbench_view``, ``settings_page`` e
    #: ``header_action``; roda em iframe isolado, sem acesso ao app.
    entry: str | None = Field(default=None, max_length=200)
    #: Para ``file_icon``: extensões de arquivo (sem ponto) que recebem o ícone.
    file_extensions: list[str] = Field(default_factory=list, max_length=32)

    @field_validator("entry")
    @classmethod
    def _valid_entry(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not _ENTRY_PATTERN.match(value) or ".." in value.split("/"):
            raise ValueError("entry de contribuição inválido")
        return value

    @model_validator(mode="after")
    def _entry_matches_kind(self) -> Contribution:
        needs_entry = self.kind in _KINDS_WITH_PAGE
        if needs_entry and self.entry is None:
            raise ValueError(f"contribuição '{self.kind}' exige entry")
        if not needs_entry and self.entry is not None:
            raise ValueError(f"contribuição '{self.kind}' não aceita entry")
        if self.kind == "file_icon" and not self.file_extensions:
            raise ValueError("file_icon exige file_extensions")
        return self

    @field_validator("id")
    @classmethod
    def _valid_id(cls, value: str) -> str:
        if not _CONTRIBUTION_ID_PATTERN.match(value):
            raise ValueError("id de contribuição inválido")
        if value == RESERVED_PREFIX or value.startswith(f"{RESERVED_PREFIX}-"):
            raise ValueError("id de contribuição reservado ao Vectora")
        return value


class Grants(BaseModel):
    """O que o host concedeu à extensão. Declarações da extensão não ampliam isto."""

    #: Tools da extensão que o harness pode chamar. Vazio nega todas.
    tools: list[str] = Field(default_factory=list, max_length=128)
    #: Destinos de rede que o jail da extensão alcança. Vazio nega a rede.
    allow_hosts: list[str] = Field(default_factory=list, max_length=64)
    #: Workspaces em que as tools podem ser chamadas. Vazio nega todos.
    workspaces: list[str] = Field(default_factory=list, max_length=256)

    @field_validator("allow_hosts")
    @classmethod
    def _valid_hosts(cls, hosts: list[str]) -> list[str]:
        for host in hosts:
            if host in {"*", ""} or not _HOST_PATTERN.match(host.lower()):
                raise ValueError(f"destino de rede inválido: {host!r}")
        return [host.lower() for host in hosts]


class ExtensionRelease(BaseModel):
    """Uma versão instalada: o que é preciso para ativá-la e para voltar a ela."""

    version: str
    digest: str = Field(pattern=r"^[0-9a-f]{64}$")
    install_path: str
    command: str = Field(min_length=1, max_length=256)
    args: list[str] = Field(default_factory=list, max_length=64)
    host_api: int = HOST_API_VERSION
    declared_tools: list[str] = Field(default_factory=list, max_length=128)
    contributions: list[Contribution] = Field(default_factory=list, max_length=64)

    @field_validator("version")
    @classmethod
    def _valid_version(cls, value: str) -> str:
        if not _VERSION_PATTERN.match(value):
            raise ValueError("versão deve seguir SemVer")
        return value


class ExtensionRecord(BaseModel):
    """Estado persistido de uma extensão instalada."""

    id: str
    name: str = Field(min_length=1, max_length=120)
    publisher: str = Field(min_length=1, max_length=120)
    current: ExtensionRelease
    previous: ExtensionRelease | None = None
    state: ExtensionState = ExtensionState.INACTIVE
    state_reason: str = ""
    grants: Grants = Field(default_factory=Grants)
    installed_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())

    @field_validator("id")
    @classmethod
    def _valid_id(cls, value: str) -> str:
        return _validate_extension_id(value)


def effective_contribution_id(extension_id: str, contribution: Contribution) -> str:
    """Id estável e sem colisão: ``<extensão>.<tipo>.<id>``."""
    return f"{extension_id}.{contribution.kind}.{contribution.id}"
