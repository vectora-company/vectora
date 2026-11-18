// @vitest-environment jsdom
/**
 * Testes para os seletores de idioma/tema no primeiro step (identity) do
 * PreAuthWizard — aplicados direto no settings-store, visíveis antes mesmo
 * de escolher o modo local/VPS.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useOnboardingDraftStore } from "@/lib/stores/onboarding-draft-store";
import { PreAuthWizard } from "../pre-auth-wizard";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

beforeEach(() => {
  useSettingsStore.setState({ theme: "system", language: "en" });
  useOnboardingDraftStore.getState().reset();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: false, json: async () => ({}) })),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** As telas leem o status de licença pelo cache de queries. */
function renderWithQuery(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("PreAuthWizard — seletores de idioma e tema", () => {
  it("clicar em 'Dark' aplica o tema no settings-store imediatamente", () => {
    renderWithQuery(<PreAuthWizard />);

    fireEvent.click(screen.getByTitle("Dark"));

    expect(useSettingsStore.getState().theme).toBe("dark");
  });

  it("clicar em 'Light' depois de 'Dark' troca o tema (não acumula estado antigo)", () => {
    renderWithQuery(<PreAuthWizard />);

    fireEvent.click(screen.getByTitle("Dark"));
    fireEvent.click(screen.getByTitle("Light"));

    expect(useSettingsStore.getState().theme).toBe("light");
  });

  it("o botão do tema atual reflete aria-pressed=true", () => {
    useSettingsStore.setState({ theme: "dark" });
    renderWithQuery(<PreAuthWizard />);

    expect(screen.getByTitle("Dark")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTitle("System")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("PreAuthWizard — username: autocomplete a partir do nome + obrigatório", () => {
  it("digitar o nome preenche o username automaticamente (slug) até edição manual", () => {
    renderWithQuery(<PreAuthWizard />);

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Bruno Soares" },
    });

    expect(screen.getByLabelText("Username")).toHaveValue("brunosoares");
  });

  it("atualiza o rascunho sem setState durante o render", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderWithQuery(<PreAuthWizard />);
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Bruno Soares" },
    });

    expect(screen.getByLabelText("Username")).toHaveValue("brunosoares");
    expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
      "Cannot update a component",
    );
    consoleError.mockRestore();
  });

  it("editar o username manualmente para de seguir o nome (par de erro: mudar o nome depois não sobrescreve)", () => {
    renderWithQuery(<PreAuthWizard />);

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Bruno" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "bsoares" },
    });
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Bruno Soares" },
    });

    expect(screen.getByLabelText("Username")).toHaveValue("bsoares");
  });

  it("clicar em Next sem username bloqueia o avanço com erro (par de erro: nome preenchido não basta)", () => {
    renderWithQuery(<PreAuthWizard />);

    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Bruno" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("Next"));

    expect(screen.getByText("Choose a username.")).toBeInTheDocument();
    // Não avançou pro step "mode" — o formulário de identidade continua na tela.
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
  });
});
