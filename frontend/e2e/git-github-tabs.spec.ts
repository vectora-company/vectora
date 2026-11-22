import { test, expect, type Page, type Route } from "./electron-test";

import issueDetailFixture from "./fixtures/github/issue-detail.json";
import issuesFixture from "./fixtures/github/issues.json";
import jobLogFixture from "./fixtures/github/job-log.json";
import pullDetailFixture from "./fixtures/github/pull-detail.json";
import pullsFixture from "./fixtures/github/pulls.json";
import runDetailFixture from "./fixtures/github/run-detail.json";
import runsFixture from "./fixtures/github/runs.json";
import workflowsFixture from "./fixtures/github/workflows.json";

/**
 * E2E (Electron via CDP): abas PRs, Issues e Actions da workbench Git, somente
 * leitura.
 *
 * As respostas de `/github/*` são simuladas na rede da página (`page.route`) a
 * partir de fixtures REAIS: saídas do `gh` deste repositório (só leitura),
 * convertidas pelo backend e travadas pelo teste `test_github_real_fixtures.py`.
 * Assim o teste não depende de `gh` instalado, de login nem de rede, mas também
 * não inventa um formato: a interface real do Vectora recebe o que o backend
 * realmente entregaria.
 *
 * Requer o Vectora rodando com CDP (ver README.md desta pasta).
 */

const WORKSPACE_FOLDER_NAME = `vectora-e2e-github-${Date.now()}`;

const RUN = runDetailFixture.run;
const RUNS = runsFixture.runs;
const OTHER_RUN = RUNS.find((run) => run.id !== RUN.id)!;
const JOB_TO_FAIL = RUN.jobs.findLast((job) => job.steps.length > 0)!;
const PASSING_JOB = RUN.jobs.find(
  (job) => job.steps.length > 0 && job.id !== JOB_TO_FAIL.id,
)!;
const PULL = pullsFixture.pulls[0]!;
const ISSUE = issuesFixture.issues[0]!;

interface Recorded {
  method: string;
  url: URL;
}

interface MockOptions {
  /** `gh` "não instalado": todas as rotas respondem `unavailable`. */
  unavailable?: boolean;
  /** Marca um job real como falho, para cobrir o que só existe quando o CI quebra. */
  failJob?: boolean;
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/** O run real, ou com o último job que tem passos marcado como falho. */
function runDetail(failJob: boolean) {
  const run = structuredClone(RUN);
  if (!failJob) return run;
  run.conclusion = "failure";
  const job = run.jobs.find((item) => item.id === JOB_TO_FAIL.id)!;
  job.conclusion = "failure";
  job.steps[1] = { ...job.steps[1]!, conclusion: "failure" };
  return run;
}

/** Simula a API do GitHub do backend e registra cada requisição. */
async function mockGithub(
  page: Page,
  options: MockOptions = {},
): Promise<Recorded[]> {
  const recorded: Recorded[] = [];
  await page.route(/\/github\/(runs|workflows|pulls|issues)/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    recorded.push({ method: request.method(), url });
    const { pathname } = url;

    if (options.unavailable)
      return json(route, {
        status: "unavailable",
        message: "gh not found in PATH",
      });

    if (pathname.endsWith("/workflows")) return json(route, workflowsFixture);
    if (/\/runs\/\d+\/jobs\/\d+\/log$/.test(pathname))
      return json(route, jobLogFixture);
    if (/\/runs\/\d+$/.test(pathname))
      return json(route, {
        status: "ok",
        message: "",
        run: runDetail(Boolean(options.failJob)),
      });
    if (pathname.endsWith("/runs")) return json(route, runsFixture);
    if (/\/pulls\/\d+$/.test(pathname)) return json(route, pullDetailFixture);
    if (pathname.endsWith("/pulls")) return json(route, pullsFixture);
    if (/\/issues\/\d+$/.test(pathname)) return json(route, issueDetailFixture);
    return json(route, issuesFixture);
  });
  return recorded;
}

async function ensureWorkspace(page: Page): Promise<void> {
  await page.goto("/");

  await page.getByTestId("plus-menu-trigger").click();
  await page.getByTestId("plus-menu-add-folder").click();

  const pathInput = page.getByTestId("workspace-path-input");
  await expect(pathInput).toBeVisible({ timeout: 15_000 });

  await page.getByTestId("workspace-new-folder-btn").click();
  const newFolderInput = page.getByTestId("workspace-new-folder-input");
  await expect(newFolderInput).toBeVisible({ timeout: 10_000 });
  await newFolderInput.fill(WORKSPACE_FOLDER_NAME);
  await page.getByTestId("workspace-new-folder-create-btn").click();

  await page.getByText(WORKSPACE_FOLDER_NAME).first().click();
  await expect(page.getByTestId("workspace-git-init-checkbox")).toBeChecked({
    timeout: 10_000,
  });
  await page.getByTestId("workspace-trust-confirm-btn").click();
  await expect(pathInput).not.toBeVisible({ timeout: 15_000 });
}

async function openGitTab(page: Page, tab: "prs" | "issues" | "actions") {
  await page.getByTestId("workbench-nav-git").click();
  await expect(page.getByTestId("workbench-tab-content")).toHaveAttribute(
    "data-tab",
    "git",
  );
  await page.getByTestId(`tab-${tab}`).click();
}

const runsRequests = (recorded: Recorded[]) =>
  recorded.filter((r) => r.url.pathname.endsWith("/runs"));

test.describe("abas PRs, Issues e Actions (somente leitura)", () => {
  test.beforeEach(async ({ page }) => {
    await ensureWorkspace(page);
  });

  test("a workbench Git tem as abas PRs, Issues e Actions, nessa ordem, sem a aba GitHub", async ({
    page,
  }) => {
    await mockGithub(page);
    await page.getByTestId("workbench-nav-git").click();

    const order = await page
      .getByRole("tab")
      .evaluateAll((tabs) =>
        tabs.map((tab) => tab.getAttribute("data-testid")),
      );
    const index = (id: string) => order.indexOf(`tab-${id}`);

    expect(index("prs")).toBeGreaterThan(-1);
    expect(index("issues")).toBe(index("prs") + 1);
    expect(index("actions")).toBe(index("issues") + 1);
    await expect(page.getByText("GitHub", { exact: true })).toHaveCount(0);
  });

  test("Actions lista os runs reais, filtra pela branch atual e deixa desligar o filtro", async ({
    page,
  }) => {
    const recorded = await mockGithub(page);
    await openGitTab(page, "actions");

    await expect(page.getByTestId(`actions-run-${RUN.id}`)).toBeVisible();
    await expect(page.getByTestId(`actions-run-${OTHER_RUN.id}`)).toBeVisible();
    expect(
      runsRequests(recorded).at(-1)!.url.searchParams.get("branch"),
    ).toBeTruthy();
    await expect(page.getByTestId("actions-this-branch")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByTestId("actions-this-branch").click();
    await expect
      .poll(() => runsRequests(recorded).at(-1)!.url.searchParams.has("branch"))
      .toBe(false);
  });

  test("o run em andamento aparece com o estado no lugar da duração", async ({
    page,
  }) => {
    await mockGithub(page);
    await openGitTab(page, "actions");
    const active = RUNS.find((run) => run.status === "in_progress")!;

    await expect(
      page
        .getByTestId(`actions-run-${active.id}`)
        .getByTestId("actions-duration"),
    ).toBeVisible();
    await expect(
      page.getByTestId(`actions-run-${RUN.id}`).getByTestId("actions-duration"),
    ).toContainText(/\d/);
  });

  test("os filtros de estado e de workflow chegam ao servidor", async ({
    page,
  }) => {
    const recorded = await mockGithub(page);
    await openGitTab(page, "actions");
    await expect(page.getByTestId(`actions-run-${RUN.id}`)).toBeVisible();
    const last = () => runsRequests(recorded).at(-1)!.url.searchParams;

    await page.getByTestId("actions-status").selectOption("failure");
    await expect.poll(() => last().get("status")).toBe("failure");

    const workflow = workflowsFixture.workflows[0]!.name;
    await page.getByTestId("actions-workflow").selectOption(workflow);
    await expect.poll(() => last().get("workflow")).toBe(workflow);
  });

  test("buscar por título filtra a lista sem nova requisição", async ({
    page,
  }) => {
    const recorded = await mockGithub(page);
    await openGitTab(page, "actions");
    await expect(page.getByTestId(`actions-run-${RUN.id}`)).toBeVisible();
    const before = runsRequests(recorded).length;

    await page.getByTestId("github-filter").fill("zzz-nada-assim");

    await expect(page.getByTestId("actions-no-match")).toBeVisible();
    await expect(page.getByTestId(`actions-run-${RUN.id}`)).toHaveCount(0);
    expect(runsRequests(recorded).length).toBe(before);
  });

  test("clicar num run real abre o document com os jobs; os que passaram ficam recolhidos", async ({
    page,
  }) => {
    await mockGithub(page);
    await openGitTab(page, "actions");

    await page.getByTestId(`actions-run-${RUN.id}`).click();

    const detail = page.getByTestId("github-run-detail");
    await expect(detail).toBeVisible();
    await expect(detail).toContainText(RUN.title);
    await expect(detail).toContainText(RUN.workflow);
    await expect(
      page.getByTestId(`actions-job-${PASSING_JOB.id}`),
    ).toBeVisible();
    await expect(
      page.getByTestId(`actions-step-${PASSING_JOB.id}-1`),
    ).toHaveCount(0);
  });

  test("um job que falhou abre sozinho e mostra o passo que falhou", async ({
    page,
  }) => {
    await mockGithub(page, { failJob: true });
    await openGitTab(page, "actions");

    await page.getByTestId(`actions-run-${RUN.id}`).click();

    await expect(
      page.getByTestId(`actions-step-${JOB_TO_FAIL.id}-1`),
    ).toBeVisible();
    await expect(
      page.getByTestId(`actions-step-${PASSING_JOB.id}-1`),
    ).toHaveCount(0);
  });

  test("os passos levam ao passo no GitHub", async ({ page }) => {
    await mockGithub(page, { failJob: true });
    await openGitTab(page, "actions");
    await page.getByTestId(`actions-run-${RUN.id}`).click();

    const step = page.getByTestId(`actions-step-${JOB_TO_FAIL.id}-1`);

    await expect(step).toHaveAttribute("href", `${JOB_TO_FAIL.url}#step:1:1`);
    await expect(step).toHaveAttribute("target", "_blank");
  });

  test("o log de um job só é pedido quando o usuário clica em mostrar", async ({
    page,
  }) => {
    const recorded = await mockGithub(page, { failJob: true });
    await openGitTab(page, "actions");
    await page.getByTestId(`actions-run-${RUN.id}`).click();
    await expect(page.getByTestId("github-run-detail")).toBeVisible();

    expect(recorded.some((r) => r.url.pathname.endsWith("/log"))).toBe(false);

    await page.getByTestId(`actions-log-toggle-${JOB_TO_FAIL.id}`).click();

    await expect(page.getByTestId("actions-job-log")).toContainText(
      jobLogFixture.log.split("\n")[1]!.slice(0, 20),
    );
    expect(
      recorded.some((r) =>
        r.url.pathname.endsWith(`/jobs/${JOB_TO_FAIL.id}/log`),
      ),
    ).toBe(true);
  });

  test("gh indisponível mostra o estado de configuração, nunca uma lista vazia", async ({
    page,
  }) => {
    await mockGithub(page, { unavailable: true });
    await openGitTab(page, "actions");

    await expect(page.getByTestId("actions-unavailable")).toBeVisible();
    await expect(page.getByTestId("actions-empty")).toHaveCount(0);
  });

  test("PRs: clicar abre o document real, com as abas Conversa, Commits e Arquivos", async ({
    page,
  }) => {
    await mockGithub(page);
    await openGitTab(page, "prs");

    await page.getByTestId(`github-open-${PULL.number}`).click();

    await expect(page.getByTestId("github-pull-detail")).toBeVisible();
    await expect(page.getByTestId("github-body")).toContainText(
      pullDetailFixture.pull.body.slice(0, 20),
    );
    await page.getByTestId("github-tab-files").click();
    await expect(page.getByTestId("github-file").first()).toContainText(
      pullDetailFixture.pull.files[0]!.path,
    );
  });

  test("Issues: clicar abre o document real, com corpo e barra de metadados", async ({
    page,
  }) => {
    await mockGithub(page);
    await openGitTab(page, "issues");

    await page.getByTestId(`github-open-${ISSUE.number}`).click();

    await expect(page.getByTestId("github-issue-detail")).toBeVisible();
    await expect(page.getByTestId("github-body")).toContainText(
      issueDetailFixture.issue.body.slice(0, 20),
    );
    await expect(page.getByTestId("github-issue-sidebar")).toContainText(
      issueDetailFixture.issue.labels[0]!,
    );
  });

  test("abrir o mesmo run duas vezes não duplica o document", async ({
    page,
  }) => {
    await mockGithub(page);
    await openGitTab(page, "actions");

    await page.getByTestId(`actions-run-${RUN.id}`).click();
    await expect(page.getByTestId("github-run-detail")).toBeVisible();
    await page.keyboard.press("Escape").catch(() => {});
    await page.getByTestId(`actions-run-${RUN.id}`).click();

    await expect(page.getByTestId("github-run-detail")).toHaveCount(1);
  });

  test("somente leitura: nenhuma requisição de escrita e nenhum botão de re-run, cancelar ou comentar", async ({
    page,
  }) => {
    const recorded = await mockGithub(page, { failJob: true });
    await openGitTab(page, "actions");
    await page.getByTestId(`actions-run-${RUN.id}`).click();
    await expect(page.getByTestId("github-run-detail")).toBeVisible();
    await page.getByTestId(`actions-log-toggle-${JOB_TO_FAIL.id}`).click();
    await expect(page.getByTestId("actions-job-log")).toBeVisible();

    expect(recorded.length).toBeGreaterThan(0);
    expect(recorded.filter((r) => r.method !== "GET")).toEqual([]);

    const buttons = await page
      .getByRole("button")
      .evaluateAll((nodes) =>
        nodes.map(
          (node) => node.getAttribute("aria-label") ?? node.textContent ?? "",
        ),
      );
    expect(buttons.join(" | ")).not.toMatch(
      /re-?run|cancel|dispatch|run workflow|comment/i,
    );
  });
});
