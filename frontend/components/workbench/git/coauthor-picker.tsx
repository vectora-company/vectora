"use client";

/**
 * Seletor de co-autor do commit: lista as pessoas do repositório (quem já
 * commitou e os colaboradores do GitHub), permite buscar por nome, e-mail ou
 * usuário — inclusive quem nunca commitou ali — e adiciona ou remove a linha
 * `Co-authored-by` no corpo da mensagem.
 */

import { useEffect, useRef, useState } from "react";
import { Check, UserPlus } from "lucide-react";

import { m } from "@/lib/paraglide/messages";
import {
  addCoAuthor,
  hasCoAuthor,
  removeCoAuthor,
  type CoAuthor,
} from "@/lib/git/coauthors";

interface Person extends CoAuthor {
  username?: string | null;
  source?: string;
  commits?: number;
}

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ok"; people: Person[] };

const SEARCH_DELAY_MS = 200;

interface CoAuthorPickerProps {
  workspaceId: string;
  body: string;
  onBodyChange: (body: string) => void;
}

export function CoAuthorPicker({
  workspaceId,
  body,
  onBodyChange,
}: CoAuthorPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [state, setState] = useState<State>({ status: "loading" });
  const rootRef = useRef<HTMLDivElement>(null);

  // Busca as pessoas ao abrir e a cada texto digitado (com um pequeno atraso).
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState({ status: "loading" });
      try {
        const res = await fetch(
          `/workspaces/${encodeURIComponent(workspaceId)}/git/contributors?q=${encodeURIComponent(query)}`,
          { credentials: "include", signal: controller.signal },
        );
        if (!res.ok) {
          setState({ status: "error" });
          return;
        }
        const people = (await res.json()) as Person[];
        setState({ status: "ok", people: Array.isArray(people) ? people : [] });
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError")
          setState({ status: "error" });
      }
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query, workspaceId]);

  // Clicar fora fecha o painel.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () =>
      document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open]);

  const toggle = (person: Person) => {
    onBodyChange(
      hasCoAuthor(body, person.email)
        ? removeCoAuthor(body, person.email)
        : addCoAuthor(body, { name: person.name, email: person.email }),
    );
  };

  return (
    <div
      ref={rootRef}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        title={m.workbench_git_coauthor_add()}
        aria-label={m.workbench_git_coauthor_add()}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-testid="git-coauthor-button"
        onClick={() => setOpen((value) => !value)}
        className="rounded p-1 hover:bg-muted/50"
      >
        <UserPlus className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          data-testid="git-coauthor-panel"
          className="absolute bottom-7 left-0 z-20 w-64 rounded-md border border-border bg-popover p-1.5 shadow-lg"
        >
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={m.workbench_git_coauthor_search()}
            aria-label={m.workbench_git_coauthor_search()}
            data-testid="git-coauthor-search"
            className="mb-1 h-6 w-full rounded border border-border bg-background px-1.5 text-xs outline-none focus:border-primary"
          />
          <div
            role="listbox"
            aria-label={m.workbench_git_coauthor_add()}
            className="max-h-48 overflow-y-auto"
          >
            {state.status === "loading" && (
              <span className="block px-2 py-1 text-[10px] text-muted-foreground">
                …
              </span>
            )}
            {state.status === "error" && (
              <span
                role="alert"
                className="block px-2 py-1 text-[10px] text-destructive"
              >
                {m.workbench_git_coauthor_error()}
              </span>
            )}
            {state.status === "ok" && state.people.length === 0 && (
              <span
                data-testid="git-coauthor-empty"
                className="block px-2 py-1 text-[10px] text-muted-foreground"
              >
                {m.workbench_git_coauthor_none()}
              </span>
            )}
            {state.status === "ok" &&
              state.people.map((person) => {
                const selected = hasCoAuthor(body, person.email);
                return (
                  <button
                    key={person.email}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    data-testid={`git-coauthor-${person.email}`}
                    onClick={() => toggle(person)}
                    className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{person.name}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">
                        {person.username ? `@${person.username}` : person.email}
                      </span>
                    </span>
                    {selected && <Check className="h-3 w-3 shrink-0" />}
                  </button>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
