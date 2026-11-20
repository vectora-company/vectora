/**
 * Co-autores num commit são linhas `Co-authored-by: Nome <e-mail>` no final do
 * corpo da mensagem (trailers do git). Funções puras para ler e editar essas
 * linhas sem mexer no resto do texto.
 */

export interface CoAuthor {
  name: string;
  email: string;
}

const TRAILER_LINE = /^[A-Za-z][A-Za-z0-9-]*:\s/;
const CO_AUTHOR_LINE = /^co-authored-by:\s*(.*?)\s*<([^>]+)>\s*$/i;

export function coAuthorTrailer(person: CoAuthor): string {
  return `Co-authored-by: ${person.name} <${person.email}>`;
}

/** Co-autores já presentes no corpo, na ordem em que aparecem. */
export function parseCoAuthors(body: string): CoAuthor[] {
  const found: CoAuthor[] = [];
  for (const line of body.split("\n")) {
    const match = CO_AUTHOR_LINE.exec(line.trim());
    if (match) found.push({ name: match[1]!, email: match[2]! });
  }
  return found;
}

export function hasCoAuthor(body: string, email: string): boolean {
  const target = email.toLowerCase();
  return parseCoAuthors(body).some((a) => a.email.toLowerCase() === target);
}

/** Adiciona o trailer ao final do corpo, no bloco de trailers (sem duplicar). */
export function addCoAuthor(body: string, person: CoAuthor): string {
  if (hasCoAuthor(body, person.email)) return body;
  const trimmed = body.replace(/\s+$/, "");
  const trailer = coAuthorTrailer(person);
  if (!trimmed) return trailer;
  const paragraphs = trimmed.split(/\n{2,}/);
  const last = paragraphs[paragraphs.length - 1]!;
  const lastIsTrailerBlock =
    paragraphs.length > 1 &&
    last.split("\n").every((line) => TRAILER_LINE.test(line));
  // Um bloco de trailers existente recebe a linha; senão abre um bloco novo.
  return lastIsTrailerBlock
    ? `${trimmed}\n${trailer}`
    : `${trimmed}\n\n${trailer}`;
}

/** Remove o trailer da pessoa e limpa linhas em branco que sobrarem no fim. */
export function removeCoAuthor(body: string, email: string): string {
  const target = email.toLowerCase();
  const kept = body.split("\n").filter((line) => {
    const match = CO_AUTHOR_LINE.exec(line.trim());
    return !(match && match[2]!.toLowerCase() === target);
  });
  return kept.join("\n").replace(/\s+$/, "");
}
