// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PluginsTab } from "../plugins-tab";

describe("PluginsTab", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mantém a configuração MCP sem duplicar o painel global de ferramentas", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ servers: [] }), { status: 200 }),
        ),
    );

    render(<PluginsTab />);

    expect(await screen.findByText("MCP Plugins")).toBeInTheDocument();
    expect(screen.queryByText("Tool access")).not.toBeInTheDocument();
    expect(screen.queryByText("web_search")).not.toBeInTheDocument();
  });
});
