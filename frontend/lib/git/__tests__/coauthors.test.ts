import { describe, expect, it } from "vitest";

import {
  addCoAuthor,
  coAuthorTrailer,
  hasCoAuthor,
  parseCoAuthors,
  removeCoAuthor,
} from "../coauthors";

const ana = { name: "Ana Souza", email: "ana@example.com" };
const bruno = { name: "Bruno", email: "1+bruno@users.noreply.github.com" };

describe("coAuthorTrailer", () => {
  it("usa o formato que o GitHub reconhece", () => {
    expect(coAuthorTrailer(ana)).toBe(
      "Co-authored-by: Ana Souza <ana@example.com>",
    );
  });
});

describe("addCoAuthor", () => {
  it("corpo vazio vira só o trailer", () => {
    expect(addCoAuthor("", ana)).toBe(coAuthorTrailer(ana));
  });

  it("separa o trailer do texto por uma linha em branco", () => {
    expect(addCoAuthor("Corrige o bug.", ana)).toBe(
      "Corrige o bug.\n\nCo-authored-by: Ana Souza <ana@example.com>",
    );
  });

  it("junta o segundo co-autor ao mesmo bloco de trailers", () => {
    const once = addCoAuthor("Texto.", ana);

    expect(addCoAuthor(once, bruno)).toBe(
      "Texto.\n\nCo-authored-by: Ana Souza <ana@example.com>\nCo-authored-by: Bruno <1+bruno@users.noreply.github.com>",
    );
  });

  it("não duplica a mesma pessoa, mesmo com outra caixa no e-mail", () => {
    const once = addCoAuthor("Texto.", ana);

    expect(addCoAuthor(once, { ...ana, email: "ANA@example.com" })).toBe(once);
  });

  it("ignora espaços e quebras no fim do corpo", () => {
    expect(addCoAuthor("Texto.\n\n\n", ana)).toBe(
      "Texto.\n\nCo-authored-by: Ana Souza <ana@example.com>",
    );
  });

  it("acrescenta ao bloco de trailers que já existe (Signed-off-by)", () => {
    const body = "Texto.\n\nSigned-off-by: Eu <eu@x.com>";

    expect(addCoAuthor(body, ana)).toBe(
      "Texto.\n\nSigned-off-by: Eu <eu@x.com>\nCo-authored-by: Ana Souza <ana@example.com>",
    );
  });
});

describe("removeCoAuthor", () => {
  it("remove só a pessoa pedida e deixa o resto", () => {
    let body = addCoAuthor("Texto.", ana);
    body = addCoAuthor(body, bruno);

    expect(removeCoAuthor(body, "ANA@example.com")).toBe(
      "Texto.\n\nCo-authored-by: Bruno <1+bruno@users.noreply.github.com>",
    );
  });

  it("sem trailers sobrando, não deixa linhas em branco no fim", () => {
    const body = addCoAuthor("Texto.", ana);

    expect(removeCoAuthor(body, ana.email)).toBe("Texto.");
  });

  it("corpo sem o co-autor fica igual", () => {
    expect(removeCoAuthor("Texto.", ana.email)).toBe("Texto.");
  });
});

describe("parseCoAuthors / hasCoAuthor", () => {
  const body =
    "Texto.\n\nCo-authored-by: Ana Souza <ana@example.com>\nco-authored-by: Bruno <b@x.com>";

  it("lê todos os co-autores, ignorando a caixa da chave", () => {
    expect(parseCoAuthors(body)).toEqual([
      { name: "Ana Souza", email: "ana@example.com" },
      { name: "Bruno", email: "b@x.com" },
    ]);
  });

  it("hasCoAuthor compara o e-mail sem diferenciar caixa", () => {
    expect(hasCoAuthor(body, "ANA@EXAMPLE.COM")).toBe(true);
    expect(hasCoAuthor(body, "outro@x.com")).toBe(false);
  });

  it("linhas parecidas que não são trailer não contam", () => {
    expect(parseCoAuthors("Co-authored-by sem formato\nNota: x")).toEqual([]);
  });
});
