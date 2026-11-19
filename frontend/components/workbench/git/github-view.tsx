"use client";

/**
 * Solicitações de revisão e chamados do repositório do workspace, lidos pelo
 * `gh` do usuário (só leitura). Fica ao lado de Mudanças e Histórico na aba Git
 * para acompanhar a revisão sem sair do app.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { GitPullRequest, MessageSquare, RefreshCw } from "lucide-react";

import { m } from "@/lib/paraglide/messages";
import {
  WorkbenchEmpty,
  WorkbenchError,
  WorkbenchLoading,
  WorkbenchToolbar,
} from "../primitives";

export interface GithubPull {
  number: number;
  title: string;
  state: string;
  is_draft: boolean;
  author: string;
  head_ref: string;
  base_ref: string;
  updated_at: string;
  url: string;
  review_decision: string;
  checks: { passed: number; failed: number; pending: number };
}

export interface GithubIssue {
  number: number;
  title: string;
  state: string;
  author: string;
  labels: string[];
  updated_at: string;
  url: string;
  comments: number;
}

type Kind = "pulls" | "issues";
type StateFilter = "open" | "closed" | "all";

type Loaded =
  | { status: "loading" }
  | { status: "unavailable" | "error"; message: string }
  | { status: "ok"; pulls: GithubPull[]; issues: GithubIssue[] };

const STATE_FILTERS: StateFilter[] = ["open", "closed", "all"];

function stateLabel(filter: StateFilter): string {
  if (filter === "open") return m.workbench_github_state_open();
  if (filter === "closed") return m.workbench_github_state_closed();
  return m.workbench_github_state_all();
}

function reviewLabel(decision: string): string | null {
  if (decision === "APPROVED") return m.workbench_github_review_approved();
  if (decision === "CHANGES_REQUESTED")
    return m.workbench_github_review_changes();
  if (decision === "REVIEW_REQUIRED")
    return m.workbench_github_review_required();
  return null;
}

function ChecksChip({ checks }: { checks: GithubPull["checks"] }) {
  if (checks.passed + checks.failed + checks.pending === 0) return null;
  const tone =
    checks.failed > 0
      ? "text-destructive"
      : checks.pending > 0
        ? "text-amber-500"
        : "text-green-500";
  return (
    <span className={tone} data-testid="github-checks">
      {checks.failed > 0
        ? m.workbench_github_checks_failed({ count: checks.failed })
        : checks.pending > 0
          ? m.workbench_github_checks_pending({ count: checks.pending })
          : m.workbench_github_checks_passed({ count: checks.passed })}
    </span>
  );
}

function PullRow({ pull }: { pull: GithubPull }) {
  const review = reviewLabel(pull.review_decision);
  return (
    <li className="border-b border-border/40 px-3 py-2">
      <a
        href={pull.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs font-medium text-foreground hover:underline"
      >
        <span className="text-muted-foreground">#{pull.number}</span>{" "}
        {pull.title}
      </a>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        <span>{pull.author}</span>
        <span className="font-mono">
          {pull.head_ref} → {pull.base_ref}
        </span>
        {pull.is_draft && <span>{m.workbench_github_draft()}</span>}
        {review && <span>{review}</span>}
        <ChecksChip checks={pull.checks} />
      </div>
    </li>
  );
}

function IssueRow({ issue }: { issue: GithubIssue }) {
  return (
    <li className="border-b border-border/40 px-3 py-2">
      <a
        href={issue.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-xs font-medium text-foreground hover:underline"
      >
        <span className="text-muted-foreground">#{issue.number}</span>{" "}
        {issue.title}
      </a>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
        <span>{issue.author}</span>
        {issue.labels.map((label) => (
          <span key={label} className="rounded bg-muted px-1">
            {label}
          </span>
        ))}
        {issue.comments > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <MessageSquare className="h-3 w-3" />
            {issue.comments}
          </span>
        )}
      </div>
    </li>
  );
}

export function GithubView({ workspaceId }: { workspaceId: string }) {
  const [kind, setKind] = useState<Kind>("pulls");
  const [filter, setFilter] = useState<StateFilter>("open");
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (signal: AbortSignal) => {
      const path = kind === "pulls" ? "pulls" : "issues";
      const params = new URLSearchParams({
        state: filter,
        workspace_id: workspaceId,
      });
      try {
        const res = await fetch(`/github/${path}?${params.toString()}`, {
          credentials: "include",
          signal,
        });
        if (!res.ok) {
          setLoaded({ status: "error", message: `HTTP ${res.status}` });
          return;
        }
        const data = (await res.json()) as {
          status: "ok" | "unavailable" | "error";
          message?: string;
          pulls?: GithubPull[];
          issues?: GithubIssue[];
        };
        if (data.status !== "ok") {
          setLoaded({ status: data.status, message: data.message ?? "" });
          return;
        }
        setLoaded({
          status: "ok",
          pulls: data.pulls ?? [],
          issues: data.issues ?? [],
        });
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        setLoaded({ status: "error", message: String(error) });
      }
    },
    [kind, filter, workspaceId],
  );

  const reload = useCallback(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoaded({ status: "loading" });
    void load(controller.signal);
  }, [load]);

  useEffect(() => {
    // Recarrega a cada troca de lista, filtro ou workspace.
    // oxlint-disable-next-line react/set-state-in-effect
    reload();
    return () => controllerRef.current?.abort();
  }, [reload]);

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="github-view">
      <WorkbenchToolbar className="flex-wrap">
        <div role="group" className="flex gap-1">
          {(["pulls", "issues"] as Kind[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
              className={`rounded px-2 py-1 text-xs ${
                kind === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {option === "pulls"
                ? m.workbench_github_pulls()
                : m.workbench_github_issues()}
            </button>
          ))}
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as StateFilter)}
          aria-label={m.workbench_github_state()}
          className="h-6 rounded border border-border bg-background px-1.5 text-xs text-muted-foreground"
        >
          {STATE_FILTERS.map((option) => (
            <option key={option} value={option}>
              {stateLabel(option)}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label={m.workbench_github_refresh()}
          title={m.workbench_github_refresh()}
          onClick={reload}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </WorkbenchToolbar>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loaded.status === "loading" && <WorkbenchLoading />}
        {loaded.status === "unavailable" && (
          <WorkbenchEmpty
            testId="github-unavailable"
            icon={
              <GitPullRequest className="h-6 w-6 text-muted-foreground/40" />
            }
          >
            {m.workbench_github_unavailable()}
          </WorkbenchEmpty>
        )}
        {loaded.status === "error" && (
          <WorkbenchError testId="github-error">
            {m.workbench_github_error()} {loaded.message}
          </WorkbenchError>
        )}
        {loaded.status === "ok" &&
          (kind === "pulls" ? (
            loaded.pulls.length === 0 ? (
              <WorkbenchEmpty testId="github-empty">
                {m.workbench_github_empty_pulls()}
              </WorkbenchEmpty>
            ) : (
              <ul>
                {loaded.pulls.map((pull) => (
                  <PullRow key={pull.number} pull={pull} />
                ))}
              </ul>
            )
          ) : loaded.issues.length === 0 ? (
            <WorkbenchEmpty testId="github-empty">
              {m.workbench_github_empty_issues()}
            </WorkbenchEmpty>
          ) : (
            <ul>
              {loaded.issues.map((issue) => (
                <IssueRow key={issue.number} issue={issue} />
              ))}
            </ul>
          ))}
      </div>
    </div>
  );
}
