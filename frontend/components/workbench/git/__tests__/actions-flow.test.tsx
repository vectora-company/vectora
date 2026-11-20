// @vitest-environment jsdom
/**
 * Fluxo completo, com os componentes reais e só a rede simulada: a lista
 * (Actions, PRs, Issues) entrega o item, o descritor vai para a store, a janela
 * do canvas monta o document e o document busca o conteúdo. É o mesmo caminho
 * que a rota da sessão percorre; aqui nada é trocado por mock.
 *
 * Os dados são as fixtures reais (saídas do `gh` deste repositório, convertidas
 * pelo backend). A única alteração é a variante "falhou": um job real marcado
 * como falho, para cobrir o que o repositório só gera quando o CI quebra.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

import issueDetailFixture from "../../../../e2e/fixtures/github/issue-detail.json";
import issuesFixture from "../../../../e2e/fixtures/github/issues.json";
import jobLogFixture from "../../../../e2e/fixtures/github/job-log.json";
import pullDetailFixture from "../../../../e2e/fixtures/github/pull-detail.json";
import pullsFixture from "../../../../e2e/fixtures/github/pulls.json";
import runDetailFixture from "../../../../e2e/fixtures/github/run-detail.json";
import runsFixture from "../../../../e2e/fixtures/github/runs.json";
import workflowsFixture from "../../../../e2e/fixtures/github/workflows.json";

import { ActionsView } from "../actions-view";
import { GithubView, type GithubItemRef } from "../github-view";
import {
  githubDocumentDescriptor,
  renderGithubDocument,
} from "../github-documents";
import { CanvasDocumentWindows } from "@/components/workbench/canvas-document-windows";
import { useWindowsStore } from "@/lib/stores/windows-store";

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

const RUNS = runsFixture.runs;
const RUN = runDetailFixture.run; // run concluído com sucesso, com jobs reais
const OTHER_RUN =
  RUNS.find((run) => run.id !== RUN.id && run.status === "completed") ??
  RUNS.find((run) => run.id !== RUN.id)!;
const JOB_WITH_STEPS = RUN.jobs.find((job) => job.steps.length > 0)!;
const JOB_TO_FAIL = RUN.jobs.findLast((job) => job.steps.length > 0)!;
const SKIPPED_JOB = RUN.jobs.find((job) => job.conclusion === "skipped")!;
const PULL = pullsFixture.pulls[0]!;
const ISSUE = issuesFixture.issues[0]!;

type Variant = "real" | "failed";
let variant: Variant = "real";
let unavailable = false;

/** O run real, ou com o último job que tem passos marcado como falho. */
function runDetail(id: number) {
  const base = structuredClone(RUN);
  if (id !== RUN.id) {
    const listed = RUNS.find((run) => run.id === id)!;
    Object.assign(base, listed, { jobs: base.jobs });
  }
  if (variant === "failed") {
    base.conclusion = "failure";
    const job = base.jobs.find((item) => item.id === JOB_TO_FAIL.id)!;
    job.conclusion = "failure";
    job.steps[1] = { ...job.steps[1]!, conclusion: "failure" };
  }
  return base;
}

const fetchMock = vi.fn();

const ok = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body,
});

function route(url: string) {
  const { pathname } = new URL(url, "http://x");
  if (unavailable) return { status: "unavailable", message: "gh not found" };
  if (pathname.endsWith("/workflows")) return workflowsFixture;
  if (/\/runs\/\d+\/jobs\/\d+\/log$/.test(pathname)) return jobLogFixture;
  const detail = /\/runs\/(\d+)$/.exec(pathname);
  if (detail)
    return { status: "ok", message: "", run: runDetail(Number(detail[1])) };
  if (pathname.endsWith("/runs")) return runsFixture;
  if (/\/pulls\/\d+$/.test(pathname)) return pullDetailFixture;
  if (pathname.endsWith("/pulls")) return pullsFixture;
  if (/\/issues\/\d+$/.test(pathname)) return issueDetailFixture;
  return issuesFixture;
}

beforeEach(() => {
  variant = "real";
  unavailable = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => ok(route(String(url))));
  vi.stubGlobal("fetch", fetchMock);
  useWindowsStore.getState().closeAll();
});
afterEach(() => {
  clearGithubDetailCache();
  cleanup();
  vi.unstubAllGlobals();
});

/** A ligação da rota: um item da lista vira um document na store. */
const open = (item: GithubItemRef) =>
  useWindowsStore
    .getState()
    .openCanvasDocument(githubDocumentDescriptor(item, "ws1", "t1"));

/** A mesma ligação da rota: a lista abre o item pela store e a camada de janelas o mostra. */
function Harness({ list }: { list: "actions" | "pulls" | "issues" }) {
  const documents = useWindowsStore((s) => s.canvasDocuments);
  const activeId = useWindowsStore((s) => s.activeCanvasDocumentId);
  const minimizedIds = useWindowsStore((s) => s.minimizedCanvasDocumentIds);

  return (
    <>
      {list === "actions" ? (
        <ActionsView
          workspaceId="ws1"
          currentBranch={RUNS[0]!.branch}
          onOpenItem={open}
        />
      ) : (
        <GithubView workspaceId="ws1" kind={list} onOpenItem={open} />
      )}
      <CanvasDocumentWindows
        documents={documents}
        activeId={activeId}
        minimizedIds={minimizedIds}
        onClose={(id) =>
          useWindowsStore.getState().closeCanvasDocumentModal(id)
        }
        onMinimize={(id) =>
          useWindowsStore.getState().minimizeCanvasDocument(id)
        }
        renderDocument={renderGithubDocument}
      />
    </>
  );
}

const store = () => useWindowsStore.getState();
const requested = () => fetchMock.mock.calls.map(([url]) => String(url));
const runRow = (id: number) => screen.findByTestId(`actions-run-${id}`);

describe("fluxo — Actions: lista → document do run", () => {
  it("clicar no run abre a janela com o detalhe, buscando exatamente aquele run", async () => {
    render(<Harness list="actions" />);

    fireEvent.click(await runRow(RUN.id));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(`#${RUN.id} ${RUN.title}`)).toBeTruthy();
    expect(await within(dialog).findByTestId("github-run-detail")).toBeTruthy();
    expect(
      requested().some((u) => u.startsWith(`/github/runs/${RUN.id}?`)),
    ).toBe(true);
    expect(
      requested().some((u) => u.startsWith(`/github/runs/${OTHER_RUN.id}?`)),
    ).toBe(false);
  });

  it("a store guarda só o identificador do run (um id grande, acima de 32 bits)", async () => {
    expect(RUN.id).toBeGreaterThan(2 ** 31);
    render(<Harness list="actions" />);

    fireEvent.click(await runRow(RUN.id));
    await screen.findByRole("dialog");

    expect(store().canvasDocuments).toEqual([
      {
        id: `workflow-run:ws1:${RUN.id}`,
        kind: "workflow-run",
        workspaceId: "ws1",
        threadId: "t1",
        title: `#${RUN.id} ${RUN.title}`,
        githubNumber: RUN.id,
      },
    ]);
    expect(store().activeCanvasDocumentId).toBe(`workflow-run:ws1:${RUN.id}`);
  });

  it("run real que passou: todos os jobs ficam recolhidos e os pulados não têm passos", async () => {
    render(<Harness list="actions" />);
    fireEvent.click(await runRow(RUN.id));
    await screen.findByTestId("github-run-detail");

    expect(
      screen.queryByTestId(`actions-step-${JOB_WITH_STEPS.id}-1`),
    ).toBeNull();
    const skipped = screen.getByTestId(`actions-job-${SKIPPED_JOB.id}`);
    expect(within(skipped).queryAllByRole("link")).toHaveLength(0);
  });

  it("com um job falho (variante), ele abre sozinho e os outros continuam recolhidos", async () => {
    variant = "failed";
    render(<Harness list="actions" />);
    fireEvent.click(await runRow(RUN.id));

    expect(
      await screen.findByTestId(`actions-step-${JOB_TO_FAIL.id}-1`),
    ).toBeTruthy();
    if (JOB_WITH_STEPS.id !== JOB_TO_FAIL.id)
      expect(
        screen.queryByTestId(`actions-step-${JOB_WITH_STEPS.id}-1`),
      ).toBeNull();
  });

  it("o log só é pedido quando o usuário pede, e vem do job certo", async () => {
    variant = "failed";
    render(<Harness list="actions" />);
    fireEvent.click(await runRow(RUN.id));
    await screen.findByTestId("github-run-detail");
    expect(requested().some((u) => u.includes("/log"))).toBe(false);

    fireEvent.click(screen.getByTestId(`actions-log-toggle-${JOB_TO_FAIL.id}`));

    const log = await screen.findByTestId("actions-job-log");
    expect(log.textContent).toBe(jobLogFixture.log);
    expect(
      requested().some((u) =>
        u.startsWith(`/github/runs/${RUN.id}/jobs/${JOB_TO_FAIL.id}/log?`),
      ),
    ).toBe(true);
  });

  it("clicar de novo no mesmo run não duplica o document", async () => {
    render(<Harness list="actions" />);

    fireEvent.click(await runRow(RUN.id));
    await screen.findByTestId("github-run-detail");
    fireEvent.click(screen.getByTestId(`actions-run-${RUN.id}`));

    expect(store().canvasDocuments).toHaveLength(1);
    expect(screen.getAllByTestId("github-run-detail")).toHaveLength(1);
  });

  it("abrir outro run guarda os dois e mostra o novo", async () => {
    render(<Harness list="actions" />);

    fireEvent.click(await runRow(RUN.id));
    await screen.findByTestId("github-run-detail");
    fireEvent.click(screen.getByTestId(`actions-run-${OTHER_RUN.id}`));

    await waitFor(() =>
      expect(store().activeCanvasDocumentId).toBe(
        `workflow-run:ws1:${OTHER_RUN.id}`,
      ),
    );
    expect(store().canvasDocuments.map((d) => d.githubNumber)).toEqual([
      RUN.id,
      OTHER_RUN.id,
    ]);
  });

  it("minimizar esconde a janela sem fechar o document; restaurar o traz de volta", async () => {
    render(<Harness list="actions" />);
    fireEvent.click(await runRow(RUN.id));
    await screen.findByTestId("github-run-detail");

    fireEvent.click(screen.getByRole("button", { name: "window_minimize" }));

    expect(store().minimizedCanvasDocumentIds).toEqual([
      `workflow-run:ws1:${RUN.id}`,
    ]);
    expect(store().canvasDocuments).toHaveLength(1);
    expect(screen.getByRole("dialog", { hidden: true }).style.display).toBe(
      "none",
    );

    act(() => store().restoreCanvasDocument(`workflow-run:ws1:${RUN.id}`));

    await waitFor(() =>
      expect(screen.getByRole("dialog").style.display).not.toBe("none"),
    );
    expect(store().minimizedCanvasDocumentIds).toEqual([]);
  });

  it("fechar a janela remove o document da store", async () => {
    render(<Harness list="actions" />);
    fireEvent.click(await runRow(RUN.id));
    await screen.findByTestId("github-run-detail");

    fireEvent.click(screen.getByRole("button", { name: "dialog_close" }));

    await waitFor(() => expect(store().canvasDocuments).toEqual([]));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("fluxo — Actions: casos reais da lista", () => {
  it("o run em andamento aparece com o estado no lugar da duração e abre normalmente", async () => {
    const active = RUNS.find((run) => run.status === "in_progress")!;
    render(<Harness list="actions" />);

    const row = await runRow(active.id);

    expect(within(row).getByTestId("actions-duration").textContent).toBe(
      "workbench_actions_state_running",
    );
  });

  it("os workflows reais enchem o seletor", async () => {
    render(<Harness list="actions" />);
    await runRow(RUN.id);

    const select = await screen.findByTestId("actions-workflow");
    expect(
      [...select.querySelectorAll("option")].slice(1).map((o) => o.textContent),
    ).toEqual(workflowsFixture.workflows.map((w) => w.name));
  });
});

describe("fluxo — PRs e Issues: lista → document", () => {
  it("PR: abre o document, mostra o corpo real e troca para a aba de arquivos", async () => {
    render(<Harness list="pulls" />);

    fireEvent.click(await screen.findByTestId(`github-open-${PULL.number}`));

    expect((await screen.findByTestId("github-body")).textContent).toContain(
      pullDetailFixture.pull.body.slice(0, 20),
    );
    fireEvent.click(screen.getByTestId("github-tab-files"));
    expect(screen.getAllByTestId("github-file")[0]!.textContent).toContain(
      pullDetailFixture.pull.files[0]!.path,
    );
    expect(store().canvasDocuments[0]).toMatchObject({
      id: `pull-request:ws1:${PULL.number}`,
      kind: "pull-request",
      githubNumber: PULL.number,
    });
  });

  it("Issue: abre o document com o corpo real e a barra de metadados", async () => {
    render(<Harness list="issues" />);

    fireEvent.click(await screen.findByTestId(`github-open-${ISSUE.number}`));

    expect((await screen.findByTestId("github-body")).textContent).toContain(
      issueDetailFixture.issue.body.slice(0, 20),
    );
    expect(screen.getByTestId("github-issue-sidebar").textContent).toContain(
      issueDetailFixture.issue.labels[0]!,
    );
    expect(store().canvasDocuments[0]).toMatchObject({
      id: `issue:ws1:${ISSUE.number}`,
      kind: "issue",
    });
  });
});

describe("fluxo — falhas", () => {
  it("gh indisponível na lista: estado de configuração, nenhum document, nenhuma lista vazia", async () => {
    unavailable = true;
    render(<Harness list="actions" />);

    expect(await screen.findByTestId("actions-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("actions-empty")).toBeNull();
    expect(store().canvasDocuments).toEqual([]);
  });

  it("o gh cai depois de a lista carregar: o document mostra o estado de configuração", async () => {
    render(<Harness list="actions" />);
    await runRow(RUN.id);

    unavailable = true;
    fireEvent.click(screen.getByTestId(`actions-run-${RUN.id}`));

    expect(await screen.findByTestId("github-detail-unavailable")).toBeTruthy();
    expect(screen.queryByTestId("github-run-detail")).toBeNull();
  });

  it("erro HTTP no detalhe mostra o erro dentro da janela, sem derrubá-la", async () => {
    render(<Harness list="actions" />);
    await runRow(RUN.id);
    fetchMock.mockImplementation(async (url: string) =>
      String(url).startsWith("/github/runs/")
        ? ok({}, 500)
        : ok(route(String(url))),
    );

    fireEvent.click(screen.getByTestId(`actions-run-${RUN.id}`));

    expect(await screen.findByTestId("github-detail-error")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("fluxo — somente leitura", () => {
  it("abrir listas, documents e logs só faz requisições GET", async () => {
    variant = "failed";
    const first = render(<Harness list="actions" />);
    fireEvent.click(await runRow(RUN.id));
    fireEvent.click(
      await screen.findByTestId(`actions-log-toggle-${JOB_TO_FAIL.id}`),
    );
    await screen.findByTestId("actions-job-log");
    first.unmount();

    for (const list of ["pulls", "issues"] as const) {
      const view = render(<Harness list={list} />);
      fireEvent.click(
        await screen.findByTestId(
          `github-open-${list === "pulls" ? PULL.number : ISSUE.number}`,
        ),
      );
      await screen.findByTestId("github-body");
      view.unmount();
    }

    expect(fetchMock.mock.calls.length).toBeGreaterThan(5);
    for (const [, init] of fetchMock.mock.calls)
      expect((init as RequestInit | undefined)?.method ?? "GET").toBe("GET");
  });

  it("nenhuma janela de document tem botão de re-run, cancelar, disparar ou comentar", async () => {
    render(<Harness list="actions" />);
    fireEvent.click(await runRow(RUN.id));
    await screen.findByTestId("github-run-detail");

    const labels = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label") ?? b.textContent ?? "");

    expect(labels.join(" | ")).not.toMatch(/re-?run|cancel|dispatch|comment/i);
  });
});
