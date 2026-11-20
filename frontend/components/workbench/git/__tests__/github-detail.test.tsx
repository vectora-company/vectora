// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
  clearGithubDetailCache,
  GithubIssueDetail,
  GithubPullDetail,
} from "../github-detail";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy(
    {},
    {
      get: (_t, prop) => (args?: Record<string, unknown>) =>
        args ? `${String(prop)}(${JSON.stringify(args)})` : String(prop),
    },
  ),
}));
vi.mock("@/components/workbench/markdown-view", () => ({
  MarkdownView: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

const pull = {
  number: 7,
  title: "feat: algo",
  state: "OPEN",
  is_draft: false,
  author: "ana",
  head_ref: "feat/x",
  base_ref: "master",
  created_at: "2026-11-19T10:00:00Z",
  url: "https://github.com/o/r/pull/7",
  body: "Closes #3",
  labels: ["bug"],
  assignees: ["ana"],
  reviewers: ["bia"],
  milestone: "0.2",
  additions: 56,
  deletions: 32,
  changed_files: 2,
  mergeable: "MERGEABLE",
  checks: { passed: 8, failed: 0, pending: 2 },
  comments: [
    {
      author: "bia",
      body: "Boa!",
      created_at: "2026-11-19T12:00:00Z",
      url: "",
    },
  ],
  commits: [
    { sha: "abc1234def", message: "feat: algo", author: "ana", date: "" },
  ],
  files: [{ path: "a.ts", additions: 30, deletions: 2 }],
};

const issue = {
  number: 3,
  title: "bug no chat",
  state: "CLOSED",
  author: "ana",
  created_at: "2026-11-19T10:00:00Z",
  url: "https://github.com/o/r/issues/3",
  body: "## Objetivo",
  labels: ["bug"],
  assignees: [],
  milestone: "",
  comments: [],
};

const fetchMock = vi.fn();

function respond(payload: unknown, ok = true) {
  fetchMock.mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  clearGithubDetailCache();
  cleanup();
  vi.unstubAllGlobals();
});

describe("GithubPullDetail", () => {
  it("busca o PR pelo número e workspace", async () => {
    respond({ status: "ok", pull });
    render(<GithubPullDetail workspaceId="ws 1" number={7} />);

    await screen.findByTestId("github-pull-detail");
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "/github/pulls/7?workspace_id=ws%201",
    );
  });

  it("mostra título, estado, autor, branches e a contagem de linhas no cabeçalho", async () => {
    respond({ status: "ok", pull });
    render(<GithubPullDetail workspaceId="ws1" number={7} />);

    const detail = await screen.findByTestId("github-pull-detail");
    await screen.findByText(/feat: algo/);
    expect(detail.textContent).toContain("#7");
    expect(screen.getByTestId("github-state").textContent).toBe(
      "workbench_github_detail_state_open",
    );
    expect(detail.textContent).toContain("ana");
    expect(detail.textContent).toContain("feat/x → master");
    expect(detail.textContent).toContain("+56");
    expect(detail.textContent).toContain("−32");
  });

  it("mostra rótulos, responsáveis, revisores e marco", async () => {
    respond({ status: "ok", pull });
    render(<GithubPullDetail workspaceId="ws1" number={7} />);

    const detail = await screen.findByTestId("github-pull-detail");
    await screen.findByText("bug");
    for (const text of ["bug", "ana", "bia", "0.2"])
      expect(detail.textContent).toContain(text);
  });

  it("resume os checks e a mergeabilidade", async () => {
    respond({ status: "ok", pull });
    render(<GithubPullDetail workspaceId="ws1" number={7} />);

    expect(
      (await screen.findByTestId("github-detail-checks")).textContent,
    ).toContain('"passed":8');
    expect(screen.getByTestId("github-detail-mergeable").textContent).toContain(
      "mergeable_ok",
    );
  });

  it("conflitos aparecem como aviso", async () => {
    respond({ status: "ok", pull: { ...pull, mergeable: "CONFLICTING" } });
    render(<GithubPullDetail workspaceId="ws1" number={7} />);

    expect(
      (await screen.findByTestId("github-detail-mergeable")).textContent,
    ).toContain("mergeable_conflict");
  });

  it("a aba Conversa mostra o corpo em markdown e os comentários", async () => {
    respond({ status: "ok", pull });
    render(<GithubPullDetail workspaceId="ws1" number={7} />);

    expect((await screen.findByTestId("github-body")).textContent).toContain(
      "Closes #3",
    );
    expect(screen.getAllByTestId("github-comment")).toHaveLength(1);
  });

  it("as abas mostram as contagens e trocam o conteúdo", async () => {
    respond({ status: "ok", pull });
    render(<GithubPullDetail workspaceId="ws1" number={7} />);
    await screen.findByTestId("github-tab-commits");

    expect(screen.getByTestId("github-tab-conversation").textContent).toContain(
      "(1)",
    );
    expect(screen.getByTestId("github-tab-files").textContent).toContain("(2)");

    fireEvent.click(screen.getByTestId("github-tab-commits"));
    expect(screen.getAllByTestId("github-commit")[0]!.textContent).toContain(
      "abc1234",
    );
    expect(screen.queryByTestId("github-body")).toBeNull();

    fireEvent.click(screen.getByTestId("github-tab-files"));
    expect(screen.getAllByTestId("github-file")[0]!.textContent).toContain(
      "a.ts",
    );
  });

  it("PR rascunho e mesclado têm o estado certo", async () => {
    respond({ status: "ok", pull: { ...pull, is_draft: true } });
    const { unmount } = render(
      <GithubPullDetail workspaceId="ws1" number={7} />,
    );
    expect((await screen.findByTestId("github-state")).textContent).toBe(
      "workbench_github_draft",
    );
    unmount();

    respond({ status: "ok", pull: { ...pull, state: "MERGED" } });
    render(<GithubPullDetail workspaceId="ws1" number={7} />);
    expect((await screen.findByTestId("github-state")).textContent).toBe(
      "workbench_github_detail_state_merged",
    );
  });

  it("gh indisponível não vira PR vazio: mostra o estado de configuração", async () => {
    respond({ status: "unavailable", message: "gh not found" });
    render(<GithubPullDetail workspaceId="ws1" number={7} />);

    expect(await screen.findByTestId("github-detail-unavailable")).toBeTruthy();
  });

  it("erro do servidor mostra o erro", async () => {
    respond({}, false);
    render(<GithubPullDetail workspaceId="ws1" number={7} />);

    expect(await screen.findByTestId("github-detail-error")).toBeTruthy();
  });

  it("tem um link para abrir no GitHub", async () => {
    respond({ status: "ok", pull });
    render(<GithubPullDetail workspaceId="ws1" number={7} />);

    const link = await screen.findByRole("link", {
      name: "workbench_github_detail_open_on_github",
    });
    expect(link.getAttribute("href")).toBe("https://github.com/o/r/pull/7");
  });
});

describe("GithubIssueDetail", () => {
  it("busca a issue e mostra título, estado fechado, corpo e barra de metadados", async () => {
    respond({ status: "ok", issue });
    render(<GithubIssueDetail workspaceId="ws1" number={3} />);

    await screen.findByTestId("github-issue-detail");
    expect(fetchMock.mock.calls[0]![0]).toBe(
      "/github/issues/3?workspace_id=ws1",
    );
    expect((await screen.findByTestId("github-state")).textContent).toBe(
      "workbench_github_detail_state_closed",
    );
    expect(screen.getByTestId("github-body").textContent).toContain(
      "## Objetivo",
    );
    expect(screen.getByTestId("github-issue-sidebar").textContent).toContain(
      "bug",
    );
  });

  it("sem responsáveis e sem marco mostra 'Nenhum' na barra", async () => {
    respond({ status: "ok", issue });
    render(<GithubIssueDetail workspaceId="ws1" number={3} />);

    const sidebar = await screen.findByTestId("github-issue-sidebar");
    expect(sidebar.textContent).toContain("workbench_github_detail_none");
  });

  it("corpo vazio mostra 'sem descrição'", async () => {
    respond({ status: "ok", issue: { ...issue, body: "" } });
    render(<GithubIssueDetail workspaceId="ws1" number={3} />);

    expect((await screen.findByTestId("github-body")).textContent).toContain(
      "workbench_github_detail_no_description",
    );
  });

  it("a barra de metadados vai para a direita só quando há largura (container query)", async () => {
    respond({ status: "ok", issue });
    render(<GithubIssueDetail workspaceId="ws1" number={3} />);

    const sidebar = await screen.findByTestId("github-issue-sidebar");
    expect(sidebar.className).toContain("@2xl:border-l");
    expect(sidebar.parentElement!.className).toContain("@2xl:flex-row");
  });

  it("trocar de issue volta ao carregamento e busca a nova", async () => {
    respond({ status: "ok", issue });
    const { rerender } = render(
      <GithubIssueDetail workspaceId="ws1" number={3} />,
    );
    await screen.findByTestId("github-body");

    rerender(<GithubIssueDetail workspaceId="ws1" number={4} />);

    expect(fetchMock.mock.calls.at(-1)![0]).toBe(
      "/github/issues/4?workspace_id=ws1",
    );
  });
});

describe("cache de detalhes entre remontagens", () => {
  it("reabre o PR já com o conteúdo anterior, sem voltar ao carregamento", async () => {
    respond({ status: "ok", pull });
    const first = render(<GithubPullDetail workspaceId="ws1" number={7} />);
    await screen.findByText(/feat: algo/);
    first.unmount();

    render(<GithubPullDetail workspaceId="ws1" number={7} />);

    // Na primeira pintura o título já está na tela.
    expect(screen.getByText(/feat: algo/)).toBeTruthy();
  });

  it("revalida por baixo: a consulta é refeita mesmo com cache", async () => {
    respond({ status: "ok", pull });
    const first = render(<GithubPullDetail workspaceId="ws1" number={7} />);
    await screen.findByText(/feat: algo/);
    first.unmount();
    fetchMock.mockClear();

    render(<GithubPullDetail workspaceId="ws1" number={7} />);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it("falha na revalidação não troca o conteúdo em cache por erro", async () => {
    respond({ status: "ok", pull });
    const first = render(<GithubPullDetail workspaceId="ws1" number={7} />);
    await screen.findByText(/feat: algo/);
    first.unmount();
    respond({}, false);

    render(<GithubPullDetail workspaceId="ws1" number={7} />);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());

    expect(screen.getByText(/feat: algo/)).toBeTruthy();
  });

  it("o cache é por workspace e por número", async () => {
    respond({ status: "ok", pull });
    const first = render(<GithubPullDetail workspaceId="ws1" number={7} />);
    await screen.findByText(/feat: algo/);
    first.unmount();
    fetchMock.mockReturnValue(new Promise(() => {}));

    render(<GithubPullDetail workspaceId="ws2" number={7} />);

    expect(screen.queryByText(/feat: algo/)).toBeNull();
  });
});
