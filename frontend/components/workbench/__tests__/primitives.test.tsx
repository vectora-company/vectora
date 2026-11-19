// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  WorkbenchEmpty,
  WorkbenchError,
  WorkbenchLoading,
  WorkbenchToolbar,
} from "../primitives";

afterEach(cleanup);

describe("primitivas do workbench", () => {
  it("o carregamento tem papel de status acessível", () => {
    render(<WorkbenchLoading />);

    expect(screen.getByRole("status")).toBeTruthy();
  });

  it("o vazio mostra o texto e o ícone", () => {
    render(
      <WorkbenchEmpty icon={<span data-testid="icon" />} testId="empty">
        Nada por aqui
      </WorkbenchEmpty>,
    );

    expect(screen.getByTestId("empty").textContent).toBe("Nada por aqui");
    expect(screen.getByTestId("icon")).toBeTruthy();
  });

  it("o vazio compacto vira uma linha dentro da seção", () => {
    render(<WorkbenchEmpty compact>Sem itens</WorkbenchEmpty>);

    expect(screen.getByText("Sem itens").tagName).toBe("P");
  });

  it("o erro é anunciado como alerta", () => {
    render(<WorkbenchError>Falhou</WorkbenchError>);

    expect(screen.getByRole("alert").textContent).toBe("Falhou");
  });

  it("a barra de ferramentas agrupa as ações", () => {
    render(
      <WorkbenchToolbar>
        <button>Ação</button>
      </WorkbenchToolbar>,
    );

    expect(screen.getByRole("button", { name: "Ação" })).toBeTruthy();
  });
});
