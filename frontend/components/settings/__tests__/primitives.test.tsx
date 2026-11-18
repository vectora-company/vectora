// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  SettingsField,
  SettingsMessage,
  SettingsRow,
  SettingsSection,
  SettingsStack,
  SettingsStatus,
  SettingsTabHeader,
  settingsSectionClass,
} from "../primitives";

afterEach(cleanup);

describe("SettingsSection", () => {
  it("é um card com título, descrição, ações e o padding padrão", () => {
    render(
      <SettingsSection
        title="Chat"
        description="Modelo do chat"
        actions={<button type="button">Testar</button>}
      >
        <p>conteúdo</p>
      </SettingsSection>,
    );
    const section = document.querySelector(
      '[data-slot="settings-section"]',
    ) as HTMLElement;
    expect(section).toHaveClass("p-4", "rounded-lg", "border", "space-y-3");
    expect(settingsSectionClass).toContain("p-4");
    expect(
      screen.getByRole("heading", { level: 3, name: "Chat" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Modelo do chat")).toHaveClass(
      "text-xs",
      "text-muted-foreground",
    );
    expect(screen.getByRole("button", { name: "Testar" })).toBeInTheDocument();
    expect(screen.getByText("conteúdo")).toBeInTheDocument();
  });

  it("mostra o ícone do cabeçalho quando informado", () => {
    render(
      <SettingsSection
        title="Ollama"
        icon={<svg data-testid="icone" aria-hidden="true" />}
      />,
    );
    expect(screen.getByTestId("icone")).toBeInTheDocument();
  });
});

describe("SettingsTabHeader e SettingsStack", () => {
  it("o cabeçalho da aba usa h2 e a coluna dá 24px entre blocos", () => {
    const { container } = render(
      <SettingsStack>
        <SettingsTabHeader title="AI Models" description="Escolha os modelos" />
      </SettingsStack>,
    );
    expect(container.firstChild).toHaveClass("space-y-6");
    expect(
      screen.getByRole("heading", { level: 2, name: "AI Models" }),
    ).toHaveClass("text-sm", "font-medium");
  });
});

describe("SettingsRow", () => {
  it("usa o fundo do card do tema, sem cor fixa", () => {
    render(<SettingsRow data-testid="linha">x</SettingsRow>);
    const row = screen.getByTestId("linha");
    expect(row).toHaveClass("bg-card", "border-border", "px-3", "py-2");
    expect(row.className).not.toMatch(/#|\[/);
  });
});

describe("SettingsField", () => {
  it("associa o rótulo ao controle e mostra a ajuda", () => {
    render(
      <SettingsField label="Endpoint" hint="URL base" htmlFor="endpoint">
        <input id="endpoint" />
      </SettingsField>,
    );
    expect(screen.getByLabelText("Endpoint")).toBeInTheDocument();
    expect(screen.getByText("URL base")).toHaveClass("text-xs");
  });
});

describe("SettingsStatus e SettingsMessage", () => {
  it.each([
    ["success", "text-success"],
    ["warning", "text-warning"],
    ["danger", "text-destructive"],
    ["info", "text-info"],
    ["neutral", "text-muted-foreground"],
  ] as const)("o tom %s usa só tokens do tema", (tone, cls) => {
    render(<SettingsStatus tone={tone}>estado</SettingsStatus>);
    const el = screen.getByText("estado");
    expect(el).toHaveClass(cls, "text-2xs");
    expect(el).toHaveAttribute("data-tone", tone);
    cleanup();
  });

  it("erro e aviso viram alerta; informação vira status", () => {
    render(
      <>
        <SettingsMessage tone="danger">falhou</SettingsMessage>
        <SettingsMessage tone="info">ok</SettingsMessage>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("falhou");
    expect(screen.getByRole("status")).toHaveTextContent("ok");
  });
});
