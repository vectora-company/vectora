import { describe, expect, it } from "vitest";

import { isFailureConclusion, isRunActive, runStatusKind } from "../run-status";

describe("isRunActive", () => {
  it.each(["queued", "in_progress", "waiting", "requested", "pending"])(
    "%s está ativo",
    (status) => expect(isRunActive(status)).toBe(true),
  );

  it.each(["completed", "", "desconhecido"])("%s não está ativo", (status) =>
    expect(isRunActive(status)).toBe(false),
  );
});

describe("isFailureConclusion", () => {
  it.each(["failure", "timed_out", "startup_failure"])("%s é falha", (c) =>
    expect(isFailureConclusion(c)).toBe(true),
  );

  it.each([
    "success",
    "cancelled",
    "skipped",
    "neutral",
    "",
    "action_required",
  ])("%s não é falha", (c) => expect(isFailureConclusion(c)).toBe(false));
});

describe("runStatusKind", () => {
  it("em execução e na fila vêm do status, mesmo sem conclusão", () => {
    expect(runStatusKind("in_progress", "")).toBe("running");
    for (const status of ["queued", "waiting", "requested", "pending"])
      expect(runStatusKind(status, "")).toBe("queued");
  });

  it("concluído vem da conclusão", () => {
    expect(runStatusKind("completed", "success")).toBe("success");
    expect(runStatusKind("completed", "failure")).toBe("failure");
    expect(runStatusKind("completed", "timed_out")).toBe("failure");
    expect(runStatusKind("completed", "startup_failure")).toBe("failure");
    expect(runStatusKind("completed", "cancelled")).toBe("cancelled");
    expect(runStatusKind("completed", "skipped")).toBe("skipped");
  });

  it("conclusão desconhecida ou ausente é neutra", () => {
    expect(runStatusKind("completed", "")).toBe("neutral");
    expect(runStatusKind("completed", "action_required")).toBe("neutral");
    expect(runStatusKind("completed", "neutral")).toBe("neutral");
  });

  it("o status ativo vence uma conclusão antiga (re-tentativa em andamento)", () => {
    expect(runStatusKind("in_progress", "failure")).toBe("running");
  });
});
