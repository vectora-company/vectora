import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "../format-relative-time";

const NOW = Date.parse("2026-11-19T12:00:00Z");
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe("formatRelativeTime", () => {
  it("menos de ~45 s é 'agora há pouco' (null)", () => {
    expect(formatRelativeTime(ago(0), NOW)).toBeNull();
    expect(formatRelativeTime(ago(44), NOW)).toBeNull();
  });

  it("escolhe a maior unidade que cabe", () => {
    expect(formatRelativeTime(ago(60), NOW)).toMatch(/1/);
    expect(formatRelativeTime(ago(5 * 60), NOW)).toMatch(/5/);
    expect(formatRelativeTime(ago(3 * 3600), NOW)).toMatch(/3/);
    expect(formatRelativeTime(ago(2 * 24 * 3600), NOW)).toMatch(/2/);
    expect(formatRelativeTime(ago(14 * 24 * 3600), NOW)).toMatch(/2/);
    expect(formatRelativeTime(ago(400 * 24 * 3600), NOW)).toMatch(/1/);
  });

  it("não troca de unidade antes da hora (59 min continua em minutos)", () => {
    const text = formatRelativeTime(ago(59 * 60), NOW)!;
    expect(text).toMatch(/59/);
  });

  it("o mesmo instante dá o mesmo texto para qualquer linha (now é compartilhado)", () => {
    expect(formatRelativeTime(ago(600), NOW)).toBe(
      formatRelativeTime(ago(600), NOW),
    );
  });

  it("datas no futuro também funcionam", () => {
    const future = new Date(NOW + 5 * 60 * 1000).toISOString();
    expect(formatRelativeTime(future, NOW)).toMatch(/5/);
  });

  it("data inválida devolve null em vez de NaN", () => {
    expect(formatRelativeTime("lixo", NOW)).toBeNull();
    expect(formatRelativeTime("", NOW)).toBeNull();
  });
});
