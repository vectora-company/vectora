// @vitest-environment jsdom
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { useAutoGrow } from "../use-auto-grow";

function Field({ value, max }: { value: string; max: number }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoGrow(ref, value, max);
  return <textarea ref={ref} defaultValue={value} data-testid="field" />;
}

/** jsdom não faz layout: a altura natural vem do número de linhas. */
function stubScrollHeight(perLine = 20) {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockImplementation(
    function (this: HTMLElement) {
      const text = (this as HTMLTextAreaElement).value ?? "";
      return Math.max(1, text.split("\n").length) * perLine;
    },
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("useAutoGrow", () => {
  it("cresce com o conteúdo", () => {
    stubScrollHeight();
    const { rerender } = render(<Field value="a" max={200} />);
    const field = screen.getByTestId("field") as HTMLTextAreaElement;
    expect(field.style.height).toBe("20px");

    field.value = "a\nb\nc";
    rerender(<Field value={"a\nb\nc"} max={200} />);
    expect(field.style.height).toBe("60px");
    expect(field.style.overflowY).toBe("hidden");
  });

  it("para no limite e passa a rolar", () => {
    stubScrollHeight();
    const long = Array.from({ length: 30 }, (_, i) => String(i)).join("\n");
    render(<Field value={long} max={120} />);
    const field = screen.getByTestId("field") as HTMLTextAreaElement;

    expect(field.style.height).toBe("120px");
    expect(field.style.overflowY).toBe("auto");
  });

  it("encolhe quando o texto diminui", () => {
    stubScrollHeight();
    const { rerender } = render(<Field value={"a\nb\nc\nd"} max={200} />);
    const field = screen.getByTestId("field") as HTMLTextAreaElement;
    expect(field.style.height).toBe("80px");

    field.value = "a";
    rerender(<Field value="a" max={200} />);
    expect(field.style.height).toBe("20px");
  });

  it("não ultrapassa o limite mesmo com conteúdo enorme", () => {
    stubScrollHeight(1000);
    render(<Field value={"a\nb"} max={160} />);

    expect(
      (screen.getByTestId("field") as HTMLTextAreaElement).style.height,
    ).toBe("160px");
  });
});
