"use client";

/**
 * FloatingFrame — moldura de janela flutuante: mover pela barra de título,
 * redimensionar por qualquer borda ou canto (8 alças), maximizar/restaurar
 * (botão e duplo clique na barra) e manter a janela dentro da tela.
 *
 * Durante o gesto a geometria é aplicada direto no elemento (um quadro por
 * `requestAnimationFrame`, sem renderizar React nem tocar na store); a store
 * só recebe o resultado ao soltar. Um escudo transparente cobre o conteúdo
 * (editor, iframes) enquanto o ponteiro está capturado.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { Maximize2, Minimize2, Minus, X } from "lucide-react";

import { WindowLayoutMenu } from "@/components/ui/window-layout-menu";
import { RESIZE_HANDLES } from "@/lib/layout/window-handles";
import { m } from "@/lib/paraglide/messages";
import { cn } from "@/lib/utils";
import {
  fitRectToViewport,
  moveRect,
  resizeRect,
  snapRect,
  type LayoutTarget,
  type Rect,
  type ResizeDir,
} from "@/lib/layout/window-geometry";

const MIN_SIZE = { w: 320, h: 200 };

interface FloatingFrameProps {
  rect: Rect;
  zIndex: number;
  title: string;
  titleHint?: string;
  onFocus: () => void;
  onBoundsChange: (rect: Rect) => void;
  onMinimize: () => void;
  onClose: () => void;
  children: ReactNode;
  /** Faixa entre a barra de título e o conteúdo (abas). */
  subHeader?: ReactNode;
}

const viewportSize = () => ({ w: window.innerWidth, h: window.innerHeight });

export function FloatingFrame({
  rect,
  zIndex,
  title,
  titleHint,
  onFocus,
  onBoundsChange,
  onMinimize,
  onClose,
  children,
  subHeader,
}: FloatingFrameProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [maximized, setMaximized] = useState(false);
  const [gesturing, setGesturing] = useState(false);
  const liveRef = useRef<Rect>(rect);
  const frameIdRef = useRef(0);

  const apply = useCallback((next: Rect) => {
    liveRef.current = next;
    cancelAnimationFrame(frameIdRef.current);
    frameIdRef.current = requestAnimationFrame(() => {
      const el = frameRef.current;
      if (!el) return;
      el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      el.style.width = `${next.w}px`;
      el.style.height = `${next.h}px`;
    });
  }, []);

  // Mantém o elemento em sincronia com a store fora de um gesto e traz de
  // volta para a tela uma janela salva em outro monitor ou tamanho de janela.
  useEffect(() => {
    const fitted = fitRectToViewport(rect, MIN_SIZE, viewportSize());
    apply(fitted);
    if (
      fitted.x !== rect.x ||
      fitted.y !== rect.y ||
      fitted.w !== rect.w ||
      fitted.h !== rect.h
    ) {
      onBoundsChange(fitted);
    }
    // oxlint-disable-next-line react/exhaustive-deps
  }, [rect.x, rect.y, rect.w, rect.h, apply]);

  useEffect(() => () => cancelAnimationFrame(frameIdRef.current), []);

  const startGesture = (
    event: ReactPointerEvent<HTMLElement>,
    compute: (start: Rect, dx: number, dy: number) => Rect,
  ) => {
    if (maximized || event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const start = { ...liveRef.current };
    const originX = event.clientX;
    const originY = event.clientY;
    setGesturing(true);

    const onMove = (move: PointerEvent) =>
      apply(compute(start, move.clientX - originX, move.clientY - originY));

    const finish = () => {
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
      setGesturing(false);
      onBoundsChange(liveRef.current);
    };

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", finish);
    target.addEventListener("pointercancel", finish);
  };

  const applyLayout = (target: LayoutTarget) => {
    const next = snapRect(target, liveRef.current, MIN_SIZE, viewportSize());
    setMaximized(false);
    apply(next);
    onBoundsChange(next);
  };

  const startMove = (event: ReactPointerEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest("button")) return;
    startGesture(event, (start, dx, dy) =>
      moveRect(start, dx, dy, viewportSize()),
    );
  };

  const startResize = (event: ReactPointerEvent<HTMLElement>, dir: ResizeDir) =>
    startGesture(event, (start, dx, dy) =>
      resizeRect(start, dir, dx, dy, MIN_SIZE, viewportSize()),
    );

  return (
    <div
      ref={frameRef}
      data-testid="floating-frame"
      data-maximized={maximized}
      onPointerDown={onFocus}
      style={
        maximized
          ? { zIndex, transform: "none", width: "100%", height: "100%" }
          : {
              zIndex,
              transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
              width: rect.w,
              height: rect.h,
            }
      }
      className="pointer-events-auto absolute left-0 top-0 will-change-transform"
    >
      <div
        className={cn(
          "flex h-full flex-col overflow-hidden border border-border bg-sidebar shadow-2xl",
          maximized ? "rounded-none" : "rounded-lg",
        )}
      >
        <div
          data-testid="window-title-bar"
          onPointerDown={startMove}
          onDoubleClick={() => setMaximized((value) => !value)}
          className={cn(
            "flex h-8 shrink-0 select-none items-center gap-2 border-b border-border/60 bg-muted/40 px-2 touch-none",
            maximized ? "cursor-default" : "cursor-move",
          )}
        >
          <span
            className="flex-1 truncate text-xs font-medium"
            title={titleHint}
          >
            {title}
          </span>
          <WindowLayoutMenu
            onSelect={applyLayout}
            className="rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground [&_svg]:h-3.5 [&_svg]:w-3.5"
          />
          <button
            type="button"
            onClick={onMinimize}
            className="rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            aria-label={m.window_minimize()}
            title={m.window_minimize()}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMaximized((value) => !value)}
            className="rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            aria-label={maximized ? m.window_restore() : m.window_maximize()}
            title={maximized ? m.window_restore() : m.window_maximize()}
          >
            {maximized ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted/60 hover:text-destructive"
            aria-label={m.window_close()}
            title={m.window_close()}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {subHeader}
        <div className="relative min-h-0 flex-1 bg-background">
          {children}
          {gesturing && (
            <div
              data-testid="window-gesture-shield"
              className="absolute inset-0 z-10"
            />
          )}
        </div>
      </div>
      {!maximized &&
        RESIZE_HANDLES.map(({ dir, className }) => (
          <div
            key={dir}
            data-testid={`window-resize-${dir}`}
            onPointerDown={(event) => startResize(event, dir)}
            className={cn("absolute z-20 touch-none", className)}
          />
        ))}
    </div>
  );
}
