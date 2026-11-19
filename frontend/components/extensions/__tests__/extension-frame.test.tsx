// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExtensionFrame, parseFrameMessage } from "../extension-frame";
import type { ExtensionContribution } from "@/lib/extensions/registry";

const contribution: ExtensionContribution = {
  id: "demo.settings_page.config",
  extension_id: "demo",
  kind: "settings_page",
  label: "Configurações do Demo",
  entry: "config.html",
};

describe("parseFrameMessage", () => {
  it("aceita só ready e resize, com a altura limitada", () => {
    expect(parseFrameMessage({ type: "vectora.ready" })).toEqual({
      type: "ready",
    });
    expect(
      parseFrameMessage({ type: "vectora.resize", height: 999999 }),
    ).toEqual({ type: "resize", height: 4000 });
    expect(parseFrameMessage({ type: "vectora.resize", height: 1 })).toEqual({
      type: "resize",
      height: 120,
    });
  });

  it.each([
    null,
    "texto",
    { type: "vectora.getToken" },
    { type: "vectora.resize", height: "alto" },
    { type: "vectora.resize", height: NaN },
  ])("ignora %j", (data) => {
    expect(parseFrameMessage(data)).toBeNull();
  });
});

describe("ExtensionFrame", () => {
  it("roda isolado: sandbox só com scripts, sem referrer e URL do host", () => {
    render(<ExtensionFrame contribution={contribution} />);

    const frame = screen.getByTitle("Configurações do Demo");
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(frame).toHaveAttribute("src", "/extensions/demo/ui/config.html");
    expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
  });

  it("some o carregando depois do load", () => {
    render(<ExtensionFrame contribution={contribution} />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    fireEvent.load(screen.getByTitle("Configurações do Demo"));

    expect(screen.queryByRole("status")).toBeNull();
  });

  it("ignora mensagens de outra janela", () => {
    render(<ExtensionFrame contribution={contribution} />);

    fireEvent(
      window,
      new MessageEvent("message", { data: { type: "vectora.ready" } }),
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("sem entry mostra um aviso e não monta iframe", () => {
    render(<ExtensionFrame contribution={{ ...contribution, entry: null }} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByTitle("Configurações do Demo")).toBeNull();
  });
});
