"""Endereço e modelos oficiais do JEV (TypeSafe) e migração dos valores antigos.

O JEV é servido pela TypeSafe em ``https://api.typesafe.ai`` (``POST
/v1/systemone``; ``GET /v1/models`` lista os modelos da conta). Versões
anteriores do Vectora usavam ``https://api.jev.ai``, que não resolve em DNS,
e os ids ``jev-1`` e ``jev-fast``, que não existem. Configurações já salvas com
esses valores são migradas ao serem lidas, sem apagar nada do que o usuário
escolheu de diferente.
"""

from __future__ import annotations

JEV_API_BASE_URL = "https://api.typesafe.ai"
JEV_DEFAULT_MODEL = "jev-latest"

#: Modelos publicados na documentação da TypeSafe (docs.typesafe.ai/models);
#: ``jev-latest`` é o alias do mais novo.
JEV_MODELS: tuple[str, ...] = ("jev-latest", "jev-1.14.0", "jev-1.13.0")

#: Modelos Clef hospedados no Cloudflare Workers AI.
CLEF_CLOUDFLARE_MODELS: tuple[str, ...] = (
    "@cf/cloudflare/clef",
    "@cf/cloudflare/clef-flash",
    "@cf/cloudflare/clef-omni",
)

_LEGACY_JEV_BASE_URLS = frozenset({"https://api.jev.ai", "http://api.jev.ai"})
_LEGACY_JEV_MODELS = frozenset({"jev-fast", "jev-1"})


def normalize_jev_base_url(value: str) -> str:
    """Troca o endereço antigo (sem DNS) pelo oficial; mantém qualquer outro."""
    stripped = (value or "").strip().rstrip("/")
    if not stripped or stripped in _LEGACY_JEV_BASE_URLS:
        return JEV_API_BASE_URL
    return value


def normalize_jev_model(value: str) -> str:
    """Troca os ids antigos, que não existem, pelo alias ``jev-latest``."""
    stripped = (value or "").strip()
    if not stripped or stripped in _LEGACY_JEV_MODELS:
        return JEV_DEFAULT_MODEL
    return value
