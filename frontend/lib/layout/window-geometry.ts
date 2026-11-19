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

export type LayoutPreset =
  | "center"
  | "left"
  | "right"
  | "top"
  | "bottom"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/** Fração da tela (null = manter o tamanho atual) e âncora (0, 0,5 ou 1). */
const PRESETS: Record<
  LayoutPreset,
  { fw: number | null; fh: number | null; ax: number; ay: number }
> = {
  center: { fw: null, fh: null, ax: 0.5, ay: 0.5 },
  left: { fw: 0.5, fh: 1, ax: 0, ay: 0 },
  right: { fw: 0.5, fh: 1, ax: 1, ay: 0 },
  top: { fw: 1, fh: 0.5, ax: 0, ay: 0 },
  bottom: { fw: 1, fh: 0.5, ax: 0, ay: 1 },
  "top-left": { fw: 0.5, fh: 0.5, ax: 0, ay: 0 },
  "top-right": { fw: 0.5, fh: 0.5, ax: 1, ay: 0 },
  "bottom-left": { fw: 0.5, fh: 0.5, ax: 0, ay: 1 },
  "bottom-right": { fw: 0.5, fh: 0.5, ax: 1, ay: 1 },
};

/** Ordem de exibição na grade 3x3 do menu de layout. */
export const LAYOUT_GRID: LayoutPreset[] = [
  "top-left",
  "top",
  "top-right",
  "left",
  "center",
  "right",
  "bottom-left",
  "bottom",
  "bottom-right",
];

/**
 * Posição e tamanho de um encaixe (metade, quadrante ou centro). Respeita o
 * tamanho mínimo e o máximo: se a metade da tela for menor que o mínimo, a
 * janela fica no mínimo, ainda ancorada no lado pedido e dentro da tela.
 */
export function snapRect(
  preset: LayoutPreset,
  current: Rect,
  min: Size,
  viewport: Size,
  max: Size = { w: Number.POSITIVE_INFINITY, h: Number.POSITIVE_INFINITY },
): Rect {
  const { fw, fh, ax, ay } = PRESETS[preset];
  const w = clamp(
    fw === null ? current.w : viewport.w * fw,
    min.w,
    Math.min(max.w, viewport.w),
  );
  const h = clamp(
    fh === null ? current.h : viewport.h * fh,
    min.h,
    Math.min(max.h, viewport.h),
  );
  return {
    w: Math.round(w),
    h: Math.round(h),
    x: Math.round((viewport.w - w) * ax),
    y: Math.round((viewport.h - h) * ay),
  };
}
