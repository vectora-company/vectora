/**
 * Geometria das janelas flutuantes: mover e redimensionar por qualquer borda
 * ou canto, sempre dentro da área visível e respeitando o tamanho mínimo.
 */

export type ResizeDir = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Size {
  w: number;
  h: number;
}

/** Área visível; `top` reserva uma faixa no alto (barra de título do Electron). */
export interface Viewport extends Size {
  top?: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Move a janela mantendo-a inteira dentro da área visível. */
export function moveRect(
  start: Rect,
  dx: number,
  dy: number,
  viewport: Viewport,
): Rect {
  const top = viewport.top ?? 0;
  return {
    ...start,
    x: clamp(start.x + dx, 0, viewport.w - start.w),
    y: clamp(start.y + dy, top, viewport.h - start.h),
  };
}

/** Redimensiona a partir de uma borda ou canto; o lado oposto fica parado. */
export function resizeRect(
  start: Rect,
  dir: ResizeDir,
  dx: number,
  dy: number,
  min: Size,
  viewport: Viewport,
): Rect {
  const topLimit = viewport.top ?? 0;
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;

  if (dir.includes("e")) right = clamp(right + dx, left + min.w, viewport.w);
  if (dir.includes("w")) left = clamp(left + dx, 0, right - min.w);
  if (dir.includes("s")) bottom = clamp(bottom + dy, top + min.h, viewport.h);
  if (dir.includes("n")) top = clamp(top + dy, topLimit, bottom - min.h);

  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Traz de volta para a tela uma janela que ficou fora dela (monitor trocado). */
export function fitRectToViewport(
  rect: Rect,
  min: Size,
  viewport: Viewport,
): Rect {
  const top = viewport.top ?? 0;
  const w = clamp(rect.w, min.w, viewport.w);
  const h = clamp(rect.h, min.h, viewport.h - top);
  return {
    w,
    h,
    x: clamp(rect.x, 0, viewport.w - w),
    y: clamp(rect.y, top, viewport.h - h),
  };
}

/** Região da tela, em frações de 0 a 1 (como as zonas de um modelo de encaixe). */
export interface LayoutZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutTemplate {
  id: string;
  zones: LayoutZone[];
}

const zone = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): LayoutZone => ({ id, x, y, w, h });

/** Modelos de divisão oferecidos no menu de layout, no estilo do Windows 11. */
export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "halves",
    zones: [zone("left", 0, 0, 0.5, 1), zone("right", 0.5, 0, 0.5, 1)],
  },
  {
    id: "wide-narrow",
    zones: [
      zone("left-wide", 0, 0, 2 / 3, 1),
      zone("right-narrow", 2 / 3, 0, 1 / 3, 1),
    ],
  },
  {
    id: "thirds",
    zones: [
      zone("third-left", 0, 0, 1 / 3, 1),
      zone("third-center", 1 / 3, 0, 1 / 3, 1),
      zone("third-right", 2 / 3, 0, 1 / 3, 1),
    ],
  },
  {
    id: "quarters",
    zones: [
      zone("top-left", 0, 0, 0.5, 0.5),
      zone("top-right", 0.5, 0, 0.5, 0.5),
      zone("bottom-left", 0, 0.5, 0.5, 0.5),
      zone("bottom-right", 0.5, 0.5, 0.5, 0.5),
    ],
  },
];

/** Destino de um encaixe: uma zona de um modelo ou centralizar mantendo o tamanho. */
export type LayoutTarget = LayoutZone | "center";

/**
 * Posição e tamanho de um encaixe. Respeita o tamanho mínimo e o máximo: se a
 * zona for menor que o mínimo, a janela fica no mínimo, colada ao lado da
 * zona (direita/base quando a zona encosta nesses lados) e dentro da tela.
 */
export function snapRect(
  target: LayoutTarget,
  current: Rect,
  min: Size,
  viewport: Viewport,
  max: Size = { w: Number.POSITIVE_INFINITY, h: Number.POSITIVE_INFINITY },
): Rect {
  const top = viewport.top ?? 0;
  const availableH = viewport.h - top;
  const limitW = Math.min(max.w, viewport.w);
  const limitH = Math.min(max.h, availableH);
  if (target === "center") {
    const w = clamp(current.w, min.w, limitW);
    const h = clamp(current.h, min.h, limitH);
    return {
      w: Math.round(w),
      h: Math.round(h),
      x: Math.round((viewport.w - w) / 2),
      y: Math.round(top + (availableH - h) / 2),
    };
  }
  const w = clamp(viewport.w * target.w, min.w, limitW);
  const h = clamp(availableH * target.h, min.h, limitH);
  // Zona que começa no início do eixo fica colada nele; só as que começam
  // adiante e chegam ao fim (direita/base) ficam coladas ao fim.
  const x =
    target.x > 0 && target.x + target.w >= 1
      ? viewport.w - w
      : viewport.w * target.x;
  const y =
    target.y > 0 && target.y + target.h >= 1
      ? viewport.h - h
      : top + availableH * target.y;
  return {
    w: Math.round(w),
    h: Math.round(h),
    x: Math.round(clamp(x, 0, viewport.w - w)),
    y: Math.round(clamp(y, top, viewport.h - h)),
  };
}
