"use client";

/**
 * Barra das listas do GitHub (PRs, Issues e Actions): campo de busca por
 * título, os controles de filtro de cada lista (ex.: o seletor de estado) à
 * direita da busca e, no fim, o botão de atualizar. Uma só barra, para as três
 * listas ficarem idênticas.
 */

import type { ReactNode } from "react";
import { RefreshCw, Search } from "lucide-react";

import { m } from "@/lib/paraglide/messages";
import { WorkbenchToolbar } from "../primitives";

/** Estilo único dos seletores de filtro da barra. */
export const LIST_SELECT_CLASS =
  "h-6 rounded border border-border bg-background px-1.5 text-xs text-muted-foreground";

interface GithubListToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  onRefresh: () => void;
  /** Filtros da lista, desenhados à direita do campo de busca. */
  children?: ReactNode;
}

export function GithubListToolbar({
  query,
  onQueryChange,
  onRefresh,
  children,
}: GithubListToolbarProps) {
  return (
    <WorkbenchToolbar className="flex-wrap">
      <label className="relative flex min-w-24 flex-1 items-center">
        <Search className="pointer-events-none absolute left-1.5 h-3 w-3 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={m.workbench_github_filter_placeholder()}
          aria-label={m.workbench_github_filter_placeholder()}
          data-testid="github-filter"
          className="h-6 w-full rounded border border-border bg-background pr-1.5 pl-5 text-xs outline-none focus:border-primary"
        />
      </label>
      {children}
      <button
        type="button"
        aria-label={m.workbench_github_refresh()}
        title={m.workbench_github_refresh()}
        onClick={onRefresh}
        className="ml-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted/50 hover:text-foreground"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </WorkbenchToolbar>
  );
}
