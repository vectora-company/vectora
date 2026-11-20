import { describe, expect, it } from "vitest";

import {
  LAYOUT_TEMPLATES,
  snapRect,
  type LayoutZone,
} from "../window-geometry";

const view = { w: 1920, h: 1080 };
const min = { w: 320, h: 200 };
const current = { x: 300, y: 200, w: 800, h: 600 };

const zoneById = (id: string): LayoutZone =>
  LAYOUT_TEMPLATES.flatMap((template) => template.zones).find(
    (candidate) => candidate.id === id,
  )!;

describe("snapRect", () => {
  it("centralizar mantém o tamanho e centra na tela", () => {
    expect(snapRect("center", current, min, view)).toEqual({
      x: 560,
      y: 240,
      w: 800,
      h: 600,
    });
  });

  it("metades ocupam metade da tela, coladas no lado da zona", () => {
    expect(snapRect(zoneById("left"), current, min, view)).toEqual({
      x: 0,
      y: 0,
      w: 960,
      h: 1080,
    });
    expect(snapRect(zoneById("right"), current, min, view)).toEqual({
      x: 960,
      y: 0,
      w: 960,
      h: 1080,
    });
  });

  it("2/3 e 1/3 ocupam as proporções certas", () => {
    expect(snapRect(zoneById("left-wide"), current, min, view)).toEqual({
      x: 0,
      y: 0,
      w: 1280,
      h: 1080,
    });
    expect(snapRect(zoneById("right-narrow"), current, min, view)).toEqual({
      x: 1280,
      y: 0,
      w: 640,
      h: 1080,
    });
  });

  it("três colunas cobrem a tela sem sobrar nem faltar", () => {
    const rects = ["third-left", "third-center", "third-right"].map((id) =>
      snapRect(zoneById(id), current, min, view),
    );
    expect(rects.map((rect) => rect.x)).toEqual([0, 640, 1280]);
    expect(rects.every((rect) => rect.w === 640)).toBe(true);
  });

  it("quatro cantos ocupam um quarto cada", () => {
    expect(snapRect(zoneById("bottom-right"), current, min, view)).toEqual({
      x: 960,
      y: 540,
      w: 960,
      h: 540,
    });
    expect(snapRect(zoneById("top-left"), current, min, view)).toEqual({
      x: 0,
      y: 0,
      w: 960,
      h: 540,
    });
  });

  it("respeita o tamanho mínimo, colado ao lado da zona e dentro da tela", () => {
    expect(
      snapRect(
        zoneById("bottom-right"),
        current,
        { w: 400, h: 300 },
        { w: 500, h: 400 },
      ),
    ).toEqual({ x: 100, y: 100, w: 400, h: 300 });
  });

  it("respeita o tamanho máximo", () => {
    expect(
      snapRect(zoneById("left"), current, min, view, { w: 700, h: 900 }),
    ).toEqual({ x: 0, y: 0, w: 700, h: 900 });
  });

  it("nunca sai da tela, em nenhuma zona, nem com mínimo grande", () => {
    for (const template of LAYOUT_TEMPLATES)
      for (const candidate of template.zones) {
        const rect = snapRect(candidate, current, { w: 1200, h: 800 }, view);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.w).toBeLessThanOrEqual(view.w);
        expect(rect.y + rect.h).toBeLessThanOrEqual(view.h);
      }
  });
});

describe("LAYOUT_TEMPLATES", () => {
  it("são poucos modelos, com ids únicos", () => {
    expect(LAYOUT_TEMPLATES).toHaveLength(4);
    const ids = LAYOUT_TEMPLATES.flatMap((template) =>
      template.zones.map((candidate) => candidate.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("as zonas de cada modelo cobrem exatamente a tela", () => {
    for (const template of LAYOUT_TEMPLATES) {
      const area = template.zones.reduce(
        (sum, candidate) => sum + candidate.w * candidate.h,
        0,
      );
      expect(area).toBeCloseTo(1, 5);
    }
  });
});

describe("topo reservado (barra de título do Electron)", () => {
  const withBar = { w: 1920, h: 1080, top: 36 };

  it("zonas de cima começam abaixo da barra e a altura é só a área livre", () => {
    expect(snapRect(zoneById("top-left"), current, min, withBar)).toEqual({
      x: 0,
      y: 36,
      w: 960,
      h: 522,
    });
    expect(snapRect(zoneById("left"), current, min, withBar)).toEqual({
      x: 0,
      y: 36,
      w: 960,
      h: 1044,
    });
  });

  it("zonas de baixo continuam coladas na base", () => {
    expect(snapRect(zoneById("bottom-right"), current, min, withBar)).toEqual({
      x: 960,
      y: 558,
      w: 960,
      h: 522,
    });
  });

  it("centralizar centra na área livre", () => {
    expect(snapRect("center", current, min, withBar)).toEqual({
      x: 560,
      y: 258,
      w: 800,
      h: 600,
    });
  });
});
