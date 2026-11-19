"""Orçamento de histórico por modelo (backend/services/context_budget.py)."""

from __future__ import annotations

from backend.services.context_budget import (
    HISTORY_BUDGET_CAP,
    estimate_tools_tokens,
    model_context_window,
    resolve_history_budget,
)


def test_override_do_cliente_vence() -> None:
    assert (
        resolve_history_budget(
            model="gemini-2.5-pro", override=3000, default=8000, tools_tokens=0
        )
        == 3000
    )


def test_modelo_desconhecido_usa_o_padrao() -> None:
    assert (
        resolve_history_budget(
            model="modelo-local-xyz", override=None, default=8000, tools_tokens=0
        )
        == 8000
    )
    assert model_context_window("modelo-local-xyz") is None


def test_janela_grande_e_limitada_pelo_teto() -> None:
    budget = resolve_history_budget(
        model="gemini-2.5-pro", override=None, default=8000, tools_tokens=26_000
    )
    assert budget == HISTORY_BUDGET_CAP


def test_modelo_de_200k_usa_metade_menos_schema_das_tools() -> None:
    budget = resolve_history_budget(
        model="claude-sonnet-4-5", override=None, default=8000, tools_tokens=26_000
    )
    assert budget == 200_000 // 2 - 26_000


def test_prefixo_de_roteador_e_ignorado() -> None:
    assert model_context_window("9router/gemini-2.5-pro") == 1_000_000


def test_nunca_abaixo_do_padrao() -> None:
    budget = resolve_history_budget(
        model="claude-sonnet-4-5", override=None, default=8000, tools_tokens=150_000
    )
    assert budget == 8000


def test_estimativa_de_tokens_das_tools() -> None:
    tools = [{"name": "x", "description": "d" * 400}]
    assert estimate_tools_tokens(tools) >= 100
