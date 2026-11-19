// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { WindowLayoutMenu } from "../window-layout-menu";
import { LAYOUT_TEMPLATES } from "@/lib/layout/window-geometry";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

const trigger = () => screen.getByRole("button", { name: "window_layout" });
const panel = () => screen.queryByTestId("window-layout-panel");

describe("WindowLayoutMenu", () => {
  it("começa fechado e o botão não usa tooltip nativo que cobriria o painel", () => {
    render(<WindowLayoutMenu onSelect={vi.fn()} />);

    expect(panel()).toBeNull();
    expect(trigger().hasAttribute("title")).toBe(false);
  });

  it("abre ao passar o mouse com os quatro modelos desenhados", () => {
    render(<WindowLayoutMenu onSelect={vi.fn()} />);

    fireEvent.mouseEnter(trigger().parentElement!);

    expect(panel()).toBeTruthy();
    for (const template of LAYOUT_TEMPLATES) {
      expect(
        screen.getByTestId(`window-layout-template-${template.id}`),
      ).toBeTruthy();
      for (const zone of template.zones)
        expect(
          screen.getByTestId(`window-layout-zone-${zone.id}`),
        ).toBeTruthy();
    }
  });

  it("oferece poucas opções: 11 zonas em 4 modelos, mais centralizar", () => {
    render(<WindowLayoutMenu onSelect={vi.fn()} />);
    fireEvent.click(trigger());

    expect(screen.getAllByTestId(/^window-layout-zone-/)).toHaveLength(11);
    expect(screen.getByTestId("window-layout-center")).toBeTruthy();
  });

  it("o painel fica acima do editor: o contêiner tem z-index alto", () => {
    render(<WindowLayoutMenu onSelect={vi.fn()} />);

    expect(trigger().parentElement!.className).toContain("z-[1000]");
  });

  it("fecha pouco depois de o mouse sair, mas não imediatamente", () => {
    render(<WindowLayoutMenu onSelect={vi.fn()} />);
    const root = trigger().parentElement!;

    fireEvent.mouseEnter(root);
    fireEvent.mouseLeave(root);
    expect(panel()).toBeTruthy();

    act(() => vi.advanceTimersByTime(200));
    expect(panel()).toBeNull();
  });

  it("voltar com o mouse a tempo cancela o fechamento", () => {
    render(<WindowLayoutMenu onSelect={vi.fn()} />);
    const root = trigger().parentElement!;

    fireEvent.mouseEnter(root);
    fireEvent.mouseLeave(root);
    act(() => vi.advanceTimersByTime(60));
    fireEvent.mouseEnter(root);
    act(() => vi.advanceTimersByTime(500));

    expect(panel()).toBeTruthy();
  });

  it("escolher uma zona entrega a zona e fecha o painel", () => {
    const onSelect = vi.fn();
    render(<WindowLayoutMenu onSelect={onSelect} />);

    fireEvent.mouseEnter(trigger().parentElement!);
    fireEvent.click(screen.getByTestId("window-layout-zone-top-right"));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "top-right",
        x: 0.5,
        y: 0,
        w: 0.5,
        h: 0.5,
      }),
    );
    expect(panel()).toBeNull();
  });

  it("centralizar entrega o destino 'center'", () => {
    const onSelect = vi.fn();
    render(<WindowLayoutMenu onSelect={onSelect} />);

    fireEvent.click(trigger());
    fireEvent.click(screen.getByTestId("window-layout-center"));

    expect(onSelect).toHaveBeenCalledWith("center");
  });

  it("funciona sem mouse: clicar no botão alterna e Esc fecha", () => {
    render(<WindowLayoutMenu onSelect={vi.fn()} />);

    fireEvent.click(trigger());
    expect(panel()).toBeTruthy();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(trigger(), { key: "Escape" });
    expect(panel()).toBeNull();
  });

  it("cada zona tem nome acessível", () => {
    render(<WindowLayoutMenu onSelect={vi.fn()} />);
    fireEvent.click(trigger());

    expect(
      screen.getByRole("button", { name: "window_layout_left_wide" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "window_layout_third_center" }),
    ).toBeTruthy();
  });
});
