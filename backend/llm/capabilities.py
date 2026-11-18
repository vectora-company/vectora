"""Resolve capacidades de entrada de um modelo concreto.

Providers que roteiam para modelos diferentes não podem ser classificados por
nome de provider: a visão pertence ao modelo selecionado e deve acompanhar o
mesmo contrato até o roteamento de mídia e o fallback.
"""

from __future__ import annotations

import os
import time

from backend.settings import CapabilityState

# Modelos Cohere cuja API Chat v2 aceita imagens. O restante da família
# Command continua corretamente como texto-only.
_COHERE_VISION_MODELS = frozenset(
    {"command-a-plus-05-2026", "command-a-vision-07-2025"}
)
_OPENAI_COMPAT_TTL_S = 120.0
_openai_compat_cache: dict[str, tuple[float, CapabilityState]] = {}


async def model_vision_state(model_spec: str) -> CapabilityState:  # noqa: PLR0911
    """Devolve a capacidade de visão do modelo, preservando estado desconhecido."""
    provider, separator, model = model_spec.partition(":")
    if not separator:
        from backend.workspace.runtime_settings import runtime_settings

        provider = os.getenv("LLM_PROVIDER") or runtime_settings.active_provider
        model = model_spec
    provider = provider.replace("-", "_")
    model = model.strip()

    if provider == "openrouter":
        from backend.api.handlers.provider_routing import openrouter_model_image_state

        return await openrouter_model_image_state(model if separator else model_spec)
    if provider == "nine_router":
        from backend.api.handlers.provider_routing import (
            nine_router_model_supports_image,
        )

        return await nine_router_model_supports_image(
            model if separator else model_spec
        )
    if provider == "cohere":
        return (
            CapabilityState.SUPPORTED
            if model.casefold() in _COHERE_VISION_MODELS
            else CapabilityState.UNSUPPORTED
        )
    if provider == "ollama":
        return await _ollama_model_vision_state(model)
    if provider == "dmr" and _dmr_uses_ollama():
        return await _ollama_model_vision_state(model, dmr=True)
    if provider in {"llamacpp", "dmr"}:
        return await _openai_compatible_model_vision_state(provider, model)

    from backend.settings import VISION_CAPABLE_PROVIDERS, provider_capability_state

    normalized_provider = provider.replace("_", "-")
    if normalized_provider in VISION_CAPABLE_PROVIDERS:
        return CapabilityState.SUPPORTED
    return provider_capability_state(normalized_provider, "vision")


def _dmr_uses_ollama() -> bool:
    from backend.settings import settings

    return (settings.dmr_contract or "openai").casefold() == "ollama"


async def _openai_compatible_model_vision_state(
    provider: str, model: str
) -> CapabilityState:
    """Read per-model modalities from local OpenAI-compatible runtimes."""
    if not model:
        return CapabilityState.UNKNOWN
    endpoint = _openai_compatible_endpoint(provider)
    if endpoint is None:
        return CapabilityState.UNKNOWN
    base_url, api_key = endpoint
    cache_key = f"{base_url.rstrip('/')}::{model}"
    now = time.monotonic()
    cached = _openai_compat_cache.get(cache_key)
    if cached and now - cached[0] < _OPENAI_COMPAT_TTL_S:
        return cached[1]

    modalities = await _fetch_openai_compatible_modalities(base_url, api_key, model)
    if modalities is None:
        return CapabilityState.UNKNOWN
    state = (
        CapabilityState.SUPPORTED
        if modalities & {"image", "image_url", "vision"}
        else CapabilityState.UNSUPPORTED
    )
    _openai_compat_cache[cache_key] = (now, state)
    return state


def _openai_compatible_endpoint(provider: str) -> tuple[str, str] | None:
    from backend.settings import settings

    if provider == "dmr":
        from backend.services.docker_model_runner import normalize_base_url

        try:
            root = normalize_base_url(settings.dmr_base_url)
        except ValueError:
            return None
        base_url = root if root.endswith("/engines/v1") else f"{root}/engines/v1"
        return base_url, ""
    if os.getenv("LLAMACPP_MODE", "external") == "managed":
        from backend.services.llamacpp_sidecar import llamacpp_status

        status = llamacpp_status()
        host, port = status.get("host"), status.get("port")
        if not status.get("running") or not isinstance(port, int):
            return None
        host = str(host or "127.0.0.1")
        return f"http://{f'[{host}]' if ':' in host else host}:{port}/v1", ""

    base_url = settings.llamacpp_base_url or "http://127.0.0.1:18080/v1"
    if not base_url.rstrip("/").endswith("/v1"):
        base_url = f"{base_url.rstrip('/')}/v1"
    return base_url, settings.llamacpp_api_key or ""


async def _fetch_openai_compatible_modalities(
    base_url: str, api_key: str, model: str
) -> set[str] | None:
    import httpx

    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                f"{base_url.rstrip('/')}/models", headers=headers
            )
            response.raise_for_status()
            payload = response.json()
    except Exception:
        return None

    models = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(models, list):
        return None
    selected = next(
        (
            item
            for item in models
            if isinstance(item, dict) and str(item.get("id", "")) == model
        ),
        None,
    )
    if selected is None and len(models) == 1 and isinstance(models[0], dict):
        selected = models[0]
    architecture = selected.get("architecture") if selected else None
    modalities = (
        architecture.get("input_modalities") if isinstance(architecture, dict) else None
    )
    if not isinstance(modalities, list):
        return None
    return {str(value).casefold() for value in modalities}


async def _ollama_model_vision_state(
    model: str, *, dmr: bool = False
) -> CapabilityState:
    if not model:
        return CapabilityState.UNKNOWN

    from backend.llm.ollama.capabilities import _do_model_info
    from backend.llm.ollama.client import OllamaClient
    from backend.settings import settings

    if dmr:
        from backend.services.docker_model_runner import normalize_base_url

        base_url = normalize_base_url(settings.dmr_base_url)
        if not base_url:
            return CapabilityState.UNKNOWN
        api_key = ""
    else:
        base_url = settings.ollama_base_url or "http://127.0.0.1:11434"
        api_key = settings.ollama_api_key or ""

    client = OllamaClient(base_url=base_url, api_key=api_key, timeout_s=10)
    try:
        payload = await client.post_json("/api/show", {"model": model})
    except Exception:
        # Sem metadados não se deve bloquear a chamada ativa: o servidor do
        # usuário pode ser compatível com uma versão antiga ou customizada.
        return CapabilityState.UNKNOWN
    finally:
        await client.aclose()

    capabilities = payload.get("capabilities")
    info = payload.get("model_info") or {}
    vision_fallback, _ = _do_model_info(info)
    if isinstance(capabilities, list):
        supports_vision = "vision" in {str(value).casefold() for value in capabilities}
        supports_vision = supports_vision or vision_fallback
    else:
        supports_vision = vision_fallback
    return CapabilityState.SUPPORTED if supports_vision else CapabilityState.UNSUPPORTED
