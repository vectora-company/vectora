"""Orçamento de histórico por modelo (backend/services/context_budget.py)."""

from __future__ import annotations

import pytest

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


def test_calibracao_encolhe_o_orcamento_quando_o_provedor_conta_mais() -> None:
    from backend.services.context_budget import calibrated_budget, calibration_ratio

    ratio = calibration_ratio(real_prompt_tokens=13_000, estimated_prompt_tokens=10_000)
    assert ratio == pytest.approx(1.3)
    assert calibrated_budget(26_000, ratio, floor=8000) == 20_000
    assert calibrated_budget(8_000, ratio, floor=8000) == 8000


def test_calibracao_ignora_dados_invalidos_e_limita_extremos() -> None:
    from backend.services.context_budget import calibration_ratio

    assert calibration_ratio(0, 100) == 1.0
    assert calibration_ratio(100, 0) == 1.0
    assert calibration_ratio(10_000, 100) == 3.0
    assert calibration_ratio(1, 100) == 1.0
