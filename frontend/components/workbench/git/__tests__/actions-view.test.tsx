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

import { ACTIVE_POLL_MS, ActionsView, IDLE_POLL_MS } from "../actions-view";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy(
    {},
    {
      get: (_t, prop) => (args?: Record<string, unknown>) =>
        args ? `${String(prop)}(${JSON.stringify(args)})` : String(prop),
    },
  ),
}));

const run = (overrides: Record<string, unknown> = {}) => ({
  id: 987654321,
  number: 590,
  title: "feat: algo",
  workflow: "PR Gate",
  status: "completed",
  conclusion: "success",
  event: "pull_request",
  branch: "feat/x",
  created_at: "2026-11-19T10:00:00Z",
  updated_at: "2026-11-19T10:05:00Z",
  started_at: "2026-11-19T10:00:05Z",
  attempt: 1,
  ...overrides,
});

const fetchMock = vi.fn();
let runsPayload: unknown;
let workflowsPayload: unknown;

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
});

beforeEach(() => {
  runsPayload = { status: "ok", runs: [run()] };
  workflowsPayload = {
    status: "ok",
    workflows: [
      { id: 1, name: "PR Gate" },
      { id: 2, name: "Release" },
    ],
  };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) =>
    ok(
      String(url).startsWith("/github/workflows")
        ? workflowsPayload
        : runsPayload,
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const noop = () => {};

/** Deixa as respostas simuladas (promessas já resolvidas) chegarem ao React. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** `b` vem depois de `a` no documento. */
const follows = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

const runCalls = () =>
  fetchMock.mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith("/github/runs"));
const lastRunUrl = () => new URL(runCalls().at(-1)!, "http://x");

function renderView(props: Partial<Parameters<typeof ActionsView>[0]> = {}) {
  return render(
    <ActionsView
      workspaceId="ws1"
      currentBranch="feat/x"
      onOpenItem={vi.fn()}
      {...props}
    />,
  );
}

describe("ActionsView — leitura", () => {
  it("mostra título, workflow, número, evento, branch e duração do run", async () => {
    renderView();

    const row = await screen.findByTestId("actions-run-987654321");
    expect(row.textContent).toContain("feat: algo");
    expect(row.textContent).toContain("PR Gate · #590 · pull_request");
    expect(row.textContent).toContain("feat/x");
    // Do início (10:00:05) à última atualização (10:05:00).
    expect(screen.getByTestId("actions-duration").textContent).toBe("4m 55s");
  });

  it("run em andamento mostra o estado no lugar da duração", async () => {
    runsPayload = {
      status: "ok",
      runs: [run({ status: "in_progress", conclusion: "" })],
    };
    renderView();

    await screen.findByTestId("actions-run-987654321");
    expect(screen.getByTestId("actions-duration").textContent).toBe(
      "workbench_actions_state_running",
    );
  });

  it("a tentativa só aparece a partir da segunda", async () => {
    runsPayload = { status: "ok", runs: [run({ attempt: 2 })] };
    renderView();

    expect(
      (await screen.findByTestId("actions-run-987654321")).textContent,
    ).toContain('workbench_actions_attempt({"n":2})');
  });

  it("clicar num run o abre como document do tipo workflow-run com o id do run", async () => {
    const onOpenItem = vi.fn();
    renderView({ onOpenItem });

    fireEvent.click(await screen.findByTestId("actions-run-987654321"));

    expect(onOpenItem).toHaveBeenCalledWith({
      kind: "workflow-run",
      number: 987654321,
      title: "feat: algo",
    });
  });

  it("sem handler a linha não é clicável (nada abre)", async () => {
    renderView({ onOpenItem: undefined });

    expect(
      (await screen.findByTestId("actions-run-987654321")).hasAttribute(
        "disabled",
      ),
    ).toBe(true);
  });
});

describe("ActionsView — filtros", () => {
  it("começa filtrando pela branch atual", async () => {
    renderView();
    await screen.findByTestId("actions-run-987654321");

    expect(lastRunUrl().searchParams.get("branch")).toBe("feat/x");
    expect(lastRunUrl().searchParams.get("workspace_id")).toBe("ws1");
    expect(
      screen.getByTestId("actions-this-branch").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("desligar 'Esta branch' relê sem o filtro de branch", async () => {
    renderView();
    await screen.findByTestId("actions-run-987654321");

    fireEvent.click(screen.getByTestId("actions-this-branch"));

    await waitFor(() =>
      expect(lastRunUrl().searchParams.has("branch")).toBe(false),
    );
    expect(
      screen.getByTestId("actions-this-branch").getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("sem branch atual (HEAD solto) não oferece o filtro nem manda branch", async () => {
    renderView({ currentBranch: null });
    await screen.findByTestId("actions-run-987654321");

    expect(screen.queryByTestId("actions-this-branch")).toBeNull();
    expect(lastRunUrl().searchParams.has("branch")).toBe(false);
  });

  it.each([
    ["running", "in_progress"],
    ["success", "success"],
    ["failure", "failure"],
    ["cancelled", "cancelled"],
  ])("o estado %s vira --status %s", async (option, expected) => {
    renderView();
    await screen.findByTestId("actions-run-987654321");

    fireEvent.change(screen.getByTestId("actions-status"), {
      target: { value: option },
    });

    await waitFor(() =>
      expect(lastRunUrl().searchParams.get("status")).toBe(expected),
    );
  });

  it("'Todos' não manda estado", async () => {
    renderView();
    await screen.findByTestId("actions-run-987654321");

    expect(lastRunUrl().searchParams.has("status")).toBe(false);
  });

  it("o seletor de workflow lista os workflows do repositório e filtra", async () => {
    renderView();
    await screen.findByTestId("actions-run-987654321");
    const select = await screen.findByTestId("actions-workflow");

    expect(
      [...select.querySelectorAll("option")].map((option) => option.value),
    ).toEqual(["", "PR Gate", "Release"]);

    fireEvent.change(select, { target: { value: "Release" } });

    await waitFor(() =>
      expect(lastRunUrl().searchParams.get("workflow")).toBe("Release"),
    );
  });

  it("sem workflows (gh falhou nessa chamada) o seletor some e a lista continua", async () => {
    workflowsPayload = { status: "unavailable", message: "x" };
    renderView();

    await screen.findByTestId("actions-run-987654321");
    expect(screen.queryByTestId("actions-workflow")).toBeNull();
  });

  it("buscar por título filtra no cliente, sem nova chamada", async () => {
    runsPayload = {
      status: "ok",
      runs: [
        run({ id: 1, title: "feat: algo novo", number: 1 }),
        run({ id: 2, title: "fix: bug no chat", number: 2 }),
      ],
    };
    renderView();
    await screen.findByTestId("actions-run-1");
    const calls = runCalls().length;

    fireEvent.change(screen.getByTestId("github-filter"), {
      target: { value: "BUG" },
    });

    expect(screen.queryByTestId("actions-run-1")).toBeNull();
    expect(screen.getByTestId("actions-run-2")).toBeTruthy();
    expect(runCalls().length).toBe(calls);
  });

  it("o campo de busca vem antes do seletor de estado, que vem antes de atualizar", async () => {
    renderView();
    await screen.findByTestId("actions-run-987654321");

    const search = screen.getByTestId("github-filter");
    const status = screen.getByTestId("actions-status");
    const refresh = screen.getByRole("button", {
      name: "workbench_github_refresh",
    });
    expect(follows(search, status)).toBe(true);
    expect(follows(status, refresh)).toBe(true);
  });
});

describe("ActionsView — estados", () => {
  it("lista vazia é diferente de filtro sem resultado", async () => {
    runsPayload = { status: "ok", runs: [] };
    renderView();
    expect(await screen.findByTestId("actions-empty")).toBeTruthy();
    cleanup();

    runsPayload = { status: "ok", runs: [run()] };
    renderView();
    await screen.findByTestId("actions-run-987654321");
    fireEvent.change(screen.getByTestId("github-filter"), {
      target: { value: "zzz" },
    });
    expect(screen.getByTestId("actions-no-match")).toBeTruthy();
    expect(screen.queryByTestId("actions-empty")).toBeNull();
  });

  it("gh indisponível não vira lista vazia: mostra o estado de configuração", async () => {
    runsPayload = { status: "unavailable", message: "gh not found" };
    renderView();

    expect(await screen.findByTestId("actions-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("actions-empty")).toBeNull();
  });

  it("erro do servidor mostra o erro", async () => {
    runsPayload = { status: "error", message: "falhou" };
    renderView();

    expect((await screen.findByTestId("actions-error")).textContent).toContain(
      "falhou",
    );
  });

  it("o botão atualizar relê a lista", async () => {
    renderView();
    await screen.findByTestId("actions-run-987654321");
    const before = runCalls().length;

    fireEvent.click(
      screen.getByRole("button", { name: "workbench_github_refresh" }),
    );

    await waitFor(() => expect(runCalls().length).toBeGreaterThan(before));
  });
});

describe("ActionsView — releitura automática", () => {
  it("com run em andamento relê a cada ~8 s; parado, a cada ~30 s", async () => {
    vi.useFakeTimers();
    runsPayload = {
      status: "ok",
      runs: [run({ status: "in_progress", conclusion: "" })],
    };
    renderView();
    await flush();
    const initial = runCalls().length;

    await act(async () => vi.advanceTimersByTime(ACTIVE_POLL_MS - 100));
    expect(runCalls().length).toBe(initial);
    await act(async () => vi.advanceTimersByTime(200));
    await flush();
    expect(runCalls().length).toBe(initial + 1);

    // Agora tudo termina: o intervalo passa a ser o longo.
    runsPayload = { status: "ok", runs: [run()] };
    await act(async () => vi.advanceTimersByTime(ACTIVE_POLL_MS));
    await flush();
    const afterFinish = runCalls().length;
    await act(async () => vi.advanceTimersByTime(ACTIVE_POLL_MS * 2));
    expect(runCalls().length).toBe(afterFinish);
    await act(async () => vi.advanceTimersByTime(IDLE_POLL_MS));
    await flush();
    expect(runCalls().length).toBeGreaterThan(afterFinish);
  });

  it("a releitura mantém a lista na tela (não volta ao carregando)", async () => {
    vi.useFakeTimers();
    runsPayload = {
      status: "ok",
      runs: [run({ status: "in_progress", conclusion: "" })],
    };
    renderView();
    await flush();
    expect(screen.getByTestId("actions-run-987654321")).toBeTruthy();

    // A próxima resposta demora: durante a espera a linha continua lá.
    let release: (value: unknown) => void = noop;
    fetchMock.mockImplementation(
      (url: string) =>
        new Promise((resolve) => {
          if (String(url).startsWith("/github/runs")) release = resolve;
          else resolve(ok(workflowsPayload));
        }),
    );
    await act(async () => vi.advanceTimersByTime(ACTIVE_POLL_MS + 10));

    expect(screen.getByTestId("actions-run-987654321")).toBeTruthy();
    expect(screen.queryByTestId("actions-error")).toBeNull();

    await act(async () => {
      release(ok({ status: "ok", runs: [run({ title: "feat: atualizado" })] }));
    });
    await flush();
    expect(screen.getByTestId("actions-run-987654321").textContent).toContain(
      "feat: atualizado",
    );
  });

  it("uma releitura automática que falha não apaga a lista", async () => {
    vi.useFakeTimers();
    runsPayload = {
      status: "ok",
      runs: [run({ status: "in_progress", conclusion: "" })],
    };
    renderView();
    await flush();

    runsPayload = { status: "error", message: "rede caiu" };
    await act(async () => vi.advanceTimersByTime(ACTIVE_POLL_MS + 10));
    await flush();

    expect(screen.getByTestId("actions-run-987654321")).toBeTruthy();
    expect(screen.queryByTestId("actions-error")).toBeNull();
  });

  it("para de reler ao sair da aba (desmontar)", async () => {
    vi.useFakeTimers();
    runsPayload = {
      status: "ok",
      runs: [run({ status: "in_progress", conclusion: "" })],
    };
    const { unmount } = renderView();
    await flush();
    const calls = runCalls().length;

    unmount();
    await act(async () => vi.advanceTimersByTime(IDLE_POLL_MS * 3));

    expect(runCalls().length).toBe(calls);
  });
});

describe("ActionsView — somente leitura", () => {
  it("nenhum botão de re-run, cancelar, disparar ou comentar; só filtros, atualizar e abrir", async () => {
    renderView();
    await screen.findByTestId("actions-run-987654321");

    const labels = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label") ?? button.textContent);

    expect(labels.join(" | ")).not.toMatch(
      /rerun|re-run|cancel|dispatch|run workflow|comment/i,
    );
    expect(screen.queryByRole("textbox", { name: /comment/i })).toBeNull();
  });

  it("só faz GET", async () => {
    renderView();
    await screen.findByTestId("actions-run-987654321");
    fireEvent.click(screen.getByTestId("actions-run-987654321"));

    for (const [, init] of fetchMock.mock.calls)
      expect((init as RequestInit | undefined)?.method ?? "GET").toBe("GET");
  });
});
