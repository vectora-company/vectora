"use client";

/**
 * Um run do GitHub Actions aberto como document: cabeçalho no mesmo padrão do
 * PR e da issue, metadados do run e a lista de jobs com os passos. Só leitura:
 * não há re-run, cancelar nem disparar; o log de um job é carregado sob demanda.
 * Enquanto o run está ativo a tela se atualiza sozinha, mantendo o que já exibe.
 */

import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Workflow,
} from "lucide-react";

import { m } from "@/lib/paraglide/messages";
import { formatDurationBetween } from "@/lib/format-duration";
import {
  isFailureConclusion,
  isRunActive,
  runStatusKind,
  type RunStatusKind,
} from "@/lib/github/run-status";
import { cn } from "@/lib/utils";
import { WorkbenchEmpty } from "../primitives";
import {
  Header,
  MetaRow,
  Status,
  formatDate,
  useGithubDetail,
} from "./github-detail";
import { RunStatusIcon, runStatusLabel } from "./run-status-icon";

export interface RunStepData {
  number: number;
  name: string;
  status: string;
  conclusion: string;
  started_at: string;
  completed_at: string;
}

export interface RunJobData {
  id: number;
  name: string;
  status: string;
  conclusion: string;
  started_at: string;
  completed_at: string;
  url: string;
  steps: RunStepData[];
}

export interface RunDetailData {
  id: number;
  number: number;
  title: string;
  workflow: string;
  status: string;
  conclusion: string;
  event: string;
  branch: string;
  sha: string;
  created_at: string;
  updated_at: string;
  started_at: string;
  url: string;
  attempt: number;
  jobs: RunJobData[];
}

/** Releitura do run enquanto ele está em andamento. */
export const RUN_POLL_MS = 8_000;

const BADGE_STYLE: Record<RunStatusKind, string> = {
  queued: "bg-amber-600/20 text-amber-400",
  running: "bg-amber-600/20 text-amber-400",
  success: "bg-emerald-600/20 text-emerald-400",
  failure: "bg-red-600/20 text-red-400",
  cancelled: "bg-muted text-muted-foreground",
  skipped: "bg-muted text-muted-foreground",
  neutral: "bg-muted text-muted-foreground",
};

function pollWhileActive(run: RunDetailData): number | null {
  return isRunActive(run.status) ? RUN_POLL_MS : null;
}

/** Lê o log de um job só quando o usuário pede (só existe depois de o job terminar). */
function JobLog({
  workspaceId,
  runId,
  jobId,
}: {
  workspaceId: string;
  runId: number;
  jobId: number;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ok"; log: string; truncated: boolean }
  >({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(
          `/github/runs/${runId}/jobs/${jobId}/log?workspace_id=${encodeURIComponent(workspaceId)}`,
          { credentials: "include", signal: controller.signal },
        );
        const data = (await res.json()) as {
          status?: string;
          message?: string;
          log?: string;
          truncated?: boolean;
        };
        if (!res.ok || data.status !== "ok") {
          setState({ status: "error", message: data.message ?? "" });
          return;
        }
        setState({
          status: "ok",
          log: data.log ?? "",
          truncated: Boolean(data.truncated),
        });
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        setState({ status: "error", message: String(error) });
      }
    })();
    return () => controller.abort();
  }, [workspaceId, runId, jobId]);

  if (state.status === "loading")
    return (
      <p className="text-[11px] text-muted-foreground">
        {m.workbench_actions_detail_log_loading()}
      </p>
    );
  if (state.status === "error")
    return (
      <p role="alert" className="text-[11px] text-destructive">
        {m.workbench_actions_detail_log_error()} {state.message}
      </p>
    );
  return (
    <div className="space-y-1">
      {state.truncated && (
        <p className="text-[11px] text-muted-foreground">
          {m.workbench_actions_detail_log_truncated()}
        </p>
      )}
      <pre
        data-testid="actions-job-log"
        className="max-h-72 overflow-auto rounded bg-muted/40 p-2 font-mono text-[11px] leading-4 whitespace-pre-wrap"
      >
        {state.log}
      </pre>
    </div>
  );
}

function JobRow({
  job,
  workspaceId,
  runId,
}: {
  job: RunJobData;
  workspaceId: string;
  runId: number;
}) {
  const active = isRunActive(job.status);
  // O que está rodando ou falhou é o que interessa: abre sozinho.
  const [open, setOpen] = useState(
    active || isFailureConclusion(job.conclusion),
  );
  const [showLog, setShowLog] = useState(false);
  const elapsed = formatDurationBetween(job.started_at, job.completed_at);

  return (
    <li
      data-testid={`actions-job-${job.id}`}
      className="border-b border-border/60 last:border-b-0"
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/40"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <RunStatusIcon status={job.status} conclusion={job.conclusion} />
        <span className="min-w-0 flex-1 truncate font-medium">{job.name}</span>
        {elapsed && (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {elapsed}
          </span>
        )}
      </button>

      {open && job.steps.length > 0 && (
        <ul className="pb-1">
          {job.steps.map((step) => {
            const stepElapsed = formatDurationBetween(
              step.started_at,
              step.completed_at,
            );
            return (
              <li key={`${step.number}:${step.name}`}>
                <a
                  href={
                    job.url ? `${job.url}#step:${step.number}:1` : undefined
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  title={m.workbench_actions_detail_open_step()}
                  data-testid={`actions-step-${job.id}-${step.number}`}
                  className={cn(
                    "group flex items-center gap-2 py-1 pr-3 pl-10 text-xs",
                    job.url && "hover:bg-muted/30",
                  )}
                >
                  <RunStatusIcon
                    status={step.status}
                    conclusion={step.conclusion}
                    className="h-3.5 w-3.5"
                  />
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {step.name}
                  </span>
                  {stepElapsed && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {stepElapsed}
                    </span>
                  )}
                  {job.url && (
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {open && job.steps.length === 0 && (
        <p className="py-1 pr-3 pl-10 text-[11px] text-muted-foreground">
          {active
            ? m.workbench_actions_detail_waiting_steps()
            : m.workbench_actions_detail_no_steps()}
        </p>
      )}

      {open && (
        <div className="pr-3 pb-2 pl-10">
          {active ? (
            // O GitHub só serve o log depois de o job terminar.
            <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
              <span>{m.workbench_actions_detail_log_running()}</span>
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline-offset-2 hover:text-foreground hover:underline"
                >
                  {m.workbench_actions_detail_watch_live()}
                </a>
              )}
            </p>
          ) : (
            <>
              <button
                type="button"
                data-testid={`actions-log-toggle-${job.id}`}
                onClick={() => setShowLog((value) => !value)}
                className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              >
                {showLog
                  ? m.workbench_actions_detail_hide_log()
                  : m.workbench_actions_detail_show_log()}
              </button>
              {showLog && (
                <div className="mt-1.5">
                  <JobLog
                    workspaceId={workspaceId}
                    runId={runId}
                    jobId={job.id}
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

export function GithubRunDetail({
  workspaceId,
  runId,
}: {
  workspaceId: string;
  runId: number;
}) {
  const loaded = useGithubDetail<RunDetailData>(
    "runs",
    runId,
    workspaceId,
    pollWhileActive,
  );

  return (
    <div
      data-testid="github-run-detail"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#1f1f1f]"
    >
      <Status loaded={loaded}>
        {loaded.status === "ok" && (
          <RunBody run={loaded.data} workspaceId={workspaceId} />
        )}
      </Status>
    </div>
  );
}

function RunBody({
  run,
  workspaceId,
}: {
  run: RunDetailData;
  workspaceId: string;
}) {
  const kind = runStatusKind(run.status, run.conclusion);
  const duration = isRunActive(run.status)
    ? ""
    : formatDurationBetween(run.started_at || run.created_at, run.updated_at);

  return (
    <>
      <Header
        icon={<Workflow className="h-4 w-4" />}
        title={run.title}
        number={run.number}
        url={run.url}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span
            data-testid="github-run-state"
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              BADGE_STYLE[kind],
            )}
          >
            <RunStatusIcon
              status={run.status}
              conclusion={run.conclusion}
              className="h-3 w-3"
            />
            {runStatusLabel(kind)}
          </span>
          {duration && (
            <span data-testid="github-run-duration">{duration}</span>
          )}
        </div>
        <div className="space-y-1">
          <MetaRow label={m.workbench_actions_detail_workflow()}>
            <span>{run.workflow}</span>
          </MetaRow>
          <MetaRow label={m.workbench_actions_detail_branch()}>
            <span className="font-mono">{run.branch}</span>
          </MetaRow>
          <MetaRow label={m.workbench_actions_detail_event()}>
            <span>{run.event}</span>
          </MetaRow>
          {run.attempt > 1 && (
            <MetaRow label={m.workbench_actions_detail_attempt()}>
              <span>{run.attempt}</span>
            </MetaRow>
          )}
          <MetaRow label={m.workbench_actions_detail_commit()}>
            <span className="font-mono">{run.sha.slice(0, 7)}</span>
          </MetaRow>
          <MetaRow label={m.workbench_actions_detail_started()}>
            <span>{formatDate(run.started_at || run.created_at)}</span>
          </MetaRow>
        </div>
      </Header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <h3 className="mb-2 text-xs font-medium text-muted-foreground">
          {m.workbench_actions_detail_jobs({ n: run.jobs.length })}
        </h3>
        {run.jobs.length === 0 ? (
          <WorkbenchEmpty testId="github-run-no-jobs" compact>
            {m.workbench_actions_detail_no_jobs()}
          </WorkbenchEmpty>
        ) : (
          <ul className="overflow-hidden rounded-md border border-border/60">
            {run.jobs.map((job) => (
              <JobRow
                key={job.id}
                job={job}
                workspaceId={workspaceId}
                runId={run.id}
              />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
