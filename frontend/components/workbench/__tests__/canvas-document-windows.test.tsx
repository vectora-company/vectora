// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { CanvasDocumentWindows } from "../canvas-document-windows";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

const doc = (id: string) => ({
  id,
  kind: "file" as const,
  workspaceId: "ws",
  title: `${id}.md`,
  path: `/p/${id}.md`,
});

afterEach(cleanup);

function renderWindows(activeId: string | null, minimizedIds: string[]) {
  return render(
    <CanvasDocumentWindows
      documents={[doc("a"), doc("b"), doc("c")]}
      activeId={activeId}
      minimizedIds={minimizedIds}
      onClose={vi.fn()}
      onMinimize={vi.fn()}
      renderDocument={(d) => <span data-testid={`body-${d.id}`}>{d.id}</span>}
    />,
  );
}

describe("CanvasDocumentWindows", () => {
  it("monta só a janela ativa quando nada está minimizado", () => {
    renderWindows("a", []);

    expect(screen.getByTestId("body-a")).toBeTruthy();
    expect(screen.queryByTestId("body-b")).toBeNull();
  });

  it("mantém montadas (e escondidas) as minimizadas, ao lado da ativa", () => {
    renderWindows("c", ["a", "b"]);

    for (const id of ["a", "b", "c"])
      expect(screen.getByTestId(`body-${id}`)).toBeTruthy();
    const hidden = screen
      .getAllByRole("dialog", { hidden: true })
      .map((dialog) => dialog.style.display);
    expect(hidden.filter((display) => display === "none")).toHaveLength(2);
  });

  it("sem ativa e sem minimizadas não há janela", () => {
    renderWindows(null, []);

    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
  });
});
