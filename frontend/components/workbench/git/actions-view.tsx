"use client";

/**
 * Aba Actions da workbench Git: os runs do GitHub Actions do repositório, lidos
 * pelo `gh` (só leitura). Filtra por título, estado, workflow e pela branch
 * atual ("Esta branch", ligada por padrão). Clicar num run o abre como document
 * no canvas. A lista se relê sozinha, a cada poucos segundos enquanto há run em
 * andamento, mantendo o que já está na tela (sem piscar).
 */

import { useCallback, useEffect, useState } from "react";
import { Workflow } from "lucide-react";

import { m } from "@/lib/paraglide/messages";
import { formatDurationBetween } from "@/lib/format-duration";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { isRunActive, runStatusKind } from "@/lib/github/run-status";
import { cn } from "@/lib/utils";
import {
  WorkbenchEmpty,
  WorkbenchError,
  WorkbenchLoading,
} from "../primitives";
import { filterByTitle, type GithubItemRef } from "./github-view";
import { GithubListToolbar, LIST_SELECT_CLASS } from "./github-list-toolbar";
import { RunStatusIcon, runStatusLabel } from "./run-status-icon";

export interface RunSummaryData {
  id: number;
  number: number;
  title: string;
  workflow: string;
  status: string;
  conclusion: string;
  event: string;
  branch: string;
  created_at: string;
  updated_at: string;
  started_at: string;
  attempt: number;
}

/** Intervalo de releitura com run em andamento e com tudo parado. */
export const ACTIVE_POLL_MS = 8_000;
export const IDLE_POLL_MS = 30_000;
/** Com que frequência os tempos relativos ("há 5 min") se atualizam. */
const NOW_TICK_MS = 30_000;

type StatusFilter = "all" | "running" | "success" | "failure" | "cancelled";

const STATUS_FILTERS: StatusFilter[] = [
  "all",
  "running",
  "success",
  "failure",
  "cancelled",
];

/** Valor do `--status` do `gh run list` para cada opção. */
const STATUS_PARAM: Record<StatusFilter, string | null> = {
  all: null,
  running: "in_progress",
  success: "success",
  failure: "failure",
  cancelled: "cancelled",
};

function statusFilterLabel(filter: StatusFilter): string {
  switch (filter) {
    case "running":
      return m.workbench_actions_status_running();
    case "success":
      return m.workbench_actions_status_success();
    case "failure":
      return m.workbench_actions_status_failure();
    case "cancelled":
      return m.workbench_actions_status_cancelled();
    default:
      return m.workbench_actions_status_all();
  }
}

type Failure = { kind: "unavailable" | "error"; message: string };

interface WorkflowOption {
  id: number;
  name: string;
}

/** Texto de duração de uma linha: tempo gasto, ou o estado enquanto ativo. */
function runDuration(run: RunSummaryData): string {
  if (isRunActive(run.status))
    return runStatusLabel(runStatusKind(run.status, run.conclusion));
  return formatDurationBetween(
    run.started_at || run.created_at,
    run.updated_at,
  );
}

function RunRow({
  run,
  now,
  onOpen,
}: {
  run: RunSummaryData;
  now: number;
  onOpen?: (item: GithubItemRef) => void;
}) {
  const when = formatRelativeTime(run.updated_at, now);
  const duration = runDuration(run);
  const meta = [
    run.workflow,
    `#${run.number}`,
    run.event,
    run.attempt > 1
      ? m.workbench_actions_attempt({ n: run.attempt })
      : undefined,
  ].filter(Boolean);
  return (
    <li className="border-b border-border/40">
      <button
        type="button"
        data-testid={`actions-run-${run.id}`}
        disabled={!onOpen}
        onClick={() =>
          onOpen?.({ kind: "workflow-run", number: run.id, title: run.title })
        }
        className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted/40 disabled:cursor-default"
      >
        <RunStatusIcon
          status={run.status}
          conclusion={run.conclusion}
          className="mt-0.5"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium text-foreground">
            {run.title}
          </span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {meta.join(" · ")}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
            <span className="font-mono">{run.branch}</span>
            <span>{when ?? m.workbench_actions_time_just_now()}</span>
            {duration && <span data-testid="actions-duration">{duration}</span>}
          </span>
        </span>
      </button>
    </li>
  );
}

export function ActionsView({
  workspaceId,
  currentBranch,
  onOpenItem,
}: {
  workspaceId: string;
  /** Branch atual do repositório; sem ela (HEAD solto) o filtro não aparece. */
  currentBranch: string | null;
  onOpenItem?: (item: GithubItemRef) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [thisBranch, setThisBranch] = useState(true);
  const [workflow, setWorkflow] = useState("");
  const [workflows, setWorkflows] = useState<WorkflowOption[]>([]);
  const [runs, setRuns] = useState<RunSummaryData[] | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  // Relendo (troca de filtro ou atualizar): o conteúdo anterior fica visível.
  const [stale, setStale] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const branch = thisBranch ? currentBranch : null;

  // Tempos relativos acompanham o relógio sem reler a lista.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), NOW_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Workflows para o filtro; falha aqui só deixa o seletor com "Todos".
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          `/github/workflows?workspace_id=${encodeURIComponent(workspaceId)}`,
          { credentials: "include", signal: controller.signal },
        );
        const data = (await res.json()) as {
          status?: string;
          workflows?: WorkflowOption[];
        };
        if (res.ok && data.status === "ok") setWorkflows(data.workflows ?? []);
      } catch {
        // sem workflows: o filtro continua só com "Todos".
      }
    })();
    return () => controller.abort();
  }, [workspaceId]);

  const load = useCallback(
    async (
      signal: AbortSignal,
      silent: boolean,
    ): Promise<RunSummaryData[] | null> => {
      const params = new URLSearchParams({ workspace_id: workspaceId });
      const statusParam = STATUS_PARAM[status];
      if (statusParam) params.set("status", statusParam);
      if (branch) params.set("branch", branch);
      if (workflow) params.set("workflow", workflow);
      if (!silent) setStale(true);
      try {
        const res = await fetch(`/github/runs?${params.toString()}`, {
          credentials: "include",
          signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          status: "ok" | "unavailable" | "error";
          message?: string;
          runs?: RunSummaryData[];
        };
        if (data.status !== "ok") {
          if (!silent) {
            setRuns(null);
            setFailure({ kind: data.status, message: data.message ?? "" });
          }
          return null;
        }
        setRuns(data.runs ?? []);
        setFailure(null);
        return data.runs ?? [];
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return null;
        // Uma releitura automática que falha não apaga o que já está na tela.
        if (!silent) {
          setRuns(null);
          setFailure({ kind: "error", message: String(error) });
        }
        return null;
      } finally {
        if (!signal.aborted) setStale(false);
      }
    },
    [workspaceId, status, branch, workflow],
  );

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cycle = async (silent: boolean) => {
      const loaded = await load(controller.signal, silent);
      if (controller.signal.aborted) return;
      const active = loaded?.some((run) => isRunActive(run.status));
      timer = setTimeout(
        () => void cycle(true),
        active ? ACTIVE_POLL_MS : IDLE_POLL_MS,
      );
    };
    void cycle(false);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // `reloadTick` só reinicia o ciclo (botão atualizar); não é lido aqui.
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [load, reloadTick]);

  const shown = runs
    ? filterByTitle(
        runs.map((run) => ({ ...run })),
        query,
      )
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="actions-view">
      <GithubListToolbar
        query={query}
        onQueryChange={setQuery}
        onRefresh={() => setReloadTick((tick) => tick + 1)}
      >
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
          aria-label={m.workbench_actions_status_label()}
          data-testid="actions-status"
          className={LIST_SELECT_CLASS}
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option} value={option}>
              {statusFilterLabel(option)}
            </option>
          ))}
        </select>
        {currentBranch && (
          <button
            type="button"
            aria-pressed={thisBranch}
            data-testid="actions-this-branch"
            onClick={() => setThisBranch((value) => !value)}
            className={cn(
              "h-6 rounded border px-2 text-xs",
              thisBranch
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {m.workbench_actions_this_branch()}
          </button>
        )}
        {workflows.length > 0 && (
          <select
            value={workflow}
            onChange={(event) => setWorkflow(event.target.value)}
            aria-label={m.workbench_actions_workflow_label()}
            data-testid="actions-workflow"
            className={cn(LIST_SELECT_CLASS, "max-w-36")}
          >
            <option value="">{m.workbench_actions_workflow_all()}</option>
            {workflows.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        )}
      </GithubListToolbar>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto transition-opacity",
          stale && runs && "opacity-60",
        )}
      >
        {runs === null && !failure && <WorkbenchLoading />}
        {failure?.kind === "unavailable" && (
          <WorkbenchEmpty
            testId="actions-unavailable"
            icon={<Workflow className="h-6 w-6 text-muted-foreground/40" />}
          >
            {m.workbench_github_unavailable()}
          </WorkbenchEmpty>
        )}
        {failure?.kind === "error" && (
          <WorkbenchError testId="actions-error">
            {m.workbench_github_error()} {failure.message}
          </WorkbenchError>
        )}
        {runs && runs.length === 0 && (
          <WorkbenchEmpty testId="actions-empty">
            {m.workbench_actions_empty()}
          </WorkbenchEmpty>
        )}
        {runs && runs.length > 0 && shown.length === 0 && (
          <WorkbenchEmpty testId="actions-no-match">
            {m.workbench_github_no_match()}
          </WorkbenchEmpty>
        )}
        {shown.length > 0 && (
          <ul>
            {shown.map((run) => (
              <RunRow key={run.id} run={run} now={now} onOpen={onOpenItem} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
