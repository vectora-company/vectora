/**
 * Decide quais abas cabem numa linha e quais vão para o menu "Mais" (como no
 * GitHub Desktop). A aba ativa nunca fica escondida: se ela não coube, entra
 * no lugar da última que coube.
 */
export interface FitTabsResult {
  /** Índices das abas visíveis, na ordem original. */
  visible: number[];
  /** Índices das abas que foram para o menu, na ordem original. */
  overflow: number[];
}

export function fitTabs(
  widths: number[],
  available: number,
  moreWidth: number,
  activeIndex: number,
): FitTabsResult {
  const all = widths.map((_, index) => index);
  const total = widths.reduce((sum, width) => sum + width, 0);
  // Sem medida ainda (primeiro render, jsdom) ou tudo cabe: mostra todas.
  if (available <= 0 || total <= available)
    return { visible: all, overflow: [] };

  const budget = Math.max(0, available - moreWidth);
  const visible: number[] = [];
  let used = 0;
  for (const index of all) {
    if (used + widths[index]! > budget) break;
    visible.push(index);
    used += widths[index]!;
  }

  if (activeIndex >= 0 && !visible.includes(activeIndex)) {
    // Abre espaço para a ativa tirando as últimas visíveis até ela caber.
    while (visible.length > 0 && used + widths[activeIndex]! > budget) {
      used -= widths[visible.pop()!]!;
    }
    visible.push(activeIndex);
    visible.sort((a, b) => a - b);
  }

  return { visible, overflow: all.filter((index) => !visible.includes(index)) };
}
