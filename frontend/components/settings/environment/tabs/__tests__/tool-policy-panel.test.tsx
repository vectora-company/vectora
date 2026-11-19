// @vitest-environment jsdom

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ToolPolicyPanel } from "../tool-policy-panel";
import { useAuthStore } from "@/lib/stores/auth-store";

describe("ToolPolicyPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("não exibe zero enquanto o uso ainda está carregando", async () => {
    let resolveUsage!: (value: Response) => void;
    const usageResponse = new Promise<Response>((resolve) => {
      resolveUsage = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        url === "/tools/policy"
          ? Promise.resolve(
              new Response(
                JSON.stringify({ available: ["web_search"], disabled: [] }),
                { status: 200 },
              ),
            )
          : usageResponse,
      ),
    );

    render(<ToolPolicyPanel />);

    expect(await screen.findByText("Loading usage…")).toBeInTheDocument();
    expect(screen.queryByText(/Used 0 times/)).not.toBeInTheDocument();

    await act(async () => {
      resolveUsage(
        new Response(JSON.stringify({ usage: { web_search: 3 } }), {
          status: 200,
        }),
      );
    });

    expect(
      await screen.findByText("Used 3 times in the last 7 days"),
    ).toBeInTheDocument();
  });

  it("usa a forma singular e localiza o rótulo do schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url === "/tools/policy"
                ? {
                    available: ["web_search"],
                    disabled: [],
                    schemas: { web_search: { type: "object" } },
                  }
                : { usage: { web_search: 1 } },
            ),
            { status: 200 },
          ),
        ),
      ),
    );

    render(<ToolPolicyPanel />);

    expect(
      await screen.findByText("Used 1 time in the last 7 days"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Show schema" }),
    ).toBeInTheDocument();

    await act(async () => {
      screen.getByRole("button", { name: "Show schema" }).click();
    });

    expect(
      screen.getByRole("region", { name: "web_search schema" }),
    ).toBeInTheDocument();
  });
});

describe("ToolPolicyPanel — RBAC", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    useAuthStore.setState({ user: null });
  });

  it("bloqueada pelo admin aparece desligada e travada para o usuário", async () => {
    useAuthStore.setState({ user: { id: "u", role: "member" } as never });
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          new Response(
            JSON.stringify(
              url === "/tools/policy"
                ? {
                    available: ["terminal"],
                    disabled: [],
                    locked: ["terminal"],
                  }
                : { usage: {} },
            ),
            { status: 200 },
          ),
        ),
      ),
    );

    render(<ToolPolicyPanel />);

    const toggle = await screen.findByRole("switch", { name: "terminal" });
    expect(toggle).toBeDisabled();
    expect(toggle).not.toBeChecked();
    expect(
      screen.getByText("Blocked by the administrator"),
    ).toBeInTheDocument();
    // Quem não é admin não vê a matriz de roles.
    expect(screen.queryByText("Who can use it")).not.toBeInTheDocument();
  });

  it("admin escolhe os roles de cada tool e grava só o que mudou", async () => {
    useAuthStore.setState({ user: { id: "a", role: "admin" } as never });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return Promise.resolve(new Response("{}", { status: 200 }));
      }
      if (url === "/admin/tool-access") {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              tools: [{ name: "terminal", roles: ["member", "viewer"] }],
            }),
            { status: 200 },
          ),
        );
      }
      return Promise.resolve(
        new Response(
          JSON.stringify(
            url === "/tools/policy"
              ? { available: ["terminal"], disabled: [], locked: [] }
              : { usage: {} },
          ),
          { status: 200 },
        ),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ToolPolicyPanel />);

    const viewer = await screen.findByRole("checkbox", { name: "Viewer" });
    expect(viewer).toBeChecked();
    // Admin e root aparecem marcados e travados.
    expect(screen.getByRole("checkbox", { name: "Admin" })).toBeDisabled();
    fireEvent.click(viewer);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    const putAccess = () =>
      fetchMock.mock.calls.find(
        ([url, init]) =>
          url === "/admin/tool-access" &&
          (init as RequestInit | undefined)?.method === "PUT",
      );
    await waitFor(() => expect(putAccess()).toBeDefined());
    const putCall = putAccess() ?? [];
    const body = JSON.parse(String((putCall[1] as RequestInit).body));
    expect(body).toEqual({ access: { terminal: ["member"] } });
  });
});
