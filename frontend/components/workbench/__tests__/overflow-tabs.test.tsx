// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { OverflowTabs } from "../overflow-tabs";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const tabs = [
  { id: "changes", label: "Mudanças", badge: 4 },
  { id: "history", label: "Histórico" },
  { id: "prs", label: "PRs" },
  { id: "issues", label: "Issues" },
  { id: "compare", label: "Comparação" },
];

/** jsdom não faz layout: simula larguras por aba e a do contêiner. */
function stubLayout(containerWidth: number, tabWidth = 80, moreWidth = 40) {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(
    function (this: HTMLElement) {
      return this.hasAttribute("data-more") ? moreWidth : tabWidth;
    },
  );
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(
    containerWidth,
  );
}

const hidden = (id: string) =>
  screen.getByTestId(`tab-${id}`).getAttribute("aria-hidden") === "true";

describe("OverflowTabs", () => {
  it("mostra todas as abas e nenhum menu Mais quando cabem", () => {
    stubLayout(1000);
    render(
      <OverflowTabs
        tabs={tabs}
        activeId="changes"
        onSelect={vi.fn()}
        ariaLabel="x"
      />,
    );

    for (const tab of tabs) expect(hidden(tab.id)).toBe(false);
    expect(screen.getByTestId("tabs-more").getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("manda as últimas para o menu Mais quando não cabem", () => {
    stubLayout(250); // 250 - 40 = 210 => 2 abas de 80 cabem
    render(
      <OverflowTabs
        tabs={tabs}
        activeId="changes"
        onSelect={vi.fn()}
        ariaLabel="x"
      />,
    );

    expect(hidden("changes")).toBe(false);
    expect(hidden("history")).toBe(false);
    expect(hidden("prs")).toBe(true);
    expect(hidden("compare")).toBe(true);
    expect(
      screen.getByTestId("tabs-more").getAttribute("aria-hidden"),
    ).toBeNull();
  });

  it("a aba ativa nunca fica escondida", () => {
    stubLayout(250);
    render(
      <OverflowTabs
        tabs={tabs}
        activeId="compare"
        onSelect={vi.fn()}
        ariaLabel="x"
      />,
    );

    expect(hidden("compare")).toBe(false);
  });

  it("escolher no menu Mais seleciona a aba", async () => {
    stubLayout(250);
    const onSelect = vi.fn();
    render(
      <OverflowTabs
        tabs={tabs}
        activeId="changes"
        onSelect={onSelect}
        ariaLabel="x"
      />,
    );

    fireEvent.keyDown(screen.getByTestId("tabs-more"), { key: "Enter" });
    fireEvent.click(await screen.findByTestId("more-tab-issues"));

    expect(onSelect).toHaveBeenCalledWith("issues");
  });

  it("mostra a contagem ao lado da aba e a esconde quando é zero", () => {
    stubLayout(1000);
    const { rerender } = render(
      <OverflowTabs
        tabs={tabs}
        activeId="changes"
        onSelect={vi.fn()}
        ariaLabel="x"
      />,
    );
    expect(screen.getByTestId("tab-badge-changes").textContent).toBe("4");

    rerender(
      <OverflowTabs
        tabs={[{ ...tabs[0]!, badge: 0 }, ...tabs.slice(1)]}
        activeId="changes"
        onSelect={vi.fn()}
        ariaLabel="x"
      />,
    );
    expect(screen.queryByTestId("tab-badge-changes")).toBeNull();
  });

  it("clicar numa aba visível a seleciona", () => {
    stubLayout(1000);
    const onSelect = vi.fn();
    render(
      <OverflowTabs
        tabs={tabs}
        activeId="changes"
        onSelect={onSelect}
        ariaLabel="x"
      />,
    );

    fireEvent.click(screen.getByTestId("tab-prs"));

    expect(onSelect).toHaveBeenCalledWith("prs");
  });

  it("marca a aba ativa para leitores de tela", () => {
    stubLayout(1000);
    render(
      <OverflowTabs
        tabs={tabs}
        activeId="prs"
        onSelect={vi.fn()}
        ariaLabel="x"
      />,
    );

    expect(screen.getByTestId("tab-prs").getAttribute("aria-selected")).toBe(
      "true",
    );
    expect(
      screen.getByTestId("tab-history").getAttribute("aria-selected"),
    ).toBe("false");
  });
});
