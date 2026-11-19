// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResizableDialogContent } from "../resizable-dialog";
import { useDialogSizeStore } from "@/lib/stores/dialog-size-store";

vi.mock("@/lib/paraglide/messages", () => ({
  m: {
    dialog_close: () => "Fechar",
    dialog_resize: () => "Redimensionar diálogo",
    window_minimize: () => "Minimizar",
    window_maximize: () => "Maximizar",
    window_restore: () => "Restaurar",
    window_layout: () => "Layout",
    window_layout_center: () => "Centralizar",
    window_layout_left: () => "Esquerda",
    window_layout_right: () => "Direita",
    window_layout_top: () => "Topo",
    window_layout_bottom: () => "Base",
    window_layout_top_left: () => "Topo esquerdo",
    window_layout_top_right: () => "Topo direito",
    window_layout_bottom_left: () => "Base esquerda",
    window_layout_bottom_right: () => "Base direita",
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

  it("arrastar o cabeçalho move a janela sem mudar o tamanho", () => {
    render(
      <Dialog open>
        <ResizableDialogContent
          defaultWidth={500}
          defaultHeight={400}
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>Título</DialogTitle>
          </DialogHeader>
        </ResizableDialogContent>
      </Dialog>,
    );
    const left = parseFloat(content().style.left);
    const top = parseFloat(content().style.top);
    const header = content().querySelector('[data-slot="dialog-header"]')!;
    Object.assign(header, {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    });

    fireEvent.pointerDown(header, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerMove(header, { clientX: 230, clientY: 215, pointerId: 1 });
    fireEvent.pointerUp(header, { pointerId: 1 });

    expect(content().style.left).toBe(`${left + 30}px`);
    expect(content().style.top).toBe(`${top + 15}px`);
    expect(content().style.width).toBe("500px");
  });

  it("maximizar ocupa a tela e restaurar devolve o tamanho", () => {
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Maximizar" }));
    expect(content().dataset.maximized).toBe("true");
    expect(content().style.width).toBe("100vw");
    expect(screen.queryByTestId("dialog-resize-se")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Restaurar" }));
    expect(content().style.width).toBe("500px");
    expect(screen.getByTestId("dialog-resize-se")).toBeTruthy();
  });

  it("minimizado, some mas continua montado e ignora o Esc", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <ResizableDialogContent
          minimized
          onMinimize={vi.fn()}
          aria-describedby={undefined}
        >
          <DialogTitle>Título</DialogTitle>
          <span>conteúdo vivo</span>
        </ResizableDialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("dialog", { hidden: true }).style.display).toBe(
      "none",
    );
    expect(screen.getByText("conteúdo vivo")).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("só mostra o botão de minimizar quando quem usa o pede", () => {
    renderDialog();
    expect(screen.queryByRole("button", { name: "Minimizar" })).toBeNull();
  });

  it("o menu de layout encaixa a janela na metade da direita e persiste o tamanho", () => {
    vi.stubGlobal("innerWidth", 1600);
    vi.stubGlobal("innerHeight", 900);
    renderDialog("layout-dialog", 2000, 2000);

    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByTestId("window-layout-right"));

    expect(content().style.left).toBe("800px");
    expect(content().style.top).toBe("0px");
    expect(content().style.width).toBe("800px");
    expect(content().style.height).toBe("900px");
    expect(useDialogSizeStore.getState().sizes["layout-dialog"]).toEqual({
      w: 800,
      h: 900,
    });
    vi.unstubAllGlobals();
  });

  it("centralizar mantém o tamanho e escolher um encaixe sai do modo maximizado", () => {
    vi.stubGlobal("innerWidth", 1600);
    vi.stubGlobal("innerHeight", 900);
    renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Maximizar" }));
    fireEvent.click(screen.getByRole("button", { name: "Layout" }));
    fireEvent.click(screen.getByTestId("window-layout-center"));

    expect(content().dataset.maximized).toBe("false");
    expect(content().style.width).toBe("500px");
    expect(content().style.left).toBe("550px");
    expect(content().style.top).toBe("250px");
    vi.unstubAllGlobals();
  });
});
