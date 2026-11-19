"""Política de memória do prompt: dado do chat não pede tool."""

from __future__ import annotations

from backend.services.agent_factory import _ORCHESTRATOR_PROMPT


def test_prompt_nao_manda_consultar_memoria_para_dado_do_chat() -> None:
    assert "never call a memory tool to recall it" in _ORCHESTRATOR_PROMPT
    assert "before answering about the user" not in _ORCHESTRATOR_PROMPT


def test_prompt_restringe_save_memory_a_fatos_duraveis() -> None:
    assert "durable facts" in _ORCHESTRATOR_PROMPT
    assert (
        "immediately"
        not in _ORCHESTRATOR_PROMPT.split("## Persistent memory")[1].split("##")[0]
    )
