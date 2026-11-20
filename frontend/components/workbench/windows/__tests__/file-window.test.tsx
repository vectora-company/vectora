// @vitest-environment jsdom
/**
 * FileWindow — janela flutuante com abas. Rnd é mockado como wrapper burro
 * (drag/resize são responsabilidade da lib, não deste componente) que expõe
 * onDragStop/onResizeStop/onMouseDown via botões de teste.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

const mockFocus = vi.fn();
const mockClose = vi.fn();
const mockCloseTab = vi.fn();
const mockMinimize = vi.fn();
const mockSetActiveTab = vi.fn();
const mockSetBounds = vi.fn();

const mockWindowsState = {
  focus: mockFocus,
  close: mockClose,
  closeTab: mockCloseTab,
  minimize: mockMinimize,
  setActiveTab: mockSetActiveTab,
  setBounds: mockSetBounds,
};

vi.mock("@/lib/stores/windows-store", () => ({
  useWindowsStore: (sel: (s: typeof mockWindowsState) => unknown) =>
    sel(mockWindowsState),
}));

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

vi.mock("@/components/workbench/file-editor", () => ({
  FileEditor: ({
    workspaceId,
    path,
  }: {
    workspaceId: string;
    path: string;
  }) => (
    <div
      data-testid="file-editor"
      data-workspace-id={workspaceId}
      data-path={path}
    />
  ),
}));

// jsdom não tem PointerEvent nem captura de ponteiro: o suficiente para
// exercitar os gestos de mover e redimensionar com coordenadas reais.
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}
Object.assign(window, { PointerEvent: TestPointerEvent });
Object.assign(HTMLElement.prototype, {
  setPointerCapture: () => {},
  releasePointerCapture: () => {},
});
vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
  cb(0);
  return 1;
});

import { FileWindow } from "../file-window";
import type { FileWindowState } from "@/lib/stores/windows-store";

function makeWin(overrides: Partial<FileWindowState> = {}): FileWindowState {
  return {
    id: "win1",
    workspaceId: "ws1",
    tabs: ["/project/src/main.ts"],
    activeTab: "/project/src/main.ts",
    title: "main.ts",
    x: 0,
    y: 0,
    w: 400,
    h: 300,
    minimized: false,
    zIndex: 1,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FileWindow", () => {
  it("renderiza o título da janela na barra de título", () => {
    render(<FileWindow win={makeWin({ title: "arquivo.py" })} />);
    expect(screen.getByText("arquivo.py")).toBeInTheDocument();
  });

  it("renderiza FileEditor com workspaceId e path da aba ativa", () => {
    render(
      <FileWindow
        win={makeWin({ workspaceId: "ws42", activeTab: "/a/b.ts" })}
      />,
    );
    const editor = screen.getByTestId("file-editor");
    expect(editor).toHaveAttribute("data-workspace-id", "ws42");
    expect(editor).toHaveAttribute("data-path", "/a/b.ts");
  });

  it("com uma única aba: barra de abas não aparece (só o X da janela existe)", () => {
    render(<FileWindow win={makeWin({ tabs: ["/a/b.ts"] })} />);
    expect(screen.getAllByLabelText("window_close")).toHaveLength(1);
  });

  it("com múltiplas abas: barra de abas mostra o basename de cada uma", () => {
    render(
      <FileWindow
        win={makeWin({
          tabs: ["/a/foo.ts", "/b/bar.tsx"],
          activeTab: "/a/foo.ts",
        })}
      />,
    );
    expect(screen.getByText("foo.ts")).toBeInTheDocument();
    expect(screen.getByText("bar.tsx")).toBeInTheDocument();
  });

  it("clicar numa aba inativa chama setActiveTab com o id e path corretos", () => {
    render(
      <FileWindow
        win={makeWin({
          id: "win7",
          tabs: ["/a/foo.ts", "/b/bar.tsx"],
          activeTab: "/a/foo.ts",
        })}
      />,
    );
    fireEvent.click(screen.getByText("bar.tsx"));
    expect(mockSetActiveTab).toHaveBeenCalledWith("win7", "/b/bar.tsx");
  });

  it("clicar no X de uma aba chama closeTab e não propaga para setActiveTab", () => {
    render(
      <FileWindow
        win={makeWin({
          id: "win7",
          tabs: ["/a/foo.ts", "/b/bar.tsx"],
          activeTab: "/a/foo.ts",
        })}
      />,
    );
    // índice 0 é o X da barra de título (fecha a janela); os X's das abas vêm depois.
    const closeButtons = screen.getAllByLabelText("window_close");
    fireEvent.click(closeButtons[1]);
    expect(mockCloseTab).toHaveBeenCalledWith("win7", "/a/foo.ts");
    expect(mockSetActiveTab).not.toHaveBeenCalled();
    expect(mockClose).not.toHaveBeenCalled();
  });

  it("clicar em minimizar chama minimize(win.id)", () => {
    render(<FileWindow win={makeWin({ id: "win9" })} />);
    fireEvent.click(screen.getByLabelText("window_minimize"));
    expect(mockMinimize).toHaveBeenCalledWith("win9");
  });

  it("clicar em fechar a janela (barra de título) chama close(win.id)", () => {
    render(<FileWindow win={makeWin({ id: "win9", tabs: ["/a.ts"] })} />);
    fireEvent.click(screen.getByLabelText("window_close"));
    expect(mockClose).toHaveBeenCalledWith("win9");
  });

  it("clicar na janela chama focus(win.id)", () => {
    render(<FileWindow win={makeWin()} />);
    fireEvent.pointerDown(screen.getByTestId("floating-frame"));
    expect(mockFocus).toHaveBeenCalledWith("win1");
  });

  it("arrastar pela barra de título só guarda x/y ao soltar", () => {
    render(<FileWindow win={makeWin({ x: 100, y: 100 })} />);
    const bar = screen.getByTestId("window-title-bar");

    fireEvent.pointerDown(bar, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.pointerMove(bar, { clientX: 60, clientY: 40 });
    expect(mockSetBounds).not.toHaveBeenCalled();
    fireEvent.pointerUp(bar);

    expect(mockSetBounds).toHaveBeenCalledWith("win1", {
      x: 150,
      y: 130,
      w: 400,
      h: 300,
    });
  });

  it("a borda de baixo redimensiona a altura (antes só a largura mexia)", () => {
    render(<FileWindow win={makeWin({ x: 100, y: 100 })} />);
    const handle = screen.getByTestId("window-resize-s");

    fireEvent.pointerDown(handle, { clientX: 300, clientY: 400, button: 0 });
    fireEvent.pointerMove(handle, { clientX: 300, clientY: 460 });
    fireEvent.pointerUp(handle);

    expect(mockSetBounds).toHaveBeenCalledWith("win1", {
      x: 100,
      y: 100,
      w: 400,
      h: 360,
    });
  });

  it("o canto superior esquerdo move a origem e mantém o canto oposto", () => {
    render(<FileWindow win={makeWin({ x: 100, y: 100 })} />);
    const handle = screen.getByTestId("window-resize-nw");

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100, button: 0 });
    fireEvent.pointerMove(handle, { clientX: 60, clientY: 70 });
    fireEvent.pointerUp(handle);

    expect(mockSetBounds).toHaveBeenCalledWith("win1", {
      x: 60,
      y: 70,
      w: 440,
      h: 330,
    });
  });

  it("um escudo cobre o conteúdo só enquanto o gesto está em andamento", () => {
    render(<FileWindow win={makeWin()} />);
    const handle = screen.getByTestId("window-resize-e");
    expect(screen.queryByTestId("window-gesture-shield")).toBeNull();

    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, button: 0 });
    expect(screen.getByTestId("window-gesture-shield")).toBeTruthy();

    fireEvent.pointerUp(handle);
    expect(screen.queryByTestId("window-gesture-shield")).toBeNull();
  });

  it("maximizar (botão ou duplo clique) tira as alças e restaura depois", () => {
    render(<FileWindow win={makeWin()} />);
    const frame = screen.getByTestId("floating-frame");
    expect(frame.dataset.maximized).toBe("false");

    fireEvent.doubleClick(screen.getByTestId("window-title-bar"));
    expect(frame.dataset.maximized).toBe("true");
    expect(screen.queryByTestId("window-resize-s")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "window_restore" }));
    expect(frame.dataset.maximized).toBe("false");
    expect(screen.getByTestId("window-resize-s")).toBeTruthy();
  });
});
