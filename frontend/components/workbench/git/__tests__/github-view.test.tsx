// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { m } from "@/lib/paraglide/messages";
import { filterByTitle, GithubView } from "../github-view";

const pull = {
  number: 7,
  title: "feat: algo",
  state: "OPEN",
  is_draft: true,
  author: "ana",
  head_ref: "feat/x",
  base_ref: "master",
  updated_at: "2026-11-19T10:00:00Z",
  url: "https://github.com/o/r/pull/7",
  review_decision: "APPROVED",
  checks: { passed: 2, failed: 1, pending: 0 },
};

const issue = {
  number: 3,
  title: "bug no chat",
  state: "OPEN",
  author: "bia",
  labels: ["bug", "frontend"],
  updated_at: "",
  url: "https://github.com/o/r/issues/3",
  comments: 4,
};

function mockGithub(
  responses: Record<string, unknown>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (url: string) => {
    const path = String(url).split("?")[0];
    return {
      ok: true,
      json: async () => responses[path] ?? { status: "ok" },
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});
afterEach(cleanup);

describe("GithubView", () => {
  it("lista os PRs com autor, branches, revisão e checks", async () => {
    mockGithub({ "/github/pulls": { state: "loaded", items: [pull] } });
    render(<GithubView workspaceId="ws1" kind="pulls" />);

    const link = await screen.findByRole("link", { name: /feat: algo/ });
    expect(link.getAttribute("href")).toBe("https://github.com/o/r/pull/7");
    const row = link.closest("li") as HTMLElement;
    expect(row.textContent).toContain("ana");
    expect(row.textContent).toContain("feat/x → master");
    expect(row.textContent).toContain(m.workbench_github_draft());
    expect(row.textContent).toContain(m.workbench_github_review_approved());
    expect(screen.getByTestId("github-checks").textContent).toBe(
      m.workbench_github_checks_failed({ count: 1 }),
    );
  });

  it("a lista de issues mostra rótulos e comentários", async () => {
    mockGithub({ "/github/issues": { state: "loaded", items: [issue] } });
    render(<GithubView workspaceId="ws1" kind="issues" />);

    const link = await screen.findByRole("link", { name: /bug no chat/ });
    const row = link.closest("li") as HTMLElement;
    expect(row.textContent).toContain("frontend");
    expect(row.textContent).toContain("4");
  });

  it("cada lista é uma aba própria: não há botões para alternar entre elas", async () => {
    mockGithub({ "/github/pulls": { state: "empty", items: [] } });
    render(<GithubView workspaceId="ws1" kind="pulls" />);
    await screen.findByTestId("github-empty");

    expect(
      screen.queryByRole("button", { name: m.workbench_github_issues() }),
    ).toBeNull();
  });

  it("filtra pelo título (e pelo número) sem nova chamada ao servidor", async () => {
    const fetchMock = mockGithub({
      "/github/pulls": {
        state: "loaded",
        items: [
          { ...pull, number: 7, title: "feat: algo novo" },
          { ...pull, number: 8, title: "fix: bug no chat" },
        ],
      },
    });
    render(<GithubView workspaceId="ws1" kind="pulls" />);
    await screen.findByRole("link", { name: /feat: algo novo/ });
    const calls = fetchMock.mock.calls.length;

    fireEvent.change(screen.getByTestId("github-filter"), {
      target: { value: "BUG" },
    });
    expect(screen.queryByRole("link", { name: /feat: algo novo/ })).toBeNull();
    expect(screen.getByRole("link", { name: /fix: bug no chat/ })).toBeTruthy();

    fireEvent.change(screen.getByTestId("github-filter"), {
      target: { value: "#7" },
    });
    expect(screen.getByRole("link", { name: /feat: algo novo/ })).toBeTruthy();
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("avisa quando o filtro não encontra nada, diferente de lista vazia", async () => {
    mockGithub({ "/github/pulls": { state: "loaded", items: [pull] } });
    render(<GithubView workspaceId="ws1" kind="pulls" />);
    await screen.findByRole("link", { name: /feat: algo/ });

    fireEvent.change(screen.getByTestId("github-filter"), {
      target: { value: "zzz" },
    });

    expect(screen.getByTestId("github-no-match")).toBeTruthy();
    expect(screen.queryByTestId("github-empty")).toBeNull();
  });

  it("pede ao servidor o estado e o workspace escolhidos", async () => {
    const fetchMock = mockGithub({
      "/github/pulls": { state: "empty", items: [] },
    });
    render(<GithubView workspaceId="ws1" kind="pulls" />);
    await screen.findByTestId("github-empty");

    fireEvent.change(screen.getByLabelText(m.workbench_github_state()), {
      target: { value: "closed" },
    });

    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([url]) =>
          String(url).includes("state=closed&workspace_id=ws1"),
        ),
      ).toBe(true);
    });
  });

  it("explica quando o gh não está disponível", async () => {
    mockGithub({
      "/github/pulls": {
        state: "unknown",
        error: "gh not found in PATH",
        code: "gh_unavailable",
      },
    });
    render(<GithubView workspaceId="ws1" kind="pulls" />);

    expect(
      (await screen.findByTestId("github-unavailable")).textContent,
    ).toContain(m.workbench_github_unavailable());
  });

  it("mostra o erro do servidor", async () => {
    mockGithub({
      "/github/pulls": {
        state: "unknown",
        error: "repositório não encontrado",
      },
    });
    render(<GithubView workspaceId="ws1" kind="pulls" />);

    const error = await screen.findByTestId("github-error");
    expect(error.textContent).toContain("repositório não encontrado");
  });

  it("atualiza a lista ao clicar em atualizar", async () => {
    const fetchMock = mockGithub({
      "/github/pulls": { state: "empty", items: [] },
    });
    render(<GithubView workspaceId="ws1" kind="pulls" />);
    await screen.findByTestId("github-empty");
    const before = fetchMock.mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", { name: m.workbench_github_refresh() }),
    );

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
    });
  });

  it("com onOpenItem, clicar no título abre o item como document (em vez de ir ao GitHub)", async () => {
    const onOpenItem = vi.fn();
    mockGithub({ "/github/pulls": { state: "loaded", items: [pull] } });
    render(
      <GithubView workspaceId="ws1" kind="pulls" onOpenItem={onOpenItem} />,
    );

    fireEvent.click(await screen.findByTestId(`github-open-${pull.number}`));

    expect(onOpenItem).toHaveBeenCalledWith({
      kind: "pull-request",
      number: pull.number,
      title: pull.title,
    });
    expect(screen.queryByRole("link", { name: /feat: algo/ })).toBeNull();
  });

  it("nas issues, o document aberto é do tipo issue", async () => {
    const onOpenItem = vi.fn();
    mockGithub({ "/github/issues": { state: "loaded", items: [issue] } });
    render(
      <GithubView workspaceId="ws1" kind="issues" onOpenItem={onOpenItem} />,
    );

    fireEvent.click(await screen.findByTestId(`github-open-${issue.number}`));

    expect(onOpenItem).toHaveBeenCalledWith({
      kind: "issue",
      number: issue.number,
      title: issue.title,
    });
  });

  it("o seletor de aberto/fechado fica à direita do campo de busca", async () => {
    mockGithub({ "/github/pulls": { state: "empty", items: [] } });
    render(<GithubView workspaceId="ws1" kind="pulls" />);
    await screen.findByTestId("github-empty");

    const search = screen.getByTestId("github-filter");
    const select = screen.getByLabelText(m.workbench_github_state());
    const refresh = screen.getByRole("button", {
      name: m.workbench_github_refresh(),
    });

    expect(
      search.compareDocumentPosition(select) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      select.compareDocumentPosition(refresh) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
