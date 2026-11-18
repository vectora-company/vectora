/**
 * Guarda de estilo das telas de Settings.
 *
 * As telas usam só tokens do tema e as primitivas de `../primitives`: nada de
 * hex arbitrário (`bg-[#1f1f1f]`), tamanho de texto em pixels (`text-[10px]`,
 * use `text-2xs`) nem cor crua do Tailwind (`text-green-500`; use
 * `text-success`, `text-warning`, `text-destructive`, `text-info`).
 *
 * O baseline abaixo lista o que ainda falta migrar, por arquivo, e só pode
 * diminuir: um arquivo novo ou com mais ocorrências reprova, e quando um
 * arquivo chega a menos que o baseline o teste pede para baixá-lo.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");

const PALETTE =
  "red|green|emerald|amber|orange|blue|purple|indigo|yellow|lime|teal|cyan|sky|violet|fuchsia|pink|rose|slate|gray|zinc|neutral|stone";
const UTILITIES =
  "bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|shadow|accent|caret";
const VIOLATION = new RegExp(
  `\\b(?:${UTILITIES})-\\[#[0-9a-fA-F]{3,8}\\]|\\btext-\\[\\d+(?:\\.\\d+)?px\\]|\\b(?:${UTILITIES})-(?:${PALETTE})-\\d{2,3}`,
  "g",
);

/** Arquivos ainda não migrados → ocorrências restantes. Só diminui. */
const BASELINE: Record<string, number> = {
  "about-panel.tsx": 2,
  "administracao/admin-tab.tsx": 29,
  "billing-panel.tsx": 2,
  "environment/tabs/connect-tab.tsx": 4,
  "environment/tabs/hitl-allowlist-panel.tsx": 2,
  "environment/tabs/integracoes-tab.tsx": 10,
  "environment/tabs/plugins-tab.tsx": 10,
  "environment/tabs/sandbox-tab.tsx": 21,
  "environment/tabs/skills-tab.tsx": 5,
  "environment/tabs/tool-policy-panel.tsx": 3,
  "preferencias/tabs/memoria-tab.tsx": 1,
  "preferencias/theme-picker.tsx": 2,
  "settings-overlay.tsx": 1,
};

function listTsx(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return name === "__tests__" ? [] : listTsx(path);
    }
    return name.endsWith(".tsx") ? [path] : [];
  });
}

const counts = new Map<string, number>();
for (const file of listTsx(ROOT)) {
  const found = readFileSync(file, "utf8").match(VIOLATION)?.length ?? 0;
  counts.set(relative(ROOT, file).replaceAll("\\", "/"), found);
}

describe("estilo das telas de Settings", () => {
  it("não aumenta o uso de hex, text-[Npx] e cores cruas do Tailwind", () => {
    const worse = [...counts]
      .filter(([file, n]) => n > (BASELINE[file] ?? 0))
      .map(([file, n]) => `${file}: ${n} (baseline ${BASELINE[file] ?? 0})`);
    expect(worse).toEqual([]);
  });

  it("o baseline só encolhe: baixe-o quando um arquivo for migrado", () => {
    const stale = Object.entries(BASELINE)
      .filter(([file, limit]) => (counts.get(file) ?? 0) < limit)
      .map(
        ([file, limit]) =>
          `${file}: baseline ${limit}, hoje ${counts.get(file) ?? 0}`,
      );
    expect(stale).toEqual([]);
  });

  it("AI Models e Provider Routing não têm nenhuma ocorrência", () => {
    expect(counts.get("environment/tabs/ai-models-tab.tsx")).toBe(0);
    expect(counts.get("environment/tabs/provider-routing-tab.tsx")).toBe(0);
    expect(counts.get("primitives.tsx")).toBe(0);
  });
});
