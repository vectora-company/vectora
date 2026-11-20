// @vitest-environment jsdom
/**
 * MemoriesPanel no layout denso da workbench: ações numa linha abaixo do
 * resumo, botões na variação menor do tema, e skills/fatos aprendidos na mesma
 * lista das memórias (sem seção à parte nem itens repetidos).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

const MEMORIES = [
  {
    key: "main_project_outside_vectora",
    content: "O projeto principal é o AbilitySystem.",
    metadata: {},
    updated_at: "2026-11-19T00:00:00Z",
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({ memories: MEMORIES, total: MEMORIES.length }),
        ),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy(
    {},
    {
      get:
        (_t, prop) =>
        (..._a: unknown[]) =>
          String(prop),
    },
  ),
}));
vi.mock("@/lib/i18n-dyn", () => ({
  mDyn: (_key: string, params: { n: number }) => `${params.n} memória(s)`,
}));

async function renderPanel(
  props: Parameters<typeof import("../memories-panel").MemoriesPanel>[0] = {},
) {
  const { MemoriesPanel } = await import("../memories-panel");
  await act(async () => {
    render(<MemoriesPanel {...props} />);
  });
  await screen.findByText("main_project_outside_vectora");
}

describe("MemoriesPanel — layout compacto", () => {
  it("os botões de adicionar e limpar ficam juntos, na mesma linha, depois do texto", async () => {
    await renderPanel({ compact: true });

    const actions = screen.getByTestId("memory-actions");
    const summary = screen.getByText("memory_subtitle");

    expect(actions.querySelectorAll("button")).toHaveLength(2);
    expect(
      summary.compareDocumentPosition(actions) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // Mesma linha: um único contêiner flex com os dois botões.
    expect(actions.className).toContain("flex");
    expect(actions.className).toContain("gap-1.5");
  });

  it("usa a variação menor (xs) do tema nos botões de ação", async () => {
    await renderPanel({ compact: true });

    for (const button of screen
      .getByTestId("memory-actions")
      .querySelectorAll("button"))
      expect(button.className).toContain("h-6");
    expect(
      screen.getByRole("button", { name: /memory_edit/ }).className,
    ).toContain("h-6");
  });

  it("no layout padrão (configurações) os botões continuam no tamanho sm", async () => {
    await renderPanel({ compact: false });

    for (const button of screen
      .getByTestId("memory-actions")
      .querySelectorAll("button"))
      expect(button.className).toContain("h-8");
  });

  it("skills e fatos aprendidos aparecem na mesma lista das memórias", async () => {
    await renderPanel({
      compact: true,
      learned: {
        facts: [{ key: "gosto", content: "Prefere respostas curtas" }],
        skills: [{ id: "s1", name: "Revisar PR", description: "Revisa PRs" }],
      },
    });

    expect(
      screen.getByText("O projeto principal é o AbilitySystem."),
    ).toBeTruthy();
    expect(screen.getByText("Prefere respostas curtas")).toBeTruthy();
    expect(screen.getByText("Revisa PRs")).toBeTruthy();
  });

  it("um fato que já é memória não aparece duas vezes", async () => {
    await renderPanel({
      compact: true,
      learned: {
        facts: [
          {
            key: "main_project_outside_vectora",
            content: "O projeto principal é o AbilitySystem.",
          },
        ],
        skills: [],
      },
    });

    expect(
      screen.getAllByText("O projeto principal é o AbilitySystem."),
    ).toHaveLength(1);
  });

  it("sem memórias nem aprendizados mostra um único estado vazio", async () => {
    MEMORIES.length = 0;
    const { MemoriesPanel } = await import("../memories-panel");
    await act(async () => {
      render(<MemoriesPanel compact learned={{ facts: [], skills: [] }} />);
    });

    await waitFor(() =>
      expect(
        screen.getAllByText("workbench_memory_journey_empty"),
      ).toHaveLength(1),
    );
    expect(screen.queryByText("memory_empty_hint")).toBeNull();
    MEMORIES.push({
      key: "main_project_outside_vectora",
      content: "O projeto principal é o AbilitySystem.",
      metadata: {},
      updated_at: "2026-11-19T00:00:00Z",
    });
  });

  it("só mostra Limpar tudo quando há memória para limpar", async () => {
    MEMORIES.length = 0;
    const { MemoriesPanel } = await import("../memories-panel");
    await act(async () => {
      render(<MemoriesPanel compact />);
    });

    await waitFor(() =>
      expect(
        screen.getByTestId("memory-actions").querySelectorAll("button"),
      ).toHaveLength(1),
    );
    MEMORIES.push({
      key: "main_project_outside_vectora",
      content: "O projeto principal é o AbilitySystem.",
      metadata: {},
      updated_at: "2026-11-19T00:00:00Z",
    });
  });
});
