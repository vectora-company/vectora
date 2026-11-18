// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, key) => () => String(key) }),
}));
vi.mock("@/lib/stores/workspaces-store", () => ({
  useWorkspacesStore: (selector: (s: { active_id: string }) => unknown) =>
    selector({ active_id: "ws" }),
}));
vi.mock("@/lib/stores/settings-store", () => ({
  hydrateDecisionModelPreferences: vi.fn().mockResolvedValue(undefined),
  useSettingsStore: (selector: (s: object) => unknown) =>
    selector({
      decisionModelsEnabled: true,
      decisionModelProvider: "laya-local",
      permissionMode: "ask",
      setDecisionModelsEnabled: vi.fn(),
      setDecisionModelProvider: vi.fn(),
    }),
}));

import { DecisionModelMenu } from "../decision-model-menu";

describe("DecisionModelMenu", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const configured = url.includes("provider=laya-local");
        return {
          ok: true,
          json: async () => ({
            ready: configured,
            configured,
            healthy: configured,
          }),
        };
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("lista só os modelos já configurados", async () => {
    render(<DecisionModelMenu />);
    fireEvent.click(screen.getByRole("button", { name: /Laya local/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(4));
    const itens = await screen.findAllByText("Laya local");
    // Gatilho + item da lista.
    expect(itens).toHaveLength(2);
    expect(screen.queryByText("Clef local")).not.toBeInTheDocument();
    expect(screen.queryByText("Clef Cloudflare")).not.toBeInTheDocument();
    expect(screen.queryByText("JEV")).not.toBeInTheDocument();
  });
});
