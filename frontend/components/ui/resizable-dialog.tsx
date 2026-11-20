"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Maximize2 as Maximize2Icon,
  Minimize2 as Minimize2Icon,
  Minus as MinusIcon,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { m } from "@/lib/paraglide/messages";
import { useDialogSizeStore } from "@/lib/stores/dialog-size-store";
import {
  moveRect,
  resizeRect,
  snapRect,
  type LayoutTarget,
  type Rect,
  type ResizeDir,
} from "@/lib/layout/window-geometry";
import { WindowLayoutMenu } from "@/components/ui/window-layout-menu";
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
  /**
   * `false` para confirmações curtas: mesma moldura, centralizado, largura
   * `defaultWidth` e altura pelo conteúdo, sem alças de redimensionar.
   */
  resizable?: boolean;
  /** Mostra o botão de minimizar; quem usa decide o que "minimizado" significa. */
  onMinimize?: () => void;
  /** Escondido sem desmontar: o conteúdo e o estado dele continuam vivos. */
  minimized?: boolean;
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
  resizable = true,
  onMinimize,
  minimized = false,
  onEscapeKeyDown,
  onInteractOutside,
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
  const [maximized, setMaximized] = React.useState(false);
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

  /** Mover/redimensionar: um gesto com ponteiro capturado, quadro a quadro. */
  const beginGesture = (
    event: React.PointerEvent<HTMLElement>,
    compute: (start: Rect, dx: number, dy: number) => Rect,
    mode: "move" | "resize" = "resize",
  ) => {
    if (maximized || event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const start = { ...liveRef.current };
    const originX = event.clientX;
    const originY = event.clientY;
    setGesturing(true);

    const onMove = (move: PointerEvent) => {
      const next = compute(
        start,
        move.clientX - originX,
        move.clientY - originY,
      );
      liveRef.current = next;
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = requestAnimationFrame(() => {
        // Mover só desloca por transform (sem relayout do editor); redimensionar
        // precisa de largura e altura novas.
        if (mode === "move" && frameRef.current) {
          frameRef.current.style.transform = `translate3d(${next.x - start.x}px, ${next.y - start.y}px, 0)`;
        } else paint(next);
      });
    };

    const finish = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
      cancelAnimationFrame(frameIdRef.current);
      const final = liveRef.current;
      if (frameRef.current) frameRef.current.style.transform = "";
      paint(final);
      setRect(final);
      setGesturing(false);
      if (storageKey) saveSize(storageKey, { w: final.w, h: final.h });
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
  };

  const startResize = (
    event: React.PointerEvent<HTMLElement>,
    dir: ResizeDir,
  ) => {
    const view = viewport();
    // O limite visual é a janela do app com margem; os máximos do chamador
    // continuam valendo para não estourar um tamanho razoável.
    beginGesture(event, (start, dx, dy) => {
      const next = resizeRect(
        start,
        dir,
        dx,
        dy,
        { w: minWidth, h: minHeight },
        {
          w: Math.max(
            Math.min(view.w - VIEWPORT_MARGIN, start.x + maxWidth),
            start.x + minWidth,
          ),
          h: Math.max(
            Math.min(view.h - VIEWPORT_MARGIN, start.y + maxHeight),
            start.y + minHeight,
          ),
        },
      );
      return {
        ...next,
        w: Math.min(next.w, maxWidth),
        h: Math.min(next.h, maxHeight),
      };
    });
  };

  /** Encaixa a janela (metade, canto ou centro) pelo menu de layout. */
  const applyLayout = (target: LayoutTarget) => {
    const next = snapRect(
      target,
      liveRef.current,
      { w: minWidth, h: minHeight },
      viewport(),
      { w: maxWidth, h: maxHeight },
    );
    setMaximized(false);
    liveRef.current = next;
    paint(next);
    setRect(next);
    if (storageKey) saveSize(storageKey, { w: next.w, h: next.h });
  };

  /** Arrastar pelo cabeçalho (ou por qualquer `data-window-handle`) move a janela. */
  const onFramePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    const target = event.target as Element;
    const handle = target.closest(
      '[data-slot="dialog-header"], [data-window-handle]',
    );
    if (!handle || !event.currentTarget.contains(handle)) return;
    if (target.closest("button, a, input, textarea, select, [role='tab']"))
      return;
    beginGesture(
      event,
      (start, dx, dy) => moveRect(start, dx, dy, viewport()),
      "move",
    );
  };

  const onHeaderDoubleClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as Element;
    if (
      target.closest('[data-slot="dialog-header"], [data-window-handle]') &&
      !target.closest("button, a, input, textarea, select")
    )
      setMaximized((value) => !value);
  };

  if (!resizable) {
    return (
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          data-slot="dialog-content"
          className={cn(
            "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "flex max-h-[calc(100vh-2rem)] flex-col rounded-lg border shadow-lg duration-150",
            className,
          )}
          style={{
            width: `min(${defaultWidth}px, calc(100vw - 2rem))`,
            ...style,
          }}
          {...props}
        >
          {children}
          {showCloseButton && (
            <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
              <XIcon />
              <span className="sr-only">{m.dialog_close()}</span>
            </DialogPrimitive.Close>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    );
  }

  const controlClass =
    "rounded-xs p-0.5 opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:outline-hidden [&_svg]:size-4";

  return (
    <DialogPrimitive.Portal>
      {!minimized && (
        <DialogPrimitive.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50" />
      )}
      <DialogPrimitive.Content
        data-slot="dialog-content"
        data-maximized={maximized}
        data-gesturing={gesturing}
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "fixed z-50 data-[gesturing=true]:will-change-[transform,width,height] data-[gesturing=true]:transition-none",
          "flex flex-col border shadow-lg duration-150 overflow-hidden",
          maximized ? "rounded-none" : "rounded-lg",
          "[&_[data-slot=dialog-header]]:select-none",
          !maximized && "[&_[data-slot=dialog-header]]:cursor-move",
          className,
        )}
        style={{
          ...(maximized
            ? { left: 0, top: 0, width: "100vw", height: "100vh" }
            : { left: rect.x, top: rect.y, width: rect.w, height: rect.h }),
          ...(minimized ? { display: "none" } : null),
          ...style,
        }}
        // Minimizado, o diálogo deixa de ser modal: clique fora e Esc não o fecham.
        onEscapeKeyDown={(event) => {
          if (minimized) event.preventDefault();
          onEscapeKeyDown?.(event);
        }}
        onInteractOutside={(event) => {
          if (minimized) event.preventDefault();
          onInteractOutside?.(event);
        }}
        onPointerDown={onFramePointerDown}
        onDoubleClick={onHeaderDoubleClick}
        {...props}
        ref={frameRef}
      >
        {children}

        <div className="absolute top-4 right-4 flex items-center gap-1.5">
          <WindowLayoutMenu onSelect={applyLayout} className={controlClass} />
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className={controlClass}
              aria-label={m.window_minimize()}
              title={m.window_minimize()}
            >
              <MinusIcon />
            </button>
          )}
          <button
            type="button"
            onClick={() => setMaximized((value) => !value)}
            className={controlClass}
            aria-label={maximized ? m.window_restore() : m.window_maximize()}
            title={maximized ? m.window_restore() : m.window_maximize()}
          >
            {maximized ? <Minimize2Icon /> : <Maximize2Icon />}
          </button>
          {showCloseButton && (
            <DialogPrimitive.Close
              className={cn(
                controlClass,
                "ring-offset-background focus:ring-ring",
              )}
            >
              <XIcon />
              <span className="sr-only">{m.dialog_close()}</span>
            </DialogPrimitive.Close>
          )}
        </div>

        {gesturing && (
          <div
            data-testid="dialog-gesture-shield"
            className="absolute inset-0 z-10"
          />
        )}

        {!maximized &&
          RESIZE_HANDLES.map(({ dir, className: handleClass }) => (
            <div
              key={dir}
              role="separator"
              aria-label={
                dir === "se"
                  ? m.dialog_resize()
                  : `${m.dialog_resize()} (${dir})`
              }
              data-testid={`dialog-resize-${dir}`}
              onPointerDown={(event) => {
                event.stopPropagation();
                startResize(event, dir);
              }}
              className={cn(
                "absolute z-20 touch-none select-none",
                handleClass,
              )}
            />
          ))}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
