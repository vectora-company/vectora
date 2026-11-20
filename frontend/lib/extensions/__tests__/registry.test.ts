import { describe, expect, it } from "vitest";
import {
  contributionPageUrl,
  fileIconFor,
  resolveContributions,
  type ExtensionContribution,
} from "../registry";

function item(
  overrides: Partial<ExtensionContribution> = {},
): ExtensionContribution {
  return {
    id: "demo.mode.studio",
    extension_id: "demo",
    kind: "mode",
    label: "Studio",
    entry: "studio.html",
    ...overrides,
  };
}

describe("resolveContributions", () => {
  it("ordena por extensão e id, não pela ordem de chegada", () => {
    const { accepted } = resolveContributions([
      item({ id: "zeta.mode.a", extension_id: "zeta" }),
      item({ id: "alfa.mode.b", extension_id: "alfa" }),
      item({ id: "alfa.mode.a", extension_id: "alfa" }),
    ]);

    expect(accepted.map((entry) => entry.id)).toEqual([
      "alfa.mode.a",
      "alfa.mode.b",
      "zeta.mode.a",
    ]);
  });

  it("em conflito de id a primeira vence e a outra volta em rejected", () => {
    const { accepted, rejected } = resolveContributions([
      item({ label: "Primeira" }),
      item({ label: "Segunda" }),
    ]);

    expect(accepted).toHaveLength(1);
    expect(accepted[0].label).toBe("Primeira");
    expect(rejected).toEqual([
      { id: "demo.mode.studio", reason: "duplicate_id" },
    ]);
  });

  it("recusa tipo desconhecido, página sem entry e ids dos controles nativos", () => {
    const { accepted, rejected } = resolveContributions([
      item({ id: "demo.alien.x", kind: "alien" as never }),
      item({ id: "demo.mode.sem-entry", entry: null }),
      item({ id: "demo.mode.assistant" }),
      item({ id: "demo.file_icon.md", kind: "file_icon", entry: null }),
    ]);

    expect(rejected.map((entry) => entry.reason).toSorted()).toEqual([
      "missing_entry",
      "reserved_id",
      "unknown_kind",
    ]);
    expect(accepted.map((entry) => entry.id)).toEqual(["demo.file_icon.md"]);
  });
});

describe("contributionPageUrl", () => {
  it("monta a URL do host escapando cada trecho", () => {
    expect(contributionPageUrl(item({ entry: "pages/a b.html" }))).toBe(
      "/extensions/demo/ui/pages/a%20b.html",
    );
  });

  it("devolve null sem entry", () => {
    expect(contributionPageUrl(item({ entry: null }))).toBeNull();
  });
});

describe("fileIconFor", () => {
  const icons = [
    item({
      id: "demo.file_icon.docs",
      kind: "file_icon",
      entry: null,
      icon: "file",
      file_extensions: ["MD", "mdx"],
    }),
  ];

  it("casa a extensão sem diferenciar maiúsculas", () => {
    expect(fileIconFor(icons, "README.md")?.id).toBe("demo.file_icon.docs");
    expect(fileIconFor(icons, "page.MDX")?.id).toBe("demo.file_icon.docs");
  });

  it("não casa arquivo sem extensão nem extensão alheia", () => {
    expect(fileIconFor(icons, "Makefile")).toBeNull();
    expect(fileIconFor(icons, "a.ts")).toBeNull();
  });
});
