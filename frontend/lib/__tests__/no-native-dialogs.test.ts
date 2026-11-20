import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");

function sources(dir: string): string[] {
  const found: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "paraglide" || name === "__tests__")
      continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...sources(path));
    else if (/\.(tsx?|jsx?)$/.test(name) && !/\.test\./.test(name))
      found.push(path);
  }
  return found;
}

describe("diálogos nativos do navegador", () => {
  it("nenhum código do app usa window.confirm, alert ou prompt", () => {
    const offenders = ["components", "src", "lib"]
      .flatMap((dir) => sources(join(ROOT, dir)))
      .filter(
        (file) =>
          /\b(?:window\.)?(?:confirm|alert|prompt)\(/.test(
            readFileSync(file, "utf8").replace(/\bawait confirm\(/g, ""),
          ) &&
          /window\.(?:confirm|alert|prompt)\(|(?<![.\w])(?:alert|prompt)\(/.test(
            readFileSync(file, "utf8"),
          ),
      )
      .map((file) => file.replace(`${ROOT}/`, ""));

    expect(offenders).toEqual([]);
  });
});
