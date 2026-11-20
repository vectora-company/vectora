// @vitest-environment jsdom
/**
 * WindowDock — dock única das janelas de arquivo e dos documentos minimizados.
 * Usa a store real: o que importa é o caminho minimizar → dock → restaurar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

import { WindowDock } from "../window-dock";
import { useWindowsStore } from "@/lib/stores/windows-store";
import { useSettingsStore } from "@/lib/stores/settings-store";

const doc = (id: string, title: string) => ({
  id,
  kind: "file" as const,
  workspaceId: "ws",
  title,
  path: `/p/${title}`,
});

beforeEach(() => {
  useSettingsStore.setState({ uiMode: "assistant" });
  useWindowsStore.getState().closeAll();
});
afterEach(cleanup);

describe("WindowDock", () => {
  it("fica oculta sem nada minimizado, mesmo com janelas e documentos abertos", () => {
    useWindowsStore.getState().open("ws", "/p/a.ts");
    useWindowsStore.getState().openCanvasDocument(doc("d1", "README.md"));

    const { container } = render(<WindowDock />);

    expect(container).toBeEmptyDOMElement();
  });

  it("lista só as janelas de arquivo minimizadas", () => {
    useWindowsStore.getState().open("ws1", "/p/aberta.ts");
    useWindowsStore.getState().open("ws2", "/p/minimizada.ts");
    useWindowsStore.getState().minimize("ws2");

    render(<WindowDock />);

    expect(screen.getByText("minimizada.ts")).toBeTruthy();
    expect(screen.queryByText("aberta.ts")).toBeNull();
  });

  it("documento minimizado aparece na dock e clicar o restaura como ativo", () => {
    const { openCanvasDocument, minimizeCanvasDocument } =
      useWindowsStore.getState();
    openCanvasDocument(doc("d1", "README.md"));
    minimizeCanvasDocument("d1");

    render(<WindowDock />);
    fireEvent.click(screen.getByText("README.md"));

    const state = useWindowsStore.getState();
    expect(state.minimizedCanvasDocumentIds).toEqual([]);
    expect(state.activeCanvasDocumentId).toBe("d1");
    expect(screen.queryByTestId("window-dock")).toBeNull();
  });

  it("vários documentos minimizados convivem na mesma dock, em ordem", () => {
    const store = useWindowsStore.getState();
    store.openCanvasDocument(doc("d1", "um.md"));
    store.openCanvasDocument(doc("d2", "dois.md"));
    store.minimizeCanvasDocument("d1");
    store.minimizeCanvasDocument("d2");

    render(<WindowDock />);

    const labels = screen
      .getAllByTestId(/^dock-document-/)
      .map((item) => item.textContent);
    expect(labels).toEqual(["um.md", "dois.md"]);
  });

  it("o X da dock fecha o documento de vez", () => {
    const store = useWindowsStore.getState();
    store.openCanvasDocument(doc("d1", "README.md"));
    store.minimizeCanvasDocument("d1");

    render(<WindowDock />);
    fireEvent.click(screen.getByRole("button", { name: "window_close" }));

    expect(useWindowsStore.getState().canvasDocuments).toEqual([]);
    expect(useWindowsStore.getState().minimizedCanvasDocumentIds).toEqual([]);
  });

  it("fora do modo assistente os documentos não aparecem (não há janela para restaurar)", () => {
    useSettingsStore.setState({ uiMode: "ide" });
    const store = useWindowsStore.getState();
    store.openCanvasDocument(doc("d1", "README.md"));
    store.minimizeCanvasDocument("d1");

    const { container } = render(<WindowDock />);

    expect(container).toBeEmptyDOMElement();
  });
});
