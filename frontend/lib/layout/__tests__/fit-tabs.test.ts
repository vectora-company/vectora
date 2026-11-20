import { describe, expect, it } from "vitest";

import { fitTabs } from "../fit-tabs";

const widths = [80, 70, 60, 50, 90]; // total 350
const more = 40;

describe("fitTabs", () => {
  it("mostra todas quando cabem", () => {
    expect(fitTabs(widths, 400, more, 0)).toEqual({
      visible: [0, 1, 2, 3, 4],
      overflow: [],
    });
  });

  it("sem medida (largura 0) mostra todas em vez de esconder tudo", () => {
    expect(fitTabs(widths, 0, more, 0).overflow).toEqual([]);
  });

  it("manda para o menu as que não cabem, reservando espaço para o botão Mais", () => {
    // 250 - 40 = 210: cabem 80+70+60 = 210.
    expect(fitTabs(widths, 250, more, 0)).toEqual({
      visible: [0, 1, 2],
      overflow: [3, 4],
    });
  });

  it("a aba ativa nunca fica escondida: entra no lugar das últimas visíveis", () => {
    // Ativa = 4 (90). budget 210: tira 2 e 1 até caber 80 + 90 = 170 <= 210.
    expect(fitTabs(widths, 250, more, 4)).toEqual({
      visible: [0, 4],
      overflow: [1, 2, 3],
    });
  });

  it("a ativa já visível não muda nada", () => {
    expect(fitTabs(widths, 250, more, 1).visible).toEqual([0, 1, 2]);
  });

  it("com muito pouco espaço ainda mostra pelo menos a ativa", () => {
    const result = fitTabs(widths, 100, more, 3);
    expect(result.visible).toEqual([3]);
    expect(result.overflow).toEqual([0, 1, 2, 4]);
  });

  it("nenhuma aba some nem se repete", () => {
    for (let available = 50; available <= 400; available += 10)
      for (let active = 0; active < widths.length; active++) {
        const { visible, overflow } = fitTabs(widths, available, more, active);
        expect([...visible, ...overflow].toSorted((a, b) => a - b)).toEqual([
          0, 1, 2, 3, 4,
        ]);
        expect(visible).toContain(active);
      }
  });
});
