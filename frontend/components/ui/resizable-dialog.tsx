"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { m } from "@/lib/paraglide/messages";
import { useDialogSizeStore } from "@/lib/stores/dialog-size-store";
import {
  resizeRect,
  type Rect,
  type ResizeDir,
} from "@/lib/layout/window-geometry";
import { RESIZE_HANDLES } from "@/lib/layout/window-handles";

/** Margem mantida entre o diálogo e a borda da janela do app. */
const VIEWPORT_MARGIN = 16;

interface ResizableDialogContentProps extends React.ComponentProps<
  typeof DialogPrimitive.Content
> {
  defaultWidth?: number;
  defaultHeight?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  showCloseButton?: boolean;
  /** Chave para persistir o tamanho no Zustand. Se omitido, não persiste. */
  storageKey?: string;
}

const viewport = () => ({ w: window.innerWidth, h: window.innerHeight });

function centeredRect(
  size: { w: number; h: number },
  limits: { minW: number; minH: number; maxW: number; maxH: number },
): Rect {
  const view = viewport();
  const w = Math.min(
    Math.max(size.w, limits.minW),
    limits.maxW,
    view.w - VIEWPORT_MARGIN * 2,
  );
  const h = Math.min(
    Math.max(size.h, limits.minH),
    limits.maxH,
    view.h - VIEWPORT_MARGIN * 2,
  );
  return {
    w,
    h,
    x: Math.round((view.w - w) / 2),
    y: Math.round((view.h - h) / 2),
  };
}

/**
 * Diálogo redimensionável por qualquer borda ou canto. Ancorado no canto
 * superior esquerdo (e não no centro), de modo que o canto arrastado segue o
 * ponteiro; durante o gesto a geometria vai direto para o elemento, um quadro
 * por vez, e o React só recebe o resultado ao soltar.
 */
export function ResizableDialogContent({
  className,
  children,
  defaultWidth = 560,
  defaultHeight = 460,
  minWidth = 340,
  minHeight = 280,
  maxWidth = Number.POSITIVE_INFINITY,
  maxHeight = Number.POSITIVE_INFINITY,
  showCloseButton = true,
  storageKey,
  style,
  ...props
}: ResizableDialogContentProps) {
  const getSize = useDialogSizeStore((s) => s.getSize);
  const saveSize = useDialogSizeStore((s) => s.setSize);
  const limits = {
    minW: minWidth,
    minH: minHeight,
    maxW: maxWidth,
    maxH: maxHeight,
  };

  const [rect, setRect] = React.useState<Rect>(() =>
    centeredRect(
      storageKey
        ? getSize(storageKey, { w: defaultWidth, h: defaultHeight })
        : { w: defaultWidth, h: defaultHeight },
      limits,
    ),
  );
  const [gesturing, setGesturing] = React.useState(false);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const liveRef = React.useRef<Rect>(rect);
  const frameIdRef = React.useRef(0);

  React.useEffect(() => () => cancelAnimationFrame(frameIdRef.current), []);

  const paint = (next: Rect) => {
    const el = frameRef.current;
    if (!el) return;
    el.style.left = `${next.x}px`;
    el.style.top = `${next.y}px`;
    el.style.width = `${next.w}px`;
    el.style.height = `${next.h}px`;
  };

  const startResize = (
    event: React.PointerEvent<HTMLElement>,
    dir: ResizeDir,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const start = { ...liveRef.current };
    const originX = event.clientX;
    const originY = event.clientY;
    const view = viewport();
    // O limite visual é a janela do app com margem; os máximos do chamador
    // continuam valendo para não estourar um tamanho razoável.
    const bound = {
      w: Math.min(view.w - VIEWPORT_MARGIN, start.x + maxWidth),
      h: Math.min(view.h - VIEWPORT_MARGIN, start.y + maxHeight),
    };
    setGesturing(true);

    const compute = (dx: number, dy: number) => {
      const next = resizeRect(
        start,
        dir,
        dx,
        dy,
        { w: minWidth, h: minHeight },
        {
          w: Math.max(bound.w, start.x + minWidth),
          h: Math.max(bound.h, start.y + minHeight),
        },
      );
      return {
        ...next,
        w: Math.min(next.w, maxWidth),
        h: Math.min(next.h, maxHeight),
      };
    };

    const onMove = (move: PointerEvent) => {
      const next = compute(move.clientX - originX, move.clientY - originY);
      liveRef.current = next;
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = requestAnimationFrame(() => paint(next));
    };

    const finish = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
      cancelAnimationFrame(frameIdRef.current);
      const final = liveRef.current;
      paint(final);
      setRect(final);
      setGesturing(false);
      if (storageKey) saveSize(storageKey, { w: final.w, h: final.h });
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "fixed z-50",
          "flex flex-col rounded-lg border shadow-lg duration-150 overflow-hidden",
          className,
        )}
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.w,
          height: rect.h,
          ...style,
        }}
        {...props}
        ref={frameRef}
      >
        {children}

        {showCloseButton && (
          <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
            <XIcon />
            <span className="sr-only">{m.dialog_close()}</span>
          </DialogPrimitive.Close>
        )}

        {gesturing && (
          <div
            data-testid="dialog-gesture-shield"
            className="absolute inset-0 z-10"
          />
        )}

        {RESIZE_HANDLES.map(({ dir, className: handleClass }) => (
          <div
            key={dir}
            role="separator"
            aria-label={
              dir === "se" ? m.dialog_resize() : `${m.dialog_resize()} (${dir})`
            }
            data-testid={`dialog-resize-${dir}`}
            onPointerDown={(event) => startResize(event, dir)}
            className={cn("absolute z-20 touch-none select-none", handleClass)}
          />
        ))}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
