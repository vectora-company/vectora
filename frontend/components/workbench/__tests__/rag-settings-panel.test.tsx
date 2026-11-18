// @vitest-environment jsdom
/**
 * O painel RAG mantém apenas ingestão e coleções. A seleção de modelos fica em
 * IA Models; este teste protege essa separação e o carregamento das coleções.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { RagSettingsPanel } from "../rag-settings-panel";

const fetchMock = vi.fn();

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RagSettingsPanel", () => {
  it("carrega coleções e não expõe configuração de provider ou modelo", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/rag/settings")
        return jsonResponse({ ingest_file_types: [] });
      if (url === "/rag/collections")
        return jsonResponse({ collections: [{ name: "articles", count: 3 }] });
      return jsonResponse({});
    });

    render(<RagSettingsPanel />);
    fireEvent.click(screen.getByTestId("rag-settings-btn"));

    expect(await screen.findByText("articles")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/rag/settings"),
    );
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/embed provider|rerank provider/i),
    ).not.toBeInTheDocument();
  });
});
