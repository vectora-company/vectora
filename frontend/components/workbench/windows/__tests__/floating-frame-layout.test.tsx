// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { FloatingFrame } from "../floating-frame";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup() {
  vi.stubGlobal("innerWidth", 1600);
  vi.stubGlobal("innerHeight", 900);
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  });
  const onBoundsChange = vi.fn();
  render(
    <FloatingFrame
      rect={{ x: 100, y: 100, w: 640, h: 460 }}
      zIndex={1}
      title="a.ts"
      onFocus={() => {}}
      onBoundsChange={onBoundsChange}
      onMinimize={() => {}}
      onClose={() => {}}
    >
      conteúdo
    </FloatingFrame>,
  );
  onBoundsChange.mockClear();
  return onBoundsChange;
}

describe("FloatingFrame — menu de layout", () => {
  it("o botão de layout fica ao lado do de minimizar", () => {
    setup();
    const buttons = screen
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(buttons.indexOf("window_layout")).toBeLessThan(
      buttons.indexOf("window_minimize"),
    );
  });

  it("encaixar no canto inferior esquerdo grava os novos limites", () => {
    const onBoundsChange = setup();

    fireEvent.click(screen.getByRole("button", { name: "window_layout" }));
    fireEvent.click(screen.getByTestId("window-layout-bottom-left"));

    expect(onBoundsChange).toHaveBeenCalledWith({
      x: 0,
      y: 450,
      w: 800,
      h: 450,
    });
    expect(screen.getByTestId("floating-frame").style.transform).toBe(
      "translate3d(0px, 450px, 0px)",
    );
  });

  it("centralizar mantém o tamanho", () => {
    const onBoundsChange = setup();

    fireEvent.click(screen.getByRole("button", { name: "window_layout" }));
    fireEvent.click(screen.getByTestId("window-layout-center"));

    expect(onBoundsChange).toHaveBeenCalledWith({
      x: 480,
      y: 220,
      w: 640,
      h: 460,
    });
  });
});
