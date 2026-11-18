"""Catálogo unificado de modelos e capacidades dos providers configurados."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

from backend.settings import settings

logger = logging.getLogger(__name__)
_CATALOG_CACHE_TTL_S = 600.0
_catalog_cache: dict[str, Any] = {"updated": 0.0, "entries": []}
_catalog_lock = asyncio.Lock()

MODEL_CAPABILITIES = (
    "chat",
    "decision",
    "vision",
    "embedding",
    "reranking",
    "moderation",
    "image_generation",
    "video_understanding",
    "video_generation",
    "speech_to_text",
    "text_to_speech",
    "realtime_audio",
    "audio_generation",
)

# Providers sem API de catálogo ou cujos endpoints não declaram a capacidade.
# `catalogued` separa evidência curada de capability retornada pelo provider.
CURATED_MODELS: tuple[dict[str, Any], ...] = (
    {
        "provider": "openai",
        "id": "text-embedding-3-small",
        "capabilities": ["embedding"],
    },
    {
        "provider": "openai",
        "id": "text-embedding-3-large",
        "capabilities": ["embedding"],
    },
    {
        "provider": "openai",
        "id": "gpt-4o-mini-transcribe",
        "capabilities": ["speech_to_text"],
    },
    {
        "provider": "openai",
        "id": "gpt-4o-transcribe",
        "capabilities": ["speech_to_text"],
    },
    {"provider": "openai", "id": "gpt-4o-mini-tts", "capabilities": ["text_to_speech"]},
    {"provider": "openai", "id": "tts-1", "capabilities": ["text_to_speech"]},
    {
        "provider": "google-genai",
        "id": "gemini-embedding-001",
        "capabilities": ["embedding"],
    },
    {
        "provider": "google-genai",
        "id": "gemini-embedding-2",
        "capabilities": ["embedding"],
    },
    {
        "provider": "google-genai",
        "id": "gemini-decision-1",
        "capabilities": ["decision"],
    },
    {
        "provider": "google-genai",
        "id": "gemini-3.1-flash-tts-preview",
        "capabilities": ["text_to_speech"],
    },
    {
        "provider": "google-genai",
        "id": "gemini-3.5-transcribe",
        "capabilities": ["speech_to_text"],
    },
    {"provider": "cohere", "id": "embed-v5.0-pro", "capabilities": ["embedding"]},
    {"provider": "cohere", "id": "embed-v5.0-fast", "capabilities": ["embedding"]},
    {"provider": "cohere", "id": "rerank-v5.0-pro", "capabilities": ["reranking"]},
    {"provider": "cohere", "id": "rerank-v5.0-fast", "capabilities": ["reranking"]},
    {"provider": "voyage", "id": "voyage-4-large", "capabilities": ["embedding"]},
    {"provider": "voyage", "id": "voyage-4", "capabilities": ["embedding"]},
    {"provider": "voyage", "id": "voyage-4-lite", "capabilities": ["embedding"]},
    {"provider": "voyage", "id": "voyage-code-4", "capabilities": ["embedding"]},
    {"provider": "voyage", "id": "rerank-3", "capabilities": ["reranking"]},
    {"provider": "voyage", "id": "rerank-3-lite", "capabilities": ["reranking"]},
    {"provider": "voyage", "id": "rerank-2.5", "capabilities": ["reranking"]},
    {"provider": "voyage", "id": "rerank-2.5-lite", "capabilities": ["reranking"]},
)


def _entry(
    provider: str,
    model_id: str,
    *,
    name: str | None = None,
    capabilities: list[str] | None = None,
    source: str = "provider_api",
    confidence: str = "confirmed",
    available: bool = True,
) -> dict[str, Any]:
    caps = list(dict.fromkeys(capabilities or []))
    return {
        "id": f"{provider}:{model_id}",
        "model": model_id,
        "name": name or model_id,
        "provider": provider,
        "capabilities": caps,
        "capabilities_known": bool(caps),
        "source": source,
        "confidence": confidence if caps else "unknown",
        "available": available,
        "executable_capabilities": [
            cap
            for cap in caps
            if cap
            in {
                "chat",
                "vision",
                "embedding",
                "reranking",
                "image_generation",
                "speech_to_text",
                "text_to_speech",
                "video_understanding",
            }
        ],
    }


def _guess_capabilities(provider: str, model_id: str) -> list[str]:
    """Conservador: nomes explícitos podem sugerir task, sem garantir execução."""
    value = model_id.lower().replace("_", "-")
    caps: list[str] = []
    if any(mark in value for mark in ("embed", "embedding")):
        caps.append("embedding")
    if "rerank" in value or "re-rank" in value:
        caps.append("reranking")
    if any(mark in value for mark in ("transcrib", "whisper", "speech-to-text", "asr")):
        caps.append("speech_to_text")
    if any(mark in value for mark in ("tts", "text-to-speech")):
        caps.append("text_to_speech")
    if "moderation" in value or "moderator" in value:
        caps.append("moderation")
    if "decision" in value or "classifier" in value:
        caps.append("decision")
    if any(mark in value for mark in ("veo", "sora", "video-gen", "video-generation")):
        caps.append("video_generation")
    elif "video" in value:
        caps.append("video_understanding")
    if any(
        mark in value for mark in ("dall-e", "imagen", "image-gen", "image-generation")
    ):
        caps.append("image_generation")
    if not caps and (
        provider == "anthropic"
        or (provider == "openai" and value.startswith(("gpt-", "o1", "o3", "o4")))
        or (provider == "google-genai" and value.startswith("gemini-"))
        or (provider == "cohere" and value.startswith(("command", "c4ai-")))
    ):
        caps.append("chat")
    return caps


def _with_curated(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    by_id = {entry["id"]: entry for entry in entries}
    direct_configured = {
        "openai": bool(settings.openai_api_key),
        "google-genai": bool(settings.google_api_key),
        "cohere": bool(settings.get_cohere_api_key()),
        "voyage": bool(settings.voyage_api_key),
    }
    for item in CURATED_MODELS:
        provider = str(item["provider"])
        key = f"{provider}:{item['id']}"
        if key not in by_id and direct_configured.get(provider):
            entry = _entry(
                provider,
                str(item["id"]),
                capabilities=list(item["capabilities"]),
                source="curated",
            )
            by_id[key] = entry
    return list(by_id.values())


async def _get_json(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: dict[str, str] | None = None,
    params: dict[str, str] | None = None,
) -> dict[str, Any] | None:
    try:
        response = await client.get(url, headers=headers, params=params)
        response.raise_for_status()
        payload = response.json()
        return payload if isinstance(payload, dict) else None
    except Exception:
        logger.info("model catalog: provider endpoint unavailable (%s)", url)
        return None


async def _direct_provider_catalogs(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    tasks: list[Any] = []
    if settings.openai_api_key:
        tasks.append(
            (
                "openai",
                _get_json(
                    client,
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                ),
            )
        )
    if settings.google_api_key:
        tasks.append(
            (
                "google-genai",
                _get_json(
                    client,
                    "https://generativelanguage.googleapis.com/v1beta/models",
                    headers={"x-goog-api-key": settings.google_api_key},
                    params={"pageSize": "1000"},
                ),
            )
        )
    if settings.anthropic_api_key:
        tasks.append(
            (
                "anthropic",
                _get_json(
                    client,
                    "https://api.anthropic.com/v1/models",
                    headers={
                        "x-api-key": settings.anthropic_api_key,
                        "anthropic-version": "2023-06-01",
                    },
                    params={"limit": "1000"},
                ),
            )
        )
    if settings.get_cohere_api_key():
        key = settings.get_cohere_api_key()
        tasks.append(
            (
                "cohere",
                _get_json(
                    client,
                    "https://api.cohere.com/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                    params={"page_size": "1000"},
                ),
            )
        )
    results = await asyncio.gather(*(task for _, task in tasks), return_exceptions=True)
    entries: list[dict[str, Any]] = []
    for (provider, _), result in zip(tasks, results, strict=True):
        if isinstance(result, BaseException) or not isinstance(result, dict):
            continue
        raw_models = result.get("data", result.get("models", result.get("models", [])))
        if provider == "google-genai":
            raw_models = result.get("models", [])
        for model in raw_models if isinstance(raw_models, list) else []:
            if not isinstance(model, dict):
                continue
            model_id = str(
                model.get("id") or model.get("name") or model.get("name", "")
            )
            if model_id.startswith("models/"):
                model_id = model_id.removeprefix("models/")
            if not model_id:
                continue
            endpoint_values = (
                model.get("endpoints") or model.get("supportedGenerationMethods") or []
            )
            endpoint_text = " ".join(str(value).lower() for value in endpoint_values)
            caps = _guess_capabilities(provider, model_id)
            if "embed" in endpoint_text:
                caps = list(dict.fromkeys([*caps, "embedding"]))
            if (
                "chat" in endpoint_text
                or "generatecontent" in endpoint_text
                or "messages" in endpoint_text
            ):
                caps = list(dict.fromkeys([*caps, "chat"]))
            if "rerank" in endpoint_text:
                caps = list(dict.fromkeys([*caps, "reranking"]))
            if provider == "cohere":
                features = model.get("features") or []
                endpoints = model.get("endpoints") or []
                feature_text = " ".join(
                    str(value).lower() for value in [*features, *endpoints]
                )
                for marker, capability in (
                    ("embed", "embedding"),
                    ("rerank", "reranking"),
                    ("chat", "chat"),
                    ("classif", "decision"),
                ):
                    if marker in feature_text and capability not in caps:
                        caps.append(capability)
            modalities = (
                model.get("input_modalities")
                or model.get("supported_input_modalities")
                or []
            )
            if any("image" in str(value).lower() for value in modalities):
                caps = list(dict.fromkeys([*caps, "vision"]))
            if any("video" in str(value).lower() for value in modalities):
                caps = list(dict.fromkeys([*caps, "video_understanding"]))
            if any("audio" in str(value).lower() for value in modalities):
                caps = list(dict.fromkeys([*caps, "realtime_audio"]))
            if provider == "google-genai" and model_id == "gemini-decision-1":
                caps = ["decision"]
            entries.append(
                _entry(
                    provider,
                    model_id,
                    name=str(
                        model.get("display_name") or model.get("name") or model_id
                    ),
                    capabilities=caps,
                    confidence="provider_metadata"
                    if endpoint_values or modalities
                    else "inferred",
                )
            )
    return entries


async def _router_catalogs(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    if settings.openrouter_api_key:
        headers = {"Authorization": f"Bearer {settings.openrouter_api_key}"}
        for catalog_url in (
            "https://openrouter.ai/api/v1/models",
            "https://openrouter.ai/api/v1/embeddings/models",
        ):
            is_embedding_catalog = catalog_url.endswith("/embeddings/models")
            payload = await _get_json(client, catalog_url, headers=headers)
            for model in (payload or {}).get("data", []):
                if not isinstance(model, dict) or not model.get("id"):
                    continue
                architecture = model.get("architecture") or {}
                output_modalities = [
                    str(value).lower()
                    for value in architecture.get("output_modalities", [])
                ]
                model_id = str(model["id"])
                caps = _guess_capabilities("openrouter", model_id)
                if "embeddings" in output_modalities or is_embedding_catalog:
                    caps = list(dict.fromkeys([*caps, "embedding"]))
                if any(
                    mark in str(value).lower()
                    for value in model.get("supported_parameters", [])
                    for mark in ("rerank",)
                ):
                    caps = list(dict.fromkeys([*caps, "reranking"]))
                if "text" in output_modalities and "embedding" not in caps:
                    caps = list(dict.fromkeys([*caps, "chat"]))
                if "audio" in output_modalities:
                    caps = list(dict.fromkeys([*caps, "text_to_speech"]))
                if "image" in output_modalities:
                    caps = list(dict.fromkeys([*caps, "image_generation"]))
                if "video" in output_modalities:
                    caps = list(dict.fromkeys([*caps, "video_generation"]))
                if any(
                    "image" in str(value).lower()
                    for value in architecture.get("input_modalities", [])
                ):
                    caps = list(dict.fromkeys([*caps, "vision"]))
                if any(
                    "video" in str(value).lower()
                    for value in architecture.get("input_modalities", [])
                ):
                    caps = list(dict.fromkeys([*caps, "video_understanding"]))
                if any(
                    "audio" in str(value).lower()
                    for value in architecture.get("input_modalities", [])
                ):
                    caps = list(dict.fromkeys([*caps, "realtime_audio"]))
                entries.append(
                    _entry(
                        "openrouter",
                        model_id,
                        name=str(model.get("name") or model_id),
                        capabilities=caps,
                        confidence="router_metadata"
                        if output_modalities
                        else "inferred",
                    )
                )
    # Providers locais/compatíveis: catálogo dinâmico, sem credenciais no retorno.
    ollama_url = (settings.ollama_base_url or "http://127.0.0.1:11434").rstrip("/")
    ollama_headers = (
        {"Authorization": f"Bearer {settings.ollama_api_key}"}
        if settings.ollama_api_key
        else None
    )
    ollama_payload = await _get_json(
        client, f"{ollama_url}/api/tags", headers=ollama_headers
    )
    for model in (ollama_payload or {}).get("models", []):
        if isinstance(model, dict) and model.get("name"):
            model_id = str(model["name"])
            entries.append(
                _entry(
                    "ollama",
                    model_id,
                    name=model_id,
                    capabilities=_guess_capabilities("ollama", model_id),
                    confidence="inferred",
                )
            )

    llamacpp_url = (settings.llamacpp_base_url or "http://127.0.0.1:18080/v1").rstrip(
        "/"
    )
    llamacpp_headers = (
        {"Authorization": f"Bearer {settings.llamacpp_api_key}"}
        if settings.llamacpp_api_key
        else None
    )
    llamacpp_payload = await _get_json(
        client, f"{llamacpp_url}/models", headers=llamacpp_headers
    )
    for model in (llamacpp_payload or {}).get("data", []):
        if isinstance(model, dict) and model.get("id"):
            model_id = str(model["id"])
            entries.append(
                _entry(
                    "llamacpp",
                    model_id,
                    name=str(model.get("name") or model_id),
                    capabilities=_guess_capabilities("llamacpp", model_id),
                    confidence="inferred",
                )
            )

    if settings.dmr_base_url:
        try:
            from backend.services.docker_model_runner import probe_dmr

            probe = await probe_dmr(settings.dmr_base_url)
            entries.extend(
                _entry(
                    "dmr",
                    model_id,
                    capabilities=_guess_capabilities("dmr", model_id),
                    confidence="inferred",
                )
                for model_id in probe.models
            )
        except Exception:
            logger.info("model catalog: DMR catalog unavailable", exc_info=True)

    if settings.nine_router_base_url and settings.nine_router_api_key:
        payload = await _get_json(
            client,
            f"{settings.nine_router_base_url.rstrip('/')}/models",
            headers={"Authorization": f"Bearer {settings.nine_router_api_key}"},
        )
        for model in (payload or {}).get("data", []):
            if isinstance(model, dict) and model.get("id"):
                model_id = str(model["id"])
                modalities = (model.get("architecture") or {}).get(
                    "input_modalities", []
                )
                caps = _guess_capabilities("nine_router", model_id)
                if any("image" in str(value).lower() for value in modalities):
                    caps = list(dict.fromkeys([*caps, "vision"]))
                entries.append(
                    _entry(
                        "nine_router",
                        model_id,
                        name=str(model.get("name") or model_id),
                        capabilities=caps,
                        confidence="router_metadata" if modalities else "inferred",
                    )
                )
    return entries


async def list_model_catalog() -> list[dict[str, Any]]:
    """Agrega catálogos disponíveis sem deixar falha de um provider bloquear os outros."""
    now = time.monotonic()
    if now - float(_catalog_cache["updated"]) < _CATALOG_CACHE_TTL_S:
        return list(_catalog_cache["entries"])
    async with _catalog_lock:
        now = time.monotonic()
        if now - float(_catalog_cache["updated"]) < _CATALOG_CACHE_TTL_S:
            return list(_catalog_cache["entries"])
        entries: list[dict[str, Any]] = []
        timeout = httpx.Timeout(8.0, connect=3.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            direct, routed = await asyncio.gather(
                _direct_provider_catalogs(client),
                _router_catalogs(client),
                return_exceptions=True,
            )
        if isinstance(direct, list):
            entries.extend(direct)
        if isinstance(routed, list):
            entries.extend(routed)
        entries = _with_curated(entries)
        deduplicated: dict[str, dict[str, Any]] = {}
        for entry in entries:
            previous = deduplicated.get(entry["id"])
            if previous:
                caps = list(
                    dict.fromkeys([*previous["capabilities"], *entry["capabilities"]])
                )
                previous["capabilities"] = caps
                previous["capabilities_known"] = bool(caps)
                previous["executable_capabilities"] = list(
                    dict.fromkeys(
                        [
                            *previous["executable_capabilities"],
                            *entry["executable_capabilities"],
                        ]
                    )
                )
                if (
                    entry["confidence"] == "confirmed"
                    or previous["confidence"] == "unknown"
                ):
                    previous["confidence"] = entry["confidence"]
                if entry["source"] == "provider_api":
                    previous["source"] = entry["source"]
            else:
                deduplicated[entry["id"]] = entry
        entries = list(deduplicated.values())
        _catalog_cache.update(updated=time.monotonic(), entries=entries)
        return list(entries)


def invalidate_model_catalog() -> None:
    """Força nova descoberta no próximo acesso do catálogo."""
    _catalog_cache["updated"] = 0.0
