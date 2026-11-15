// @vitest-environment jsdom
/**
 * ContaTab — Vectora identifica a conta por username, não por email (email é
 * opcional e fica vazio em modo local, sem conta — ver
 * backend/api/middleware/auth.py::_get_virtual_local_user). O bloco de
 * identidade deve mostrar username + badge de role, nunca email.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy(
    {},
    {
      get:
        (_t, prop) =>
        (..._args: unknown[]) =>
          String(prop),
    },
  ),
}));

async function renderContaTab(user: {
  id: string;
  username?: string;
  email?: string;
  role: string;
  name?: string;
}) {
  vi.doMock("@/lib/stores/auth-store", () => ({
    useAuthStore: (
      selector: (s: { user: typeof user; setUser: () => void }) => unknown,
    ) => selector({ user, setUser: vi.fn() }),
  }));
  const { ContaTab } = await import("../conta-tab");
  render(<ContaTab />);
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("ContaTab — identidade da conta", () => {
  it("mostra o username (não o email) e o badge de role correspondente", async () => {
    await renderContaTab({
      id: "local",
      username: "bruno",
      email: "bruno@example.com",
      role: "root",
      name: "Bruno",
    });

    expect(screen.getByText("bruno")).toBeInTheDocument();
    expect(screen.getByText("Root")).toBeInTheDocument();
    expect(screen.queryByText("bruno@example.com")).not.toBeInTheDocument();
  });

  it("par de erro: email vazio (modo local, sem conta) não afeta a exibição do username", async () => {
    await renderContaTab({
      id: "local",
      username: "bruno",
      email: "",
      role: "root",
      name: "Bruno",
    });

    expect(screen.getByText("bruno")).toBeInTheDocument();
    expect(screen.getByText("Root")).toBeInTheDocument();
  });

  it("permite editar o nome local do cliente sem alterar o nome da conta", async () => {
    await renderContaTab({
      id: "local",
      username: "bruno",
      role: "root",
      name: "Bruno",
    });

    const clientName = await screen.findByRole("textbox");
    fireEvent.change(clientName, { target: { value: "Notebook" } });
    fireEvent.click(
      screen.getByRole("button", { name: "account_client_profile_save" }),
    );

    expect(screen.getByText("Bruno")).toBeInTheDocument();
    expect(window.localStorage.getItem("client-profile")).toContain("Notebook");
  });
});
