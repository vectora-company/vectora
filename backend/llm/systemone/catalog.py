"""Catálogo de Decision Models e dos providers que servem cada modelo.

Cada modelo declara onde pode rodar (servidor local, API oficial, roteador).
Um transporte só é selecionável quando ``provider`` aponta para um provider que
o runtime SystemOne já sabe chamar (``clef-local``, ``laya-local``,
``clef-api`` ou ``jev-api``). Os demais ficam listados com ``provider=None``,
para a tela mostrar a opção sem fingir que ela funciona.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

from backend.llm.systemone.endpoints import CLEF_CLOUDFLARE_MODELS, JEV_MODELS

TransportKind = Literal["local", "api", "router"]


class DecisionTransport(BaseModel):
    """Um jeito de executar um Decision Model."""

    id: str
    label: str
    kind: TransportKind
    #: Provider do runtime que executa este transporte; ``None`` = sem adaptador.
    provider: Literal["clef-local", "laya-local", "clef-api", "jev-api"] | None = None
    #: Id do modelo gravado na configuração do provider ao selecionar.
    model_id: str | None = None

    @property
    def supported(self) -> bool:
        return self.provider is not None


class DecisionModelEntry(BaseModel):
    id: str
    family: str
    label: str
    transports: list[DecisionTransport]


def _jev(version: str) -> DecisionModelEntry:
    return DecisionModelEntry(
        id=version,
        family="jev",
        label="JEV (latest)" if version == "jev-latest" else f"JEV {version[4:]}",
        transports=[
            DecisionTransport(
                id="typesafe-api",
                label="TypeSafe API",
                kind="api",
                provider="jev-api",
                model_id=version,
            ),
            DecisionTransport(id="openrouter", label="OpenRouter", kind="router"),
        ],
    )


def _clef(model_id: str) -> DecisionModelEntry:
    name = model_id.rsplit("/", 1)[-1]
    return DecisionModelEntry(
        id=model_id,
        family="clef",
        label="Clef"
        + ("" if name == "clef" else f" {name.removeprefix('clef-').title()}"),
        transports=[
            DecisionTransport(
                id="cloudflare-workers-ai",
                label="Cloudflare Workers AI",
                kind="api",
                provider="clef-api",
                model_id=model_id,
            ),
            DecisionTransport(
                id="llamacpp", label="llama.cpp", kind="local", provider="clef-local"
            ),
            DecisionTransport(id="9router", label="9Router", kind="router"),
            DecisionTransport(id="omniroute", label="OmniRoute", kind="router"),
            DecisionTransport(id="openrouter", label="OpenRouter", kind="router"),
        ],
    )


DECISION_MODEL_CATALOG: tuple[DecisionModelEntry, ...] = (
    *(_jev(version) for version in JEV_MODELS),
    *(_clef(model_id) for model_id in CLEF_CLOUDFLARE_MODELS),
    DecisionModelEntry(
        id="laya",
        family="laya",
        label="Laya",
        transports=[
            DecisionTransport(
                id="laya-server",
                label="Laya server",
                kind="local",
                provider="laya-local",
            ),
            DecisionTransport(id="llamacpp", label="llama.cpp", kind="local"),
        ],
    ),
    DecisionModelEntry(
        id="gemini-decision-1",
        family="gemini",
        label="Gemini Decision 1",
        transports=[DecisionTransport(id="google-api", label="Google API", kind="api")],
    ),
    DecisionModelEntry(
        id="gpt-6-luna",
        family="openai",
        label="GPT-6 Luna",
        transports=[DecisionTransport(id="openai-api", label="OpenAI API", kind="api")],
    ),
)


class DecisionCatalogResponse(BaseModel):
    models: list[DecisionModelEntry]


def decision_catalog() -> DecisionCatalogResponse:
    return DecisionCatalogResponse(models=list(DECISION_MODEL_CATALOG))
