import { describe, expect, it } from "vitest";

import { formatDuration, formatDurationBetween } from "../format-duration";

/** Instante ISO de 19/11/2026 a partir de `HH:MM:SS`. */
const at = (time: string) => `2026-11-19T${time}Z`;

describe("formatDuration", () => {
  it.each([
    [0, "0s"],
    [999, "0s"],
    [42_000, "42s"],
    [59_999, "59s"],
    [60_000, "1m 0s"],
    [192_000, "3m 12s"],
    [3_599_000, "59m 59s"],
    [3_600_000, "1h 0m"],
    [3_720_000, "1h 2m"],
  ])("%d ms vira %s", (ms, expected) =>
    expect(formatDuration(ms)).toBe(expected),
  );

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "entrada inválida (%s) vira 0s",
    (ms) => expect(formatDuration(ms)).toBe("0s"),
  );
});

describe("formatDurationBetween", () => {
  it.each([
    ["10:00:00", "10:00:00", "0s"],
    ["10:00:00", "10:00:42", "42s"],
    ["10:00:00", "10:03:00", "3m"],
    ["10:00:00", "10:03:12", "3m 12s"],
    ["10:00:00", "11:02:30", "1h 2m"],
  ])("%s até %s vira %s", (start, end, expected) =>
    expect(formatDurationBetween(at(start), at(end))).toBe(expected),
  );

  it("sem uma das pontas não há duração (passo ainda em execução)", () => {
    expect(formatDurationBetween(at("10:00:00"), undefined)).toBe("");
    expect(formatDurationBetween(undefined, at("10:00:00"))).toBe("");
    expect(formatDurationBetween("", "")).toBe("");
  });

  it("data inválida ou fora de ordem não vira NaN", () => {
    expect(formatDurationBetween("lixo", at("10:00:00"))).toBe("");
    expect(formatDurationBetween(at("10:05:00"), at("10:00:00"))).toBe("");
  });
});
