"""Toolsets adiados (backend/tools/toolsets.py)."""

from __future__ import annotations

import pytest
from pydantic import BaseModel

from backend.nodes.tools import ALL_TOOL_NAMES
from backend.tools.registry import TOOL_REGISTRY, ToolExtras, ToolSpec
from backend.tools.toolsets import (
    ENABLE_TOOLSET_TOOL,
    build_registry_with_deferred,
    toolset_for,
)


class _NoArgs(BaseModel):
    pass


def _spec(name: str, module: str) -> ToolSpec:
    async def handler() -> str:
        return "ok"

    handler.__module__ = f"backend.tools.{module}"
    return ToolSpec(
        name=name,
        description="d",
        args_model=_NoArgs,
        handler=handler,
        extras=ToolExtras(),
        needs_ctx=False,
    )


def test_tools_raras_ficam_fora_do_schema_inicial() -> None:
    registry = build_registry_with_deferred(
        [_spec("read_file", "fs"), _spec("slack_post", "slack")]
    )
    nomes = {s.name for s in registry.all()}
    assert "read_file" in nomes
    assert "slack_post" not in nomes
    assert ENABLE_TOOLSET_TOOL in nomes
    assert registry.get("slack_post") is None


@pytest.mark.asyncio
async def test_enable_toolset_ativa_as_tools() -> None:
    registry = build_registry_with_deferred(
        [_spec("read_file", "fs"), _spec("slack_post", "slack")]
    )
    enable = registry.get(ENABLE_TOOLSET_TOOL)
    assert enable is not None

    resultado = await enable.handler(name="team_tools")

    assert "slack_post" in resultado
    assert registry.get("slack_post") is not None
    assert "Error" in await enable.handler(name="team_tools")


def test_sem_adiamento_tudo_fica_ativo() -> None:
    registry = build_registry_with_deferred([_spec("slack_post", "slack")], defer=False)
    assert registry.get("slack_post") is not None
    assert ENABLE_TOOLSET_TOOL not in registry


def test_schema_do_modo_codigo_encolhe() -> None:
    from backend.engine.conversation_loop import _default_context_tokens
    from backend.services.context_budget import estimate_tools_tokens

    specs = [TOOL_REGISTRY.get(n) for n in ALL_TOOL_NAMES]
    specs = [s for s in specs if s is not None]
    cheio = build_registry_with_deferred(specs, defer=False)
    enxuto = build_registry_with_deferred(specs, defer=True)

    assert len(enxuto.all()) < len(cheio.all())
    assert estimate_tools_tokens(
        [s.openai_schema() for s in enxuto.all()]
    ) < estimate_tools_tokens([s.openai_schema() for s in cheio.all()])
    assert all(
        toolset_for(s) is None for s in enxuto.all() if s.name != ENABLE_TOOLSET_TOOL
    )
