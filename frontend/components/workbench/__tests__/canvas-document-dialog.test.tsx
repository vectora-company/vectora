// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CanvasDocumentDialog } from "../canvas-document-dialog";
import { useDialogSizeStore } from "@/lib/stores/dialog-size-store";

vi.mock("@/lib/paraglide/messages", () => ({
  m: {
    dialog_close: () => "Fechar",
    dialog_resize: () => "Redimensionar diálogo",
    window_minimize: () => "Minimizar",
    window_maximize: () => "Maximizar",
    window_restore: () => "Restaurar",
    window_close: () => "Fechar janela",
  },
}));

describe("CanvasDocumentDialog", () => {
  beforeEach(() => {
    useDialogSizeStore.setState({ sizes: {} });
    window.localStorage.clear();
  });
  afterEach(cleanup);

  it("permite redimensionar e persiste o tamanho do documento", () => {
    // O diálogo nunca passa da janela do app; o jsdom tem só 1024x768.
    vi.stubGlobal("innerWidth", 1920);
    vi.stubGlobal("innerHeight", 1080);
    render(
      <CanvasDocumentDialog open onOpenChange={vi.fn()} title="AGENTS.md">
        Conteúdo
      </CanvasDocumentDialog>,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog.style.width).toBe("1248px");
    expect(dialog.style.height).toBe("832px");

    const handle = screen.getByRole("separator", {
      name: "Redimensionar diálogo",
    });
    Object.assign(handle, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    });
    fireEvent.pointerDown(handle, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 150, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(dialog.style.width).toBe("1348px");
    expect(dialog.style.height).toBe("882px");
    expect(useDialogSizeStore.getState().sizes["canvas-document"]).toEqual({
      w: 1348,
      h: 882,
    });
  });

  it("minimizar esconde a janela, mantém o conteúdo e o botão restaura", () => {
    const onOpenChange = vi.fn();
    render(
      <CanvasDocumentDialog open onOpenChange={onOpenChange} title="AGENTS.md">
        <span>editor vivo</span>
      </CanvasDocumentDialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: /minimiz/i }));

    expect(screen.getByTestId("minimized-document")).toBeTruthy();
    expect(screen.getByText("editor vivo")).toBeTruthy();
    expect(onOpenChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /restaur/i }));
    expect(screen.queryByTestId("minimized-document")).toBeNull();
  });
});
