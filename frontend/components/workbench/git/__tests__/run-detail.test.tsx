// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { GithubRunDetail, RUN_POLL_MS } from "../run-detail";

import { clearGithubDetailCache } from "../github-detail";
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
  MarkdownView: ({ content }: { content: string }) => <div>{content}</div>,
}));

const step = (number: number, overrides: Record<string, unknown> = {}) => ({
  number,
  name: `Passo ${number}`,
  status: "completed",
  conclusion: "success",
  started_at: "2026-11-19T10:00:10Z",
  completed_at: "2026-11-19T10:00:13Z",
  ...overrides,
});

const job = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Job ${id}`,
  status: "completed",
  conclusion: "success",
  started_at: "2026-11-19T10:00:10Z",
  completed_at: "2026-11-19T10:00:42Z",
  url: `https://github.com/o/r/actions/runs/1/job/${id}`,
  steps: [step(1), step(2)],
  ...overrides,
});

const runData = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  number: 590,
  title: "feat: algo",
  workflow: "PR Gate",
  status: "completed",
  conclusion: "failure",
  event: "pull_request",
  branch: "feat/x",
  sha: "abc1234def5678",
  created_at: "2026-11-19T10:00:00Z",
  updated_at: "2026-11-19T10:05:00Z",
  started_at: "2026-11-19T10:00:05Z",
  url: "https://github.com/o/r/actions/runs/1",
  attempt: 1,
  jobs: [
    job(10, { conclusion: "success" }),
    job(11, {
      conclusion: "failure",
      steps: [step(1, { conclusion: "failure" })],
    }),
  ],
  ...overrides,
});

const fetchMock = vi.fn();
let runPayload: unknown;
let logPayload: unknown;

const ok = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

beforeEach(() => {
  runPayload = { status: "ok", run: runData() };
  logPayload = { status: "ok", log: "linha 1\nlinha 2", truncated: false };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) =>
    String(url).includes("/log") ? ok(logPayload) : ok(runPayload),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  clearGithubDetailCache();
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const urls = () => fetchMock.mock.calls.map(([url]) => String(url));

async function renderRun() {
  render(<GithubRunDetail workspaceId="ws 1" runId={1} />);
  await screen.findByTestId("github-run-state");
}

describe("GithubRunDetail — cabeçalho", () => {
  it("busca o run pelo id e pelo workspace", async () => {
    await renderRun();

    expect(urls()[0]).toBe("/github/runs/1?workspace_id=ws%201");
  });

  it("mostra título, número, estado, workflow, branch, evento e commit curto", async () => {
    await renderRun();

    const detail = screen.getByTestId("github-run-detail");
    expect(detail.textContent).toContain("feat: algo");
    expect(detail.textContent).toContain("#590");
    expect(screen.getByTestId("github-run-state").textContent).toContain(
      "workbench_actions_state_failure",
    );
    for (const text of ["PR Gate", "feat/x", "pull_request", "abc1234"])
      expect(detail.textContent).toContain(text);
    expect(detail.textContent).not.toContain("abc1234d");
  });

  it("run concluído mostra a duração; a tentativa só aparece a partir da segunda", async () => {
    await renderRun();
    expect(screen.getByTestId("github-run-duration").textContent).toBe(
      "4m 55s",
    );
    expect(screen.queryByText("workbench_actions_detail_attempt")).toBeNull();

    cleanup();
    runPayload = { status: "ok", run: runData({ attempt: 3 }) };
    await renderRun();
    expect(screen.getByText("workbench_actions_detail_attempt")).toBeTruthy();
  });

  it("run em andamento não mostra duração fixa", async () => {
    runPayload = {
      status: "ok",
      run: runData({ status: "in_progress", conclusion: "" }),
    };
    await renderRun();

    expect(screen.queryByTestId("github-run-duration")).toBeNull();
    expect(screen.getByTestId("github-run-state").textContent).toContain(
      "workbench_actions_state_running",
    );
  });

  it("tem link para abrir no GitHub", async () => {
    await renderRun();

    expect(
      screen
        .getByRole("link", { name: "workbench_github_detail_open_on_github" })
        .getAttribute("href"),
    ).toBe("https://github.com/o/r/actions/runs/1");
  });
});

describe("GithubRunDetail — jobs e passos", () => {
  it("mostra a contagem de jobs", async () => {
    await renderRun();

    expect(
      screen.getByText('workbench_actions_detail_jobs({"n":2})'),
    ).toBeTruthy();
  });

  it("job com falha abre sozinho; job que passou fica recolhido", async () => {
    await renderRun();

    expect(screen.getByTestId("actions-step-11-1")).toBeTruthy();
    expect(screen.queryByTestId("actions-step-10-1")).toBeNull();
  });

  it("clicar no job alterna os passos", async () => {
    await renderRun();
    const toggle = screen
      .getByTestId("actions-job-10")
      .querySelector("button[aria-expanded]")!;

    fireEvent.click(toggle);
    expect(screen.getByTestId("actions-step-10-1")).toBeTruthy();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(toggle);
    expect(screen.queryByTestId("actions-step-10-1")).toBeNull();
  });

  it("cada passo mostra a duração e leva ao passo no GitHub", async () => {
    await renderRun();

    const stepLink = screen.getByTestId("actions-step-11-1");
    expect(stepLink.getAttribute("href")).toBe(
      "https://github.com/o/r/actions/runs/1/job/11#step:1:1",
    );
    expect(stepLink.getAttribute("target")).toBe("_blank");
    expect(stepLink.getAttribute("rel")).toContain("noopener");
    expect(stepLink.textContent).toContain("3s");
  });

  it("passo ainda em execução não tem duração", async () => {
    runPayload = {
      status: "ok",
      run: runData({
        status: "in_progress",
        conclusion: "",
        jobs: [
          job(10, {
            status: "in_progress",
            conclusion: "",
            completed_at: "",
            steps: [
              step(1, {
                status: "in_progress",
                conclusion: "",
                completed_at: "",
              }),
            ],
          }),
        ],
      }),
    };
    await renderRun();

    expect(screen.getByTestId("actions-step-10-1").textContent).not.toMatch(
      /\ds/,
    );
  });

  it("job ativo sem passos ainda: aguardando; concluído sem passos: sem detalhes", async () => {
    runPayload = {
      status: "ok",
      run: runData({
        status: "in_progress",
        conclusion: "",
        jobs: [
          job(10, { status: "in_progress", conclusion: "", steps: [] }),
          job(11, { conclusion: "failure", steps: [] }),
        ],
      }),
    };
    await renderRun();

    expect(
      screen.getByText("workbench_actions_detail_waiting_steps"),
    ).toBeTruthy();
    expect(screen.getByText("workbench_actions_detail_no_steps")).toBeTruthy();
  });

  it("sem jobs ainda mostra que eles não começaram", async () => {
    runPayload = { status: "ok", run: runData({ jobs: [] }) };
    await renderRun();

    expect(screen.getByTestId("github-run-no-jobs")).toBeTruthy();
  });
});

describe("GithubRunDetail — log sob demanda", () => {
  it("não busca o log até o usuário pedir", async () => {
    await renderRun();

    expect(urls().some((url) => url.includes("/log"))).toBe(false);
  });

  it("mostrar log busca o job certo e exibe o texto; ocultar recolhe", async () => {
    await renderRun();

    fireEvent.click(screen.getByTestId("actions-log-toggle-11"));

    expect((await screen.findByTestId("actions-job-log")).textContent).toBe(
      "linha 1\nlinha 2",
    );
    expect(urls().at(-1)).toBe(
      "/github/runs/1/jobs/11/log?workspace_id=ws%201",
    );

    fireEvent.click(screen.getByTestId("actions-log-toggle-11"));
    expect(screen.queryByTestId("actions-job-log")).toBeNull();
  });

  it("log longo avisa que só o final é mostrado", async () => {
    logPayload = { status: "ok", log: "fim", truncated: true };
    await renderRun();

    fireEvent.click(screen.getByTestId("actions-log-toggle-11"));

    expect(
      await screen.findByText("workbench_actions_detail_log_truncated"),
    ).toBeTruthy();
  });

  it("falha ao carregar o log mostra o erro", async () => {
    logPayload = { status: "error", message: "job is still in progress" };
    await renderRun();

    fireEvent.click(screen.getByTestId("actions-log-toggle-11"));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "job is still in progress",
    );
  });

  it("job em execução não oferece o log: avisa e aponta para o GitHub ao vivo", async () => {
    runPayload = {
      status: "ok",
      run: runData({
        status: "in_progress",
        conclusion: "",
        jobs: [
          job(10, { status: "in_progress", conclusion: "", completed_at: "" }),
        ],
      }),
    };
    await renderRun();

    expect(screen.queryByTestId("actions-log-toggle-10")).toBeNull();
    expect(
      screen.getByText("workbench_actions_detail_log_running"),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "workbench_actions_detail_watch_live" })
        .getAttribute("href"),
    ).toContain("/job/10");
  });
});

describe("GithubRunDetail — estados e releitura", () => {
  it("gh indisponível não vira run vazio", async () => {
    runPayload = { status: "unavailable", message: "gh not found" };
    render(<GithubRunDetail workspaceId="ws1" runId={1} />);

    expect(await screen.findByTestId("github-detail-unavailable")).toBeTruthy();
  });

  it("erro do servidor mostra o erro", async () => {
    fetchMock.mockImplementation(async () => ok({}, 500));
    render(<GithubRunDetail workspaceId="ws1" runId={1} />);

    expect(await screen.findByTestId("github-detail-error")).toBeTruthy();
  });

  it("run ativo se atualiza sozinho mantendo o conteúdo; ao terminar, para", async () => {
    vi.useFakeTimers();
    runPayload = {
      status: "ok",
      run: runData({ status: "in_progress", conclusion: "", jobs: [] }),
    };
    render(<GithubRunDetail workspaceId="ws1" runId={1} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("github-run-state").textContent).toContain(
      "workbench_actions_state_running",
    );
    const first = urls().length;

    runPayload = {
      status: "ok",
      run: runData({ conclusion: "success", jobs: [] }),
    };
    await act(async () => vi.advanceTimersByTime(RUN_POLL_MS + 10));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(urls().length).toBe(first + 1);
    expect(screen.getByTestId("github-run-state").textContent).toContain(
      "workbench_actions_state_success",
    );

    await act(async () => vi.advanceTimersByTime(RUN_POLL_MS * 5));
    expect(urls().length).toBe(first + 1);
  });

  it("run já concluído nunca relê sozinho", async () => {
    vi.useFakeTimers();
    render(<GithubRunDetail workspaceId="ws1" runId={1} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const first = urls().length;

    await act(async () => vi.advanceTimersByTime(RUN_POLL_MS * 5));

    expect(urls().length).toBe(first);
  });

  it("uma releitura que falha mantém o run na tela", async () => {
    vi.useFakeTimers();
    runPayload = {
      status: "ok",
      run: runData({ status: "in_progress", conclusion: "", jobs: [] }),
    };
    render(<GithubRunDetail workspaceId="ws1" runId={1} />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    runPayload = { status: "error", message: "rede" };
    await act(async () => vi.advanceTimersByTime(RUN_POLL_MS + 10));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId("github-run-state")).toBeTruthy();
    expect(screen.queryByTestId("github-detail-error")).toBeNull();
  });
});

describe("GithubRunDetail — somente leitura", () => {
  it("não há re-run, cancelar, disparar nem comentar; só alternar jobs e logs", async () => {
    await renderRun();

    const labels = screen
      .getAllByRole("button")
      .map(
        (button) =>
          button.getAttribute("aria-label") ?? button.textContent ?? "",
      );
    expect(labels.join(" | ")).not.toMatch(
      /rerun|re-run|cancel|dispatch|comment/i,
    );
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("só faz GET (inclusive ao abrir o log)", async () => {
    await renderRun();
    fireEvent.click(screen.getByTestId("actions-log-toggle-11"));
    await waitFor(() =>
      expect(urls().some((u) => u.includes("/log"))).toBe(true),
    );

    for (const [, init] of fetchMock.mock.calls)
      expect((init as RequestInit | undefined)?.method ?? "GET").toBe("GET");
  });
});
