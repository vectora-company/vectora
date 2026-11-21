// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { WorkbenchActions, WorkbenchSection } from "../primitives";
import { Button } from "@/components/ui/button";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

afterEach(cleanup);

describe("WorkbenchSection", () => {
  it("fixa o título pequeno em caixa alta acima do conteúdo", () => {
    render(
      <WorkbenchSection title="Título" testId="sec">
        <p>conteúdo</p>
      </WorkbenchSection>,
    );

    const heading = screen.getByRole("heading", { name: "Título" });
    expect(heading.className).toContain("uppercase");
    expect(heading.className).toContain("text-[10px]");
    expect(screen.getByTestId("sec").lastElementChild?.textContent).toBe(
      "conteúdo",
    );
  });
});

describe("WorkbenchActions", () => {
  it("agrupa os botões numa linha só, com espaçamento fixo", () => {
    render(
      <WorkbenchActions testId="row">
        <button type="button">a</button>
        <button type="button">b</button>
      </WorkbenchActions>,
    );

    const row = screen.getByTestId("row");
    expect(row.className).toContain("flex");
    expect(row.className).toContain("gap-1.5");
    expect(row.querySelectorAll("button")).toHaveLength(2);
  });
});

describe("Button — variações menores do tema", () => {
  it("xs é menor que sm, que é menor que o padrão", () => {
    render(
      <>
        <Button size="xs">xs</Button>
        <Button size="sm">sm</Button>
        <Button>padrão</Button>
        <Button size="icon-xs" aria-label="i">
          i
        </Button>
      </>,
    );

    expect(screen.getByText("xs").className).toContain("h-6");
    expect(screen.getByText("sm").className).toContain("h-8");
    expect(screen.getByText("padrão").className).toContain("h-9");
    expect(screen.getByLabelText("i").className).toContain("size-6");
  });

  it("xs reduz o texto e os ícones", () => {
    render(<Button size="xs">xs</Button>);

    const classes = screen.getByText("xs").className;
    expect(classes).toContain("text-xs");
    expect(classes).toContain("size-3");
  });
});
