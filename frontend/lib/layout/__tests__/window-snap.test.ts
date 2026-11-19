import { describe, expect, it } from "vitest";

import { LAYOUT_GRID, snapRect } from "../window-geometry";

const view = { w: 1920, h: 1080 };
const min = { w: 320, h: 200 };
const current = { x: 300, y: 200, w: 800, h: 600 };

describe("snapRect", () => {
  it("centralizar mantém o tamanho e centra na tela", () => {
    expect(snapRect("center", current, min, view)).toEqual({
      x: 560,
      y: 240,
      w: 800,
      h: 600,
    });
  });

  it("metades ocupam metade da tela, coladas no lado pedido", () => {
    expect(snapRect("left", current, min, view)).toEqual({
      x: 0,
      y: 0,
      w: 960,
      h: 1080,
    });
    expect(snapRect("right", current, min, view)).toEqual({
      x: 960,
      y: 0,
      w: 960,
      h: 1080,
    });
    expect(snapRect("top", current, min, view)).toEqual({
      x: 0,
      y: 0,
      w: 1920,
      h: 540,
    });
    expect(snapRect("bottom", current, min, view)).toEqual({
      x: 0,
      y: 540,
      w: 1920,
      h: 540,
    });
  });

  it("quadrantes ocupam um quarto, cada um no seu canto", () => {
    expect(snapRect("top-left", current, min, view)).toEqual({
      x: 0,
      y: 0,
      w: 960,
      h: 540,
    });
    expect(snapRect("top-right", current, min, view)).toEqual({
      x: 960,
      y: 0,
      w: 960,
      h: 540,
    });
    expect(snapRect("bottom-left", current, min, view)).toEqual({
      x: 0,
      y: 540,
      w: 960,
      h: 540,
    });
    expect(snapRect("bottom-right", current, min, view)).toEqual({
      x: 960,
      y: 540,
      w: 960,
      h: 540,
    });
  });

  it("respeita o tamanho mínimo e continua ancorado e dentro da tela", () => {
    const small = { w: 500, h: 400 };
    expect(
      snapRect("bottom-right", current, { w: 400, h: 300 }, small),
    ).toEqual({ x: 100, y: 100, w: 400, h: 300 });
  });

  it("respeita o tamanho máximo", () => {
    expect(snapRect("left", current, min, view, { w: 700, h: 900 })).toEqual({
      x: 0,
      y: 0,
      w: 700,
      h: 900,
    });
  });

  it("nunca sai da tela, em nenhum encaixe, nem com mínimo grande", () => {
    for (const preset of LAYOUT_GRID) {
      const rect = snapRect(preset, current, { w: 1200, h: 800 }, view);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(view.w);
      expect(rect.y + rect.h).toBeLessThanOrEqual(view.h);
    }
  });

  it("a grade tem os nove encaixes, uma vez cada", () => {
    expect(new Set(LAYOUT_GRID).size).toBe(9);
    expect(LAYOUT_GRID[4]).toBe("center");
  });
});
