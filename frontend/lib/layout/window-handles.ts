import type { ResizeDir } from "./window-geometry";

/** Alças de redimensionar: 4 bordas e 4 cantos, posicionadas por classe. */
export const RESIZE_HANDLES: { dir: ResizeDir; className: string }[] = [
  { dir: "n", className: "left-2 right-2 top-0 h-1.5 cursor-ns-resize" },
  { dir: "s", className: "left-2 right-2 bottom-0 h-1.5 cursor-ns-resize" },
  { dir: "e", className: "top-2 bottom-2 right-0 w-1.5 cursor-ew-resize" },
  { dir: "w", className: "top-2 bottom-2 left-0 w-1.5 cursor-ew-resize" },
  { dir: "nw", className: "left-0 top-0 size-3 cursor-nwse-resize" },
  { dir: "ne", className: "right-0 top-0 size-3 cursor-nesw-resize" },
  { dir: "sw", className: "bottom-0 left-0 size-3 cursor-nesw-resize" },
  { dir: "se", className: "bottom-0 right-0 size-3 cursor-nwse-resize" },
];
