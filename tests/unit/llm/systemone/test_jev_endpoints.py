"""Endereço e modelos oficiais do JEV (TypeSafe) e migração dos valores antigos."""

from __future__ import annotations

import pytest

from backend.llm.systemone.api_adapters import ClefApiAdapter, JevApiAdapter
from backend.llm.systemone.endpoints import (
    CLEF_CLOUDFLARE_MODELS,
    JEV_API_BASE_URL,
    JEV_DEFAULT_MODEL,
    JEV_MODELS,
    normalize_jev_base_url,
    normalize_jev_model,
)
from backend.llm.systemone.settings import SystemOneSettings


def test_o_padrao_aponta_para_a_api_da_typesafe() -> None:
    assert JEV_API_BASE_URL == "https://api.typesafe.ai"
    assert SystemOneSettings().jev_api_base_url == JEV_API_BASE_URL
    assert SystemOneSettings().jev_api_model == JEV_DEFAULT_MODEL == "jev-latest"


@pytest.mark.parametrize("antigo", ["https://api.jev.ai", "https://api.jev.ai/", ""])
def test_o_endereco_antigo_sem_dns_e_migrado(antigo: str) -> None:
    assert normalize_jev_base_url(antigo) == JEV_API_BASE_URL
    assert (
        SystemOneSettings(jev_api_base_url=antigo).jev_api_base_url == JEV_API_BASE_URL
    )


def test_endereco_personalizado_e_preservado() -> None:
    proxy = "https://proxy.interno.example/typesafe"
    assert normalize_jev_base_url(proxy) == proxy
    assert SystemOneSettings(jev_api_base_url=proxy).jev_api_base_url == proxy


@pytest.mark.parametrize("antigo", ["jev-fast", "jev-1", ""])
def test_ids_antigos_que_nao_existem_viram_o_alias_atual(antigo: str) -> None:
    assert normalize_jev_model(antigo) == "jev-latest"


@pytest.mark.parametrize("id_", ["jev-1.14.0", "jev-1.13.0", "jev-latest"])
def test_ids_oficiais_sao_preservados(id_: str) -> None:
    assert normalize_jev_model(id_) == id_
    assert SystemOneSettings(jev_api_model=id_).jev_api_model == id_


@pytest.mark.asyncio
async def test_os_adaptadores_declaram_os_modelos_oficiais() -> None:
    jev = await JevApiAdapter(api_key="k").capabilities()
    clef = await ClefApiAdapter(api_key="k", account_id="a").capabilities()

    assert tuple(jev.supported_models) == JEV_MODELS
    assert set(JEV_MODELS) == {"jev-latest", "jev-1.14.0", "jev-1.13.0"}
    assert tuple(clef.supported_models) == CLEF_CLOUDFLARE_MODELS
    assert "@cf/cloudflare/clef-omni" in clef.supported_models
