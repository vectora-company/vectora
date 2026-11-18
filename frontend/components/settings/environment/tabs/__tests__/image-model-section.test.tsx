// @vitest-environment jsdom
/**
 * Seleção de um modelo explícito para entrada com imagem.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  waitFor,
  fireEvent,
} from "@testing-library/react";

vi.mock("@/lib/paraglide/messages", () => ({
  m: new Proxy({}, { get: (_t, prop) => () => String(prop) }),
}));

import { ImageFallbackModelSection } from "../image-model-section";
import {
  getAllowedModels,
  getModelDisplayName,
} from "@/lib/config/deployment-config";

beforeEach(() => {
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function stubFetch(_order: string[], opts: { imageFallback?: string } = {}) {
  const { imageFallback = "" } = opts;
  const imagePatches: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      if (u.includes("/admin/model/image-fallback") && method === "GET") {
        return new Response(JSON.stringify({ model: imageFallback }));
      }
      if (u.includes("/admin/model/image-fallback") && method === "PATCH") {
        const body = JSON.parse(String(init?.body)) as { model: string };
        imagePatches.push(body.model);
        return new Response(JSON.stringify({ status: "updated" }));
      }
      return new Response(JSON.stringify({}));
    }),
  );
  return { imagePatches };
}

describe("ImageFallbackModelSection", () => {
  it("modelo de fallback de imagem carrega o valor salvo do backend", async () => {
    const [first] = getAllowedModels();
    stubFetch([], { imageFallback: first });

    render(<ImageFallbackModelSection />);

    await waitFor(() =>
      expect(
        screen.getByText("prefs_image_fallback_title"),
      ).toBeInTheDocument(),
    );
    expect(
      screen.getByText(getModelDisplayName(first) || first),
    ).toBeInTheDocument();
  });

  it("sem fallback configurado (edge), mostra a opção 'nenhum'", async () => {
    stubFetch([], { imageFallback: "" });

    render(<ImageFallbackModelSection />);

    await waitFor(() =>
      expect(screen.getByText("prefs_image_fallback_none")).toBeInTheDocument(),
    );
  });

  it("trocar o select do fallback de imagem persiste via PATCH", async () => {
    const [first, second] = getAllowedModels();
    const { imagePatches } = stubFetch([], { imageFallback: first });

    render(<ImageFallbackModelSection />);
    await waitFor(() =>
      expect(
        screen.getByText(getModelDisplayName(first) || first),
      ).toBeInTheDocument(),
    );

    const trigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(trigger);
    const option = await screen.findByRole("option", {
      name: getModelDisplayName(second) || second,
    });
    fireEvent.click(option);

    await waitFor(() => expect(imagePatches.at(-1)).toBe(second));
  });
});
