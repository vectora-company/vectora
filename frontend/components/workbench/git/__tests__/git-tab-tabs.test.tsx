// @vitest-environment jsdom
/**
 * GitTab — as abas: Mudanças com contagem, Histórico, PRs, Issues e Comparação
 * como abas diretas (sem a aba "GitHub" que escondia PRs e Issues).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useWorkbenchStore } from "@/lib/stores/workbench-store";

const api = vi.hoisted(() => ({
  fetchGitRepos: vi.fn(),
  selectGitRepo: vi.fn(),
  fetchDiff: vi.fn(),
  fetchGitStatus: vi.fn(),
  fetchGitOperation: vi.fn(),
  fetchBranches: vi.fn(),
  fetchPullRequests: vi.fn(),
  apiCreatePR: vi.fn(),
}));
vi.mock("../api", () => api);

const mounts = vi.hoisted(() => ({ changes: 0, history: 0 }));
vi.mock("../changes-view", async () => {
  const { useEffect } = await import("react");
  return {
    ChangesView: () => {
      useEffect(() => {
        mounts.changes += 1;
      }, []);
      return <div data-testid="changes" />;
    },
  };
});
vi.mock("../github-view", () => ({
  GithubView: ({ kind }: { kind: string }) => (
    <div data-testid={`github-${kind}`} />
  ),
}));
vi.mock("../actions-view", () => ({
  ActionsView: ({ currentBranch }: { currentBranch: string | null }) => (
    <div data-testid="actions" data-branch={currentBranch ?? ""} />
  ),
}));
vi.mock("../history-view", () => ({
  HistoryView: () => <div data-testid="history" />,
}));
vi.mock("../compare-view", () => ({ CompareView: () => null }));
vi.mock("../git-toolbar", () => ({
  GitToolbar: () => <div data-testid="toolbar" />,
}));
vi.mock("../stash-modal", () => ({ StashModal: () => null }));
vi.mock("../worktrees-modal", () => ({ WorktreesModal: () => null }));
vi.mock("../../tabs/git-skeleton", () => ({ GitSkeleton: () => null }));
vi.mock("@/components/workbench/settings/workbench-settings-surface", () => ({
  WorkbenchSettingsSurface: () => null,
}));
vi.mock("@/lib/stores/workspaces-store", () => ({
  useWorkspacesStore: (selector: (state: unknown) => unknown) =>
    selector({ getActive: () => ({ id: "ws1" }) }),
}));
vi.mock("@/lib/stores/ci-store", () => ({
  useCIStore: (selector: (state: { lastRun: null }) => unknown) =>
    selector({ lastRun: null }),
}));
vi.mock("@/lib/stores/toast-store", () => ({
  useToastStore: { getState: () => ({ error: vi.fn() }) },
}));
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange: (value: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      aria-label="seletor"
      value={value ?? ""}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="" disabled />
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));
vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_target, key) => () => String(key) }),
}));

import { GitTab } from "../git-tab";

const file = (path: string) => ({
  path,
  status: "M",
  additions: 1,
  deletions: 0,
});

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  api.fetchGitStatus.mockResolvedValue(null);
  api.fetchBranches.mockResolvedValue(null);
  api.fetchGitOperation.mockResolvedValue(null);
  api.fetchGitRepos.mockResolvedValue({ repos: [], selected: "" });
  api.fetchPullRequests.mockResolvedValue({ available: false, prs: [] });
  useWorkbenchStore.setState({ git: {} } as never);
});
afterEach(cleanup);

describe("GitTab — abas", () => {
  it("tem Mudanças, Histórico, PRs, Issues, Actions e Comparação, sem a aba GitHub", async () => {
    api.fetchDiff.mockResolvedValue({ is_git_repo: true, files: [] });
    render(<GitTab threadId="t1" />);

    await screen.findByTestId("toolbar");
    for (const id of [
      "changes",
      "history",
      "prs",
      "issues",
      "actions",
      "compare",
    ])
      expect(screen.getByTestId(`tab-${id}`)).toBeTruthy();
    expect(screen.queryByText("workbench_github_tab")).toBeNull();
  });

  it("Actions fica logo depois de Issues e antes de Comparação", async () => {
    api.fetchDiff.mockResolvedValue({ is_git_repo: true, files: [] });
    render(<GitTab threadId="t1" />);
    await screen.findByTestId("toolbar");

    const order = screen
      .getAllByRole("tab", { hidden: true })
      .map((tab) => tab.getAttribute("data-testid"));

    expect(order.indexOf("tab-actions")).toBe(order.indexOf("tab-issues") + 1);
    expect(order.indexOf("tab-compare")).toBe(order.indexOf("tab-actions") + 1);
  });

  it("a aba Actions abre a lista de runs com a branch atual", async () => {
    api.fetchDiff.mockResolvedValue({ is_git_repo: true, files: [] });
    api.fetchGitStatus.mockResolvedValue({
      is_git_repo: true,
      branch: "feat/x",
      clean: true,
      ahead: 0,
      behind: 0,
    });
    render(<GitTab threadId="t1" />);
    await screen.findByTestId("toolbar");

    fireEvent.click(screen.getByTestId("tab-actions"));

    expect(screen.getByTestId("actions")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByTestId("actions").dataset.branch).toBe("feat/x"),
    );
    expect(screen.queryByTestId("changes")).toBeNull();
  });

  it("a aba Mudanças mostra quantos arquivos mudaram", async () => {
    api.fetchDiff.mockResolvedValue({
      is_git_repo: true,
      files: [file("a.ts"), file("b.ts"), file("c.ts")],
    });
    render(<GitTab threadId="t1" />);

    expect((await screen.findByTestId("tab-badge-changes")).textContent).toBe(
      "3",
    );
  });

  it("sem arquivos alterados a aba não mostra contagem", async () => {
    api.fetchDiff.mockResolvedValue({ is_git_repo: true, files: [] });
    render(<GitTab threadId="t1" />);

    await screen.findByTestId("toolbar");
    expect(screen.queryByTestId("tab-badge-changes")).toBeNull();
  });

  it("PRs e Issues abrem a lista certa", async () => {
    api.fetchDiff.mockResolvedValue({ is_git_repo: true, files: [] });
    render(<GitTab threadId="t1" />);
    await screen.findByTestId("toolbar");

    fireEvent.click(screen.getByTestId("tab-prs"));
    expect(screen.getByTestId("github-pulls")).toBeTruthy();

    fireEvent.click(screen.getByTestId("tab-issues"));
    expect(screen.getByTestId("github-issues")).toBeTruthy();
    expect(screen.queryByTestId("github-pulls")).toBeNull();
  });

  it("Comparação abre e voltar retorna às mudanças", async () => {
    api.fetchDiff.mockResolvedValue({ is_git_repo: true, files: [] });
    render(<GitTab threadId="t1" />);
    await screen.findByTestId("toolbar");

    fireEvent.click(screen.getByTestId("tab-compare"));
    expect(
      screen.getByTestId("tab-compare").getAttribute("aria-selected"),
    ).toBe("true");
    expect(screen.queryByTestId("changes")).toBeNull();
  });
});
