"use client";

/**
 * PR e issue abertos como document (como o detalhe de um commit), no layout do
 * GitDesktop: cabeçalho com título, estado, autor e branches, linha de
 * metadados, abas Conversa/Commits/Arquivos (PR) e o corpo em markdown com os
 * comentários. Só leitura; o conteúdo vem do `gh` pelo backend ao abrir.
 */

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, GitPullRequest, CircleDot } from "lucide-react";

import { MarkdownView } from "@/components/workbench/markdown-view";
import { m } from "@/lib/paraglide/messages";
import { cn } from "@/lib/utils";
import {
  WorkbenchEmpty,
  WorkbenchError,
  WorkbenchLoading,
} from "../primitives";

export interface GithubComment {
  author: string;
  body: string;
  created_at: string;
  url: string;
}

export interface PullDetailData {
  number: number;
  title: string;
  state: string;
  is_draft: boolean;
  author: string;
  head_ref: string;
  base_ref: string;
  created_at: string;
  url: string;
  body: string;
  labels: string[];
  assignees: string[];
  reviewers: string[];
  milestone: string;
  additions: number;
  deletions: number;
  changed_files: number;
  mergeable: string;
  checks: { passed: number; failed: number; pending: number };
  comments: GithubComment[];
  commits: { sha: string; message: string; author: string; date: string }[];
  files: { path: string; additions: number; deletions: number }[];
}

export interface IssueDetailData {
  number: number;
  title: string;
  state: string;
  author: string;
  created_at: string;
  url: string;
  body: string;
  labels: string[];
  assignees: string[];
  milestone: string;
  comments: GithubComment[];
}

type Loaded<T> =
  | { status: "loading" }
  | { status: "unavailable" | "error"; message: string }
  | { status: "ok"; data: T };

/** Carrega um PR (`pulls`) ou uma issue (`issues`) pelo número. */
export function useGithubDetail<T>(
  kind: "pulls" | "issues",
  number: number,
  workspaceId: string,
): Loaded<T> {
  const [loaded, setLoaded] = useState<Loaded<T>>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    // Troca de PR ou issue volta ao carregamento.
    // oxlint-disable-next-line react/set-state-in-effect
    setLoaded({ status: "loading" });
    void (async () => {
      try {
        const res = await fetch(
          `/github/${kind}/${number}?workspace_id=${encodeURIComponent(workspaceId)}`,
          { credentials: "include", signal: controller.signal },
        );
        if (!res.ok) {
          setLoaded({ status: "error", message: `HTTP ${res.status}` });
          return;
        }
        const payload = (await res.json()) as {
          status: "ok" | "unavailable" | "error";
          message?: string;
          pull?: T;
          issue?: T;
        };
        const data = kind === "pulls" ? payload.pull : payload.issue;
        if (payload.status !== "ok" || !data) {
          setLoaded({
            status: payload.status === "ok" ? "error" : payload.status,
            message: payload.message ?? "",
          });
          return;
        }
        setLoaded({ status: "ok", data });
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
        setLoaded({ status: "error", message: String(error) });
      }
    })();
    return () => controller.abort();
  }, [kind, number, workspaceId]);

  return loaded;
}

function formatDate(raw: string): string {
  const date = new Date(raw);
  return Number.isNaN(date.getTime())
    ? raw.slice(0, 10)
    : date.toLocaleDateString();
}

const STATE_STYLE: Record<string, string> = {
  OPEN: "bg-emerald-600/20 text-emerald-400",
  CLOSED: "bg-red-600/20 text-red-400",
  MERGED: "bg-purple-600/20 text-purple-400",
  DRAFT: "bg-muted text-muted-foreground",
};

function stateLabel(state: string): string {
  if (state === "MERGED") return m.workbench_github_detail_state_merged();
  if (state === "CLOSED") return m.workbench_github_detail_state_closed();
  if (state === "DRAFT") return m.workbench_github_draft();
  return m.workbench_github_detail_state_open();
}

export function StateBadge({
  state,
  draft,
}: {
  state: string;
  draft?: boolean;
}) {
  const key = draft ? "DRAFT" : state.toUpperCase();
  return (
    <span
      data-testid="github-state"
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        STATE_STYLE[key] ?? STATE_STYLE.OPEN,
      )}
    >
      {stateLabel(key)}
    </span>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Chips({ items }: { items: string[] }) {
  if (items.length === 0)
    return (
      <span className="text-muted-foreground">
        {m.workbench_github_detail_none()}
      </span>
    );
  return (
    <>
      {items.map((item) => (
        <span key={item} className="rounded bg-muted px-1.5 py-0.5">
          {item}
        </span>
      ))}
    </>
  );
}

function CommentCard({
  author,
  date,
  body,
  testId,
}: {
  author: string;
  date: string;
  body: string;
  testId?: string;
}) {
  return (
    <article
      data-testid={testId}
      className="overflow-hidden rounded-md border border-border/60"
    >
      <header className="border-b border-border/60 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
        {m.workbench_github_detail_commented({
          author,
          date: formatDate(date),
        })}
      </header>
      {body.trim() ? (
        <MarkdownView content={body} />
      ) : (
        <p className="px-3 py-2 text-xs italic text-muted-foreground">
          {m.workbench_github_detail_no_description()}
        </p>
      )}
    </article>
  );
}

function Conversation({
  author,
  created,
  body,
  comments,
}: {
  author: string;
  created: string;
  body: string;
  comments: GithubComment[];
}) {
  return (
    <div className="space-y-3 p-4">
      <CommentCard
        testId="github-body"
        author={author}
        date={created}
        body={body}
      />
      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {m.workbench_github_detail_no_comments()}
        </p>
      ) : (
        comments.map((comment, index) => (
          <CommentCard
            key={`${comment.created_at}-${index}`}
            testId="github-comment"
            author={comment.author}
            date={comment.created_at}
            body={comment.body}
          />
        ))
      )}
    </div>
  );
}

function Header({
  icon,
  title,
  number,
  url,
  children,
}: {
  icon: ReactNode;
  title: string;
  number: number;
  url: string;
  children: ReactNode;
}) {
  return (
    <header className="shrink-0 space-y-2 border-b border-border/60 bg-[#202020] px-4 py-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <h2 className="min-w-0 flex-1 break-words text-sm font-semibold leading-5">
          {title}{" "}
          <span className="font-normal text-muted-foreground">#{number}</span>
        </h2>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={m.workbench_github_detail_open_on_github()}
          aria-label={m.workbench_github_detail_open_on_github()}
          className="rounded p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      {children}
    </header>
  );
}

function Status({
  loaded,
  children,
}: {
  loaded: Loaded<unknown>;
  children: ReactNode;
}) {
  if (loaded.status === "loading") return <WorkbenchLoading />;
  if (loaded.status === "unavailable")
    return (
      <WorkbenchEmpty testId="github-detail-unavailable">
        {m.workbench_github_unavailable()}
      </WorkbenchEmpty>
    );
  if (loaded.status === "error")
    return (
      <WorkbenchError testId="github-detail-error">
        {m.workbench_github_error()} {loaded.message}
      </WorkbenchError>
    );
  return <>{children}</>;
}

type PullTab = "conversation" | "commits" | "files";

function PullTabs({
  pull,
  tab,
  onTab,
}: {
  pull: PullDetailData;
  tab: PullTab;
  onTab: (tab: PullTab) => void;
}) {
  const tabs: { id: PullTab; label: string; count: number }[] = [
    {
      id: "conversation",
      label: m.workbench_github_detail_tab_conversation(),
      count: pull.comments.length,
    },
    {
      id: "commits",
      label: m.workbench_github_detail_tab_commits(),
      count: pull.commits.length,
    },
    {
      id: "files",
      label: m.workbench_github_detail_tab_files(),
      count: pull.changed_files || pull.files.length,
    },
  ];
  return (
    <div
      role="tablist"
      className="flex shrink-0 gap-1 border-b border-border/60 px-3"
    >
      {tabs.map(({ id, label, count }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          data-testid={`github-tab-${id}`}
          onClick={() => onTab(id)}
          className={cn(
            "px-2.5 py-1.5 text-xs font-medium",
            tab === id
              ? "-mb-px border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label} <span className="text-muted-foreground">({count})</span>
        </button>
      ))}
    </div>
  );
}

export function GithubPullDetail({
  workspaceId,
  number,
}: {
  workspaceId: string;
  number: number;
}) {
  const loaded = useGithubDetail<PullDetailData>("pulls", number, workspaceId);
  const [tab, setTab] = useState<PullTab>("conversation");

  return (
    <div
      data-testid="github-pull-detail"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#1f1f1f]"
    >
      <Status loaded={loaded}>
        {loaded.status === "ok" && (
          <>
            <Header
              icon={<GitPullRequest className="h-4 w-4" />}
              title={loaded.data.title}
              number={loaded.data.number}
              url={loaded.data.url}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <StateBadge
                  state={loaded.data.state}
                  draft={loaded.data.is_draft}
                />
                <span>{loaded.data.author}</span>
                <span className="font-mono">
                  {loaded.data.head_ref} → {loaded.data.base_ref}
                </span>
                <span className="text-emerald-400">
                  +{loaded.data.additions}
                </span>
                <span className="text-red-400">−{loaded.data.deletions}</span>
              </div>
              <div className="space-y-1">
                <MetaRow label={m.workbench_github_detail_labels()}>
                  <Chips items={loaded.data.labels} />
                </MetaRow>
                <MetaRow label={m.workbench_github_detail_assignees()}>
                  <Chips items={loaded.data.assignees} />
                </MetaRow>
                <MetaRow label={m.workbench_github_detail_reviewers()}>
                  <Chips items={loaded.data.reviewers} />
                </MetaRow>
                {loaded.data.milestone && (
                  <MetaRow label={m.workbench_github_detail_milestone()}>
                    <Chips items={[loaded.data.milestone]} />
                  </MetaRow>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {loaded.data.checks.passed +
                  loaded.data.checks.pending +
                  loaded.data.checks.failed >
                  0 && (
                  <span
                    data-testid="github-detail-checks"
                    className={
                      loaded.data.checks.failed > 0
                        ? "text-destructive"
                        : loaded.data.checks.pending > 0
                          ? "text-amber-500"
                          : "text-emerald-400"
                    }
                  >
                    {m.workbench_github_detail_checks({
                      passed: loaded.data.checks.passed,
                      pending: loaded.data.checks.pending,
                      failed: loaded.data.checks.failed,
                    })}
                  </span>
                )}
                {loaded.data.mergeable &&
                  loaded.data.mergeable !== "UNKNOWN" && (
                    <span
                      data-testid="github-detail-mergeable"
                      className={
                        loaded.data.mergeable === "CONFLICTING"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {loaded.data.mergeable === "CONFLICTING"
                        ? m.workbench_github_detail_mergeable_conflict({
                            base: loaded.data.base_ref,
                          })
                        : m.workbench_github_detail_mergeable_ok({
                            base: loaded.data.base_ref,
                          })}
                    </span>
                  )}
              </div>
            </Header>
            <PullTabs pull={loaded.data} tab={tab} onTab={setTab} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "conversation" && (
                <Conversation
                  author={loaded.data.author}
                  created={loaded.data.created_at}
                  body={loaded.data.body}
                  comments={loaded.data.comments}
                />
              )}
              {tab === "commits" &&
                (loaded.data.commits.length === 0 ? (
                  <WorkbenchEmpty>
                    {m.workbench_github_detail_no_commits()}
                  </WorkbenchEmpty>
                ) : (
                  <ul>
                    {loaded.data.commits.map((commit) => (
                      <li
                        key={commit.sha}
                        data-testid="github-commit"
                        className="flex items-baseline gap-2 border-b border-border/40 px-4 py-2 text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {commit.message}
                        </span>
                        <span className="text-muted-foreground">
                          {commit.author}
                        </span>
                        <span className="font-mono text-muted-foreground">
                          {commit.sha.slice(0, 7)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ))}
              {tab === "files" &&
                (loaded.data.files.length === 0 ? (
                  <WorkbenchEmpty>
                    {m.workbench_github_detail_no_files()}
                  </WorkbenchEmpty>
                ) : (
                  <ul>
                    {loaded.data.files.map((file) => (
                      <li
                        key={file.path}
                        data-testid="github-file"
                        className="flex items-baseline gap-2 border-b border-border/40 px-4 py-2 font-mono text-xs"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {file.path}
                        </span>
                        <span className="text-emerald-400">
                          +{file.additions}
                        </span>
                        <span className="text-red-400">−{file.deletions}</span>
                      </li>
                    ))}
                  </ul>
                ))}
            </div>
          </>
        )}
      </Status>
    </div>
  );
}

export function GithubIssueDetail({
  workspaceId,
  number,
}: {
  workspaceId: string;
  number: number;
}) {
  const loaded = useGithubDetail<IssueDetailData>(
    "issues",
    number,
    workspaceId,
  );

  return (
    <div
      data-testid="github-issue-detail"
      className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#1f1f1f]"
    >
      <Status loaded={loaded}>
        {loaded.status === "ok" && (
          <>
            <Header
              icon={<CircleDot className="h-4 w-4" />}
              title={loaded.data.title}
              number={loaded.data.number}
              url={loaded.data.url}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <StateBadge state={loaded.data.state} />
                <span>
                  {m.workbench_github_detail_opened_by({
                    author: loaded.data.author,
                    date: formatDate(loaded.data.created_at),
                  })}
                </span>
              </div>
            </Header>
            {/* Container query: com largura, a barra de metadados vai para a direita. */}
            <div className="@container min-h-0 flex-1 overflow-y-auto">
              <div className="flex flex-col @2xl:flex-row">
                <div className="min-w-0 flex-1">
                  <Conversation
                    author={loaded.data.author}
                    created={loaded.data.created_at}
                    body={loaded.data.body}
                    comments={loaded.data.comments}
                  />
                </div>
                <aside
                  data-testid="github-issue-sidebar"
                  className="shrink-0 space-y-2 border-t border-border/60 p-4 @2xl:w-56 @2xl:border-t-0 @2xl:border-l"
                >
                  <MetaRow label={m.workbench_github_detail_assignees()}>
                    <Chips items={loaded.data.assignees} />
                  </MetaRow>
                  <MetaRow label={m.workbench_github_detail_labels()}>
                    <Chips items={loaded.data.labels} />
                  </MetaRow>
                  <MetaRow label={m.workbench_github_detail_milestone()}>
                    <Chips
                      items={
                        loaded.data.milestone ? [loaded.data.milestone] : []
                      }
                    />
                  </MetaRow>
                </aside>
              </div>
            </div>
          </>
        )}
      </Status>
    </div>
  );
}
