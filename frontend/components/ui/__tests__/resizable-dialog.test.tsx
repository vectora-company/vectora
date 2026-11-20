// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { ResizableDialogContent } from "../resizable-dialog";
import { useDialogSizeStore } from "@/lib/stores/dialog-size-store";

vi.mock("@/lib/paraglide/messages", () => ({
  m: {
    dialog_close: () => "Fechar",
    dialog_resize: () => "Redimensionar diálogo",
  },
}));

function renderDialog(
  storageKey?: string,
  maxWidth?: number,
  maxHeight?: number,
) {
  return render(
    <Dialog open>
      <ResizableDialogContent
        storageKey={storageKey}
        defaultWidth={500}
        defaultHeight={400}
        minWidth={300}
        minHeight={200}
        maxWidth={maxWidth}
        maxHeight={maxHeight}
        aria-describedby={undefined}
      >
        <DialogTitle>Título</DialogTitle>
      </ResizableDialogContent>
    </Dialog>,
  );
}

const content = () => screen.getByRole("dialog");

/** Arrasta a alça: jsdom não implementa pointer capture. */
function drag(dx: number, dy: number) {
  const handle = screen.getByRole("separator", {
    name: "Redimensionar diálogo",
  });
  Object.assign(handle, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  });
  fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.pointerMove(handle, {
    clientX: 100 + dx,
    clientY: 100 + dy,
    pointerId: 1,
  });
  fireEvent.pointerUp(handle, { pointerId: 1 });
}

/** Arrasta uma alça pelo data-testid, com coordenadas reais. */
function dragHandle(
  dir: string,
  from: [number, number],
  to: [number, number],
  release = true,
) {
  const handle = screen.getByTestId(`dialog-resize-${dir}`);
  Object.assign(handle, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  });
  fireEvent.pointerDown(handle, {
    clientX: from[0],
    clientY: from[1],
    pointerId: 1,
  });
  fireEvent.pointerMove(handle, {
    clientX: to[0],
    clientY: to[1],
    pointerId: 1,
  });
  if (release) fireEvent.pointerUp(handle, { pointerId: 1 });
}

beforeEach(() => {
  useDialogSizeStore.setState({ sizes: {} });
  window.localStorage.clear();
});
afterEach(cleanup);

describe("ResizableDialogContent", () => {
  it("abre no tamanho padrão", () => {
    renderDialog();

    expect(content().style.width).toBe("500px");
    expect(content().style.height).toBe("400px");
  });

  it("arrastar a alça muda o tamanho", () => {
    renderDialog();

    drag(120, 80);

    expect(content().style.width).toBe("620px");
    expect(content().style.height).toBe("480px");
  });

  it("nunca encolhe abaixo do mínimo", () => {
    renderDialog();

    drag(-1000, -1000);

    expect(content().style.width).toBe("300px");
    expect(content().style.height).toBe("200px");
  });

  it("não cresce além dos limites configurados", () => {
    renderDialog(undefined, 640, 480);
    drag(500, 500);
    expect(content().style.width).toBe("640px");
    expect(content().style.height).toBe("480px");
  });

  it("com storageKey o tamanho fica salvo e volta na próxima abertura", () => {
    const first = renderDialog("meu-dialogo");
    drag(100, 50);
    expect(useDialogSizeStore.getState().sizes["meu-dialogo"]).toEqual({
      w: 600,
      h: 450,
    });
    first.unmount();

    renderDialog("meu-dialogo");

    expect(content().style.width).toBe("600px");
    expect(content().style.height).toBe("450px");
  });

  it("sem storageKey nada é salvo", () => {
    renderDialog();
    drag(100, 50);

    expect(useDialogSizeStore.getState().sizes).toEqual({});
  });

  it("chaves diferentes guardam tamanhos independentes", () => {
    const a = renderDialog("a");
    drag(100, 0);
    a.unmount();
    const b = renderDialog("b");

    expect(content().style.width).toBe("500px");
    b.unmount();
    expect(useDialogSizeStore.getState().sizes.a?.w).toBe(600);
  });

  it("o botão de fechar tem nome acessível traduzido", () => {
    renderDialog();

    expect(screen.getByText("Fechar").closest("button")).toBeTruthy();
  });

  it("é ancorado no canto: arrastar a borda de baixo muda só a altura", () => {
    renderDialog();
    const before = { left: content().style.left, top: content().style.top };

    dragHandle("s", [0, 0], [0, 60]);

    expect(content().style.height).toBe("460px");
    expect(content().style.width).toBe("500px");
    expect(content().style.left).toBe(before.left);
    expect(content().style.top).toBe(before.top);
  });

  it("arrastar o canto superior esquerdo move a origem e mantém o canto oposto", () => {
    renderDialog();
    const left = parseFloat(content().style.left);
    const top = parseFloat(content().style.top);

    dragHandle("nw", [0, 0], [-40, -30]);

    expect(content().style.left).toBe(`${left - 40}px`);
    expect(content().style.top).toBe(`${top - 30}px`);
    expect(content().style.width).toBe("540px");
    expect(content().style.height).toBe("430px");
  });

  it("não passa dos limites da janela do app", () => {
    renderDialog();

    drag(9999, 9999);

    expect(parseFloat(content().style.width)).toBeLessThanOrEqual(
      window.innerWidth,
    );
    expect(parseFloat(content().style.height)).toBeLessThanOrEqual(
      window.innerHeight,
    );
  });

  it("um escudo cobre o conteúdo só durante o gesto", () => {
    renderDialog();
    expect(screen.queryByTestId("dialog-gesture-shield")).toBeNull();

    dragHandle("e", [0, 0], [10, 0], false);
    expect(screen.getByTestId("dialog-gesture-shield")).toBeTruthy();

    fireEvent.pointerUp(screen.getByTestId("dialog-resize-e"), {
      pointerId: 1,
    });
    expect(screen.queryByTestId("dialog-gesture-shield")).toBeNull();
  });
});
