"""Toolsets adiados: tools raras que só entram no schema quando o agente pede.

Mandar as ~195 tools em toda chamada custa dezenas de milhares de tokens. As
integrações externas e as ferramentas especializadas abaixo ficam fora do
schema inicial; o agente as liga com ``enable_toolset`` e elas valem a partir
da chamada seguinte do mesmo turno.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from pydantic import BaseModel, Field

from backend.tools.registry import ToolExtras, ToolRegistry, ToolSpec

if TYPE_CHECKING:
    from collections.abc import Iterable

ENABLE_TOOLSET_TOOL = "enable_toolset"

# toolset -> (descrição curta, módulos cujas tools pertencem a ele)
DEFERRED_TOOLSETS: dict[str, tuple[str, frozenset[str]]] = {
    "browser_devtools": (
        "DevTools do navegador: rede, console, DOM, performance, storage",
        frozenset({"browser_devtools"}),
    ),
    "computer_use": (
        "controle de mouse, teclado e tela do desktop",
        frozenset({"computer_use"}),
    ),
    "crypto": (
        "hash, HMAC, UUID, base64 e utilidades criptográficas",
        frozenset({"crypto_utils"}),
    ),
    "context_graph": ("grafo de contexto do código", frozenset({"context_graph"})),
    "google_workspace": ("Gmail e Google Drive", frozenset({"gmail", "gdrive"})),
    "team_tools": (
        "Slack, Jira, Linear e Notion",
        frozenset({"slack", "jira", "linear", "notion"}),
    ),
    "home_and_media": (
        "Home Assistant e YouTube",
        frozenset({"homeassistant", "youtube"}),
    ),
    "kanban": ("quadro kanban do workspace", frozenset({"kanban"})),
}


def toolset_for(spec: ToolSpec) -> str | None:
    """Toolset adiado a que a tool pertence, ou ``None`` se for sempre ativa."""
    module = getattr(spec.handler, "__module__", "").rsplit(".", 1)[-1]
    for name, (_desc, modules) in DEFERRED_TOOLSETS.items():
        if module in modules:
            return name
    return None


class _EnableToolsetArgs(BaseModel):
    name: str = Field(description="Nome do toolset a ativar.")


def _enable_description(toolsets: dict[str, list[str]]) -> str:
    lines = [
        (
            "Ativa um grupo de tools que não está no schema atual. As tools "
            "ativadas ficam disponíveis a partir da próxima chamada. "
            "Toolsets disponíveis:"
        )
    ]
    for name, tools in sorted(toolsets.items()):
        lines.append(f"- {name}: {DEFERRED_TOOLSETS[name][0]} ({len(tools)} tools)")
    return "\n".join(lines)


def build_registry_with_deferred(
    specs: Iterable[ToolSpec],
    *,
    defer: bool = True,
    always_active: frozenset[str] = frozenset(),
) -> ToolRegistry:
    """Registro com as tools sempre ativas e as raras adiadas.

    ``always_active`` lista tools que nunca são adiadas (as das Workbenches,
    compartilhadas com o usuário). Com ``defer=False`` tudo entra ativo.
    """
    registry = ToolRegistry()
    for spec in specs:
        toolset = (
            toolset_for(spec) if defer and spec.name not in always_active else None
        )
        if toolset is None:
            registry.register(spec)
        else:
            registry.defer(toolset, spec)

    pending = registry.deferred_toolsets()
    if not pending:
        return registry

    async def _enable(name: str) -> str:
        if name not in registry.deferred_toolsets():
            ativos = ", ".join(sorted(registry.deferred_toolsets())) or "nenhum"
            return f"Error: toolset '{name}' não existe ou já está ativo. Disponíveis: {ativos}."
        tools = registry.activate(name)
        return (
            f"Toolset '{name}' ativado: {', '.join(tools)}. "
            "As tools ficam disponíveis a partir da próxima chamada."
        )

    registry.register(
        ToolSpec(
            name=ENABLE_TOOLSET_TOOL,
            description=_enable_description(pending),
            args_model=_EnableToolsetArgs,
            handler=_enable,
            extras=ToolExtras(category="meta", icon="plug"),
            needs_ctx=False,
        )
    )
    return registry
