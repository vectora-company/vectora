/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { STORAGE_KEYS } from "@/lib/constants/features";
import { ClientProfileSettings } from "../client-profile-settings";

describe("ClientProfileSettings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("carrega, atualiza e restaura o perfil local após remontar", async () => {
    window.localStorage.setItem(
      STORAGE_KEYS.CLIENT_PROFILE,
      JSON.stringify({ id: "client-1234", label: "Meu computador" }),
    );
    const first = render(<ClientProfileSettings />);
    const name = await screen.findByLabelText("Name for this client");
    await waitFor(() => expect(name).toHaveValue("Meu computador"));

    fireEvent.change(name, { target: { value: "Notebook" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEYS.CLIENT_PROFILE)!),
    ).toEqual(
      expect.objectContaining({ id: "client-1234", label: "Notebook" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Profile saved on this device.",
    );

    first.unmount();
    render(<ClientProfileSettings />);
    await waitFor(() =>
      expect(screen.getByLabelText("Name for this client")).toHaveValue(
        "Notebook",
      ),
    );
  });

  it("mantém a tela utilizável e informa quando o armazenamento falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.localStorage.setItem(
      STORAGE_KEYS.CLIENT_PROFILE,
      JSON.stringify({ id: "client-1234", label: "Meu computador" }),
    );
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("storage disabled", "SecurityError");
    });

    render(<ClientProfileSettings />);
    const name = await screen.findByLabelText("Name for this client");
    fireEvent.change(name, { target: { value: "Perfil em memória" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(name).toHaveValue("Perfil em memória");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Storage for this profile is unavailable.",
    );
  });

  it("recupera um perfil corrompido criando e persistindo um perfil válido", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    window.localStorage.setItem(STORAGE_KEYS.CLIENT_PROFILE, "{");

    render(<ClientProfileSettings />);
    await screen.findByLabelText("Name for this client");

    const recovered = JSON.parse(
      window.localStorage.getItem(STORAGE_KEYS.CLIENT_PROFILE)!,
    ) as { id: string; label: string };
    expect(recovered.id).toBeTruthy();
    expect(recovered.label).toMatch(/^Client /);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("não aceita um nome vazio", async () => {
    render(<ClientProfileSettings />);
    const name = await screen.findByLabelText("Name for this client");
    fireEvent.change(name, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a name for this client.",
    );
  });
});
