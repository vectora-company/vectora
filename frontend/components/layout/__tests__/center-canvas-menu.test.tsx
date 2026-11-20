// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CenterCanvas } from "../center-canvas";

const tabs = [
  { id: "a", label: "A.md", content: <div>A</div> },
  { id: "b", label: "B.md", content: <div>B</div> },
];

afterEach(() => {
  (window as unknown as { vectora?: unknown }).vectora = undefined;
});

describe("CenterCanvas — clique direito numa aba", () => {
  it("sem getTabMenu o clique direito não abre menu algum", () => {
    render(<CenterCanvas tabs={tabs} activeTab="a" />);

    fireEvent.contextMenu(screen.getAllByRole("tab")[0]!);

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("no navegador abre o menu leve com os itens da aba", () => {
    const onSelect = vi.fn();
    render(
      <CenterCanvas
        tabs={tabs}
        activeTab="a"
        getTabMenu={() => [{ label: "Fechar", onSelect }]}
      />,
    );

    fireEvent.contextMenu(screen.getAllByRole("tab")[0]!);
    fireEvent.click(screen.getByRole("menuitem", { name: "Fechar" }));

    expect(onSelect).toHaveBeenCalledOnce();
  });

  it("no Electron usa o menu nativo e não desenha o leve", async () => {
    const popup = vi.fn().mockResolvedValue("0");
    (window as unknown as { vectora?: unknown }).vectora = {
      contextMenu: { popup },
    };
    const onSelect = vi.fn();
    render(
      <CenterCanvas
        tabs={tabs}
        activeTab="a"
        getTabMenu={() => [{ label: "Fechar", onSelect }]}
      />,
    );

    fireEvent.contextMenu(screen.getAllByRole("tab")[1]!);
    await vi.waitFor(() => expect(onSelect).toHaveBeenCalledOnce());

    expect(popup).toHaveBeenCalledWith([{ id: "0", label: "Fechar" }]);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("o menu recebe a aba, a lista e a posição da aba clicada", () => {
    const getTabMenu = vi.fn().mockReturnValue([]);
    render(<CenterCanvas tabs={tabs} activeTab="a" getTabMenu={getTabMenu} />);

    fireEvent.contextMenu(screen.getAllByRole("tab")[1]!);

    const [tab, all, index] = getTabMenu.mock.calls[0]!;
    expect(tab.id).toBe("b");
    expect(all).toHaveLength(2);
    expect(index).toBe(1);
  });
});
