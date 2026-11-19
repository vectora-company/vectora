// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CompactDrawer } from "../compact-drawer";

function Drawer({
  side = "right",
  size = "wide",
  resizeId = "test",
}: {
  side?: "left" | "right";
  size?: "narrow" | "wide";
  resizeId?: string;
}) {
  return (
    <CompactDrawer
      open
      onOpenChange={() => undefined}
      side={side}
      size={size}
      title="Gaveta"
      resizeId={resizeId}
      data-testid="drawer"
    >
      <div data-testid="conteudo">Conteúdo</div>
    </CompactDrawer>
  );
}

const handle = () => screen.getByTestId("compact-drawer-resize");
const widthOf = () => Number(handle().getAttribute("aria-valuenow"));

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1000,
  });
});
afterEach(() => window.localStorage.clear());

describe("CompactDrawer — largura", () => {
  it("começa na largura padrão do tamanho e a aplica na gaveta", () => {
    render(<Drawer size="wide" />);
    expect(widthOf()).toBe(512);
    expect(screen.getByTestId("drawer")).toHaveStyle({ width: "512px" });

    render(<Drawer size="narrow" resizeId="outra" />);
    expect(
      screen
        .getAllByTestId("compact-drawer-resize")
        .map((n) => n.getAttribute("aria-valuenow")),
    ).toContain("288");
  });

  it("a alça é um separador acessível, com nome e foco por teclado", () => {
    render(<Drawer />);
    expect(handle()).toHaveAttribute("role", "separator");
    expect(handle()).toHaveAttribute("aria-orientation", "vertical");
    expect(handle()).toHaveAttribute("tabindex", "0");
    expect(handle()).toHaveAccessibleName();
  });

  it("gaveta da direita cresce com ArrowLeft e encolhe com ArrowRight", () => {
    render(<Drawer side="right" />);

    fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    expect(widthOf()).toBe(528);
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    fireEvent.keyDown(handle(), { key: "ArrowRight" });
    expect(widthOf()).toBe(496);
  });

  it("gaveta da esquerda cresce com ArrowRight", () => {
    render(<Drawer side="left" />);

    fireEvent.keyDown(handle(), { key: "ArrowRight" });

    expect(widthOf()).toBe(528);
  });

  it("nunca passa do mínimo nem deixa de sobrar uma faixa do app", () => {
    render(<Drawer size="wide" />);

    for (let i = 0; i < 40; i += 1) {
      fireEvent.keyDown(handle(), { key: "ArrowRight" });
    }
    expect(widthOf()).toBe(320);
    for (let i = 0; i < 80; i += 1) {
      fireEvent.keyDown(handle(), { key: "ArrowLeft" });
    }
    expect(widthOf()).toBe(952);
  });

  it("Home volta ao mínimo e o duplo clique ao padrão", () => {
    render(<Drawer />);
    fireEvent.keyDown(handle(), { key: "ArrowLeft" });

    fireEvent.keyDown(handle(), { key: "Home" });
    expect(widthOf()).toBe(320);
    fireEvent.doubleClick(handle());
    expect(widthOf()).toBe(512);
  });

  it("arrastar a alça com o ponteiro muda a largura e guarda o resultado", () => {
    render(<Drawer side="right" />);
    const drawer = screen.getByTestId("drawer");
    drawer.getBoundingClientRect = () =>
      ({ left: 488, right: 1000, width: 512 }) as DOMRect;

    fireEvent.pointerDown(handle(), { pointerId: 1, clientX: 488 });
    fireEvent.pointerMove(handle(), { pointerId: 1, clientX: 400 });
    expect(widthOf()).toBe(600);
    expect(drawer).toHaveAttribute("data-resizing", "true");
    fireEvent.pointerUp(handle(), { pointerId: 1, clientX: 400 });

    expect(drawer).not.toHaveAttribute("data-resizing");
    expect(window.localStorage.getItem("vectora.compact-drawer.test")).toBe(
      "600",
    );
  });

  it("a largura escolhida volta na próxima abertura, por gaveta", () => {
    window.localStorage.setItem("vectora.compact-drawer.workbench", "700");
    render(<Drawer resizeId="workbench" />);
    expect(widthOf()).toBe(700);
  });

  it("valor guardado inválido ou fora dos limites é corrigido", () => {
    window.localStorage.setItem("vectora.compact-drawer.test", "abc");
    const { unmount } = render(<Drawer />);
    expect(widthOf()).toBe(512);
    unmount();

    window.localStorage.setItem("vectora.compact-drawer.test", "5000");
    render(<Drawer />);
    expect(widthOf()).toBe(952);
  });

  it("sem armazenamento a gaveta continua funcionando", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("bloqueado");
    };
    try {
      render(<Drawer />);
      fireEvent.keyDown(handle(), { key: "ArrowLeft" });
      expect(widthOf()).toBe(528);
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe("CompactDrawer — animação", () => {
  it("usa a animação própria, orientada pelo lado, e nenhuma transição de largura", () => {
    render(<Drawer side="left" />);
    const drawer = screen.getByTestId("drawer");

    expect(drawer).toHaveClass("compact-drawer");
    expect(drawer).toHaveAttribute("data-side", "left");
  });
});

describe("CompactDrawer — folha de estilo", () => {
  // jsdom não aplica CSS, então o contrato da animação é conferido no arquivo.
  const css = readFileSync(
    resolve(__dirname, "../../../src/styles.css"),
    "utf8",
  );

  it.each(["left", "right"])("tem entrada e saída para o lado %s", (side) => {
    expect(css).toContain(`@keyframes compact-drawer-in-${side}`);
    expect(css).toContain(`@keyframes compact-drawer-out-${side}`);
  });

  it("anima o fundo escuro junto e respeita prefers-reduced-motion", () => {
    expect(css).toContain("@keyframes compact-drawer-fade-in");
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{[^}]*compact-drawer/s,
    );
  });

  it("não anima a largura, para o arrasto não ficar com atraso", () => {
    const block = css.slice(css.indexOf(".compact-drawer.compact-drawer {"));
    expect(block.slice(0, block.indexOf("}"))).toContain("transition: none");
  });
});
