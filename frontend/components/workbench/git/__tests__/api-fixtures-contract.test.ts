/**
 * Contrato entre o backend e o frontend, medido com saídas REAIS do `gh`.
 *
 * As fixtures em `e2e/fixtures/github` são o que o backend responde a partir de
 * saídas reais do `gh` (o teste do backend garante que elas não desviam). Aqui
 * cada uma é atribuída ao tipo que a tela usa: se o backend mudar um campo, o
 * `tsc` reprova a atribuição; se faltar um campo em tempo de execução, o teste
 * reprova. Assim a simulação do frontend nunca "inventa" um formato.
 */
import { describe, expect, it } from "vitest";

import issueDetailFixture from "../../../../e2e/fixtures/github/issue-detail.json";
import issuesFixture from "../../../../e2e/fixtures/github/issues.json";
import jobLogFixture from "../../../../e2e/fixtures/github/job-log.json";
import pullDetailFixture from "../../../../e2e/fixtures/github/pull-detail.json";
import pullsFixture from "../../../../e2e/fixtures/github/pulls.json";
import runDetailFixture from "../../../../e2e/fixtures/github/run-detail.json";
import runsFixture from "../../../../e2e/fixtures/github/runs.json";
import workflowsFixture from "../../../../e2e/fixtures/github/workflows.json";

import type { RunSummaryData } from "../actions-view";
import type { IssueDetailData, PullDetailData } from "../github-detail";
import type { GithubIssue, GithubPull } from "../github-view";
import type { RunDetailData } from "../run-detail";

// Atribuições tipadas: o `tsc` falha se a forma do backend e a do frontend divergirem.
const runs: RunSummaryData[] = runsFixture.runs;
const runDetail: RunDetailData = runDetailFixture.run;
const pulls: GithubPull[] = pullsFixture.items;
const pullDetail: PullDetailData = pullDetailFixture.pull;
const issues: GithubIssue[] = issuesFixture.items;
const issueDetail: IssueDetailData = issueDetailFixture.issue;

const ENVELOPES = [
  ["runs", runsFixture],
  ["run-detail", runDetailFixture],
  ["workflows", workflowsFixture],
  ["job-log", jobLogFixture],
  ["pulls", pullsFixture],
  ["pull-detail", pullDetailFixture],
  ["issues", issuesFixture],
  ["issue-detail", issueDetailFixture],
] as const;

describe("fixtures reais ↔ tipos do frontend", () => {
  it.each(ENVELOPES)("%s mantém o envelope esperado", (_name, fixture) => {
    if ("state" in fixture) {
      expect(fixture.state).toBe("loaded");
      expect(fixture.error).toBeNull();
    } else {
      expect(fixture.status).toBe("ok");
      expect(fixture.message).toBe("");
    }
  });

  it("a lista de runs traz os campos que a linha usa, com os tipos certos", () => {
    expect(runs.length).toBeGreaterThan(1);
    for (const run of runs) {
      expect(typeof run.id).toBe("number");
      expect(typeof run.number).toBe("number");
      for (const key of [
        "title",
        "workflow",
        "status",
        "event",
        "branch",
      ] as const)
        expect(typeof run[key]).toBe("string");
      expect(run.attempt).toBeGreaterThanOrEqual(1);
    }
  });

  it("há um run concluído e um em andamento, com conclusão vazia (casos reais)", () => {
    const active = runs.find((run) => run.status === "in_progress");
    expect(active?.conclusion).toBe("");
    expect(runs.some((run) => run.status === "completed")).toBe(true);
  });

  it("o detalhe do run está na lista, e seus jobs e passos têm o formato usado", () => {
    expect(runs.some((run) => run.id === runDetail.id)).toBe(true);
    expect(runDetail.jobs.length).toBeGreaterThan(0);
    for (const job of runDetail.jobs) {
      expect(typeof job.id).toBe("number");
      expect(typeof job.url).toBe("string");
      for (const step of job.steps) {
        expect(typeof step.number).toBe("number");
        expect(typeof step.name).toBe("string");
      }
    }
  });

  it("há jobs pulados sem passos e jobs com passos (os dois casos reais)", () => {
    const skipped = runDetail.jobs.filter(
      (job) => job.conclusion === "skipped",
    );
    expect(skipped.length).toBeGreaterThan(0);
    expect(skipped.every((job) => job.steps.length === 0)).toBe(true);
    expect(runDetail.jobs.some((job) => job.steps.length > 0)).toBe(true);
  });

  it("o PR e a issue têm autor, rótulos e comentários no formato usado", () => {
    expect(pulls[0]!.number).toBe(pullDetail.number);
    expect(pullDetail.commits[0]!.sha).toMatch(/^[0-9a-f]{7,40}$/);
    expect(pullDetail.files[0]!.path).toBeTruthy();
    expect(pullDetail.comments[0]!.author).toBeTruthy();
    expect(issues[0]!.number).toBe(issueDetail.number);
    expect(issueDetail.labels.length).toBeGreaterThan(0);
  });

  it("o log traz o texto e o aviso de truncamento", () => {
    expect(typeof jobLogFixture.log).toBe("string");
    expect(jobLogFixture.log.length).toBeGreaterThan(0);
    expect(jobLogFixture.truncated).toBe(false);
  });

  it("os workflows têm id numérico e nome", () => {
    expect(workflowsFixture.workflows.length).toBeGreaterThan(0);
    for (const workflow of workflowsFixture.workflows) {
      expect(typeof workflow.id).toBe("number");
      expect(workflow.name).toBeTruthy();
    }
  });

  it("nenhuma fixture guarda e-mail de pessoa", () => {
    const text = JSON.stringify(ENVELOPES.map(([, fixture]) => fixture));
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  });
});
