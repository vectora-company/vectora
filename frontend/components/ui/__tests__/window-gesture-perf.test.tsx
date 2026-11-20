// @vitest-environment jsdom
/**
 * Desempenho dos gestos de janela (mover e redimensionar), nos dois
 * componentes que os implementam: o diálogo redimensionável e a janela
 * flutuante. O que se protege aqui:
 *
 * - nenhum commit do React enquanto o ponteiro se move (só no início e no fim);
 * - vários movimentos no mesmo quadro viram uma única pintura;
 * - a mudança chega ao DOM no quadro seguinte ao movimento;
 * - orçamentos de tempo folgados (o jsdom é lento; aqui pegam regressões
 *   grandes, como voltar a renderizar o React a cada pixel).
 */
import { Profiler, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResizableDialogContent } from "../resizable-dialog";
import { FloatingFrame } from "@/components/workbench/windows/floating-frame";
import { useDialogSizeStore } from "@/lib/stores/dialog-size-store";
import { moveRect, resizeRect } from "@/lib/layout/window-geometry";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

// --- quadros controlados: o teste decide quando "passa um quadro" ----------
let queue = new Map<number, FrameRequestCallback>();
let nextId = 1;
function flushFrame() {
  const pending = [...queue.values()];
  queue = new Map();
  for (const callback of pending) callback(performance.now());
}

beforeEach(() => {
  queue = new Map();
  nextId = 1;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => queue.delete(id));
  vi.stubGlobal("innerWidth", 1920);
  vi.stubGlobal("innerHeight", 1080);
  useDialogSizeStore.setState({ sizes: {} });
  Object.assign(HTMLElement.prototype, {
    setPointerCapture: () => {},
    releasePointerCapture: () => {},
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function countCommits(ui: ReactNode) {
  const commits = { count: 0 };
  const view = render(
    <Profiler id="gesture" onRender={() => (commits.count += 1)}>
      {ui}
    </Profiler>,
  );
  return { commits, view };
}

const dialogUi = (
  <Dialog open>
    <ResizableDialogContent
      defaultWidth={800}
      defaultHeight={600}
      aria-describedby={undefined}
    >
      <DialogHeader>
        <DialogTitle>Título</DialogTitle>
      </DialogHeader>
    </ResizableDialogContent>
  </Dialog>
);

const dialog = () => screen.getByRole("dialog");

describe("diálogo redimensionável — desempenho do gesto", () => {
  it("renderiza o React só no início e no fim do gesto, nunca a cada movimento", () => {
    const { commits } = countCommits(dialogUi);
    const handle = screen.getByTestId("dialog-resize-se");

    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    const afterStart = commits.count;
    for (let i = 1; i <= 200; i++) {
      fireEvent.pointerMove(handle, { clientX: i, clientY: i, pointerId: 1 });
      flushFrame();
    }
    expect(commits.count).toBe(afterStart);

    fireEvent.pointerUp(handle, { pointerId: 1 });
    expect(commits.count - afterStart).toBeLessThanOrEqual(2);
  });

  it("vários movimentos no mesmo quadro viram uma única pintura pendente", () => {
    render(dialogUi);
    const handle = screen.getByTestId("dialog-resize-e");

    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    for (let i = 1; i <= 50; i++)
      fireEvent.pointerMove(handle, { clientX: i, clientY: 0, pointerId: 1 });

    expect(queue.size).toBe(1);
  });

  it("a mudança só chega ao DOM no quadro seguinte, e chega nele", () => {
    render(dialogUi);
    const handle = screen.getByTestId("dialog-resize-se");
    const before = parseFloat(dialog().style.width);

    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 40, clientY: 30, pointerId: 1 });
    expect(parseFloat(dialog().style.width)).toBe(before);

    flushFrame();
    expect(parseFloat(dialog().style.width)).toBe(before + 40);
    expect(parseFloat(dialog().style.height)).toBe(630);
  });

  it("mover só usa transform (sem relayout) e grava left/top ao soltar", () => {
    render(
      <Dialog open>
        <ResizableDialogContent
          defaultWidth={800}
          defaultHeight={600}
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>Título</DialogTitle>
          </DialogHeader>
        </ResizableDialogContent>
      </Dialog>,
    );
    const header = dialog().querySelector('[data-slot="dialog-header"]')!;
    const left = dialog().style.left;

    fireEvent.pointerDown(header, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(header, { clientX: 25, clientY: 10, pointerId: 1 });
    flushFrame();

    expect(dialog().style.transform).toBe("translate3d(25px, 10px, 0px)");
    expect(dialog().style.left).toBe(left);

    fireEvent.pointerUp(header, { pointerId: 1 });
    expect(dialog().style.transform).toBe("");
    expect(dialog().style.left).toBe(`${parseFloat(left) + 25}px`);
  });

  it("aguenta 300 quadros de redimensionar dentro do orçamento de tempo", () => {
    render(dialogUi);
    const handle = screen.getByTestId("dialog-resize-se");
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });

    const start = performance.now();
    for (let i = 1; i <= 300; i++) {
      fireEvent.pointerMove(handle, {
        clientX: i % 120,
        clientY: i % 80,
        pointerId: 1,
      });
      flushFrame();
    }
    const elapsed = performance.now() - start;

    // ~16 ms por quadro a 60 fps seria 4,8 s; exigimos ordens de grandeza
    // menos, porque o jsdom já é lento e o objetivo é pegar regressões.
    expect(elapsed).toBeLessThan(600);
  });

  it("monta o diálogo dentro do orçamento de tempo", () => {
    const start = performance.now();
    render(dialogUi);
    expect(performance.now() - start).toBeLessThan(800);
    expect(dialog()).toBeTruthy();
  });
});

function frameUi() {
  return (
    <FloatingFrame
      rect={{ x: 100, y: 100, w: 640, h: 460 }}
      zIndex={1}
      title="a.ts"
      onFocus={() => {}}
      onBoundsChange={() => {}}
      onMinimize={() => {}}
      onClose={() => {}}
    >
      conteúdo
    </FloatingFrame>
  );
}

describe("janela flutuante — desempenho do gesto", () => {
  it("não renderiza o React durante o movimento", () => {
    const { commits } = countCommits(frameUi());
    const bar = screen.getByTestId("window-title-bar");

    fireEvent.pointerDown(bar, {
      clientX: 0,
      clientY: 0,
      button: 0,
      pointerId: 1,
    });
    const afterStart = commits.count;
    for (let i = 1; i <= 200; i++) {
      fireEvent.pointerMove(bar, { clientX: i, clientY: i, pointerId: 1 });
      flushFrame();
    }

    expect(commits.count).toBe(afterStart);
  });

  it("aplica a posição no quadro seguinte e coalesce movimentos do mesmo quadro", () => {
    render(frameUi());
    const frame = screen.getByTestId("floating-frame");
    const bar = screen.getByTestId("window-title-bar");
    flushFrame();

    fireEvent.pointerDown(bar, {
      clientX: 0,
      clientY: 0,
      button: 0,
      pointerId: 1,
    });
    for (let i = 1; i <= 30; i++)
      fireEvent.pointerMove(bar, { clientX: i, clientY: i, pointerId: 1 });
    expect(queue.size).toBe(1);

    flushFrame();
    expect(frame.style.transform).toBe("translate3d(130px, 130px, 0px)");
  });

  it("aguenta 300 quadros de redimensionar dentro do orçamento de tempo", () => {
    render(frameUi());
    const handle = screen.getByTestId("window-resize-se");
    fireEvent.pointerDown(handle, {
      clientX: 0,
      clientY: 0,
      button: 0,
      pointerId: 1,
    });

    const start = performance.now();
    for (let i = 1; i <= 300; i++) {
      fireEvent.pointerMove(handle, {
        clientX: i % 150,
        clientY: i % 90,
        pointerId: 1,
      });
      flushFrame();
    }

    expect(performance.now() - start).toBeLessThan(600);
  });
});

describe("geometria — custo por movimento", () => {
  it("100 mil cálculos de mover e redimensionar cabem em poucas dezenas de ms", () => {
    const rect = { x: 200, y: 100, w: 400, h: 300 };
    const view = { w: 1920, h: 1080 };
    const min = { w: 280, h: 180 };

    const start = performance.now();
    for (let i = 0; i < 100_000; i++) {
      moveRect(rect, i % 300, i % 200, view);
      resizeRect(rect, "se", i % 300, i % 200, min, view);
    }

    expect(performance.now() - start).toBeLessThan(500);
  });
});
