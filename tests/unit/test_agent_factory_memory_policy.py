"""Política de memória do prompt: dado do chat não pede tool."""

from __future__ import annotations

from backend.services.agent_factory import _ORCHESTRATOR_PROMPT


def test_prompt_does_not_tell_model_to_look_up_chat_data() -> None:
    assert "never call a memory tool to recall it" in _ORCHESTRATOR_PROMPT
    assert "before answering about the user" not in _ORCHESTRATOR_PROMPT


def test_prompt_limits_save_memory_to_durable_facts() -> None:
    assert "durable facts" in _ORCHESTRATOR_PROMPT
    assert (
        "immediately"
        not in _ORCHESTRATOR_PROMPT.split("## Persistent memory")[1].split("##")[0]
    )
