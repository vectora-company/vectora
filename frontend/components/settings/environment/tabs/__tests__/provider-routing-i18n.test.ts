import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../provider-routing-tab.tsx"),
  "utf8",
);

describe("provider-routing-tab: textos e confirmações", () => {
  it("não usa window.confirm", () => {
    expect(source).not.toContain("window.confirm");
  });

  it("mostra erros só por mensagens i18n", () => {
    const fixed = [
      ...source.matchAll(/(?:setError\(|throw new Error\()\s*"([^"]+)"/g),
    ].map((match) => match[1]);
    expect(fixed).toEqual([]);
  });

  it("não deixa frase fixa em português nos ternários de erro", () => {
    const fixed = [
      ...source.matchAll(/:\s*"((?:Não|Falha|Erro|Nenhum)[^"]*)"/g),
    ].map((match) => match[1]);
    expect(fixed).toEqual([]);
  });
});
