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
import { LAYOUT_GRID } from "@/lib/layout/window-geometry";

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
  it("começa fechado", () => {
    render(<WindowLayoutMenu onSelect={vi.fn()} />);
    expect(panel()).toBeNull();
  });

  it("abre ao passar o mouse e mostra os nove encaixes", () => {
    render(<WindowLayoutMenu onSelect={vi.fn()} />);

    fireEvent.mouseEnter(trigger().parentElement!);

    expect(panel()).toBeTruthy();
    for (const preset of LAYOUT_GRID)
      expect(screen.getByTestId(`window-layout-${preset}`)).toBeTruthy();
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

  it("escolher um encaixe avisa o preset e fecha o painel", () => {
    const onSelect = vi.fn();
    render(<WindowLayoutMenu onSelect={onSelect} />);

    fireEvent.mouseEnter(trigger().parentElement!);
    fireEvent.click(screen.getByTestId("window-layout-top-right"));

    expect(onSelect).toHaveBeenCalledWith("top-right");
    expect(panel()).toBeNull();
  });

  it("funciona sem mouse: clicar no botão alterna e Esc fecha", () => {
    render(<WindowLayoutMenu onSelect={vi.fn()} />);

    fireEvent.click(trigger());
    expect(panel()).toBeTruthy();
    expect(trigger().getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(trigger(), { key: "Escape" });
    expect(panel()).toBeNull();
  });

  it("cada encaixe tem nome acessível", () => {
    render(<WindowLayoutMenu onSelect={vi.fn()} />);
    fireEvent.click(trigger());

    expect(
      screen.getByRole("button", { name: "window_layout_bottom_left" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "window_layout_center" }),
    ).toBeTruthy();
  });
});
