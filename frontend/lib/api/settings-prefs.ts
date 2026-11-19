/**
 * Cliente do backend para as preferências durável do usuário (fonte de
 * verdade — CLAUDE.md §8). O settings-store (Zustand) continua com
 * localStorage como cache rápido de primeira pintura; este módulo sincroniza
 * o subconjunto curado de campos com o backend, que sobrevive a reinstalar o
 * app ou limpar o cache do navegador.
 */

export interface FrontendPrefs {
  selectedModel?: string;
  theme?: string;
  language?: string;
  chatMode?: boolean;
  permissionMode?: string;
  reasoningEffort?: string;
  decisionModelsEnabled?: boolean;
  decisionModelProvider?:
    "clef-local" | "laya-local" | "clef-api" | "jev-api" | "openrouter-api";
  decisionModelSurfaces?: Record<string, boolean>;
  transcriptionMode?: "local" | "remote";
  sidebarPosition?: string;
  autoUpdateEnabled?: boolean;
}

/** Busca as preferências salvas no backend; `{}` em qualquer falha de rede. */
export async function fetchPrefs(
  workspaceId?: string | null,
): Promise<FrontendPrefs> {
  return (await fetchPrefsOrNull(workspaceId)) ?? {};
}

/** Returns null on transport/server failure so callers can preserve their cache. */
export async function fetchPrefsOrNull(
  workspaceId?: string | null,
): Promise<FrontendPrefs | null> {
  try {
    const query = workspaceId
      ? `?workspace_id=${encodeURIComponent(workspaceId)}`
      : "";
    const res = await fetch(`/settings/prefs${query}`);
    if (!res.ok) return null;
    return (await res.json()) as FrontendPrefs;
  } catch {
    return null;
  }
}

/**
 * Envia mudanças pro backend (merge parcial). Fire-and-forget por design —
 * chamada não é aguardada pelos setters do settings-store; falha de rede não
 * pode travar a UI, e o valor já está aplicado no cache local.
 */
export async function pushPrefs(
  changes: FrontendPrefs,
  workspaceId?: string | null,
): Promise<boolean> {
  try {
    const response = await fetch("/settings/prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...changes,
        ...(workspaceId ? { workspace_id: workspaceId } : {}),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
