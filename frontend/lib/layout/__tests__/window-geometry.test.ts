import { describe, expect, it } from "vitest";

import {
  fitRectToViewport,
  moveRect,
  resizeRect,
  type Rect,
} from "../window-geometry";

const viewport = { w: 1000, h: 700 };
const min = { w: 280, h: 180 };
const start: Rect = { x: 200, y: 100, w: 400, h: 300 };

describe("moveRect", () => {
  it("move livremente dentro da tela", () => {
    expect(moveRect(start, 50, -20, viewport)).toEqual({
      x: 250,
      y: 80,
      w: 400,
      h: 300,
    });
  });

  it("não deixa a janela sair da tela", () => {
    expect(moveRect(start, -999, -999, viewport)).toMatchObject({ x: 0, y: 0 });
    expect(moveRect(start, 999, 999, viewport)).toMatchObject({
      x: 600,
      y: 400,
    });
  });
});

describe("resizeRect", () => {
  it("a borda de baixo muda só a altura (o bug em que a altura não mexia)", () => {
    expect(resizeRect(start, "s", 0, 80, min, viewport)).toEqual({
      x: 200,
      y: 100,
      w: 400,
      h: 380,
    });
  });

  it("a borda de cima move o topo e mantém a base parada", () => {
    expect(resizeRect(start, "n", 0, -50, min, viewport)).toEqual({
      x: 200,
      y: 50,
      w: 400,
      h: 350,
    });
  });

  it("a borda da esquerda mantém a direita parada", () => {
    expect(resizeRect(start, "w", -100, 0, min, viewport)).toEqual({
      x: 100,
      y: 100,
      w: 500,
      h: 300,
    });
  });

  it("cantos combinam as duas direções", () => {
    expect(resizeRect(start, "se", 100, 100, min, viewport)).toEqual({
      x: 200,
      y: 100,
      w: 500,
      h: 400,
    });
    expect(resizeRect(start, "nw", -100, -50, min, viewport)).toEqual({
      x: 100,
      y: 50,
      w: 500,
      h: 350,
    });
  });

  it("respeita o tamanho mínimo sem empurrar o lado oposto", () => {
    expect(resizeRect(start, "w", 999, 0, min, viewport)).toEqual({
      x: 320,
      y: 100,
      w: 280,
      h: 300,
    });
    expect(resizeRect(start, "n", 0, 999, min, viewport)).toEqual({
      x: 200,
      y: 220,
      w: 400,
      h: 180,
    });
  });

  it("não ultrapassa a área visível", () => {
    expect(resizeRect(start, "se", 9999, 9999, min, viewport)).toEqual({
      x: 200,
      y: 100,
      w: 800,
      h: 600,
    });
    expect(resizeRect(start, "nw", -9999, -9999, min, viewport)).toEqual({
      x: 0,
      y: 0,
      w: 600,
      h: 400,
    });
  });
});

describe("fitRectToViewport", () => {
  it("não mexe numa janela que cabe", () => {
    expect(fitRectToViewport(start, min, viewport)).toEqual(start);
  });

  it("encolhe e reposiciona uma janela maior ou fora da tela", () => {
    expect(
      fitRectToViewport({ x: 900, y: 650, w: 1400, h: 900 }, min, viewport),
    ).toEqual({ x: 0, y: 0, w: 1000, h: 700 });
  });
});

describe("topo reservado", () => {
  const withBar = { w: 1000, h: 700, top: 36 };

  it("mover não sobe além da barra de título", () => {
    expect(moveRect(start, 0, -999, withBar).y).toBe(36);
  });

  it("redimensionar pela borda de cima para na barra de título", () => {
    expect(resizeRect(start, "n", 0, -999, min, withBar).y).toBe(36);
  });

  it("uma janela salva por cima da barra volta para baixo dela", () => {
    expect(
      fitRectToViewport({ x: 0, y: 0, w: 400, h: 300 }, min, withBar).y,
    ).toBe(36);
    expect(
      fitRectToViewport({ x: 0, y: 0, w: 400, h: 900 }, min, withBar).h,
    ).toBe(664);
  });
});
