"""Catálogo de Decision Models: cada modelo declara os providers que o servem."""

from backend.llm.systemone.catalog import DECISION_MODEL_CATALOG, decision_catalog


def test_todas_as_familias_pedidas_estao_no_catalogo() -> None:
    families = {entry.family for entry in DECISION_MODEL_CATALOG}
    assert {"jev", "clef", "laya", "gemini", "openai"} <= families


def test_jev_lista_api_oficial_e_openrouter() -> None:
    jev = next(e for e in DECISION_MODEL_CATALOG if e.id == "jev-latest")
    ids = {t.id: t for t in jev.transports}
    assert ids["typesafe-api"].supported
    assert ids["typesafe-api"].model_id == "jev-latest"
    assert not ids["openrouter"].supported


def test_clef_aceita_api_local_e_roteadores() -> None:
    clef = next(e for e in DECISION_MODEL_CATALOG if e.family == "clef")
    ids = {t.id for t in clef.transports}
    assert {
        "cloudflare-workers-ai",
        "llamacpp",
        "9router",
        "omniroute",
        "openrouter",
    } <= ids


def test_modelo_sem_adaptador_nao_e_selecionavel() -> None:
    gemini = next(e for e in DECISION_MODEL_CATALOG if e.family == "gemini")
    assert all(not t.supported for t in gemini.transports)


def test_todo_modelo_tem_ao_menos_um_provider() -> None:
    assert all(entry.transports for entry in decision_catalog().models)
