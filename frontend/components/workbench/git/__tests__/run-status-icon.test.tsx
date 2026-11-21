// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { RunStatusIcon, runStatusLabel } from "../run-status-icon";
import type { RunStatusKind } from "@/lib/github/run-status";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

afterEach(cleanup);

/** As classes do ícone renderizado para um estado, desmontando em seguida. */
function cls(status: string, conclusion: string): string {
  const { unmount } = render(
    <RunStatusIcon status={status} conclusion={conclusion} />,
  );
  const value = screen.getByRole("img").getAttribute("class") ?? "";
  unmount();
  return value;
}

const KINDS: RunStatusKind[] = [
  "queued",
  "running",
  "success",
  "failure",
  "cancelled",
  "skipped",
  "neutral",
];

describe("runStatusLabel", () => {
  it.each(KINDS)("%s tem um texto próprio, vindo das mensagens", (kind) => {
    expect(runStatusLabel(kind)).toBe(`workbench_actions_state_${kind}`);
  });

  it("os sete estados têm textos diferentes entre si", () => {
    expect(new Set(KINDS.map(runStatusLabel)).size).toBe(KINDS.length);
  });
});

describe("RunStatusIcon", () => {
  it.each([
    ["queued", "", "queued"],
    ["in_progress", "", "running"],
    ["completed", "success", "success"],
    ["completed", "failure", "failure"],
    ["completed", "timed_out", "failure"],
    ["completed", "startup_failure", "failure"],
    ["completed", "cancelled", "cancelled"],
    ["completed", "skipped", "skipped"],
    ["completed", "", "neutral"],
  ])(
    "status %s + conclusão '%s' vira o estado %s",
    (status, conclusion, kind) => {
      render(<RunStatusIcon status={status} conclusion={conclusion} />);

      expect(screen.getByRole("img").getAttribute("data-status-kind")).toBe(
        kind,
      );
    },
  );

  it("tem nome acessível com o estado, para leitor de tela", () => {
    render(<RunStatusIcon status="completed" conclusion="failure" />);

    expect(
      screen.getByRole("img", { name: "workbench_actions_state_failure" }),
    ).toBeTruthy();
  });

  it("só o estado em execução gira", () => {
    const { rerender } = render(
      <RunStatusIcon status="in_progress" conclusion="" />,
    );
    expect(screen.getByRole("img").getAttribute("class")).toContain(
      "animate-spin",
    );

    rerender(<RunStatusIcon status="completed" conclusion="success" />);
    expect(screen.getByRole("img").getAttribute("class")).not.toContain(
      "animate-spin",
    );
  });

  it("usa cores do tema por estado (falha destrutiva, sucesso verde, neutro apagado)", () => {
    expect(cls("completed", "failure")).toContain("text-destructive");
    expect(cls("completed", "success")).toContain("text-emerald");
    expect(cls("completed", "cancelled")).toContain("text-muted-foreground");
    expect(cls("queued", "")).toContain("text-amber");
  });

  it("aceita uma classe extra sem perder o tamanho e a cor base", () => {
    render(
      <RunStatusIcon
        status="completed"
        conclusion="success"
        className="mt-0.5"
      />,
    );

    const value = screen.getByRole("img").getAttribute("class") ?? "";
    expect(value).toContain("mt-0.5");
    expect(value).toContain("shrink-0");
    expect(value).toContain("text-emerald");
  });

  it("estado desconhecido não quebra: cai no neutro", () => {
    render(<RunStatusIcon status="algo_novo" conclusion="algo_novo" />);

    expect(screen.getByRole("img").getAttribute("data-status-kind")).toBe(
      "neutral",
    );
  });
});
