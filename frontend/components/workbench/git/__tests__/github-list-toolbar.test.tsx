// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";

import { GithubListToolbar, LIST_SELECT_CLASS } from "../github-list-toolbar";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

afterEach(cleanup);

const follows = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

const noop = () => {};

function Harness({
  onRefresh = noop,
  children,
}: {
  onRefresh?: () => void;
  children?: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  return (
    <>
      <GithubListToolbar
        query={query}
        onQueryChange={setQuery}
        onRefresh={onRefresh}
      >
        {children}
      </GithubListToolbar>
      <output data-testid="query">{query}</output>
    </>
  );
}

describe("GithubListToolbar", () => {
  it("o campo de busca é controlado: digitar avisa quem usa", () => {
    render(<Harness />);

    fireEvent.change(screen.getByTestId("github-filter"), {
      target: { value: "bug" },
    });

    expect(screen.getByTestId("query").textContent).toBe("bug");
    expect(
      (screen.getByTestId("github-filter") as HTMLInputElement).value,
    ).toBe("bug");
  });

  it("o campo de busca tem placeholder e nome acessível", () => {
    render(<Harness />);

    const input = screen.getByTestId("github-filter");
    expect(input.getAttribute("placeholder")).toBe(
      "workbench_github_filter_placeholder",
    );
    expect(input.getAttribute("aria-label")).toBe(
      "workbench_github_filter_placeholder",
    );
  });

  it("atualizar chama o callback uma vez por clique", () => {
    const onRefresh = vi.fn();
    render(<Harness onRefresh={onRefresh} />);
    const button = screen.getByRole("button", {
      name: "workbench_github_refresh",
    });

    fireEvent.click(button);
    fireEvent.click(button);

    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it("ordem: busca, depois os filtros da lista, e só no fim o atualizar", () => {
    render(
      <Harness>
        <select data-testid="filtro-a" />
        <button type="button" data-testid="filtro-b" />
      </Harness>,
    );
    const search = screen.getByTestId("github-filter");
    const a = screen.getByTestId("filtro-a");
    const b = screen.getByTestId("filtro-b");
    const refresh = screen.getByRole("button", {
      name: "workbench_github_refresh",
    });

    expect(follows(search, a)).toBe(true);
    expect(follows(a, b)).toBe(true);
    expect(follows(b, refresh)).toBe(true);
  });

  it("sem filtros extras desenha só a busca e o atualizar", () => {
    render(<Harness />);

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getAllByRole("searchbox")).toHaveLength(1);
  });

  it("o atualizar fica empurrado para a direita da barra", () => {
    render(<Harness />);

    expect(
      screen
        .getByRole("button", { name: "workbench_github_refresh" })
        .getAttribute("class"),
    ).toContain("ml-auto");
  });

  it("os seletores de filtro compartilham um estilo único", () => {
    expect(LIST_SELECT_CLASS).toContain("h-6");
    expect(LIST_SELECT_CLASS).toContain("text-xs");
  });
});
