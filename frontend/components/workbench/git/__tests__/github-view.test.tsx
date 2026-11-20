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
import { GithubView } from "../github-view";

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
    mockGithub({ "/github/pulls": { status: "ok", pulls: [pull] } });
    render(<GithubView workspaceId="ws1" />);

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

  it("troca para as issues e mostra rótulos e comentários", async () => {
    mockGithub({
      "/github/pulls": { status: "ok", pulls: [] },
      "/github/issues": { status: "ok", issues: [issue] },
    });
    render(<GithubView workspaceId="ws1" />);

    await screen.findByTestId("github-empty");
    fireEvent.click(
      screen.getByRole("button", { name: m.workbench_github_issues() }),
    );

    const link = await screen.findByRole("link", { name: /bug no chat/ });
    const row = link.closest("li") as HTMLElement;
    expect(row.textContent).toContain("frontend");
    expect(row.textContent).toContain("4");
  });

  it("pede ao servidor o estado e o workspace escolhidos", async () => {
    const fetchMock = mockGithub({
      "/github/pulls": { status: "ok", pulls: [] },
    });
    render(<GithubView workspaceId="ws1" />);
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
        status: "unavailable",
        message: "gh not found in PATH",
      },
    });
    render(<GithubView workspaceId="ws1" />);

    expect(
      (await screen.findByTestId("github-unavailable")).textContent,
    ).toContain(m.workbench_github_unavailable());
  });

  it("mostra o erro do servidor", async () => {
    mockGithub({
      "/github/pulls": {
        status: "error",
        message: "repositório não encontrado",
      },
    });
    render(<GithubView workspaceId="ws1" />);

    const error = await screen.findByTestId("github-error");
    expect(error.textContent).toContain("repositório não encontrado");
  });

  it("atualiza a lista ao clicar em atualizar", async () => {
    const fetchMock = mockGithub({
      "/github/pulls": { status: "ok", pulls: [] },
    });
    render(<GithubView workspaceId="ws1" />);
    await screen.findByTestId("github-empty");
    const before = fetchMock.mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", { name: m.workbench_github_refresh() }),
    );

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
    });
  });
});
