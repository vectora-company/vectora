import type { RenderHint, ToolCategory, ToolCall } from "@/lib/types/tools";

/** Únicos valores que o backend pode mandar em `render_hint`/`category` de
 * `tool_call` — um valor fora daqui vira fallback explícito (nunca cast
 * silencioso de string livre pro union type). */
const KNOWN_RENDER_HINTS = new Set<RenderHint>([
  "diff",
  "code_block",
  "terminal_output",
  "search_results",
  "table",
  "queue_progress",
  "queue_badge",
  "artifact",
  "image_preview",
  "browser_screenshot",
  "thinking_step",
  "json_tree",
  "chart_inline",
  "db_result",
  "json",
]);
const KNOWN_TOOL_CATEGORIES = new Set<ToolCategory>([
  "filesystem",
  "web",
  "rag",
  "memory",
  "workspace",
  "mcp",
  "artifacts",
  "general",
]);

export interface WireToolCall {
  id: string;
  name: string;
  argsJson: string;
  renderHint?: string;
  category?: string;
  destructive?: boolean;
  icon?: string;
}

/** Monta o `ToolCall` da interface a partir do que o backend manda, seja pelo
 * evento `tool_call` do stream ou pelas partes do histórico recarregado. */
export function buildToolCall(wire: WireToolCall): ToolCall {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(wire.argsJson);
  } catch {
    args = { _raw: wire.argsJson };
  }

  return {
    id: wire.id,
    name: wire.name,
    args,
    output: undefined,
    renderHint: KNOWN_RENDER_HINTS.has(wire.renderHint as RenderHint)
      ? (wire.renderHint as RenderHint)
      : "json",
    category: KNOWN_TOOL_CATEGORIES.has(wire.category as ToolCategory)
      ? (wire.category as ToolCategory)
      : "general",
    destructive: wire.destructive ?? false,
    icon: wire.icon ?? "tool",
  };
}

/** Interpreta a saída de uma tool: JSON quando for JSON, o texto cru quando não. */
export function parseToolOutput(contentJson: string): unknown {
  try {
    return JSON.parse(contentJson);
  } catch {
    return contentJson;
  }
}
