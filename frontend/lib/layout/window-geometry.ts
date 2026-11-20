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

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max));

/** Move a janela mantendo-a inteira dentro da área visível. */
export function moveRect(
  start: Rect,
  dx: number,
  dy: number,
  viewport: Size,
): Rect {
  return {
    ...start,
    x: clamp(start.x + dx, 0, viewport.w - start.w),
    y: clamp(start.y + dy, 0, viewport.h - start.h),
  };
}

/** Redimensiona a partir de uma borda ou canto; o lado oposto fica parado. */
export function resizeRect(
  start: Rect,
  dir: ResizeDir,
  dx: number,
  dy: number,
  min: Size,
  viewport: Size,
): Rect {
  let left = start.x;
  let top = start.y;
  let right = start.x + start.w;
  let bottom = start.y + start.h;

  if (dir.includes("e")) right = clamp(right + dx, left + min.w, viewport.w);
  if (dir.includes("w")) left = clamp(left + dx, 0, right - min.w);
  if (dir.includes("s")) bottom = clamp(bottom + dy, top + min.h, viewport.h);
  if (dir.includes("n")) top = clamp(top + dy, 0, bottom - min.h);

  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Traz de volta para a tela uma janela que ficou fora dela (monitor trocado). */
export function fitRectToViewport(rect: Rect, min: Size, viewport: Size): Rect {
  const w = clamp(rect.w, min.w, viewport.w);
  const h = clamp(rect.h, min.h, viewport.h);
  return {
    w,
    h,
    x: clamp(rect.x, 0, viewport.w - w),
    y: clamp(rect.y, 0, viewport.h - h),
  };
}
