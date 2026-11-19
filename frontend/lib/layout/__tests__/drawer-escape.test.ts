// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { shouldCloseDrawerOnEscape } from "../drawer-escape";

function key(target: EventTarget, init: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("shouldCloseDrawerOnEscape", () => {
  it("Esc solto na página fecha a gaveta", () => {
    expect(shouldCloseDrawerOnEscape(key(document.body))).toBe(true);
  });

  it("outras teclas não fecham", () => {
    expect(
      shouldCloseDrawerOnEscape(key(document.body, { key: "Enter" })),
    ).toBe(false);
  });

  it("Esc já tratado por outro componente não fecha", () => {
    const event = key(document.body);
    event.preventDefault();
    expect(shouldCloseDrawerOnEscape(event)).toBe(false);
  });

  it.each([
    ["campo de texto", "<input id='x' />", "#x"],
    ["terminal", "<div class='xterm'><span id='x'></span></div>", "#x"],
    ["editor", "<div class='monaco-editor'><span id='x'></span></div>", "#x"],
  ])("Esc dentro de %s não fecha a gaveta", (_name, html, selector) => {
    document.body.innerHTML = html;
    const target = document.querySelector(selector)!;
    expect(shouldCloseDrawerOnEscape(key(target))).toBe(false);
  });

  it("Esc com um diálogo aberto por cima não fecha a gaveta", () => {
    document.body.innerHTML =
      "<div role='alertdialog' data-state='open'>Confirmar?</div>";
    expect(shouldCloseDrawerOnEscape(key(document.body))).toBe(false);
  });

  it("diálogo já fechado não bloqueia", () => {
    document.body.innerHTML =
      "<div role='dialog' data-state='closed'>fechado</div>";
    expect(shouldCloseDrawerOnEscape(key(document.body))).toBe(true);
  });
});
