import { describe, expect, it, vi } from "vitest";

import type { CenterCanvasTab } from "@/components/layout/center-canvas";
import { buildCanvasTabMenu } from "../canvas-tab-menu";

function tab(
  id: string,
  document?: CenterCanvasTab["document"],
): CenterCanvasTab {
  return { id, label: id, content: null, document };
}

const file = (id: string, path: string, workspaceId: string | null = "ws") =>
  tab(id, { id, kind: "file", workspaceId, title: id, path });

function actions() {
  return { close: vi.fn(), openInWindow: vi.fn(), copyText: vi.fn() };
}

const labels = (items: { label: string }[]) => items.map((item) => item.label);

describe("buildCanvasTabMenu", () => {
  it("com uma aba só oferece apenas fechar", () => {
    const tabs = [tab("a")];
    expect(labels(buildCanvasTabMenu(tabs[0]!, tabs, 0, actions()))).toEqual([
      expect.stringMatching(/fechar|close/i),
    ]);
  });

  it("na aba do meio oferece fechar, as outras, as da direita e todas", () => {
    const tabs = [tab("a"), tab("b"), tab("c")];
    expect(buildCanvasTabMenu(tabs[1]!, tabs, 1, actions())).toHaveLength(4);
  });

  it("na última aba não oferece fechar as da direita", () => {
    const tabs = [tab("a"), tab("b")];
    expect(buildCanvasTabMenu(tabs[1]!, tabs, 1, actions())).toHaveLength(3);
  });

  it("fechar as outras fecha todas menos a clicada", () => {
    const a = actions();
    const tabs = [tab("a"), tab("b"), tab("c")];

    buildCanvasTabMenu(tabs[1]!, tabs, 1, a)[1]?.onSelect();

    expect(a.close.mock.calls.map(([id]) => id)).toEqual(["a", "c"]);
  });

  it("fechar as da direita fecha só as seguintes", () => {
    const a = actions();
    const tabs = [tab("a"), tab("b"), tab("c"), tab("d")];

    buildCanvasTabMenu(tabs[1]!, tabs, 1, a)[2]?.onSelect();

    expect(a.close.mock.calls.map(([id]) => id)).toEqual(["c", "d"]);
  });

  it("fechar todas fecha todas", () => {
    const a = actions();
    const tabs = [tab("a"), tab("b")];

    const items = buildCanvasTabMenu(tabs[0]!, tabs, 0, a);
    items[items.length - 1]?.onSelect();

    expect(a.close).toHaveBeenCalledTimes(2);
  });

  it("arquivo oferece copiar o caminho e abrir em janela flutuante", () => {
    const a = actions();
    const tabs = [file("f", "src/a.py")];
    const items = buildCanvasTabMenu(tabs[0]!, tabs, 0, a);

    expect(items).toHaveLength(3);
    items[1]?.onSelect();
    expect(a.copyText).toHaveBeenCalledWith("src/a.py");
    items[2]?.onSelect();
    expect(a.openInWindow).toHaveBeenCalledWith("ws", "src/a.py");
    expect(a.close).toHaveBeenCalledWith("f");
  });

  it("documento que não é arquivo não oferece caminho nem janela", () => {
    const tabs = [
      tab("diff", {
        id: "diff",
        kind: "file-diff",
        workspaceId: "ws",
        title: "d",
      }),
    ];
    expect(buildCanvasTabMenu(tabs[0]!, tabs, 0, actions())).toHaveLength(1);
  });

  it("arquivo sem workspace não oferece abrir em janela", () => {
    const tabs = [file("f", "a.py", null)];
    expect(buildCanvasTabMenu(tabs[0]!, tabs, 0, actions())).toHaveLength(2);
  });
});
