"""Catálogo de Decision Models e dos providers que servem cada modelo.

Cada modelo declara onde pode rodar (servidor local, API oficial, roteador).
Um transporte só é selecionável quando ``provider`` aponta para um provider que
o runtime SystemOne já sabe chamar (``clef-local``, ``laya-local``,
``clef-api``, ``jev-api`` ou ``openrouter-api``). Os demais ficam listados
com ``provider=None``, para a tela mostrar a opção sem fingir que ela funciona.

O OpenRouter serve a maioria dos modelos de decisão; a lista dele muda com o
tempo, então :func:`live_decision_catalog` completa o catálogo estático com o
que a API de modelos do OpenRouter devolve.
"""

from __future__ import annotations

import logging
import time
from typing import Literal

import httpx
from pydantic import BaseModel

from backend.llm.systemone.endpoints import CLEF_CLOUDFLARE_MODELS, JEV_MODELS

TransportKind = Literal["local", "api", "router"]


class DecisionTransport(BaseModel):
    """Um jeito de executar um Decision Model."""

    id: str
    label: str
    kind: TransportKind
    #: Provider do runtime que executa este transporte; ``None`` = sem adaptador.
    provider: (
        Literal["clef-local", "laya-local", "clef-api", "jev-api", "openrouter-api"]
        | None
    ) = None
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


logger = logging.getLogger(__name__)

OPENROUTER_MODELS_URL = (
    "https://openrouter.ai/api/v1/models?output_modalities=decisions"
)

#: Slug de cada modelo no OpenRouter, para os modelos que também têm API própria.
_OPENROUTER_SLUG = {
    "jev-latest": "~typesafe/jev-latest",
    "jev-1.14.0": "typesafe/jev-1.14",
    "jev-1.13.0": "typesafe/jev-1.13",
    "@cf/cloudflare/clef": "cloudflare/clef",
    "@cf/cloudflare/clef-flash": "cloudflare/clef-flash",
    "@cf/cloudflare/clef-omni": "cloudflare/clef-omni",
}


def _openrouter(slug: str) -> DecisionTransport:
    return DecisionTransport(
        id="openrouter",
        label="OpenRouter",
        kind="router",
        provider="openrouter-api",
        model_id=slug,
    )


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
            _openrouter(_OPENROUTER_SLUG[version]),
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
            _openrouter(_OPENROUTER_SLUG[model_id]),
        ],
    )


_ROUTER_ONLY: tuple[tuple[str, str, str], ...] = (
    ("microsoft", "Microsoft Decision 1", "microsoft/microsoft-decision-1"),
    ("microsoft", "Microsoft Decision 1.1", "microsoft/microsoft-decision-1.1"),
    ("liquid", "Liquid d1", "liquid/d1"),
    ("liquid", "Liquid d1.1", "liquid/d1.1"),
    ("liquid", "Liquid d1.2", "liquid/d1.2"),
    ("liquid", "Liquid d1-ultra", "liquid/d1-ultra"),
    ("liquid", "Liquid d1.2-ultra", "liquid/d1.2-ultra"),
    ("heygen", "HeyGen Decision", "heygen/heygen-decision-1"),
    ("heygen", "HeyGen Decision Turbo", "heygen/heygen-decision-1-turbo"),
    ("perplexity", "Perplexity Decider V1.2", "perplexity/pplx-decider-v1.2"),
    (
        "perplexity",
        "Perplexity Decider Flash V1.2",
        "perplexity/pplx-decider-flash-v1.2",
    ),
    (
        "perplexity",
        "Perplexity Decider V1.3 (free)",
        "perplexity/pplx-decider-v1.3:free",
    ),
    (
        "perplexity",
        "Perplexity Decider Flash V1.3 (free)",
        "perplexity/pplx-decider-flash-v1.3:free",
    ),
    ("nace-ai", "Drex Max", "nace-ai/drex-max"),
    ("nace-ai", "Drex Max Finance", "nace-ai/drex-max-finance"),
    ("nace-ai", "Drex v1.5", "nace-ai/drex-v1.5"),
    ("nace-ai", "Drex v2.0", "nace-ai/drex-v2.0"),
    ("baseten", "Joey 1", "baseten/joey-1"),
    ("baseten", "Elephant 1", "baseten/elephant-1"),
    ("baseten", "Mammoth 1", "baseten/mammoth-1"),
    ("upstage", "Solar Decide", "upstage/solar-decide"),
    ("upstage", "Solar Decide Flash", "upstage/solar-decide-flash"),
    ("respan", "Span-01", "respan/span-01"),
    ("respan", "Span-01 Lite", "respan/span-01-lite"),
    ("respan", "Span-02", "respan/span-02"),
    ("morph", "Morph Reflex", "morph/reflex"),
    ("parallel", "Parallel Decisions Fast", "parallel/decisions-fast"),
    ("cloudflare", "Cloudflare Clairic", "cloudflare/clairic"),
    ("scaledown", "ScaleDown Classify-1", "scaledown/classify-1"),
    ("together", "Together Tev1 4B", "togethercomputer/tev1-4b-experimental"),
    ("jaredpalmer", "Kev 4B", "jaredpalmer/kev-4b"),
)


def _router_only(family: str, label: str, slug: str) -> DecisionModelEntry:
    return DecisionModelEntry(
        id=slug, family=family, label=label, transports=[_openrouter(slug)]
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
        transports=[
            DecisionTransport(id="google-api", label="Google API", kind="api"),
            _openrouter("google/gemini-decision-1"),
        ],
    ),
    DecisionModelEntry(
        id="gpt-6-luna",
        family="openai",
        label="GPT-6 Luna",
        transports=[
            DecisionTransport(id="openai-api", label="OpenAI API", kind="api"),
            _openrouter("openai/gpt-6-luna-decisions"),
        ],
    ),
    *(_router_only(*item) for item in _ROUTER_ONLY),
)


class DecisionCatalogResponse(BaseModel):
    models: list[DecisionModelEntry]


def decision_catalog() -> DecisionCatalogResponse:
    return DecisionCatalogResponse(models=list(DECISION_MODEL_CATALOG))


_live_cache: tuple[float, list[DecisionModelEntry]] | None = None
_LIVE_TTL_S = 600.0


def _known_openrouter_slugs() -> set[str]:
    return {
        transport.model_id
        for entry in DECISION_MODEL_CATALOG
        for transport in entry.transports
        if transport.provider == "openrouter-api" and transport.model_id
    }


async def live_decision_catalog() -> DecisionCatalogResponse:
    """Catálogo estático somado aos modelos de decisão que o OpenRouter lista agora.

    Falha de rede ou resposta inesperada devolve só o catálogo estático. O
    resultado do OpenRouter fica em cache por 10 minutos.
    """
    global _live_cache
    base = decision_catalog()
    now = time.monotonic()
    if _live_cache is not None and now - _live_cache[0] < _LIVE_TTL_S:
        return DecisionCatalogResponse(models=[*base.models, *_live_cache[1]])

    extra: list[DecisionModelEntry] = []
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            res = await client.get(OPENROUTER_MODELS_URL)
        res.raise_for_status()
        known = _known_openrouter_slugs()
        for item in res.json().get("data", []):
            slug = item.get("id")
            if not isinstance(slug, str) or slug.startswith("~") or slug in known:
                continue
            author, _, _rest = slug.partition("/")
            name = str(item.get("name") or slug)
            label = name.split(": ", 1)[-1]
            extra.append(_router_only(author, label, slug))
    except Exception:
        logger.info("decision catalog: lista do OpenRouter indisponível", exc_info=True)
        return base
    _live_cache = (now, extra)
    return DecisionCatalogResponse(models=[*base.models, *extra])
