"use client";

/* oxlint-disable react(memo-dependencies) */

/**
 * ChangesView — aba "Mudanças" do painel Git.
 *
 * Lista de arquivos alterados + painel de commit. As ações de stage, unstage,
 * discard e ignore ficam no menu de clique direito de cada arquivo.
 * O estado (resumo, arquivos abertos, hunks) vive no workbench-store (slice
 * `diff`), cacheado por workspace, revalidado por `useWorkbenchSWR`.
 */

import {
  ChevronDown,
  ChevronRight,
  GitCommit,
  Loader2,
  Settings2,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { useWorkbenchSWR } from "@/lib/hooks/workbench/use-swr";
import {
  WORKBENCH_STALE_MS,
  useWorkbenchStore,
  type DiffFile,
  type DiffSummary,
} from "@/lib/stores/workbench-store";
import {
  apiGitCommit,
  apiGitFileAction,
  apiGitignoreAppend,
  fetchGitCommitSuggestion,
  fetchDiffFile,
} from "./api";
import { HunkView, statusTone } from "./shared";
import { CoAuthorPicker } from "./coauthor-picker";
import { CommitBodyField } from "./commit-body-field";
import { useContextMenu, type ContextMenuItem } from "./git-context-menu";
import { m } from "@/lib/paraglide/messages";
import { useToastStore } from "@/lib/stores/toast-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useConfirm } from "@/components/ui/use-confirm";

function FileRow({
  workspaceId,
  file,
  onContextMenu,
  selected,
}: {
  workspaceId: string;
  file: DiffFile;
  onContextMenu: (e: React.MouseEvent, file: DiffFile) => void;
  selected: boolean;
}) {
  const open = useWorkbenchStore((s) =>
    s.getGit(workspaceId).openFiles.includes(file.path),
  );
  const hunks = useWorkbenchStore(
    (s) => s.getGit(workspaceId).hunksByFile[file.path],
  );
  const fetchedAt = useWorkbenchStore(
    (s) => s.getGit(workspaceId).fileFetchedAt[file.path] ?? 0,
  );
  const setGitOpenFile = useWorkbenchStore((s) => s.setGitOpenFile);
  const toggleSelection = useWorkbenchStore((s) => s.toggleGitFileSelection);
  const setGitHunks = useWorkbenchStore((s) => s.setGitHunks);

  const revalidate = useCallback(async () => {
    const h = await fetchDiffFile(workspaceId, file.path);
    if (h) setGitHunks(workspaceId, file.path, h);
  }, [workspaceId, file.path, setGitHunks]);

  useWorkbenchSWR({
    key: `diff:${workspaceId}:${file.path}`,
    hasCache: Array.isArray(hunks),
    isStale: () => Date.now() - fetchedAt > WORKBENCH_STALE_MS,
    revalidate,
    skip: !open,
  });

  return (
    <>
      <div
        className="border-b border-border/40 last:border-0 hover:bg-muted/30"
        onContextMenu={(e) => onContextMenu(e, file)}
      >
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => toggleSelection(workspaceId, file.path)}
            aria-label={file.path}
            className="ml-3 accent-primary"
          />
          <button
            onClick={() => setGitOpenFile(workspaceId, file.path, !open)}
            className="grid min-w-0 flex-1 grid-cols-[auto_auto_minmax(0,1fr)_2rem_2rem] items-center gap-0 py-2 pl-2 pr-0 text-left text-xs"
          >
            {open ? (
              <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
            )}
            <span
              className={`w-3.5 text-center text-[10px] font-medium shrink-0 ${statusTone(file.status)}`}
            >
              {file.status}
            </span>
            <span className="flex-1 truncate font-mono">{file.path}</span>
            <span className="w-8 text-right text-git-addition">
              +{file.additions}
            </span>
            <span className="w-8 text-right text-destructive">
              −{file.deletions}
            </span>
          </button>
        </div>
        {open && (
          <div className="px-3 pb-2 space-y-1">
            {!hunks && (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            )}
            {hunks?.map((h, i) => (
              <HunkView key={i} hunk={h} path={file.path} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function DiffGroup({
  workspaceId,
  files,
  onContextMenu,
  selectedFiles,
}: {
  workspaceId: string;
  files: DiffFile[];
  onContextMenu: (e: React.MouseEvent, file: DiffFile) => void;
  selectedFiles: string[];
}) {
  if (files.length === 0) return null;
  return (
    <div className="border-b border-border/40 last:border-0">
      {files.map((f) => (
        <FileRow
          key={f.path}
          workspaceId={workspaceId}
          file={f}
          onContextMenu={onContextMenu}
          selected={selectedFiles.includes(f.path)}
        />
      ))}
    </div>
  );
}

export function ChangesView({
  workspaceId,
  summary,
  onOpenSettings,
}: {
  workspaceId: string;
  summary: DiffSummary;
  onOpenSettings?: () => void;
}) {
  const { confirm, dialog } = useConfirm();
  const invalidateGit = useWorkbenchStore((s) => s.invalidateGit);
  const setGitFileSelection = useWorkbenchStore((s) => s.setGitFileSelection);
  const gitOps = useWorkbenchStore(
    (s) =>
      s.getGitOps?.(workspaceId) ?? {
        selectedFiles: [],
        selectionRevision: 0,
        selectedHunks: {},
        activeDocument: null,
        operation: null,
      },
  );
  const showError = useCallback((message: string) => {
    useToastStore.getState().error("Git", { description: message });
  }, []);
  const gitHooksEnabled = useSettingsStore((s) => s.gitHooksEnabled);
  const gitSignoffEnabled = useSettingsStore((s) => s.gitSignoffEnabled);
  const gitBypassEnabled = useSettingsStore((s) => s.gitBypassEnabled);
  const menu = useContextMenu();
  const [commitMsg, setCommitMsg] = useState("");
  const [commitBody, setCommitBody] = useState("");
  const [committing, setCommitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const suggestionRequest = useRef(0);

  const handleRefresh = useCallback(() => {
    invalidateGit(workspaceId);
  }, [workspaceId, invalidateGit]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, file: DiffFile) => {
      const items: ContextMenuItem[] = [];
      if (file.unstaged_change || file.untracked) {
        items.push({
          label: m.workbench_git_ctx_stage(),
          onSelect: () =>
            void apiGitFileAction(workspaceId, "stage", file.path).then(
              handleRefresh,
            ),
        });
      }
      if (file.staged_change) {
        items.push({
          label: m.workbench_git_ctx_unstage(),
          onSelect: () =>
            void apiGitFileAction(workspaceId, "unstage", file.path).then(
              handleRefresh,
            ),
        });
      }
      if (file.unstaged_change && !file.untracked) {
        items.push({
          label: m.workbench_git_ctx_discard(),
          danger: true,
          onSelect: () =>
            void apiGitFileAction(workspaceId, "discard", file.path).then(
              handleRefresh,
            ),
        });
      }
      items.push({
        label: m.workbench_git_ctx_ignore_file(),
        onSelect: () =>
          void apiGitignoreAppend(workspaceId, file.path).then((result) => {
            if (result.status === "error") {
              showError(result.message);
              return;
            }
            handleRefresh();
          }),
      });
      const normalizedPath = file.path.replaceAll("\\", "/");
      const parentPath = normalizedPath.split("/").slice(0, -1).join("/");
      if (file.status !== "D" && parentPath) {
        items.push({
          label: m.workbench_git_ctx_ignore_folder(),
          onSelect: () =>
            void apiGitignoreAppend(workspaceId, parentPath, true).then(
              (result) => {
                if (result.status === "error") {
                  showError(result.message);
                  return;
                }
                handleRefresh();
              },
            ),
        });
      }
      menu.open(e, items);
    },
    [workspaceId, handleRefresh, menu, showError],
  );

  const handleCommit = async () => {
    if (!commitMsg.trim()) return;
    if (
      gitBypassEnabled &&
      !(await confirm({
        message: m.workbench_git_force_push_warning(),
        variant: "destructive",
      }))
    )
      return;
    setCommitting(true);
    try {
      const result = await apiGitCommit(workspaceId, commitMsg.trim(), false, {
        body: commitBody.trim(),
        ...(gitHooksEnabled && !gitBypassEnabled ? { runHooks: true } : {}),
        ...(gitSignoffEnabled ? { signoff: true } : {}),
        ...(gitBypassEnabled ? { bypass: true } : {}),
      });
      if (result.status === "ok") {
        setCommitMsg("");
        setCommitBody("");
        handleRefresh();
      } else {
        showError(result.message || m.workbench_git_commit_failed());
      }
    } finally {
      setCommitting(false);
    }
  };

  const handleBatchAction = async (action: "stage" | "unstage") => {
    const initiatingRevision = gitOps.selectionRevision;
    const selected = summary.files.filter((file) =>
      gitOps.selectedFiles.includes(file.path),
    );
    const eligible = selected.filter((file) =>
      action === "stage"
        ? Boolean(file.unstaged_change || file.untracked)
        : Boolean(file.staged_change),
    );
    if (eligible.length === 0) return;
    let results: Array<{
      file: DiffFile;
      result: { status: string; message: string };
    }>;
    try {
      results = await Promise.all(
        eligible.map(async (file) => ({
          file,
          result: await apiGitFileAction(workspaceId, action, file.path),
        })),
      );
    } catch {
      showError(m.workbench_git_operation_failed());
      return;
    }
    const failed = results.filter(({ result }) => result.status === "error");
    if (
      useWorkbenchStore.getState().getGitOps(workspaceId).selectionRevision ===
      initiatingRevision
    ) {
      const successful = new Set(
        results
          .filter(({ result }) => result.status !== "error")
          .map(({ file }) => file.path),
      );
      const current = useWorkbenchStore
        .getState()
        .getGitOps(workspaceId).selectedFiles;
      setGitFileSelection(
        workspaceId,
        current.filter((path) => !successful.has(path)),
      );
    }
    if (failed.length > 0) {
      showError(
        failed
          .map(({ file, result }) => `${file.path}: ${result.message}`)
          .join("\n"),
      );
    }
    handleRefresh();
  };

  const generateSuggestion = async () => {
    if (commitMsg.trim() || commitBody.trim()) {
      showError(m.workbench_git_commit_draft_exists());
      return;
    }
    const requestId = ++suggestionRequest.current;
    const requestedWorkspaceId = workspaceId;
    setGenerating(true);
    try {
      const suggestion = await fetchGitCommitSuggestion(
        requestedWorkspaceId,
        gitOps.selectedFiles,
      );
      if (
        suggestion?.title &&
        requestedWorkspaceId === workspaceId &&
        requestId === suggestionRequest.current
      ) {
        setCommitMsg((current) => current.trim() || suggestion.title);
        setCommitBody((current) => current.trim() || suggestion.description);
      }
    } finally {
      setGenerating(false);
    }
  };

  const staged: DiffFile[] = [];
  const unstaged: DiffFile[] = [];
  const untracked: DiffFile[] = [];
  for (const file of summary.files) {
    if (file.staged_change) staged.push(file);
    if (file.unstaged_change) unstaged.push(file);
    if (file.untracked) untracked.push(file);
  }
  const allFilesSelected =
    summary.files.length > 0 &&
    summary.files.every((file) => gitOps.selectedFiles.includes(file.path));

  return (
    <div className="h-full flex flex-col">
      {menu.element}
      <div className="flex min-h-10 items-center gap-2 border-b border-border/60 px-3 py-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={allFilesSelected}
            ref={(element) => {
              if (element) {
                element.indeterminate =
                  !allFilesSelected && gitOps.selectedFiles.length > 0;
              }
            }}
            onChange={() =>
              setGitFileSelection(
                workspaceId,
                allFilesSelected ? [] : summary.files.map((file) => file.path),
              )
            }
            aria-label={m.workbench_git_select_all()}
            className="accent-primary"
          />
          <span className="truncate">
            {m.workbench_git_changed_files({ n: summary.files.length })}
          </span>
        </label>
        {gitOps.selectedFiles.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className="rounded px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => void handleBatchAction("stage")}
            >
              {m.workbench_git_stage_selected({
                n: summary.files.filter(
                  (file) =>
                    gitOps.selectedFiles.includes(file.path) &&
                    Boolean(file.unstaged_change || file.untracked),
                ).length,
              })}
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => void handleBatchAction("unstage")}
            >
              {m.workbench_git_unstage_selected({
                n: summary.files.filter(
                  (file) =>
                    gitOps.selectedFiles.includes(file.path) &&
                    Boolean(file.staged_change),
                ).length,
              })}
            </button>
          </div>
        )}
        <span className="w-8 shrink-0 text-right text-xs font-mono text-git-addition">
          +{summary.total_additions}
        </span>
        <span className="w-8 shrink-0 text-right text-xs font-mono text-destructive">
          −{summary.total_deletions}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {summary.files.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2 p-4 text-center">
            <p className="text-xs text-muted-foreground">
              {m.workbench_diff_clean()}
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              {m.workbench_diff_clean_hint()}
            </p>
          </div>
        ) : (
          <>
            <DiffGroup
              workspaceId={workspaceId}
              files={staged}
              onContextMenu={handleContextMenu}
              selectedFiles={gitOps.selectedFiles}
            />
            <DiffGroup
              workspaceId={workspaceId}
              files={unstaged}
              onContextMenu={handleContextMenu}
              selectedFiles={gitOps.selectedFiles}
            />
            {untracked.length > 0 && (
              <DiffGroup
                workspaceId={workspaceId}
                files={untracked}
                onContextMenu={handleContextMenu}
                selectedFiles={gitOps.selectedFiles}
              />
            )}
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2 border-t border-border/60 bg-muted/10 p-3">
        <input
          type="text"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder={m.workbench_diff_commit_placeholder()}
          className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-xs font-mono placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              void handleCommit();
            }
          }}
          data-testid="git-commit-message"
        />
        <CommitBodyField
          value={commitBody}
          onChange={setCommitBody}
          placeholder={m.workbench_diff_commit_body_placeholder()}
          onSubmit={() => void handleCommit()}
          testId="git-commit-body"
          actions={
            <>
              <CoAuthorPicker
                workspaceId={workspaceId}
                body={commitBody}
                onBodyChange={setCommitBody}
              />
              <button
                type="button"
                title={m.workbench_git_generate()}
                aria-label={m.workbench_git_generate()}
                onClick={() => void generateSuggestion()}
                disabled={generating}
                className="rounded p-1 hover:bg-muted/50 disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <span
                    aria-hidden="true"
                    className="inline-block h-3.5 w-3.5 bg-muted-foreground [mask-image:url('/icon.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain]"
                  />
                )}
              </button>
              <button
                type="button"
                title={m.workbench_git_settings()}
                aria-label={m.workbench_git_settings()}
                onClick={() => onOpenSettings?.()}
                className="rounded p-1 hover:bg-muted/50"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            </>
          }
        />
        <button
          onClick={() => void handleCommit()}
          disabled={!commitMsg.trim() || staged.length === 0 || committing}
          className="flex items-center justify-center gap-1.5 rounded-md py-2 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          data-testid="git-commit-btn"
        >
          {committing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <GitCommit className="w-3 h-3" />
          )}
          {m.workbench_diff_commit_button()}
        </button>
      </div>
      {dialog}
    </div>
  );
}
