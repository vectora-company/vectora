// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { COMMIT_BODY_MAX_HEIGHT, CommitBodyField } from "../commit-body-field";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(props: Partial<Parameters<typeof CommitBodyField>[0]> = {}) {
  return render(
    <CommitBodyField
      value=""
      onChange={() => {}}
      placeholder="Descrição"
      testId="body"
      actions={<button type="button">ícone</button>}
      {...props}
    />,
  );
}

describe("CommitBodyField", () => {
  it("o texto e a faixa de ícones são irmãos: o texto não ocupa o lugar dos ícones", () => {
    setup();

    const textarea = screen.getByTestId("body");
    const strip = screen.getByTestId("git-commit-body-actions");

    expect(textarea.parentElement).toBe(strip.parentElement);
    expect(
      textarea.compareDocumentPosition(strip) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(strip.contains(textarea)).toBe(false);
    // Os ícones não ficam sobrepostos ao texto (nada de posição absoluta).
    expect(strip.className).not.toContain("absolute");
    expect(textarea.className).not.toContain("pb-8");
  });

  it("sem ações não desenha a faixa", () => {
    setup({ actions: undefined });

    expect(screen.queryByTestId("git-commit-body-actions")).toBeNull();
  });

  it("cresce com o conteúdo até o limite", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
      function (this: HTMLElement) {
        return (this as HTMLTextAreaElement).value.split("\n").length * 20;
      },
    );
    const { rerender } = setup({ value: "a" });
    const textarea = screen.getByTestId("body") as HTMLTextAreaElement;
    expect(textarea.style.height).toBe("20px");

    const long = Array.from({ length: 40 }, () => "linha").join("\n");
    textarea.value = long;
    rerender(
      <CommitBodyField
        value={long}
        onChange={() => {}}
        placeholder="Descrição"
        testId="body"
      />,
    );

    expect(textarea.style.height).toBe(`${COMMIT_BODY_MAX_HEIGHT}px`);
    expect(textarea.style.overflowY).toBe("auto");
  });

  it("digitar avisa a mudança e Ctrl+Enter envia", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    setup({ onChange, onSubmit });
    const textarea = screen.getByTestId("body");

    fireEvent.change(textarea, { target: { value: "texto" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("texto");
    expect(onSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
